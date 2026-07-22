import {
  copilotConversationsTable,
  copilotMemoriesTable,
  copilotMessagesTable,
  db,
  type CopilotCitationData,
  type CopilotContextSnapshotData,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";

import { portfolioService } from "../portfolio/portfolioService";
import { researchService } from "../research/researchService";
import {
  generateOfflineAnswer,
  inferMode,
  inferTickers,
  normalizeTicker,
  sanitizeGeneratedAnswer,
  type CopilotMemoryCategory,
  type CopilotMode,
  type GeneratedCopilotAnswer,
  type GroundingSource,
  type PortfolioContextPayload,
  type ResearchContextPayload,
} from "./grounding";
import {
  openAIResponsesProvider,
  type GenerateResult,
} from "./openaiProvider";

export interface CreateConversationInput {
  title?: string;
  mode?: CopilotMode;
  primaryTicker?: string | null;
  comparisonTickers?: string[];
}

export interface AskCopilotInput {
  conversationId?: number;
  question: string;
  mode?: CopilotMode;
  tickers?: string[];
  saveMemoryCandidates?: boolean;
}

export interface CreateMemoryInput {
  category: CopilotMemoryCategory;
  subject: string;
  content: string;
  confidence?: number;
  isPinned?: boolean;
  sourceConversationId?: number | null;
  sourceMessageId?: number | null;
}

interface ContextBuildResult {
  mode: CopilotMode;
  tickers: string[];
  sources: GroundingSource[];
  portfolio: PortfolioContextPayload | null;
  research: ResearchContextPayload[];
  memories: Array<{
    category: string;
    subject: string;
    content: string;
  }>;
  snapshot: CopilotContextSnapshotData;
}

function cleanTitle(value: string | null | undefined): string {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return (cleaned || "New analysis").slice(0, 180);
}

function normaliseTickers(values: string[] = []): string[] {
  return [...new Set(values.map(normalizeTicker).filter(Boolean))].slice(0, 6);
}

function sourceCitation(
  source: GroundingSource,
  claim?: string,
): CopilotCitationData {
  return {
    sourceId: source.id,
    label: source.label,
    kind: source.kind,
    ticker: source.ticker ?? null,
    asOf: source.asOf ?? null,
    dataSource: source.dataSource,
    claim: claim ?? null,
  };
}

function compactResearchWorkspace(
  workspace: Awaited<ReturnType<typeof researchService.getWorkspace>>,
): ResearchContextPayload {
  return {
    ticker: workspace.company.ticker,
    name: workspace.company.name,
    completenessScore: workspace.completeness.score,
    completenessBand: workspace.completeness.band,
    missing: workspace.completeness.missing,
    company: {
      ticker: workspace.company.ticker,
      name: workspace.company.name,
      exchange: workspace.company.exchange,
      sector: workspace.company.sector,
      industry: workspace.company.industry,
      description: workspace.company.description,
      marketCap: workspace.company.marketCap,
      currentPrice: workspace.company.currentPrice,
      previousClose: workspace.company.previousClose,
      pe: workspace.company.pe,
      dataSource: workspace.company.dataSource,
      updatedAt: workspace.company.updatedAt,
    },
    holding: workspace.holding,
    thesis: workspace.thesis,
    risks: workspace.risks.slice(0, 20),
    catalysts: workspace.catalysts.slice(0, 20),
    invalidationTriggers: workspace.invalidationTriggers.slice(0, 20),
    valuationAssumptions: workspace.valuationAssumptions.slice(0, 30),
    notes: workspace.notes.slice(0, 20).map((note) => ({
      id: note.id,
      title: note.title,
      category: note.category,
      content: note.content.slice(0, 4_000),
      sourceLabel: note.sourceLabel,
      sourceUrl: note.sourceUrl,
      eventDate: note.eventDate,
      isPinned: note.isPinned,
      updatedAt: note.updatedAt,
    })),
  };
}

function providerCitations(
  answer: GeneratedCopilotAnswer,
  sources: GroundingSource[],
): CopilotCitationData[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  return answer.citations.flatMap((citation) => {
    const source = sourceMap.get(citation.sourceId);
    return source ? [sourceCitation(source, citation.claim)] : [];
  });
}

function conversationTitle(question: string, tickers: string[]): string {
  const prefix = tickers.length ? `${tickers.join(" vs ")} — ` : "";
  return cleanTitle(`${prefix}${question}`);
}

export class CopilotService {
  private async getOwnedConversation(userId: string, conversationId: number) {
    const [conversation] = await db
      .select()
      .from(copilotConversationsTable)
      .where(
        and(
          eq(copilotConversationsTable.id, conversationId),
          eq(copilotConversationsTable.userId, userId),
        ),
      )
      .limit(1);
    if (!conversation) throw new Error("Copilot conversation was not found");
    return conversation;
  }

  async createConversation(userId: string, input: CreateConversationInput = {}) {
    const tickers = normaliseTickers(input.comparisonTickers);
    const [conversation] = await db
      .insert(copilotConversationsTable)
      .values({
        userId,
        title: cleanTitle(input.title),
        mode: input.mode ?? "general",
        primaryTicker: input.primaryTicker
          ? normalizeTicker(input.primaryTicker)
          : null,
        comparisonTickers: tickers,
      })
      .returning();
    return conversation;
  }

  async listConversations(userId: string, includeArchived = false) {
    const conversations = await db
      .select()
      .from(copilotConversationsTable)
      .where(eq(copilotConversationsTable.userId, userId))
      .orderBy(desc(copilotConversationsTable.updatedAt));
    return includeArchived
      ? conversations
      : conversations.filter((conversation) => !conversation.isArchived);
  }

  async getConversation(userId: string, conversationId: number) {
    const conversation = await this.getOwnedConversation(userId, conversationId);
    const messages = await db
      .select()
      .from(copilotMessagesTable)
      .where(
        and(
          eq(copilotMessagesTable.conversationId, conversationId),
          eq(copilotMessagesTable.userId, userId),
        ),
      )
      .orderBy(asc(copilotMessagesTable.createdAt), asc(copilotMessagesTable.id));
    return { conversation, messages };
  }

  async archiveConversation(
    userId: string,
    conversationId: number,
    archived = true,
  ) {
    await this.getOwnedConversation(userId, conversationId);
    const [conversation] = await db
      .update(copilotConversationsTable)
      .set({ isArchived: archived, updatedAt: new Date() })
      .where(eq(copilotConversationsTable.id, conversationId))
      .returning();
    return conversation;
  }

  async deleteConversation(userId: string, conversationId: number) {
    await this.getOwnedConversation(userId, conversationId);
    const [deleted] = await db
      .delete(copilotConversationsTable)
      .where(eq(copilotConversationsTable.id, conversationId))
      .returning({ id: copilotConversationsTable.id });
    return deleted;
  }

  async listMemories(userId: string, includeArchived = false) {
    const memories = await db
      .select()
      .from(copilotMemoriesTable)
      .where(eq(copilotMemoriesTable.userId, userId))
      .orderBy(
        desc(copilotMemoriesTable.isPinned),
        desc(copilotMemoriesTable.updatedAt),
      );
    return includeArchived
      ? memories
      : memories.filter((memory) => !memory.isArchived);
  }

  async createMemory(userId: string, input: CreateMemoryInput) {
    const subject = input.subject.trim().slice(0, 160);
    const content = input.content.trim().slice(0, 4_000);
    if (!subject) throw new Error("memory subject is required");
    if (!content) throw new Error("memory content is required");

    const [existing] = await db
      .select()
      .from(copilotMemoriesTable)
      .where(
        and(
          eq(copilotMemoriesTable.userId, userId),
          eq(copilotMemoriesTable.category, input.category),
          eq(copilotMemoriesTable.subject, subject),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(copilotMemoriesTable)
        .set({
          content,
          confidence: Math.max(
            existing.confidence,
            Math.max(0, Math.min(1, input.confidence ?? 1)),
          ),
          sourceConversationId:
            input.sourceConversationId ?? existing.sourceConversationId,
          sourceMessageId: input.sourceMessageId ?? existing.sourceMessageId,
          isPinned: input.isPinned ?? existing.isPinned,
          isArchived: false,
          updatedAt: new Date(),
        })
        .where(eq(copilotMemoriesTable.id, existing.id))
        .returning();
      return updated;
    }

    const [memory] = await db
      .insert(copilotMemoriesTable)
      .values({
        userId,
        category: input.category,
        subject,
        content,
        confidence: Math.max(0, Math.min(1, input.confidence ?? 1)),
        sourceConversationId: input.sourceConversationId ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
        isPinned: input.isPinned ?? false,
      })
      .returning();
    return memory;
  }

  async updateMemory(
    userId: string,
    id: number,
    input: Partial<
      Pick<
        CreateMemoryInput,
        "category" | "subject" | "content" | "confidence" | "isPinned"
      > & { isArchived: boolean }
    >,
  ) {
    const [memory] = await db
      .update(copilotMemoriesTable)
      .set({
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.subject !== undefined
          ? { subject: cleanTitle(input.subject).slice(0, 160) }
          : {}),
        ...(input.content !== undefined
          ? { content: input.content.trim().slice(0, 4_000) }
          : {}),
        ...(input.confidence !== undefined
          ? { confidence: Math.max(0, Math.min(1, input.confidence)) }
          : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
        ...(input.isArchived !== undefined
          ? { isArchived: input.isArchived }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(copilotMemoriesTable.id, id),
          eq(copilotMemoriesTable.userId, userId),
        ),
      )
      .returning();
    if (!memory) throw new Error("Copilot memory was not found");
    return memory;
  }

  async deleteMemory(userId: string, id: number) {
    const [memory] = await db
      .delete(copilotMemoriesTable)
      .where(
        and(
          eq(copilotMemoriesTable.id, id),
          eq(copilotMemoriesTable.userId, userId),
        ),
      )
      .returning({ id: copilotMemoriesTable.id });
    if (!memory) throw new Error("Copilot memory was not found");
    return memory;
  }

  private async buildContext(
    userId: string,
    question: string,
    selectedMode: CopilotMode,
    explicitTickers: string[],
  ): Promise<ContextBuildResult> {
    const [overview, performance, risk, companies, approvedMemories] =
      await Promise.all([
        portfolioService.getOverview(userId),
        portfolioService.getPerformance(userId),
        portfolioService.getRisk(userId),
        researchService.listCompanies(userId, { archived: false }),
        this.listMemories(userId),
      ]);

    const availableTickers = [
      ...overview.holdings.map((holding) => holding.ticker),
      ...companies.map((company) => company.ticker),
    ];
    const tickers = inferTickers(question, availableTickers, explicitTickers);
    const mode = inferMode(question, selectedMode);

    const portfolio: PortfolioContextPayload = {
      portfolio: overview.portfolio,
      snapshot: overview.snapshot,
      holdings: overview.holdings,
      performance,
      risk,
    };

    const sources: GroundingSource[] = [
      {
        id: "S1",
        label: `${overview.portfolio.name} portfolio snapshot`,
        kind: "portfolio",
        dataSource: "AlphaDesk Portfolio Engine",
        asOf: overview.snapshot?.asOf?.toISOString?.() ??
          (overview.snapshot?.asOf ? String(overview.snapshot.asOf) : null),
        payload: portfolio,
      },
    ];

    let selectedTickers = [...tickers];
    if (mode === "research_gap" && selectedTickers.length === 0) {
      selectedTickers = companies
        .filter((company) => company.isCovered)
        .sort((a, b) => a.completenessScore - b.completenessScore)
        .slice(0, 8)
        .map((company) => company.ticker);
    }
    if (
      ["company_analysis", "thesis_challenge"].includes(mode) &&
      selectedTickers.length === 0
    ) {
      const primary = companies.find((company) => company.isHolding && company.isCovered);
      if (primary) selectedTickers = [primary.ticker];
    }

    const workspaces = await Promise.all(
      selectedTickers.map(async (ticker) => {
        try {
          return await researchService.getWorkspace(userId, ticker);
        } catch {
          return null;
        }
      }),
    );
    const research = workspaces
      .filter(
        (
          workspace,
        ): workspace is Awaited<ReturnType<typeof researchService.getWorkspace>> =>
          workspace !== null,
      )
      .map(compactResearchWorkspace);

    research.forEach((workspace, index) => {
      sources.push({
        id: `S${index + 2}`,
        label: `${workspace.ticker} research workspace`,
        kind: "research",
        dataSource: "AlphaDesk Research Engine",
        ticker: workspace.ticker,
        asOf:
          workspace.company && "updatedAt" in workspace.company
            ? String(workspace.company.updatedAt ?? "") || null
            : null,
        payload: workspace,
      });
    });

    const memories = approvedMemories.slice(0, 20).map((memory, index) => {
      sources.push({
        id: `M${index + 1}`,
        label: `Approved memory: ${memory.subject}`,
        kind: "memory",
        dataSource: "AlphaDesk Investment Memory",
        asOf: memory.updatedAt.toISOString(),
        payload: {
          category: memory.category,
          subject: memory.subject,
          content: memory.content,
          confidence: memory.confidence,
          isPinned: memory.isPinned,
        },
      });
      return {
        category: memory.category,
        subject: memory.subject,
        content: memory.content,
      };
    });

    const snapshot: CopilotContextSnapshotData = {
      generatedAt: new Date().toISOString(),
      mode,
      tickers: selectedTickers,
      sourceCount: sources.length,
      dataQuality: {
        liveMarketDataAvailable: false,
        priceHistoryAvailable: Boolean(
          performance?.dataQuality?.priceHistoryAvailable,
        ),
        benchmarkHistoryAvailable: Boolean(
          performance?.dataQuality?.benchmarkHistoryAvailable,
        ),
        researchCoverageCount: research.length,
      },
      sources: sources.map((source) => sourceCitation(source)),
    };

    return {
      mode,
      tickers: selectedTickers,
      sources,
      portfolio,
      research,
      memories,
      snapshot,
    };
  }

  async previewContext(
    userId: string,
    question: string,
    mode: CopilotMode = "general",
    tickers: string[] = [],
  ) {
    const context = await this.buildContext(userId, question, mode, tickers);
    return {
      mode: context.mode,
      tickers: context.tickers,
      snapshot: context.snapshot,
      portfolio: context.portfolio,
      research: context.research,
      memoryCount: context.memories.length,
    };
  }

  async ask(userId: string, input: AskCopilotInput) {
    const question = input.question.trim();
    if (!question) throw new Error("question is required");
    if (question.length > 10_000)
      throw new Error("question must be 10,000 characters or fewer");

    const context = await this.buildContext(
      userId,
      question,
      input.mode ?? "general",
      input.tickers ?? [],
    );

    const conversation = input.conversationId
      ? await this.getOwnedConversation(userId, input.conversationId)
      : await this.createConversation(userId, {
          title: conversationTitle(question, context.tickers),
          mode: context.mode,
          primaryTicker: context.tickers[0] ?? null,
          comparisonTickers: context.tickers.slice(1),
        });

    const [userMessage] = await db
      .insert(copilotMessagesTable)
      .values({
        conversationId: conversation.id,
        userId,
        role: "user",
        content: question,
        mode: context.mode,
        contextSnapshot: context.snapshot,
        citations: [],
        provider: "user",
      })
      .returning();

    const history = await db
      .select({
        role: copilotMessagesTable.role,
        content: copilotMessagesTable.content,
      })
      .from(copilotMessagesTable)
      .where(
        and(
          eq(copilotMessagesTable.conversationId, conversation.id),
          eq(copilotMessagesTable.userId, userId),
        ),
      )
      .orderBy(desc(copilotMessagesTable.id))
      .limit(13);

    const orderedHistory = history
      .reverse()
      .filter(
        (message): message is { role: "user" | "assistant"; content: string } =>
          message.role === "user" || message.role === "assistant",
      );
    if (
      orderedHistory.at(-1)?.role === "user" &&
      orderedHistory.at(-1)?.content.trim() === question
    ) {
      orderedHistory.pop();
    }

    let generated: GenerateResult;
    let providerError: string | null = null;
    if (openAIResponsesProvider.isConfigured()) {
      try {
        generated = await openAIResponsesProvider.generate({
          userId,
          mode: context.mode,
          question,
          messages: orderedHistory,
          sources: context.sources,
          memories: context.memories,
        });
      } catch (error) {
        providerError = error instanceof Error ? error.message : "AI provider failed";
        const startedAt = Date.now();
        generated = {
          answer: generateOfflineAnswer({
            mode: context.mode,
            question,
            sources: context.sources,
            portfolio: context.portfolio,
            research: context.research,
          }),
          model: "deterministic-grounded-v1",
          provider: "alphadesk_offline_fallback",
          inputTokens: null,
          outputTokens: null,
          latencyMs: Date.now() - startedAt,
        };
      }
    } else {
      const startedAt = Date.now();
      generated = {
        answer: generateOfflineAnswer({
          mode: context.mode,
          question,
          sources: context.sources,
          portfolio: context.portfolio,
          research: context.research,
        }),
        model: "deterministic-grounded-v1",
        provider: "alphadesk_offline",
        inputTokens: null,
        outputTokens: null,
        latencyMs: Date.now() - startedAt,
      };
    }

    generated.answer = sanitizeGeneratedAnswer(
      generated.answer,
      context.sources,
    );
    const citations = providerCitations(generated.answer, context.sources);

    const [assistantMessage] = await db
      .insert(copilotMessagesTable)
      .values({
        conversationId: conversation.id,
        userId,
        role: "assistant",
        content: generated.answer.answer,
        mode: context.mode,
        contextSnapshot: context.snapshot,
        citations,
        responseData: generated.answer as unknown as Record<string, unknown>,
        model: generated.model,
        provider: generated.provider,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        latencyMs: generated.latencyMs,
      })
      .returning();

    const savedMemories = [];
    if (input.saveMemoryCandidates) {
      for (const candidate of generated.answer.memoryCandidates) {
        savedMemories.push(
          await this.createMemory(userId, {
            ...candidate,
            sourceConversationId: conversation.id,
            sourceMessageId: userMessage.id,
          }),
        );
      }
    }

    await db
      .update(copilotConversationsTable)
      .set({
        mode: context.mode,
        primaryTicker: context.tickers[0] ?? conversation.primaryTicker,
        comparisonTickers:
          context.tickers.length > 1
            ? context.tickers.slice(1)
            : conversation.comparisonTickers,
        title:
          conversation.title === "New analysis"
            ? conversationTitle(question, context.tickers)
            : conversation.title,
        updatedAt: new Date(),
      })
      .where(eq(copilotConversationsTable.id, conversation.id));

    return {
      conversationId: conversation.id,
      userMessage,
      assistantMessage,
      response: generated.answer,
      citations,
      context: context.snapshot,
      provider: {
        name: generated.provider,
        model: generated.model,
        latencyMs: generated.latencyMs,
        fallbackReason: providerError,
      },
      savedMemories,
    };
  }
}

export const copilotService = new CopilotService();

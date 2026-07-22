import assert from "node:assert/strict";
import test from "node:test";

import { OpenAIResponsesProvider } from "./openaiProvider";

test("uses the Responses API with non-persistent structured output", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  let requestBody: Record<string, unknown> | null = null;

  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-model";
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  answer: "Grounded answer [S1].",
                  summary: "Summary",
                  keyPoints: ["Point"],
                  risks: [],
                  unknowns: [],
                  suggestedNextQuestions: ["Next?"],
                  citations: [{ sourceId: "S1", claim: "Supported claim" }],
                  memoryCandidates: [],
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const provider = new OpenAIResponsesProvider();
    const result = await provider.generate({
      userId: "user-1",
      mode: "portfolio_review",
      question: "Review the portfolio",
      messages: [],
      memories: [],
      sources: [
        {
          id: "S1",
          label: "Portfolio snapshot",
          kind: "portfolio",
          dataSource: "AlphaDesk Portfolio Engine",
          payload: { totalValue: 100_000 },
        },
      ],
    });

    assert.equal(result.provider, "openai_responses");
    assert.equal(result.model, "test-model");
    assert.equal(result.answer.citations[0]?.sourceId, "S1");
    assert.equal(requestBody?.store, false);
    assert.equal(requestBody?.model, "test-model");
    assert.equal(
      (requestBody?.text as { format?: { type?: string } })?.format?.type,
      "json_schema",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

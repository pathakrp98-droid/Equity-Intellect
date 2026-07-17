import { useState, useRef, useEffect } from 'react';
import { useQueryCopilot, useGetCopilotHistory } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, Send, FileText, BarChart2, RadioReceiver, Search, ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const SUGGESTED_QUESTIONS = [
  { category: 'Thesis Validation', q: 'How does the recent receivables buildup at Dmart impact our bull case thesis?' },
  { category: 'Risk Assessment', q: 'Run a stress test on our financials sector exposure if RBI hikes rates by 50bps.' },
  { category: 'Catalyst Checking', q: 'What are the key upcoming events for defence stocks in our portfolio?' },
  { category: 'Earnings Analysis', q: 'Summarize management commentary on margins from the latest HDFC Bank concall.' }
];

export function Copilot() {
  const [input, setInput] = useState('');
  const { data: history, isLoading: historyLoading } = useGetCopilotHistory();
  const copilotMutation = useQueryCopilot();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Local state to optimistic append while history fetches
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (history) {
      setMessages(history);
    }
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, copilotMutation.isPending]);

  const handleSend = (question: string) => {
    if (!question.trim() || copilotMutation.isPending) return;
    
    // Optimistic UI
    const newUserMsg = { id: Date.now().toString(), role: 'user', content: question, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');

    copilotMutation.mutate(
      { data: { question } },
      {
        onSuccess: (response) => {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: response.answer,
            timestamp: new Date().toISOString(),
            response
          }]);
        }
      }
    );
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6 overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="h-14 border-b bg-secondary/30 flex items-center px-6 gap-3">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-sm uppercase tracking-wider">PI Copilot</h2>
        </div>

        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          {messages.length === 0 && !historyLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6 text-muted-foreground mt-20">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center border">
                <Bot className="w-8 h-8 text-primary opacity-50" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Institutional AI Assistant</h3>
                <p className="text-sm">Query your portfolio, validate theses against raw filings, and run real-time stress tests.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 max-w-4xl mx-auto pb-10">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-4", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  
                  <div className={cn(
                    "max-w-[85%]",
                    msg.role === 'user' ? "" : ""
                  )}>
                    {msg.role === 'user' ? (
                      <div className="bg-primary text-primary-foreground px-5 py-3 rounded-2xl rounded-tr-sm text-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                        
                        {/* Structured Response Components */}
                        {msg.response && (
                          <div className="space-y-4 mt-6">
                            
                            {/* Sources */}
                            {msg.response.sources && msg.response.sources.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {msg.response.sources.map((s: any, idx: number) => (
                                  <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" 
                                     className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary border rounded text-xs hover:bg-secondary/80 transition-colors">
                                    {s.type === 'bse_filing' ? <FileText className="w-3 h-3 text-orange-500" /> :
                                     s.type === 'concall' ? <RadioReceiver className="w-3 h-3 text-purple-500" /> :
                                     <BarChart2 className="w-3 h-3 text-blue-500" />}
                                    <span className="font-medium">{s.title}</span>
                                  </a>
                                ))}
                              </div>
                            )}

                            {/* Thesis Impact */}
                            {msg.response.thesisImpact && msg.response.thesisImpact.length > 0 && (
                              <div className="grid grid-cols-1 gap-2 mt-4">
                                {msg.response.thesisImpact.map((impact: any, idx: number) => (
                                  <div key={idx} className={cn(
                                    "p-3 rounded border text-sm flex items-start gap-3",
                                    impact.impact === 'negative' ? "bg-destructive/5 border-destructive/20" :
                                    impact.impact === 'positive' ? "bg-emerald-500/5 border-emerald-500/20" :
                                    "bg-secondary/30"
                                  )}>
                                    <div className="font-bold w-20 shrink-0">{impact.ticker}</div>
                                    <div className="flex-1 text-muted-foreground">{impact.reason}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Recommended Actions */}
                            {msg.response.recommendedActions && msg.response.recommendedActions.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                                {msg.response.recommendedActions.map((action: string, idx: number) => (
                                  <Button key={idx} variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1.5 border-primary/30 hover:bg-primary/10">
                                    <Zap className="w-3 h-3 text-primary" />
                                    {action}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1 border">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {copilotMutation.isPending && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-5 h-5 text-primary animate-pulse" />
                  </div>
                  <div className="space-y-2 w-1/2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex gap-2 max-w-4xl mx-auto relative"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about portfolio risk, validate theses, or analyze earnings..." 
              className="h-12 pr-12 bg-secondary/30 border-border/50 focus-visible:ring-primary focus-visible:bg-background transition-colors text-base"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1 top-1 h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!input.trim() || copilotMutation.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Right Panel: Suggestions */}
      <div className="w-80 border rounded-xl bg-card overflow-hidden shrink-0 flex flex-col">
        <div className="p-4 border-b bg-secondary/20">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Suggested Queries</h3>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {SUGGESTED_QUESTIONS.map((sug, i) => (
              <div key={i} className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">{sug.category}</span>
                <button 
                  onClick={() => handleSend(sug.q)}
                  className="w-full text-left text-sm p-3 rounded-lg border bg-secondary/30 hover:bg-secondary hover:border-primary/50 transition-all flex items-start justify-between group"
                >
                  <span className="leading-relaxed">{sug.q}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 ml-2 mt-0.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

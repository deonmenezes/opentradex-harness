import { useState, useRef, useEffect, memo } from 'react';
import type { HarnessStatus } from '../lib/types';

interface ChatCockpitProps {
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
  onCommand: (command: string) => Promise<string>;
  status: HarnessStatus;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const channels = [
  { id: 'all', name: 'ALL CHANNELS', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', count: 2 },
  { id: 'command', name: 'COMMAND', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', count: 0 },
  { id: 'markets', name: 'MARKETS', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', count: 0 },
  { id: 'feeds', name: 'FEEDS', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', count: 1 },
];

const missionCards = [
  { id: '1', title: 'CONNECTOR AUDIT', description: 'Audit this OpenTradex workspace. Tell me which rails, feeds, channels, and credentials are configured, what is still missing, and the smartest next step.' },
  { id: '2', title: 'CROSS-MARKET SCAN', description: 'Scan the enabled market rails, compare overlapping themes, and surface the best 3 setups before recommending one paper trade or pass.' },
  { id: '3', title: 'TRADINGVIEW PASS', description: 'Use the TradingView lane and focus on this watchlist: SPY, QQQ, BTCUSD, NQ1!. Tell me which symbols or macro instruments deserve attention.' },
];

export default memo(function ChatCockpit({ selectedChannel, onChannelChange, onCommand, status: _status }: ChatCockpitProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await onCommand(input.trim());
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Failed to process command. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMissionClick = (description: string) => {
    setInput(description);
  };

  return (
    <main className="flex-1 flex overflow-hidden">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-bg overflow-hidden">
        {/* Chat Header with inline channel pills */}
        <div className="px-4 py-2.5 flex items-center gap-3 border-b border-border bg-surface">
          <span className="text-xs font-medium text-text-dim">Chat</span>
          <div className="flex items-center gap-1">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onChannelChange(channel.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                  selectedChannel === channel.id
                    ? 'bg-surface-2 text-text'
                    : 'text-text-dim hover:bg-surface-2 hover:text-text'
                }`}
              >
                <span>{channel.name.toLowerCase().replace('all channels', 'all')}</span>
                {channel.count > 0 && (
                  <span className="text-2xs text-text-dim">{channel.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-full max-w-xl flex flex-col items-center">
                {/* Title */}
                <h1 className="text-2xl md:text-3xl font-semibold text-text tracking-tight text-center">
                  What should we trade next?
                </h1>
                <p className="mt-2 text-sm text-text-dim text-center">
                  Direct the harness. Paper-only by default.
                </p>

                {/* Suggestion pills */}
                <div className="mt-8 w-full flex flex-col gap-2">
                  {missionCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => handleMissionClick(card.description)}
                      className="w-full text-left px-4 py-3 rounded-lg bg-surface hover:bg-surface-2 border border-border hover:border-border/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <svg className="w-3.5 h-3.5 text-text-dim group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-sm font-medium text-text">{card.title.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                      </div>
                      <p className="text-xs text-text-dim line-clamp-2 pl-5">{card.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-accent text-bg'
                        : 'bg-surface border border-border'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-surface border border-border px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-100" />
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-200" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area — Houston-style single field */}
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border bg-surface">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-input-bg border border-border focus-within:border-accent/60 transition-colors">
            <span className="text-2xs text-text-dim uppercase tracking-wide shrink-0">{selectedChannel}</span>
            <span className="text-text-dim shrink-0">·</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the harness what to scan, compare, explain, or trade"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-text-dim/60"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 p-1.5 rounded-md text-text-dim hover:text-accent hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
});

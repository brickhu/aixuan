import { useState, useRef, useEffect } from 'react';
import { createSession, sendMessage, type Message } from '../api/chat';

export function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是 aiXuan，你的 AI 购物助手。我可以帮你找商品、比价格、推荐好物。有什么我可以帮你的吗？' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [creating, setCreating] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 初始化：创建新会话
  useEffect(() => {
    createSession()
      .then((id) => setSessionId(id))
      .catch(() => {})
      .finally(() => setCreating(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  async function handleSend(text?: string) {
    const msg = (text || input).trim();
    if (!msg || sending || !sessionId) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setSending(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await sendMessage(
        sessionId,
        msg,
        (partial) => setStreamingText(partial),
        controller.signal,
      );
      setMessages((prev) => [...prev, { role: 'assistant', content: result.content, options: result.options, products: result.products }]);
      setStreamingText('');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setStreamingText('');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，请求出错了，请稍后重试。' },
      ]);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  if (creating) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {msg.content}
                {/* 选项卡片：嵌入气泡内部 */}
                {msg.role === 'assistant' && msg.options && msg.options.length > 0 && (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                    {msg.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => handleSend(opt.value)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0 text-left"
                      >
                        <span className="flex-shrink-0 w-4 h-4 rounded-full border-2 border-gray-300" />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* 商品卡片列表 */}
            {msg.role === 'assistant' && msg.products && msg.products.length > 0 && (
              <div className="mt-3 space-y-3 pl-2">
                {msg.products.map((product, pi) => (
                  <div
                    key={pi}
                    onClick={() => {
                      console.log('[click]', product.itemUrl);
                      window.open(product.itemUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="flex gap-3 rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
                  >
                    <div className="h-24 w-24 flex-shrink-0 overflow-hidden bg-gray-100">
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-center py-2 pr-3 min-w-0">
                      <p className="line-clamp-2 text-sm leading-tight text-gray-700">
                        {product.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {product.shopName}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-base font-bold text-red-500">
                          ¥{product.price}
                        </span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                          {product.platform}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* 流式输出 */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-gray-800">
              {streamingText}
              <span className="ml-0.5 animate-pulse">▍</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex gap-2">
            <textarea
            id="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按 Enter 发送..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={sending}
          />
          {sending ? (
            <button
              onClick={handleStop}
              className="rounded-xl bg-red-500 px-4 py-2.5 text-sm text-white hover:bg-red-600"
            >
              停止
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || !sessionId}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
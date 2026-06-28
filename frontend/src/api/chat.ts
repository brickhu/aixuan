export interface ProductItem {
  title: string;
  price: number;
  imageUrl: string;
  platform: string;
  itemUrl: string;
  shopName: string;
  salesCount?: number;
}

export interface OptionItem {
  label: string;
  value: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  options?: OptionItem[];
  products?: ProductItem[];
}

export interface HistoryItem {
  id: string;
  summary: string | null;
  message_count: number;
  product_count: number;
  created_at: string;
}

/** 创建新会话 */
export async function createSession(): Promise<string> {
  const token = localStorage.getItem('token');
  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  const res = await fetch(`${API_BASE}/chat/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || '创建会话失败');
  }

  const data = await res.json();
  return data.data.sessionId;
}

export interface SendResult {
  content: string;
  options: OptionItem[];
  products: ProductItem[];
}

/** 发送消息（SSE 流式返回） */
export async function sendMessage(
  sessionId: string,
  message: string,
  onChunk: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<SendResult> {
  const token = localStorage.getItem('token');
  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  const res = await fetch(`${API_BASE}/chat/session/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || '请求失败');
  }

  if (!res.body) throw new Error('无响应数据');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let options: OptionItem[] = [];
  let products: ProductItem[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 解析 SSE 格式：data: {...}\n\n
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'text' && parsed.content) {
              fullText += parsed.content;
              onChunk(fullText);
            } else if (parsed.type === 'options' && Array.isArray(parsed.options)) {
              options = parsed.options;
            } else if (parsed.type === 'products' && Array.isArray(parsed.products)) {
              products = parsed.products;
            }
          } catch {
            // 跳过解析失败的 chunk
          }
        }
      }
    }
  }

  return { content: fullText, options, products };
}

/** 获取历史会话列表 */
export async function getHistorySessions(): Promise<HistoryItem[]> {
  const token = localStorage.getItem('token');
  const API_BASE = import.meta.env.VITE_API_BASE || '/api';

  const res = await fetch(`${API_BASE}/history`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('获取历史记录失败');
  }

  const data = await res.json();
  return data.data || [];
}

/** 获取会话消息 */
export async function getSessionMessages(
  sessionId: string,
): Promise<Message[]> {
  const API_BASE = import.meta.env.VITE_API_BASE || '/api';
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_BASE}/chat/session/${sessionId}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('获取消息失败');
  }

  const data = await res.json();
  // 后端 messages 是数组 [{id, session_id, role, content, msg_type, ...}]
  return (data.data?.messages || []).map((m: Record<string, unknown>) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
  }));
}
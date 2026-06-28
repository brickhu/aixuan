import { useState, useEffect } from 'react';
import { getHistorySessions, type HistoryItem } from '../api/chat';

export function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getHistorySessions()
      .then((data) => setItems(data))
      .catch(() => setError('加载历史记录失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl">📋</p>
          <p className="mt-2 text-gray-500">暂无历史记录</p>
          <p className="mt-1 text-sm text-gray-400">去对话页面开始聊天吧</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">历史对话</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300"
          >
            <p className="text-sm font-medium text-gray-800 line-clamp-1">
              {item.summary || '新对话'}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
              <span>{new Date(item.created_at).toLocaleString('zh-CN')}</span>
              <span>·</span>
              <span>{item.message_count} 条消息</span>
              {item.product_count > 0 && (
                <>
                  <span>·</span>
                  <span>{item.product_count} 个商品</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
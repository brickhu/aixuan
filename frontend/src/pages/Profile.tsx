import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi, type ProfileResponse } from '../api/auth';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .getProfile()
      .then((res) => {
        if (res.ok) setProfile(res.data);
      })
      .catch(() => {
        // 忽略错误
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* 用户信息卡片 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl">
          👤
        </div>
        <h2 className="mt-3 text-lg font-semibold text-gray-800">
          {profile?.nickname || user?.nickname || '用户'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {user?.email}
        </p>
      </div>

      {/* 积分 */}
      {profile && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">积分余额</span>
            <span className="text-xl font-bold text-indigo-600">
              {profile.points ?? 0}
            </span>
          </div>
        </div>
      )}

      {/* 注册时间 */}
      {profile?.created_at && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">注册时间</span>
            <span className="text-sm text-gray-500">
              {new Date(profile.created_at).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      )}

      {/* 退出按钮 */}
      <div className="mt-6">
        <button
          onClick={logout}
          className="w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
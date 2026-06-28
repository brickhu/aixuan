import api from './client';

/** POST /api/auth/send-code 响应 */
export interface SendCodeResponse {
  ok: boolean;
  data: { message: string };
}

/** POST /api/auth/verify-code 响应 */
export interface VerifyCodeResponse {
  ok: boolean;
  data: {
    token: string;
    userId: string;
    isNew: boolean;
  };
}

/** GET /api/auth/me 响应 */
export interface MeResponse {
  ok: boolean;
  data: {
    userId: string;
    email: string;
    nickname: string | null;
    avatarUrl: string | null;
    points: number;
  };
}

/** GET /api/user/profile 响应 */
export interface ProfileResponse {
  ok: boolean;
  data: {
    id: string;
    nickname: string | null;
    avatar_url: string | null;
    points: number;
    total_earned: number;
    total_saved: number;
    session_count: number;
    created_at: string;
  };
}

export const authApi = {
  /** 发送邮箱验证码 */
  sendCode: (email: string) =>
    api.post<SendCodeResponse>('/auth/send-code', { email }),

  /** 验证验证码并登录/注册 */
  verifyCode: (email: string, code: string) =>
    api.post<VerifyCodeResponse>('/auth/verify-code', { email, code }),

  /** 获取当前用户信息 */
  getMe: () => api.get<MeResponse>('/auth/me'),

  /** 获取用户详细资料 */
  getProfile: () => api.get<ProfileResponse>('/user/profile'),
};
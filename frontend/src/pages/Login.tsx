import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { sendCode, verifyCode, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/chat';

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  /** 发送验证码 */
  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await sendCode(email);
      setCodeSent(true);
      setStep('code');
      // 60 秒倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('网络错误，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  }

  /** 验证验证码 */
  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await verifyCode(email, code);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('网络错误，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    setStep('email');
    setError('');
    setCode('');
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-600">aiXuan</h1>
          <p className="mt-2 text-gray-500">AI 购物助手</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="your@email.com"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '发送中...' : '发送验证码'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">
                验证码已发送至
                <span className="font-medium text-gray-700"> {email} </span>
              </p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-3 block w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '验证中...' : '验证并登录'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleBack}
                className="text-gray-500 hover:text-gray-700"
              >
                返回修改邮箱
              </button>
              <button
                type="button"
                disabled={countdown > 0}
                onClick={handleSendCode}
                className="text-indigo-600 hover:text-indigo-500 disabled:text-gray-400"
              >
                {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
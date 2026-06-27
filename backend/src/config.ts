// 在解析 config 之前确保 .env 已加载
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

export const config = {
  port: Number(process.env['PORT']) || 3000,

  databaseUrl: process.env['DATABASE_URL'] || 'postgresql://localhost:5432/aixuan',

  jwtSecret: process.env['JWT_SECRET'] || '',

  // DeepSeek — 使用 Anthropic API 兼容端点
  deepseekApiKey: process.env['DEEPSEEK_API_KEY'] || '',
  deepseekBaseUrl: process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com/anthropic',
  deepseekModel: process.env['DEEPSEEK_MODEL'] || 'deepseek-chat',

  corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:5173',

  cps: {
    taobao: {
      appKey: process.env['CPS_TAOBAO_APP_KEY'] || '',
      appSecret: process.env['CPS_TAOBAO_APP_SECRET'] || '',
      pid: process.env['CPS_TAOBAO_PID'] || '',
    },
    jd: {
      appKey: process.env['CPS_JD_API_KEY'] || '',
      appSecret: process.env['CPS_JD_APP_SECRET'] || '',
    },
    pdd: {
      clientId: process.env['CPS_PDD_API_KEY'] || '',
      clientSecret: process.env['CPS_PDD_CLIENT_SECRET'] || '',
      pid: process.env['CPS_PDD_PID'] || '',
    },
  },
} as const;

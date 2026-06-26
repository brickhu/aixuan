export const config = {
  port: Number(process.env['PORT']) || 3000,

  databaseUrl: process.env['DATABASE_URL'] || 'postgresql://localhost:5432/aixuan',

  // DeepSeek — 使用 Anthropic API 兼容端点
  deepseekApiKey: process.env['DEEPSEEK_API_KEY'] || '',
  deepseekBaseUrl: process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com/anthropic',
  deepseekModel: process.env['DEEPSEEK_MODEL'] || 'deepseek-chat',

  cloudbase: {
    envId: process.env['CLOUDBASE_ENV_ID'] || '',
    // CloudBase Auth 的 JWKS 端点，用于验证 access_token
    jwksUri: process.env['CLOUDBASE_ENV_ID']
      ? `https://${process.env['CLOUDBASE_ENV_ID']}.api.tcloudbasegateway.com/auth/v1/jwks`
      : '',
  },

  corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:5173',

  cps: {
    taobao: {
      appKey: process.env['CPS_TAOBAO_APP_KEY'] || '',
      appSecret: process.env['CPS_TAOBAO_APP_SECRET'] || '',
      pid: process.env['CPS_TAOBAO_PID'] || '',
    },
    jd: {
      apiKey: process.env['CPS_JD_API_KEY'] || '',
    },
    pdd: {
      apiKey: process.env['CPS_PDD_API_KEY'] || '',
    },
  },
} as const;

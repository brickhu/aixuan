import { query } from './pool.js';

const SCHEMA_SQL = `
-- 用户表（基础信息由 CloudBase Auth 托管，本地仅存应用数据）
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  nickname      TEXT,
  avatar_url    TEXT,
  points        INTEGER DEFAULT 0,
  total_earned  REAL DEFAULT 0.0,
  total_saved   REAL DEFAULT 0.0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 导购会话
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  status        TEXT DEFAULT 'active',
  summary       TEXT,
  product_count INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 对话消息
CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  role          TEXT NOT NULL,
  content       TEXT NOT NULL,
  msg_type      TEXT DEFAULT 'text',
  metadata      JSONB,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 推荐商品
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES sessions(id),
  platform        TEXT NOT NULL,
  title           TEXT NOT NULL,
  price           REAL NOT NULL,
  original_price  REAL,
  image_url       TEXT,
  item_url        TEXT,
  coupon_url      TEXT,
  commission_rate REAL,
  commission_amount REAL,
  sales_count     INTEGER,
  shop_name       TEXT,
  rank            INTEGER,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 点击/转化追踪
CREATE TABLE IF NOT EXISTS clicks (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  product_id    TEXT NOT NULL REFERENCES products(id),
  platform      TEXT NOT NULL,
  click_url     TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  converted     INTEGER DEFAULT 0,
  commission    REAL DEFAULT 0.0,
  clicked_at    TIMESTAMP DEFAULT NOW(),
  converted_at  TIMESTAMP
);

-- 用户积分记录
CREATE TABLE IF NOT EXISTS point_transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  points        INTEGER NOT NULL,
  type          TEXT NOT NULL,
  reference_id  TEXT,
  note          TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
`;

const INDEXES_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)',
  'CREATE INDEX IF NOT EXISTS idx_products_session ON products(session_id)',
  'CREATE INDEX IF NOT EXISTS idx_clicks_user ON clicks(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_clicks_product ON clicks(product_id)',
  'CREATE INDEX IF NOT EXISTS idx_points_user ON point_transactions(user_id)',
];

export async function migrate(): Promise<void> {
  // Create tables
  await query(SCHEMA_SQL);

  // Create indexes
  for (const sql of INDEXES_SQL) {
    await query(sql);
  }

  console.log('[DB] Migration complete');
}

import { createClient } from '@libsql/client';
import { calculateTradeStats, StatsFilters } from './stats';

// Initialize Turso client
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl) {
  throw new Error('TURSO_DATABASE_URL environment variable is required');
}

const db = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

// Initialize database schema once before serving any database operation.
const schemaReady = db.execute(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    pair TEXT NOT NULL,
    direction TEXT NOT NULL,
    entry_price REAL NOT NULL,
    stop_loss_price REAL NOT NULL,
    lot_size REAL NOT NULL,
    risk_usd REAL NOT NULL,
    tp_price REAL,
    reward_usd REAL,
    notes TEXT,
    outcome TEXT,
    close_price REAL,
    rate_used REAL,
    rate_used_display TEXT
  );
`);

export interface Trade {
  id?: number;
  timestamp?: string;
  pair: string;
  direction: 'buy' | 'sell';
  entry_price: number;
  stop_loss_price: number;
  lot_size: number;
  risk_usd: number;
  tp_price?: number;
  reward_usd?: number;
  notes?: string;
  outcome?: 'win' | 'loss' | 'breakeven' | 'open';
  close_price?: number;
  rate_used?: number;
  rate_used_display?: string;
}

export async function saveTrade(trade: Trade): Promise<Trade> {
  await schemaReady;
  const result = await db.execute({
    sql: `
      INSERT INTO trades (pair, direction, entry_price, stop_loss_price, lot_size, risk_usd, tp_price, reward_usd, notes, outcome, close_price, rate_used, rate_used_display)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      trade.pair,
      trade.direction,
      trade.entry_price,
      trade.stop_loss_price,
      trade.lot_size,
      trade.risk_usd,
      trade.tp_price || null,
      trade.reward_usd || null,
      trade.notes || null,
      trade.outcome || null,
      trade.close_price || null,
      trade.rate_used || null,
      trade.rate_used_display || null
    ]
  });
  
  return { ...trade, id: Number(result.lastInsertRowid ?? 0) };
}

export async function getTrades(filters?: {
  pair?: string;
  outcome?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Trade[]> {
  await schemaReady;
  let query = 'SELECT * FROM trades WHERE 1=1';
  const params: any[] = [];
  
  if (filters?.pair) {
    query += ' AND pair = ?';
    params.push(filters.pair);
  }
  
  if (filters?.outcome) {
    query += ' AND outcome = ?';
    params.push(filters.outcome);
  }
  
  if (filters?.startDate) {
    query += ' AND timestamp >= ?';
    params.push(filters.startDate);
  }
  
  if (filters?.endDate) {
    query += ' AND timestamp <= ?';
    params.push(filters.endDate);
  }
  
  query += ' ORDER BY timestamp DESC';
  
  const result = await db.execute({ sql: query, args: params });
  return result.rows as unknown as Trade[];
}

export async function updateTrade(id: number, updates: Partial<Trade>): Promise<void> {
  await schemaReady;
  const fields = Object.keys(updates).filter(key => key !== 'id');
  if (fields.length === 0) return;
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as any)[f]);
  
  await db.execute({
    sql: `UPDATE trades SET ${setClause} WHERE id = ?`,
    args: [...values, id]
  });
}

export async function getStats(filters?: {
  pair?: string;
  startDate?: string;
  endDate?: string;
}) {
  await schemaReady;
  const trades = await getTrades(filters);
  return calculateTradeStats(trades, filters as StatsFilters);
}

export default db;
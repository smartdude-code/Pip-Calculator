import { createClient } from '@libsql/client';

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

// Initialize database schema
db.execute(`
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
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  
  if (filters?.pair) {
    whereClause += ' AND pair = ?';
    params.push(filters.pair);
  }
  
  if (filters?.startDate) {
    whereClause += ' AND timestamp >= ?';
    params.push(filters.startDate);
  }
  
  if (filters?.endDate) {
    whereClause += ' AND timestamp <= ?';
    params.push(filters.endDate);
  }
  
  const totalTrades = await db.execute({
    sql: `SELECT COUNT(*) as count FROM trades ${whereClause}`,
    args: params
  });
  
  const completedTrades = await db.execute({
    sql: `SELECT COUNT(*) as count FROM trades ${whereClause} AND outcome IN ('win', 'loss', 'breakeven')`,
    args: params
  });
  
  const wins = await db.execute({
    sql: `SELECT COUNT(*) as count FROM trades ${whereClause} AND outcome = 'win'`,
    args: params
  });
  
  const totalRisked = await db.execute({
    sql: `SELECT SUM(risk_usd) as total FROM trades ${whereClause}`,
    args: params
  });
  
  const totalResult = await db.execute({
    sql: `SELECT 
      SUM(CASE WHEN outcome = 'win' THEN reward_usd ELSE 0 END) as wins,
      SUM(CASE WHEN outcome = 'loss' THEN -risk_usd ELSE 0 END) as losses
      FROM trades ${whereClause}`,
    args: params
  });
  
  const totalTradesCount = (totalTrades.rows[0] as any)?.count || 0;
  const completedTradesCount = (completedTrades.rows[0] as any)?.count || 0;
  const winsCount = (wins.rows[0] as any)?.count || 0;
  const totalRiskedValue = (totalRisked.rows[0] as any)?.total || 0;
  const totalResultWins = (totalResult.rows[0] as any)?.wins || 0;
  const totalResultLosses = (totalResult.rows[0] as any)?.losses || 0;
  
  const winRate = completedTradesCount > 0 ? (winsCount / completedTradesCount) * 100 : 0;
  
  return {
    totalTrades: totalTradesCount,
    completedTrades: completedTradesCount,
    wins: winsCount,
    winRate: winRate.toFixed(1),
    totalRisked: totalRiskedValue,
    totalWins: totalResultWins,
    totalLosses: totalResultLosses,
    netResult: totalResultWins + totalResultLosses
  };
}

export default db;
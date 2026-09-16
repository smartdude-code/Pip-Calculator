import { calculateTradeStats } from './stats';
import type { Trade } from './db';

const trade = (overrides: Partial<Trade>): Trade => ({
  pair: 'EUR/USD',
  direction: 'buy',
  entry_price: 1.1,
  stop_loss_price: 1.09,
  lot_size: 1,
  risk_usd: 100,
  ...overrides,
});

describe('calculateTradeStats', () => {
  it('uses the same filtered trades and realized outcomes for every metric', () => {
    const stats = calculateTradeStats([
      trade({ outcome: 'loss' }),
      trade({ outcome: 'breakeven', risk_usd: 50 }),
      trade({ outcome: 'open', risk_usd: 75 }),
      trade({ outcome: undefined, risk_usd: 25 }),
      trade({ outcome: 'LOSS' as unknown as Trade['outcome'], risk_usd: 25 }),
    ]);

    expect(stats.totalTrades).toBe(5);
    expect(stats.completedTrades).toBe(3);
    expect(stats.wins).toBe(0);
    expect(stats.winRate).toBe('0.0');
    expect(stats.totalRisked).toBe(275);
    expect(stats.totalResult).toBe(-125);
    expect(stats.netResult).toBe(-125);
    expect(stats.avgR).toBe('-0.67');
  });

  it('applies pair and outcome filters before calculating metrics', () => {
    const stats = calculateTradeStats([
      trade({ outcome: 'win', reward_usd: 200 }),
      trade({ pair: 'GBP/USD', outcome: 'loss' }),
      trade({ outcome: 'open' }),
    ], { pair: 'EUR/USD' });

    expect(stats.totalTrades).toBe(2);
    expect(stats.completedTrades).toBe(1);
    expect(stats.totalRisked).toBe(200);
    expect(stats.totalResult).toBe(200);
    expect(stats.avgR).toBe('2.00');
  });
});

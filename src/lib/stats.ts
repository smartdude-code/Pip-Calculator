import type { Trade } from './db';

export interface StatsFilters {
  pair?: string;
  outcome?: string;
  startDate?: string;
  endDate?: string;
}

export function calculateTradeStats(trades: Trade[], filters: StatsFilters = {}) {
  const filteredTrades = trades.filter((trade) => {
    if (filters.pair && trade.pair !== filters.pair) return false;
    if (filters.outcome && normalizeOutcome(trade.outcome) !== filters.outcome) return false;
    if (filters.startDate && (!trade.timestamp || trade.timestamp < filters.startDate)) return false;
    if (filters.endDate && (!trade.timestamp || trade.timestamp > filters.endDate)) return false;
    return true;
  });

  const completedTrades = filteredTrades.filter((trade) => {
    const outcome = normalizeOutcome(trade.outcome);
    return outcome === 'win' || outcome === 'loss' || outcome === 'breakeven';
  });

  const wins = completedTrades.filter((trade) => normalizeOutcome(trade.outcome) === 'win').length;
  const totalResult = completedTrades.reduce((sum, trade) => sum + getTradeResultValue(trade), 0);
  const totalR = completedTrades.reduce((sum, trade) => sum + getTradeRValue(trade), 0);

  return {
    totalTrades: filteredTrades.length,
    completedTrades: completedTrades.length,
    wins,
    winRate: (completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0).toFixed(1),
    totalRisked: filteredTrades.reduce((sum, trade) => sum + trade.risk_usd, 0),
    totalWins: completedTrades.reduce((sum, trade) => sum + (normalizeOutcome(trade.outcome) === 'win' ? (trade.reward_usd || 0) : 0), 0),
    totalLosses: completedTrades.reduce((sum, trade) => sum + (normalizeOutcome(trade.outcome) === 'loss' ? -trade.risk_usd : 0), 0),
    totalResult,
    netResult: totalResult,
    avgR: (completedTrades.length > 0 ? totalR / completedTrades.length : 0).toFixed(2),
  };
}

function getTradeResultValue(trade: Trade) {
  const outcome = normalizeOutcome(trade.outcome);
  if (outcome === 'win') return Number(trade.reward_usd || 0);
  if (outcome === 'loss') return -Number(trade.risk_usd || 0);
  if (outcome === 'breakeven') return Number(trade.breakeven_result_usd ?? 0);
  return 0;
}

function getTradeRValue(trade: Trade) {
  const outcome = normalizeOutcome(trade.outcome);
  if (outcome === 'win') return trade.risk_usd > 0 ? Number(trade.reward_usd || 0) / Number(trade.risk_usd) : 0;
  if (outcome === 'loss') return -1;
  if (outcome === 'breakeven') {
    const result = Number(trade.breakeven_result_usd ?? 0);
    return trade.risk_usd > 0 ? result / Number(trade.risk_usd) : 0;
  }
  return 0;
}

function normalizeOutcome(outcome: Trade['outcome']) {
  return (outcome || 'open').toLowerCase();
}
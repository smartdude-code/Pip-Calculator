import { NextRequest, NextResponse } from 'next/server';
import { saveTrade, getTrades, getStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    pair: searchParams.get('pair') || undefined,
    outcome: searchParams.get('outcome') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  };
  
  const trades = await getTrades(filters);
  return NextResponse.json(trades);
}

export async function POST(request: NextRequest) {
  try {
    const trade = await request.json();
    // Convert camelCase to snake_case for database
    const dbTrade = {
      pair: trade.pair,
      direction: trade.direction,
      entry_price: trade.entry_price,
      stop_loss_price: trade.stop_loss_price,
      lot_size: trade.lot_size,
      risk_usd: trade.risk_usd,
      tp_price: trade.tp_price,
      reward_usd: trade.reward_usd,
      notes: trade.notes,
      outcome: trade.outcome,
      close_price: trade.close_price,
      rate_used: trade.rate_used,
      rate_used_display: trade.rate_used_display,
    };
    const savedTrade = await saveTrade(dbTrade);
    return NextResponse.json(savedTrade, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save trade' }, { status: 500 });
  }
}
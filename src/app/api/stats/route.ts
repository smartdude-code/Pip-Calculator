import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    pair: searchParams.get('pair') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  };
  
  const stats = await getStats(filters);
  return NextResponse.json(stats);
}
import { NextRequest, NextResponse } from 'next/server';
import { resolveMarketQuery } from '@/lib/polymarket';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  try {
    const market = await resolveMarketQuery(q);
    return NextResponse.json(market);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch market';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

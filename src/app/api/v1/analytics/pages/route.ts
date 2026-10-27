import { NextRequest, NextResponse } from 'next/server';
import { getPopularPages } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const limitStr = searchParams.get('limit');

    const fromMs = fromStr ? parseInt(fromStr, 10) : undefined;
    const toMs = toStr ? parseInt(toStr, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    const pages = getPopularPages(fromMs, toMs, limit);
    return NextResponse.json({ pages });
  } catch (err) {
    console.error('Error fetching popular pages:', err);
    return NextResponse.json({ error: 'Failed to fetch popular pages' }, { status: 500 });
  }
}

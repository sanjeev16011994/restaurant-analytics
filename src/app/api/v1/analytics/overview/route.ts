import { NextRequest, NextResponse } from 'next/server';
import { getOverview } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    const fromMs = fromStr ? parseInt(fromStr, 10) : undefined;
    const toMs = toStr ? parseInt(toStr, 10) : undefined;

    const data = getOverview(fromMs, toMs);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching analytics overview:', err);
    return NextResponse.json({ error: 'Failed to fetch overview metrics' }, { status: 500 });
  }
}

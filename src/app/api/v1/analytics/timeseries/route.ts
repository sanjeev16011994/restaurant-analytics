import { NextRequest, NextResponse } from 'next/server';
import { getTimeSeries } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const grainParam = searchParams.get('grain');

    const fromMs = fromStr ? parseInt(fromStr, 10) : undefined;
    const toMs = toStr ? parseInt(toStr, 10) : undefined;
    const grain = grainParam === 'hour' ? 'hour' : 'day';

    const data = getTimeSeries(fromMs, toMs, grain);
    return NextResponse.json({ timeSeries: data });
  } catch (err) {
    console.error('Error fetching analytics time-series:', err);
    return NextResponse.json({ error: 'Failed to fetch time-series metrics' }, { status: 500 });
  }
}

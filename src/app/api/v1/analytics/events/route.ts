import { NextRequest, NextResponse } from 'next/server';
import { getEventDistribution } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    const fromMs = fromStr ? parseInt(fromStr, 10) : undefined;
    const toMs = toStr ? parseInt(toStr, 10) : undefined;

    const events = getEventDistribution(fromMs, toMs);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('Error fetching event breakdown:', err);
    return NextResponse.json({ error: 'Failed to fetch event distribution' }, { status: 500 });
  }
}

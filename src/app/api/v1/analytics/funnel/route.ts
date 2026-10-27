import { NextRequest, NextResponse } from 'next/server';
import { getFunnelMetrics } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    const fromMs = fromStr ? parseInt(fromStr, 10) : undefined;
    const toMs = toStr ? parseInt(toStr, 10) : undefined;

    const steps = getFunnelMetrics(fromMs, toMs);
    return NextResponse.json({ funnel: steps });
  } catch (err) {
    console.error('Error fetching funnel metrics:', err);
    return NextResponse.json({ error: 'Failed to fetch conversion funnel' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getRecentEvents } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitStr = searchParams.get('limit');
    const name = searchParams.get('name') || undefined;

    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const events = getRecentEvents(limit, name);

    // Parse JSON fields for clean consumption
    const parsed = events.map((ev) => {
      let props = {};
      let ctx = {};
      try {
        props = JSON.parse(ev.properties || '{}');
      } catch {
        props = { raw: ev.properties };
      }
      try {
        ctx = JSON.parse(ev.context || '{}');
      } catch {
        ctx = { raw: ev.context };
      }

      return {
        ...ev,
        properties: props,
        context: ctx,
      };
    });

    return NextResponse.json({ events: parsed });
  } catch (err) {
    console.error('Error fetching live events:', err);
    return NextResponse.json({ error: 'Failed to fetch live events' }, { status: 500 });
  }
}

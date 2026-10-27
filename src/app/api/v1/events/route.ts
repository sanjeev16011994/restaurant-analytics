import { NextRequest, NextResponse } from 'next/server';
import { insertEvents } from '@/lib/db';
import type { IngestEventInput, IngestionResponse } from '@/lib/analytics/types';

// Valid API Keys
const VALID_KEYS = new Set([
  'pk_ks_live_default',
  'sk_ks_live_default',
  process.env.KITCHEN_SPURS_WRITE_KEY || 'pk_ks_live_default',
  process.env.KITCHEN_SPURS_SERVER_KEY || 'sk_ks_live_default',
]);

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Request
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // In a production multi-tenant system, we validate writeKey against tenants
    // For demo simplicity, accept valid demo keys or payload writeKey
    let body: { writeKey?: string; events?: IngestEventInput[] } | IngestEventInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload' },
        { status: 400 }
      );
    }

    const key = token || (('writeKey' in body && body.writeKey) ? body.writeKey : '');
    if (key && !VALID_KEYS.has(key)) {
      // Return 401 if an invalid key was explicitly provided
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid Write Key or API Key' },
        { status: 401 }
      );
    }

    // 2. Extract Event Batch
    let rawEvents: IngestEventInput[] = [];
    if ('events' in body && Array.isArray(body.events)) {
      rawEvents = body.events;
    } else if ('eventName' in body) {
      rawEvents = [body as IngestEventInput];
    }

    if (rawEvents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No events provided in request body' },
        { status: 400 }
      );
    }

    // Max batch size limit
    if (rawEvents.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Batch size exceeds maximum limit of 500 events' },
        { status: 413 }
      );
    }

    // 3. Validate & Sanitize Events
    const validEvents: IngestEventInput[] = [];
    const validationErrors: string[] = [];

    // Extract client IP and user agent from request headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || undefined;

    for (let i = 0; i < rawEvents.length; i++) {
      const ev = rawEvents[i];

      if (!ev.eventName || typeof ev.eventName !== 'string') {
        validationErrors.push(`Event at index ${i} missing valid eventName`);
        continue;
      }
      if (!ev.anonymousId || typeof ev.anonymousId !== 'string') {
        validationErrors.push(`Event at index ${i} missing valid anonymousId`);
        continue;
      }
      if (!ev.sessionId || typeof ev.sessionId !== 'string') {
        validationErrors.push(`Event at index ${i} missing valid sessionId`);
        continue;
      }

      // Default source to browser if unspecified
      const source = ev.source === 'server' ? 'server' : 'browser';

      validEvents.push({
        ...ev,
        source,
        timestamp: ev.timestamp || Date.now(),
        context: {
          ...ev.context,
          ip: clientIp,
          userAgent: ev.context?.userAgent || userAgent,
        },
      });
    }

    if (validEvents.length === 0) {
      return NextResponse.json(
        { success: false, errors: validationErrors },
        { status: 422 }
      );
    }

    // 4. Ingest into Storage Engine
    const { received, inserted, duplicates } = insertEvents(validEvents);

    const responsePayload: IngestionResponse = {
      success: true,
      received,
      inserted,
      duplicates,
      ...(validationErrors.length > 0 ? { errors: validationErrors } : {}),
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err) {
    console.error('[API /api/v1/events] Ingestion error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal ingestion error' },
      { status: 500 }
    );
  }
}

// Support CORS Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

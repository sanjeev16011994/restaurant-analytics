import { NextRequest, NextResponse } from 'next/server';
import { createOrderRecord } from '@/lib/db';
import { serverAnalytics } from '@/lib/analytics/server-sdk';
import type { OrderInput } from '@/lib/analytics/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OrderInput;

    // Basic validation
    if (!body.customerName || !body.customerEmail || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required order fields (customerName, customerEmail, items)' },
        { status: 400 }
      );
    }

    // 1. Persist the Order in the Restaurant Database
    const orderRecord = createOrderRecord(body);

    // 2. DISPATCH SERVER TRACKING EVENT
    // The server helper captures this business event securely with idempotency
    await serverAnalytics.track({
      event: 'order_created',
      userId: body.customerEmail, // Canonical identity
      anonymousId: body.anonymousId, // Preserves client attribution linkage
      sessionId: body.sessionId, // Preserves session attribution linkage
      idempotencyKey: `evt_${orderRecord.id}`, // Guaranteed deduplication on retry
      properties: {
        orderId: orderRecord.id,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        diningOption: body.diningOption,
        tableNumber: body.tableNumber,
        deliveryAddress: body.deliveryAddress,
        itemCount: body.items.reduce((acc, it) => acc + it.quantity, 0),
        items: body.items.map((it) => ({
          id: it.id,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
        })),
        subtotal: body.subtotal,
        tax: body.tax,
        tip: body.tip,
        total: body.total,
        paymentMethod: body.paymentMethod,
        currency: 'USD',
      },
      context: {
        serverEnvironment: process.env.NODE_ENV || 'production',
        platform: `Node.js Next.js API [Server Tracked]`,
      },
    });

    // 3. Return Confirmed Order Response
    return NextResponse.json({
      success: true,
      order: orderRecord,
      message: 'Order placed successfully and recorded via Server Analytics SDK.',
    });
  } catch (err) {
    console.error('Failed to create order and dispatch server event:', err);
    return NextResponse.json(
      { error: 'Internal error processing restaurant order' },
      { status: 500 }
    );
  }
}

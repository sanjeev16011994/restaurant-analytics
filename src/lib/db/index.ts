import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type {
  IngestEventInput,
  StoredEvent,
  OverviewMetrics,
  TimeSeriesPoint,
  PageStat,
  EventBreakdownItem,
  FunnelStep,
  OrderInput,
  OrderRecord,
} from '../analytics/types';

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'analytics.db');

// Singleton database instance
let _db: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    // Performance optimizations
    _db.exec('PRAGMA journal_mode = WAL;');
    _db.exec('PRAGMA synchronous = NORMAL;');
    _db.exec('PRAGMA busy_timeout = 5000;');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      source TEXT NOT NULL,
      anonymous_id TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      received_at INTEGER NOT NULL,
      page_url TEXT,
      page_path TEXT,
      page_title TEXT,
      referrer TEXT,
      properties TEXT NOT NULL DEFAULT '{}',
      context TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_anon ON events(anonymous_id);
    CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_path ON events(page_path);
    CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);

    CREATE TABLE IF NOT EXISTS identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      anonymous_id TEXT NOT NULL,
      traits TEXT NOT NULL DEFAULT '{}',
      identified_at INTEGER NOT NULL,
      UNIQUE(user_id, anonymous_id)
    );

    CREATE INDEX IF NOT EXISTS idx_identities_user ON identities(user_id);
    CREATE INDEX IF NOT EXISTS idx_identities_anon ON identities(anonymous_id);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      dining_option TEXT NOT NULL,
      table_number TEXT,
      delivery_address TEXT,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      tip REAL NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  `);
}

/**
 * Ingests a batch of events with deduplication and idempotency
 */
export function insertEvents(events: IngestEventInput[]): {
  received: number;
  inserted: number;
  duplicates: number;
} {
  const db = getDatabase();
  const now = Date.now();

  const insertEventStmt = db.prepare(`
    INSERT OR IGNORE INTO events (
      id, event_id, event_name, source, anonymous_id, user_id, session_id,
      timestamp, received_at, page_url, page_path, page_title, referrer,
      properties, context
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  const upsertIdentityStmt = db.prepare(`
    INSERT INTO identities (user_id, anonymous_id, traits, identified_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, anonymous_id) DO UPDATE SET
      traits = excluded.traits,
      identified_at = excluded.identified_at
  `);

  let inserted = 0;
  let duplicates = 0;

  db.exec('BEGIN TRANSACTION');
  try {
    for (const ev of events) {
      const eventId = ev.eventId || randomUUID();
      const internalId = randomUUID();
      const ts = ev.timestamp || now;
      const propsStr = JSON.stringify(ev.properties || {});
      const ctxStr = JSON.stringify(ev.context || {});

      const result = insertEventStmt.run(
        internalId,
        eventId,
        ev.eventName,
        ev.source,
        ev.anonymousId,
        ev.userId || null,
        ev.sessionId,
        ts,
        now,
        ev.page?.url || null,
        ev.page?.path || null,
        ev.page?.title || null,
        ev.page?.referrer || null,
        propsStr,
        ctxStr
      );

      if (result.changes > 0) {
        inserted++;
      } else {
        duplicates++;
      }

      // If this event has identity traits or is an identify event, update identity mapping
      if (ev.eventName === 'identify' && ev.userId) {
        upsertIdentityStmt.run(
          ev.userId,
          ev.anonymousId,
          propsStr,
          ts
        );
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { received: events.length, inserted, duplicates };
}

/**
 * Dashboard Overview Metrics
 */
export function getOverview(fromMs?: number, toMs?: number): OverviewMetrics {
  const db = getDatabase();
  const { whereClause, params } = buildTimeFilter(fromMs, toMs);

  // Total Page Views
  const pvRow = db
    .prepare(`SELECT COUNT(*) as count FROM events WHERE event_name = 'page_view' ${whereClause}`)
    .get(...params) as { count: number } | undefined;
  const totalPageViews = pvRow?.count || 0;

  // Unique Visitors (distinct anonymous_id)
  const uvRow = db
    .prepare(`SELECT COUNT(DISTINCT anonymous_id) as count FROM events WHERE 1=1 ${whereClause}`)
    .get(...params) as { count: number } | undefined;
  const uniqueVisitors = uvRow?.count || 0;

  // Total Sessions
  const sessRow = db
    .prepare(`SELECT COUNT(DISTINCT session_id) as count FROM events WHERE 1=1 ${whereClause}`)
    .get(...params) as { count: number } | undefined;
  const totalSessions = sessRow?.count || 0;

  // Bounce Rate (sessions with exactly 1 page view / total sessions with page views)
  const bounceRow = db
    .prepare(`
      SELECT 
        COUNT(CASE WHEN pv_count = 1 THEN 1 END) as single_pv_sessions,
        COUNT(*) as total_pv_sessions
      FROM (
        SELECT session_id, COUNT(*) as pv_count
        FROM events 
        WHERE event_name = 'page_view' ${whereClause}
        GROUP BY session_id
      )
    `)
    .get(...params) as { single_pv_sessions: number; total_pv_sessions: number } | undefined;

  const bounceRatePercent = bounceRow?.total_pv_sessions
    ? Number(((bounceRow.single_pv_sessions / bounceRow.total_pv_sessions) * 100).toFixed(1))
    : 0;

  // Orders and Revenue (from events table or orders table in range)
  const orderTimeFilter = buildTimeFilter(fromMs, toMs, 'created_at');
  const orderRow = db
    .prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE 1=1 ${orderTimeFilter.whereClause}
    `)
    .get(...orderTimeFilter.params) as { count: number; revenue: number } | undefined;

  const totalOrders = orderRow?.count || 0;
  const totalRevenue = Number((orderRow?.revenue || 0).toFixed(2));
  const avgOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

  // Browser vs Server event count
  const sourceRow = db
    .prepare(`
      SELECT 
        COUNT(CASE WHEN source = 'browser' THEN 1 END) as browser_count,
        COUNT(CASE WHEN source = 'server' THEN 1 END) as server_count
      FROM events
      WHERE 1=1 ${whereClause}
    `)
    .get(...params) as { browser_count: number; server_count: number } | undefined;

  // Cart addition count
  const cartRow = db
    .prepare(`SELECT COUNT(*) as count FROM events WHERE event_name = 'add_to_cart' ${whereClause}`)
    .get(...params) as { count: number } | undefined;

  return {
    totalPageViews,
    uniqueVisitors,
    totalSessions,
    bounceRatePercent,
    totalOrders,
    totalRevenue,
    avgOrderValue,
    browserEventsCount: sourceRow?.browser_count || 0,
    serverEventsCount: sourceRow?.server_count || 0,
    cartAdditionCount: cartRow?.count || 0,
  };
}

/**
 * Time-series traffic and conversion metrics
 */
export function getTimeSeries(
  fromMs?: number,
  toMs?: number,
  grain: 'hour' | 'day' = 'day'
): TimeSeriesPoint[] {
  const db = getDatabase();
  const { whereClause, params } = buildTimeFilter(fromMs, toMs);

  // Group by format: '%Y-%m-%d %H:00' for hour, '%Y-%m-%d' for day
  const timeFormat = grain === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';

  const rows = db
    .prepare(`
      SELECT 
        strftime('${timeFormat}', timestamp / 1000, 'unixepoch', 'localtime') as time_bucket,
        COUNT(CASE WHEN event_name = 'page_view' THEN 1 END) as page_views,
        COUNT(DISTINCT anonymous_id) as unique_visitors,
        COUNT(CASE WHEN event_name = 'order_created' THEN 1 END) as orders
      FROM events
      WHERE 1=1 ${whereClause}
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `)
    .all(...params) as Array<{
      time_bucket: string;
      page_views: number;
      unique_visitors: number;
      orders: number;
    }>;

  // Query order revenue for the same buckets
  const orderTimeFilter = buildTimeFilter(fromMs, toMs, 'created_at');
  const revenueRows = db
    .prepare(`
      SELECT 
        strftime('${timeFormat}', created_at / 1000, 'unixepoch', 'localtime') as time_bucket,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE 1=1 ${orderTimeFilter.whereClause}
      GROUP BY time_bucket
    `)
    .all(...orderTimeFilter.params) as Array<{
      time_bucket: string;
      revenue: number;
    }>;

  const revenueMap = new Map<string, number>();
  for (const r of revenueRows) {
    revenueMap.set(r.time_bucket, r.revenue);
  }

  return rows.map((r) => ({
    timeBucket: r.time_bucket,
    pageViews: r.page_views,
    uniqueVisitors: r.unique_visitors,
    orders: r.orders,
    revenue: Number((revenueMap.get(r.time_bucket) || 0).toFixed(2)),
  }));
}

/**
 * Popular Pages
 */
export function getPopularPages(fromMs?: number, toMs?: number, limit = 10): PageStat[] {
  const db = getDatabase();
  const { whereClause, params } = buildTimeFilter(fromMs, toMs);

  const totalViewsRow = db
    .prepare(`SELECT COUNT(*) as count FROM events WHERE event_name = 'page_view' ${whereClause}`)
    .get(...params) as { count: number } | undefined;
  const totalViews = totalViewsRow?.count || 1;

  const rows = db
    .prepare(`
      SELECT 
        COALESCE(page_path, '/') as path,
        COALESCE(page_title, 'Kitchen Spurs') as title,
        COUNT(*) as views,
        COUNT(DISTINCT anonymous_id) as unique_visitors
      FROM events
      WHERE event_name = 'page_view' ${whereClause}
      GROUP BY path
      ORDER BY views DESC
      LIMIT ?
    `)
    .all(...params, limit) as Array<{
      path: string;
      title: string;
      views: number;
      unique_visitors: number;
    }>;

  return rows.map((r) => ({
    path: r.path,
    title: r.title,
    views: r.views,
    uniqueVisitors: r.unique_visitors,
    sharePercent: Number(((r.views / totalViews) * 100).toFixed(1)),
  }));
}

/**
 * Event Breakdown by Name & Source
 */
export function getEventDistribution(fromMs?: number, toMs?: number): EventBreakdownItem[] {
  const db = getDatabase();
  const { whereClause, params } = buildTimeFilter(fromMs, toMs);

  const totalEventsRow = db
    .prepare(`SELECT COUNT(*) as count FROM events WHERE 1=1 ${whereClause}`)
    .get(...params) as { count: number } | undefined;
  const totalEvents = totalEventsRow?.count || 1;

  const rows = db
    .prepare(`
      SELECT 
        event_name,
        source,
        COUNT(*) as count
      FROM events
      WHERE 1=1 ${whereClause}
      GROUP BY event_name, source
      ORDER BY count DESC
    `)
    .all(...params) as Array<{
      event_name: string;
      source: 'browser' | 'server';
      count: number;
    }>;

  return rows.map((r) => ({
    eventName: r.event_name,
    source: r.source,
    count: r.count,
    percentage: Number(((r.count / totalEvents) * 100).toFixed(1)),
  }));
}

/**
 * Conversion Funnel: Visit -> Browse Item -> Add to Cart -> Begin Checkout -> Order Created
 */
export function getFunnelMetrics(fromMs?: number, toMs?: number): FunnelStep[] {
  const db = getDatabase();
  const { whereClause, params } = buildTimeFilter(fromMs, toMs);

  const stepsDef = [
    { name: 'page_view', label: '1. Page Visits' },
    { name: 'view_item', label: '2. Menu Item Views' },
    { name: 'add_to_cart', label: '3. Cart Additions' },
    { name: 'begin_checkout', label: '4. Checkout Started' },
    { name: 'order_created', label: '5. Orders Placed' },
  ];

  const results: FunnelStep[] = [];
  let baseCount = 0;

  for (let i = 0; i < stepsDef.length; i++) {
    const step = stepsDef[i];
    const row = db
      .prepare(`SELECT COUNT(DISTINCT session_id) as count FROM events WHERE event_name = ? ${whereClause}`)
      .get(step.name, ...params) as { count: number } | undefined;

    const count = row?.count || 0;
    if (i === 0) {
      baseCount = count || 1;
    }

    const conversionPercent = Number(((count / baseCount) * 100).toFixed(1));
    const prevCount = i > 0 ? results[i - 1].count : count;
    const dropoffPercent = prevCount > 0 ? Number((((prevCount - count) / prevCount) * 100).toFixed(1)) : 0;

    results.push({
      name: step.name,
      label: step.label,
      count,
      conversionPercent,
      dropoffPercent: Math.max(0, dropoffPercent),
    });
  }

  return results;
}

/**
 * Live / Recent Events Feed
 */
export function getRecentEvents(limit = 50, eventName?: string): StoredEvent[] {
  const db = getDatabase();
  let query = 'SELECT * FROM events';
  const params: unknown[] = [];

  if (eventName) {
    query += ' WHERE event_name = ?';
    params.push(eventName);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params) as unknown as StoredEvent[];
}

/**
 * Restaurant Orders Persistence
 */
export function createOrderRecord(order: OrderInput): OrderRecord {
  const db = getDatabase();
  const orderId = `ord_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const now = Date.now();
  const itemsJson = JSON.stringify(order.items);

  const stmt = db.prepare(`
    INSERT INTO orders (
      id, customer_name, customer_email, dining_option, table_number,
      delivery_address, items, subtotal, tax, tip, total, payment_method,
      status, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  stmt.run(
    orderId,
    order.customerName,
    order.customerEmail,
    order.diningOption,
    order.tableNumber || null,
    order.deliveryAddress || null,
    itemsJson,
    order.subtotal,
    order.tax,
    order.tip,
    order.total,
    order.paymentMethod,
    'confirmed',
    now
  );

  return {
    id: orderId,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    dining_option: order.diningOption,
    table_number: order.tableNumber || null,
    delivery_address: order.deliveryAddress || null,
    items: itemsJson,
    subtotal: order.subtotal,
    tax: order.tax,
    tip: order.tip,
    total: order.total,
    payment_method: order.paymentMethod,
    status: 'confirmed',
    created_at: now,
  };
}

/**
 * Helper to build SQL WHERE clause for time ranges
 */
function buildTimeFilter(
  fromMs?: number,
  toMs?: number,
  columnName = 'timestamp'
): { whereClause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (fromMs !== undefined && !isNaN(fromMs)) {
    parts.push(`AND ${columnName} >= ?`);
    params.push(fromMs);
  }
  if (toMs !== undefined && !isNaN(toMs)) {
    parts.push(`AND ${columnName} <= ?`);
    params.push(toMs);
  }

  return {
    whereClause: parts.length > 0 ? ' ' + parts.join(' ') : '',
    params,
  };
}

/**
 * Reset all event and order data
 */
export function resetAllData() {
  const db = getDatabase();
  db.exec(`
    DELETE FROM events;
    DELETE FROM identities;
    DELETE FROM orders;
  `);
}

/**
 * Populate realistic 7-day restaurant analytics history
 */
export function seedHistoricData() {
  const db = getDatabase();
  resetAllData();

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const mockUsers = [
    { id: 'usr_sarah', name: 'Sarah Jenkins', email: 'sarah.j@example.com' },
    { id: 'usr_marcus', name: 'Marcus Sterling', email: 'marcus.s@example.com' },
    { id: 'usr_elena', name: 'Elena Rostova', email: 'elena.r@example.com' },
    { id: 'usr_devon', name: 'Devon Miller', email: 'devon.m@example.com' },
    { id: 'usr_aisha', name: 'Aisha Patel', email: 'aisha.p@example.com' },
    { id: 'usr_liam', name: 'Liam O’Connor', email: 'liam.oc@example.com' },
  ];

  const menuItems = [
    { id: 'item_ribeye', name: 'Prime Tomahawk Ribeye', price: 58.0, category: 'grill' },
    { id: 'item_smashburger', name: 'Truffle Bacon Smashburger', price: 24.5, category: 'burger' },
    { id: 'item_margherita', name: 'Wood-Fired Margherita D.O.P.', price: 21.0, category: 'pizza' },
    { id: 'item_burrata', name: 'Heirloom Burrata Crostini', price: 16.5, category: 'starter' },
    { id: 'item_lavacake', name: 'Smoked Bourbon Lava Cake', price: 14.0, category: 'dessert' },
    { id: 'item_oldfashioned', name: 'Kitchen Spurs Smoked Old Fashioned', price: 18.0, category: 'drinks' },
  ];

  const pages = [
    { path: '/', title: 'Kitchen Spurs | Artisanal Kitchen & Grill' },
    { path: '/menu', title: 'Menu & Daily Specials | Kitchen Spurs' },
    { path: '/menu/steaks', title: 'Wood-Fired Steaks | Kitchen Spurs' },
    { path: '/menu/pizzas', title: 'Artisan Neapolitan Pizzas | Kitchen Spurs' },
    { path: '/cart', title: 'Your Order Cart | Kitchen Spurs' },
    { path: '/checkout', title: 'Secure Checkout | Kitchen Spurs' },
  ];

  const eventsToInsert: IngestEventInput[] = [];

  // Generate 7 days of traffic
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const dayBaseTime = now - dayOffset * DAY_MS;
    // Vary daily visitor volume: weekends higher
    const sessionCount = 18 + Math.floor(Math.random() * 14);

    for (let s = 0; s < sessionCount; s++) {
      const anonId = `anon_${randomUUID().slice(0, 12)}`;
      const sessionId = `sess_${randomUUID().slice(0, 12)}`;
      const isKnownUser = Math.random() > 0.45;
      const user = isKnownUser ? mockUsers[Math.floor(Math.random() * mockUsers.length)] : null;
      const hourOffset = Math.floor(Math.random() * 14) + 10; // 10 AM to midnight
      const minuteOffset = Math.floor(Math.random() * 55);
      const sessionTime = dayBaseTime + hourOffset * 3600 * 1000 + minuteOffset * 60 * 1000;

      // 1. Home page visit
      eventsToInsert.push({
        eventId: randomUUID(),
        eventName: 'page_view',
        source: 'browser',
        anonymousId: anonId,
        userId: user?.id,
        sessionId,
        timestamp: sessionTime,
        page: pages[0],
        context: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0',
          locale: 'en-US',
          timezone: 'America/New_York',
        },
      });

      // 2. Menu page visit (75% probability)
      if (Math.random() > 0.25) {
        eventsToInsert.push({
          eventId: randomUUID(),
          eventName: 'page_view',
          source: 'browser',
          anonymousId: anonId,
          userId: user?.id,
          sessionId,
          timestamp: sessionTime + 25000,
          page: pages[1],
        });

        // 3. View Item (65% probability)
        const viewedItem = menuItems[Math.floor(Math.random() * menuItems.length)];
        eventsToInsert.push({
          eventId: randomUUID(),
          eventName: 'view_item',
          source: 'browser',
          anonymousId: anonId,
          userId: user?.id,
          sessionId,
          timestamp: sessionTime + 55000,
          page: { path: `/menu/${viewedItem.category}`, title: viewedItem.name },
          properties: {
            itemId: viewedItem.id,
            name: viewedItem.name,
            price: viewedItem.price,
            category: viewedItem.category,
          },
        });

        // 4. Add to Cart (45% probability)
        if (Math.random() > 0.55) {
          eventsToInsert.push({
            eventId: randomUUID(),
            eventName: 'add_to_cart',
            source: 'browser',
            anonymousId: anonId,
            userId: user?.id,
            sessionId,
            timestamp: sessionTime + 85000,
            properties: {
              itemId: viewedItem.id,
              name: viewedItem.name,
              price: viewedItem.price,
              quantity: 1,
            },
          });

          // 5. Begin Checkout (30% probability)
          if (Math.random() > 0.5) {
            eventsToInsert.push({
              eventId: randomUUID(),
              eventName: 'begin_checkout',
              source: 'browser',
              anonymousId: anonId,
              userId: user?.id,
              sessionId,
              timestamp: sessionTime + 120000,
              page: pages[5],
            });

            // 6. Complete Order (20% probability of total sessions)
            if (Math.random() > 0.45 && user) {
              const subtotal = viewedItem.price * 2;
              const tax = Number((subtotal * 0.08875).toFixed(2));
              const tip = Number((subtotal * 0.18).toFixed(2));
              const total = Number((subtotal + tax + tip).toFixed(2));
              const orderId = `ord_${randomUUID().replace(/-/g, '').slice(0, 10)}`;

              // Insert Order in DB
              const orderStmt = db.prepare(`
                INSERT INTO orders (
                  id, customer_name, customer_email, dining_option,
                  table_number, delivery_address, items, subtotal, tax, tip, total,
                  payment_method, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              orderStmt.run(
                orderId,
                user.name,
                user.email,
                'dine-in',
                'Table 14',
                null,
                JSON.stringify([
                  { id: viewedItem.id, name: viewedItem.name, price: viewedItem.price, quantity: 2 },
                ]),
                subtotal,
                tax,
                tip,
                total,
                'apple_pay',
                'confirmed',
                sessionTime + 160000
              );

              // Server Event: order_created (Critical Server Business Event!)
              eventsToInsert.push({
                eventId: `evt_${orderId}`,
                eventName: 'order_created',
                source: 'server',
                anonymousId: anonId,
                userId: user.id,
                sessionId,
                timestamp: sessionTime + 160000,
                properties: {
                  orderId,
                  subtotal,
                  tax,
                  tip,
                  total,
                  itemCount: 2,
                  diningOption: 'dine-in',
                  paymentMethod: 'apple_pay',
                  customerEmail: user.email,
                },
                context: {
                  serverEnvironment: 'production',
                  platform: 'Node.js/Next.js API Engine',
                },
              });
            }
          }
        }
      }
    }
  }

  insertEvents(eventsToInsert);
}

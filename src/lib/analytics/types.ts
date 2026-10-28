/**
 * Ember Analytics Core Data Types & Contracts
 */

export type EventSource = 'browser' | 'server';

export interface DeviceContext {
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  locale?: string;
  timezone?: string;
  platform?: string;
  ip?: string;
  library?: {
    name: string;
    version: string;
  };
  serverEnvironment?: string;
}

export interface PageContext {
  url?: string;
  path?: string;
  title?: string;
  referrer?: string;
}

export interface IngestEventInput {
  eventId?: string; // Client/caller-generated UUID for idempotency
  eventName: string;
  source: EventSource;
  anonymousId: string;
  userId?: string | null;
  sessionId: string;
  timestamp?: number; // Epoch ms
  page?: PageContext;
  properties?: Record<string, unknown>;
  context?: DeviceContext;
}

export interface StoredEvent {
  id: string;
  event_id: string;
  event_name: string;
  source: EventSource;
  anonymous_id: string;
  user_id: string | null;
  session_id: string;
  timestamp: number;
  received_at: number;
  page_url: string | null;
  page_path: string | null;
  page_title: string | null;
  referrer: string | null;
  properties: string; // JSON string
  context: string; // JSON string
}

export interface IdentityRecord {
  id: number;
  user_id: string;
  anonymous_id: string;
  traits: string; // JSON string
  identified_at: number;
}

// Ingestion API Request
export interface IngestionPayload {
  writeKey?: string;
  events: IngestEventInput[];
}

export interface IngestionResponse {
  success: boolean;
  received: number;
  inserted: number;
  duplicates: number;
  errors?: string[];
}

// Analytics Aggregate Types
export interface OverviewMetrics {
  totalPageViews: number;
  uniqueVisitors: number;
  totalSessions: number;
  bounceRatePercent: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  browserEventsCount: number;
  serverEventsCount: number;
  cartAdditionCount: number;
}

export interface TimeSeriesPoint {
  timeBucket: string;
  pageViews: number;
  uniqueVisitors: number;
  orders: number;
  revenue: number;
}

export interface PageStat {
  path: string;
  title: string;
  views: number;
  uniqueVisitors: number;
  sharePercent: number;
}

export interface EventBreakdownItem {
  eventName: string;
  source: EventSource;
  count: number;
  percentage: number;
}

export interface FunnelStep {
  name: string;
  label: string;
  count: number;
  conversionPercent: number; // vs step 1
  dropoffPercent: number;
}

// Restaurant Domain Models
export interface MenuItem {
  id: string;
  name: string;
  category: 'grill' | 'pizza' | 'burger' | 'starter' | 'dessert' | 'drinks';
  description: string;
  price: number;
  image: string;
  badge?: string;
  calories?: number;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  notes?: string;
}

export interface OrderInput {
  customerName: string;
  customerEmail: string;
  diningOption: 'dine-in' | 'takeout' | 'delivery';
  tableNumber?: string;
  deliveryAddress?: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  paymentMethod: string;
  anonymousId: string;
  sessionId: string;
}

export interface OrderRecord {
  id: string;
  customer_name: string;
  customer_email: string;
  dining_option: string;
  table_number: string | null;
  delivery_address: string | null;
  items: string; // JSON
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string;
  status: string;
  created_at: number;
}

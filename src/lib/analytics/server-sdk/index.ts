/**
 * Ember Server Tracking SDK
 * Lightweight, robust client for dispatching business events from server-side services.
 *
 * Designed for:
 * - Transactional business events (e.g., `order_created`, `payment_succeeded`, `refund_processed`)
 * - Idempotency guarantee (prevents duplicate counting on server retries)
 * - Server context enrichment (environment, process runtime, timestamps)
 * - Non-blocking execution (never throws or crashes business transactions)
 */

import { randomUUID } from 'node:crypto';
import type { IngestEventInput, DeviceContext } from '../types';
import { insertEvents } from '../../db';

export interface ServerAnalyticsConfig {
  endpoint?: string;
  apiKey?: string;
  environment?: string;
  directDbMode?: boolean; // When running co-located in the same application
  onError?: (err: unknown, event: IngestEventInput) => void;
}

export interface ServerTrackParams {
  event: string;
  userId?: string | null;
  anonymousId?: string;
  sessionId?: string;
  idempotencyKey?: string;
  properties?: Record<string, unknown>;
  context?: Partial<DeviceContext>;
  timestamp?: number;
}

export interface ServerIdentifyParams {
  userId: string;
  traits: Record<string, unknown>;
  anonymousId?: string;
  sessionId?: string;
}

export type ServerEventCallback = (event: IngestEventInput) => void;

export class EmberServerAnalytics {
  private endpoint: string;
  private apiKey: string;
  private environment: string;
  private directDbMode: boolean;
  private onError?: (err: unknown, event: IngestEventInput) => void;
  private listeners: Set<ServerEventCallback> = new Set();

  constructor(config: ServerAnalyticsConfig = {}) {
    this.endpoint = config.endpoint || 'http://localhost:3000/api/v1/events';
    this.apiKey = config.apiKey || process.env.EMBER_SERVER_KEY || 'sk_ember_live_default';
    this.environment = config.environment || process.env.NODE_ENV || 'production';
    this.directDbMode = config.directDbMode ?? true; // Default to direct DB for zero-latency local Next.js API
    this.onError = config.onError;
  }

  /**
   * Track a server-side business event (e.g. order_created)
   */
  public async track(params: ServerTrackParams): Promise<boolean> {
    const eventId = params.idempotencyKey || `srv_${randomUUID()}`;
    const timestamp = params.timestamp || Date.now();

    const event: IngestEventInput = {
      eventId,
      eventName: params.event,
      source: 'server',
      anonymousId: params.anonymousId || `anon_srv_${randomUUID().slice(0, 8)}`,
      userId: params.userId || null,
      sessionId: params.sessionId || `sess_srv_${randomUUID().slice(0, 8)}`,
      timestamp,
      properties: params.properties || {},
      context: {
        serverEnvironment: this.environment,
        platform: `Node.js ${process.version}`,
        library: {
          name: 'ember-server-sdk',
          version: '1.0.0',
        },
        ...params.context,
      },
    };

    return this.dispatch(event);
  }

  /**
   * Identify a user and attach server traits
   */
  public async identify(params: ServerIdentifyParams): Promise<boolean> {
    const event: IngestEventInput = {
      eventId: `srv_id_${randomUUID()}`,
      eventName: 'identify',
      source: 'server',
      anonymousId: params.anonymousId || `anon_srv_${randomUUID().slice(0, 8)}`,
      userId: params.userId,
      sessionId: params.sessionId || `sess_srv_${randomUUID().slice(0, 8)}`,
      timestamp: Date.now(),
      properties: params.traits,
      context: {
        serverEnvironment: this.environment,
        platform: `Node.js ${process.version}`,
      },
    };

    return this.dispatch(event);
  }

  /**
   * Register listener for real-time debugger
   */
  public onEvent(callback: ServerEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private async dispatch(event: IngestEventInput): Promise<boolean> {
    // Notify debug listeners
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch {
        // Ignore subscriber errors
      }
    });

    try {
      if (this.directDbMode) {
        // Direct local storage mode: avoids HTTP round-trip overhead
        insertEvents([event]);
        return true;
      }

      // Remote HTTP mode
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          events: [event],
        }),
      });

      if (!response.ok) {
        throw new Error(`Server tracking HTTP error: ${response.status}`);
      }

      return true;
    } catch (err) {
      if (this.onError) {
        this.onError(err, event);
      } else {
        console.error('[EmberServerAnalytics] Tracking failed:', err);
      }
      return false;
    }
  }
}

// Global server singleton
export const serverAnalytics = new EmberServerAnalytics();

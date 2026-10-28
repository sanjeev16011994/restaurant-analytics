/**
 * Ember Browser Analytics SDK
 * A lightweight, zero-dependency, resilient client-side event tracking library.
 *
 * Features:
 * - Persistent anonymous identity & 30-min sliding window session tracking
 * - User identification & trait aliasing
 * - Micro-batching with configurable flush interval and queue limits
 * - Unload resilience via navigator.sendBeacon & keepalive fetch
 * - Offline localStorage persistence & exponential backoff retry
 * - Automatic client context enrichment (viewport, screen, referrer, timezone)
 * - Real-time event listener hook for UI debuggers
 */

import type { IngestEventInput, DeviceContext, PageContext } from '../types';

export interface BrowserSDKConfig {
  endpoint?: string;
  writeKey?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  debug?: boolean;
  autoTrackPages?: boolean;
}

export type EventCallback = (event: IngestEventInput) => void;

const STORAGE_KEYS = {
  ANONYMOUS_ID: '_ea_anon_id',
  SESSION_ID: '_ea_session_id',
  SESSION_EXP: '_ea_session_exp',
  USER_ID: '_ea_user_id',
  USER_TRAITS: '_ea_user_traits',
  OFFLINE_QUEUE: '_ea_offline_queue',
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout

export class EmberAnalytics {
  private endpoint: string;
  private writeKey: string;
  private batchSize: number;
  private flushIntervalMs: number;
  private maxQueueSize: number;
  private debug: boolean;
  private autoTrackPages: boolean;

  private queue: IngestEventInput[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private isFlushing = false;
  private retryCount = 0;
  private listeners: Set<EventCallback> = new Set();

  constructor(config: BrowserSDKConfig = {}) {
    this.endpoint = config.endpoint || '/api/v1/events';
    this.writeKey = config.writeKey || 'pk_ember_live_default';
    this.batchSize = config.batchSize ?? 5;
    this.flushIntervalMs = config.flushIntervalMs ?? 2500;
    this.maxQueueSize = config.maxQueueSize ?? 100;
    this.debug = config.debug ?? false;
    this.autoTrackPages = config.autoTrackPages ?? true;
  }

  /**
   * Initializes SDK, sets up timers, unload hooks, and page tracking
   */
  public init(config?: BrowserSDKConfig): this {
    if (typeof window === 'undefined') return this;
    if (this.initialized) return this;

    if (config) {
      if (config.endpoint) this.endpoint = config.endpoint;
      if (config.writeKey) this.writeKey = config.writeKey;
      if (config.batchSize !== undefined) this.batchSize = config.batchSize;
      if (config.flushIntervalMs !== undefined) this.flushIntervalMs = config.flushIntervalMs;
      if (config.maxQueueSize !== undefined) this.maxQueueSize = config.maxQueueSize;
      if (config.debug !== undefined) this.debug = config.debug;
      if (config.autoTrackPages !== undefined) this.autoTrackPages = config.autoTrackPages;
    }

    this.log('Initializing Ember Browser Analytics SDK...');

    // Load offline queued events from previous session
    this.loadOfflineQueue();

    // Start background flush interval
    this.startFlushTimer();

    // Register page unload & visibilitychange hooks for reliable delivery
    this.registerUnloadHooks();

    // Register online/offline network listeners
    window.addEventListener('online', () => {
      this.log('Network online. Flushing queued events...');
      this.flush();
    });

    // Auto page view tracking for SPAs
    if (this.autoTrackPages) {
      this.initAutoPageTracking();
    }

    this.initialized = true;
    return this;
  }

  /**
   * Track a custom event
   */
  public track(eventName: string, properties: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return;

    const event: IngestEventInput = {
      eventId: this.generateUUID(),
      eventName,
      source: 'browser',
      anonymousId: this.getAnonymousId(),
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      timestamp: Date.now(),
      page: this.getPageContext(),
      properties,
      context: this.getDeviceContext(),
    };

    this.enqueue(event);
  }

  /**
   * Track a page view
   */
  public page(name?: string, properties: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return;

    const pageCtx = this.getPageContext();
    if (name) {
      pageCtx.title = name;
    }

    const event: IngestEventInput = {
      eventId: this.generateUUID(),
      eventName: 'page_view',
      source: 'browser',
      anonymousId: this.getAnonymousId(),
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      timestamp: Date.now(),
      page: pageCtx,
      properties: {
        ...properties,
        name: name || pageCtx.title,
      },
      context: this.getDeviceContext(),
    };

    this.enqueue(event);
  }

  /**
   * Identify a user and attach profile traits
   */
  public identify(userId: string, traits: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    localStorage.setItem(STORAGE_KEYS.USER_TRAITS, JSON.stringify(traits));

    const event: IngestEventInput = {
      eventId: this.generateUUID(),
      eventName: 'identify',
      source: 'browser',
      anonymousId: this.getAnonymousId(),
      userId,
      sessionId: this.getSessionId(),
      timestamp: Date.now(),
      page: this.getPageContext(),
      properties: traits,
      context: this.getDeviceContext(),
    };

    this.enqueue(event);
  }

  /**
   * Reset visitor identity (e.g. on logout)
   */
  public reset(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    localStorage.removeItem(STORAGE_KEYS.USER_TRAITS);

    // Generate new anonymous ID
    const newAnonId = `anon_${this.generateUUID()}`;
    localStorage.setItem(STORAGE_KEYS.ANONYMOUS_ID, newAnonId);

    // Refresh session
    this.refreshSession(true);
    this.log('Analytics identity reset. New Anonymous ID:', newAnonId);
  }

  /**
   * Subscribe to dispatched events (useful for live debuggers / consoles)
   */
  public onEvent(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get current persistent anonymous ID
   */
  public getAnonymousId(): string {
    if (typeof window === 'undefined') return '';
    let anonId = localStorage.getItem(STORAGE_KEYS.ANONYMOUS_ID);
    if (!anonId) {
      anonId = `anon_${this.generateUUID()}`;
      localStorage.setItem(STORAGE_KEYS.ANONYMOUS_ID, anonId);
    }
    return anonId;
  }

  /**
   * Get current session ID with sliding 30-min window
   */
  public getSessionId(): string {
    if (typeof window === 'undefined') return '';
    const now = Date.now();
    const expStr = localStorage.getItem(STORAGE_KEYS.SESSION_EXP);
    const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);

    if (sessionId && expStr && now < parseInt(expStr, 10)) {
      // Refresh sliding window
      localStorage.setItem(STORAGE_KEYS.SESSION_EXP, String(now + SESSION_TIMEOUT_MS));
      return sessionId;
    }

    return this.refreshSession();
  }

  /**
   * Get current identified user ID
   */
  public getUserId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.USER_ID) || null;
  }

  /**
   * Manually flush buffered events
   */
  public async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isFlushing) return;
    this.isFlushing = true;

    const batch = [...this.queue];
    this.queue = [];
    this.persistOfflineQueue();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.writeKey}`,
        },
        body: JSON.stringify({
          writeKey: this.writeKey,
          events: batch,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ingestion failed with HTTP status ${response.status}`);
      }

      this.retryCount = 0;
      this.log(`Successfully flushed batch of ${batch.length} events.`);
      this.clearOfflineQueue();
    } catch (err) {
      this.warn('Batch delivery failed. Re-queuing with backoff...', err);
      // Re-enqueue batch at the front of queue
      this.queue = [...batch, ...this.queue].slice(0, this.maxQueueSize);
      this.persistOfflineQueue();

      // Exponential backoff
      this.retryCount++;
      const backoffDelay = Math.min(30000, 1000 * Math.pow(2, this.retryCount));
      setTimeout(() => this.flush(), backoffDelay);
    } finally {
      this.isFlushing = false;
    }
  }

  // --- Private Helpers ---

  private enqueue(event: IngestEventInput): void {
    this.queue.push(event);
    this.log(`[Track] ${event.eventName}:`, event);

    // Notify real-time subscribers
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        this.warn('Error in event listener callback:', err);
      }
    });

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      this.persistOfflineQueue();
    }
  }

  private refreshSession(force = false): string {
    const now = Date.now();
    const newSessionId = `sess_${this.generateUUID()}`;
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, newSessionId);
    localStorage.setItem(STORAGE_KEYS.SESSION_EXP, String(now + SESSION_TIMEOUT_MS));
    if (force) {
      this.log('Session refreshed:', newSessionId);
    }
    return newSessionId;
  }

  private startFlushTimer(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushIntervalMs);
  }

  private registerUnloadHooks(): void {
    const handleExit = () => {
      if (this.queue.length === 0) return;
      const payload = JSON.stringify({
        writeKey: this.writeKey,
        events: this.queue,
      });

      // Try sendBeacon first (ideal for page exit)
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        const success = navigator.sendBeacon(this.endpoint, blob);
        if (success) {
          this.queue = [];
          this.clearOfflineQueue();
          return;
        }
      }

      // Fallback to fetch keepalive
      try {
        fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.writeKey}`,
          },
          body: payload,
          keepalive: true,
        });
        this.queue = [];
        this.clearOfflineQueue();
      } catch {
        // Queue persists in localStorage for next visit
      }
    };

    // visibilitychange is more reliable on modern mobile & desktop browsers than beforeunload
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleExit();
      }
    });

    window.addEventListener('beforeunload', handleExit);
  }

  private initAutoPageTracking(): void {
    // Track initial page view
    if (typeof window !== 'undefined') {
      // Delay slightly to let document.title render
      setTimeout(() => this.page(), 100);

      // Monkey-patch history.pushState and replaceState for SPA route tracking
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        setTimeout(() => this.page(), 50);
      };

      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        setTimeout(() => this.page(), 50);
      };

      window.addEventListener('popstate', () => {
        setTimeout(() => this.page(), 50);
      });
    }
  }

  private getDeviceContext(): DeviceContext {
    return {
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform,
      library: {
        name: 'ember-browser-sdk',
        version: '1.0.0',
      },
    };
  }

  private getPageContext(): PageContext {
    return {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
    };
  }

  private persistOfflineQueue(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(this.queue));
    } catch {
      // Ignore quota errors
    }
  }

  private loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      if (stored) {
        const events: IngestEventInput[] = JSON.parse(stored);
        if (Array.isArray(events) && events.length > 0) {
          this.queue = [...events, ...this.queue].slice(0, this.maxQueueSize);
          this.log(`Loaded ${events.length} queued events from offline storage.`);
        }
      }
    } catch {
      // Ignore corrupted data
    }
  }

  private clearOfflineQueue(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    } catch {
      // Ignore
    }
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[EmberAnalytics]', ...args);
    }
  }

  private warn(...args: unknown[]): void {
    if (this.debug) {
      console.warn('[EmberAnalytics]', ...args);
    }
  }
}

// Export singleton instance for simple plug-and-play usage
export const analytics = new EmberAnalytics();

'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Layers,
  ShieldCheck,
  Zap,
  Server,
  Globe,
  Database,
  Code2,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

export const SystemDocsView: React.FC = () => {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const phpSnippet = `<?php
namespace App\\Services;

use Ember\\Analytics\\EmberAnalytics;
use App\\Models\\Order;

class OrderAnalyticsService
{
    protected EmberAnalytics $analytics;

    public function __construct()
    {
        $this->analytics = new EmberAnalytics([
            'endpoint' => config('services.ember_analytics.endpoint'),
            'api_key'  => config('services.ember_analytics.api_key'),
            'timeout'  => 3,
        ]);
    }

    /**
     * Dispatch critical business event upon confirmed payment
     */
    public function recordOrderPlaced(Order $order): bool
    {
        return $this->analytics->track([
            'event'          => 'order_created',
            'user_id'        => (string) $order->user_id,
            'anonymous_id'   => request()->cookie('_ksa_anon_id') ?? 'anon_guest',
            'session_id'     => request()->cookie('_ksa_session_id') ?? 'sess_server',
            'idempotency_key'=> 'evt_ord_' . $order->id, // Deduplication guarantee
            'properties'     => [
                'order_id'       => $order->id,
                'subtotal'       => $order->subtotal,
                'tax'            => $order->tax,
                'tip'            => $order->tip,
                'total'          => $order->total,
                'dining_option'  => $order->dining_option,
                'payment_method' => $order->payment_method,
                'item_count'     => $order->items->count(),
            ],
            'context' => [
                'serverEnvironment' => app()->environment(),
                'platform'          => 'Laravel 11 / PHP ' . PHP_VERSION,
            ],
        ]);
    }
}`;

  const browserSnippet = `import { analytics } from '@/lib/analytics/browser-sdk';

// 1. Initialize
analytics.init({
  endpoint: '/api/v1/events',
  writeKey: 'pk_ks_live_default',
  batchSize: 5,
  flushIntervalMs: 2500,
  autoTrackPages: true,
});

// 2. Track Custom Interactions
analytics.track('add_to_cart', {
  itemId: 'item_ribeye',
  name: 'Prime Tomahawk Ribeye',
  price: 68.0,
  quantity: 1,
});

// 3. User Identification
analytics.identify('alexander.reed@example.com', {
  name: 'Alexander Reed',
  preferredDining: 'dine-in',
});`;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-12">
      {/* Title */}
      <div className="border-b border-stone-800 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3 border border-emerald-500/30">
          <BookOpen className="w-3.5 h-3.5" />
          Technical Architecture & Specification
        </div>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-3">
          Ember Analytics Engine
        </h1>
        <p className="text-stone-300 text-sm sm:text-base leading-relaxed max-w-3xl">
          A high-reliability, dual-tier event tracking system capturing client-side UI telemetry
          and server-side transactional events into an indexed SQLite analytics warehouse.
        </p>
      </div>

      {/* Architecture Diagram */}
      <section className="bg-stone-900/80 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <h2 className="font-serif font-bold text-xl text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          System Architecture & Data Flow
        </h2>

        {/* Diagram Flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          {/* Client SDK */}
          <div className="bg-stone-950 border border-sky-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-center gap-2 text-sky-400 font-bold">
              <Globe className="w-4 h-4" />
              <span>Browser SDK (Client)</span>
            </div>
            <p className="text-stone-400 text-[11px] font-sans">
              Captures pageviews, clicks, menu views, and add-to-carts.
            </p>
            <ul className="space-y-1.5 text-stone-300 text-[11px]">
              <li>• Auto-generates Anonymous ID</li>
              <li>• 30-min Sliding Session Window</li>
              <li>• Micro-batch queue (5 events / 2.5s)</li>
              <li>• sendBeacon unload flush</li>
              <li>• Offline localStorage cache</li>
            </ul>
            <div className="pt-2 border-t border-stone-800 text-sky-400 text-[10px]">
              Auth: Bearer pk_ks_live_...
            </div>
          </div>

          {/* Ingestion & Storage API */}
          <div className="bg-stone-950 border border-amber-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Database className="w-4 h-4" />
              <span>Ingestion & SQLite DB</span>
            </div>
            <p className="text-stone-400 text-[11px] font-sans">
              High-throughput validation, deduplication, and indexed persistence.
            </p>
            <ul className="space-y-1.5 text-stone-300 text-[11px]">
              <li>• POST /api/v1/events</li>
              <li>• Idempotency via event_id</li>
              <li>• SQLite in WAL Mode (Sync: NORMAL)</li>
              <li>• Indexed timestamp, session, user</li>
              <li>• Real-time aggregation endpoints</li>
            </ul>
            <div className="pt-2 border-t border-stone-800 text-amber-400 text-[10px]">
              Storage: data/analytics.db
            </div>
          </div>

          {/* Server SDK */}
          <div className="bg-stone-950 border border-purple-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-center gap-2 text-purple-400 font-bold">
              <Server className="w-4 h-4" />
              <span>Server SDK (Backend)</span>
            </div>
            <p className="text-stone-400 text-[11px] font-sans">
              Tracks mission-critical transactional business events.
            </p>
            <ul className="space-y-1.5 text-stone-300 text-[11px]">
              <li>• order_created, refunds, reservations</li>
              <li>• Order ID idempotency key</li>
              <li>• Server context injection</li>
              <li>• Non-blocking execution</li>
              <li>• Node.js & PHP/Laravel SDKs</li>
            </ul>
            <div className="pt-2 border-t border-stone-800 text-purple-400 text-[10px]">
              Auth: Bearer sk_ks_live_...
            </div>
          </div>
        </div>
      </section>

      {/* Identity Resolution Model */}
      <section className="bg-stone-900/80 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <h2 className="font-serif font-bold text-xl text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Identity Resolution Model
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-stone-300 leading-relaxed font-sans">
          <div className="bg-stone-950 p-5 rounded-2xl border border-stone-800">
            <h3 className="font-bold text-white text-sm mb-2 text-amber-400">1. Anonymous Visitor ID</h3>
            <p>
              When a visitor lands on the site for the first time, the Browser SDK generates a persistent UUIDv4 stored in <code className="text-amber-300 bg-stone-900 px-1 py-0.5 rounded">localStorage._ksa_anon_id</code>. This ID stays with the device across tabs, page reloads, and browser restarts.
            </p>
          </div>

          <div className="bg-stone-950 p-5 rounded-2xl border border-stone-800">
            <h3 className="font-bold text-white text-sm mb-2 text-sky-400">2. Sliding Session ID</h3>
            <p>
              A separate session ID is generated and accompanied by an expiration timestamp with a <strong>30-minute inactivity sliding window</strong>. Every event touch extends the window. If the user is idle for more than 30 minutes, the next interaction automatically spawns a fresh session.
            </p>
          </div>

          <div className="bg-stone-950 p-5 rounded-2xl border border-stone-800">
            <h3 className="font-bold text-white text-sm mb-2 text-purple-400">3. Identity Aliasing</h3>
            <p>
              When a customer logs in or submits their checkout info, the application triggers <code className="text-purple-300 bg-stone-900 px-1 py-0.5 rounded">analytics.identify(userId, traits)</code>. The server links the existing <code className="text-stone-300 font-mono">anonymous_id</code> to the verified <code className="text-stone-300 font-mono">user_id</code> in the <code className="text-stone-300 font-mono">identities</code> table, attributing pre-login activity!
            </p>
          </div>
        </div>
      </section>

      {/* Delivery Guarantees & Resilience */}
      <section className="bg-stone-900/80 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <h2 className="font-serif font-bold text-xl text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Delivery Guarantees & Failure Handling
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-stone-300">
          <div className="space-y-4">
            <div className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-sm">Micro-Batching & Timers</strong>
                Events are buffered in memory and flushed automatically every 2.5 seconds or immediately when the queue reaches 5 events. This prevents overwhelming the server with high-frequency HTTP requests.
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-sm">Zero Drop on Page Navigation (sendBeacon)</strong>
                Traditional fetch requests are aborted when users close or navigate away from a tab. The Browser SDK registers listeners on <code className="bg-stone-950 px-1 rounded text-amber-300">visibilitychange (hidden)</code> and <code className="bg-stone-950 px-1 rounded text-amber-300">beforeunload</code> using <code className="bg-stone-950 px-1 rounded text-sky-300">navigator.sendBeacon</code> and <code className="bg-stone-950 px-1 rounded text-sky-300">fetch(..., {'{'} keepalive: true {'}'})</code>.
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-sm">Offline Storage & Exponential Backoff</strong>
                If the user loses internet connection or the ingestion endpoint encounters transient 5xx errors, events are serialized to <code className="bg-stone-950 px-1 rounded text-amber-300">localStorage._ksa_offline_queue</code> and retried with exponential backoff upon network restoration.
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block text-sm">Server Idempotency Keys</strong>
                For critical transactional events such as <code className="bg-stone-950 px-1 rounded text-purple-300">order_created</code>, the server tracking helper uses the business Order ID as the idempotency key (<code className="bg-stone-950 px-1 rounded text-purple-300">event_id = evt_ord_...</code>) so server retries never result in duplicate orders or revenue.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Code Examples: Browser SDK & PHP / Laravel SDK */}
      <section className="bg-stone-900/80 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <h2 className="font-serif font-bold text-xl text-white flex items-center gap-2">
          <Code2 className="w-5 h-5 text-sky-400" />
          Integration Examples: Browser SDK & Laravel / PHP Helper
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TypeScript Browser SDK */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-stone-400">
              <span className="text-sky-400 font-bold">Browser SDK (React / Next.js)</span>
              <button
                onClick={() => handleCopy('browser', browserSnippet)}
                className="flex items-center gap-1 hover:text-white"
              >
                {copiedSnippet === 'browser' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet === 'browser' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="bg-stone-950 border border-stone-800 p-4 rounded-2xl text-[11px] font-mono text-sky-300 overflow-x-auto leading-relaxed max-h-80">
              {browserSnippet}
            </pre>
          </div>

          {/* PHP / Laravel SDK */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-stone-400">
              <span className="text-purple-400 font-bold">Server Helper (Laravel / PHP)</span>
              <button
                onClick={() => handleCopy('php', phpSnippet)}
                className="flex items-center gap-1 hover:text-white"
              >
                {copiedSnippet === 'php' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet === 'php' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="bg-stone-950 border border-stone-800 p-4 rounded-2xl text-[11px] font-mono text-purple-300 overflow-x-auto leading-relaxed max-h-80">
              {phpSnippet}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};

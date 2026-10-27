'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Users,
  Eye,
  ShoppingBag,
  TrendingUp,
  RefreshCw,
  Database,
  Trash2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Globe,
  Server,
  Monitor,
  Activity,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import type {
  OverviewMetrics,
  TimeSeriesPoint,
  PageStat,
  EventBreakdownItem,
  FunnelStep,
  StoredEvent,
} from '@/lib/analytics/types';

type DateFilterPreset = 'today' | '24h' | '7d' | '30d' | 'all';

export const AnalyticsDashboard: React.FC = () => {
  const [preset, setPreset] = useState<DateFilterPreset>('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Metrics states
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [pages, setPages] = useState<PageStat[]>([]);
  const [eventsBreakdown, setEventsBreakdown] = useState<EventBreakdownItem[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [liveEvents, setLiveEvents] = useState<StoredEvent[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedEventNameFilter, setSelectedEventNameFilter] = useState<string>('all');

  // Compute time range based on preset
  const getTimeBounds = useCallback(() => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    switch (preset) {
      case 'today': {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return { from: startOfToday.getTime(), to: now, grain: 'hour' as const };
      }
      case '24h':
        return { from: now - DAY_MS, to: now, grain: 'hour' as const };
      case '7d':
        return { from: now - 7 * DAY_MS, to: now, grain: 'day' as const };
      case '30d':
        return { from: now - 30 * DAY_MS, to: now, grain: 'day' as const };
      case 'all':
      default:
        return { from: undefined, to: undefined, grain: 'day' as const };
    }
  }, [preset]);

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const { from, to, grain } = getTimeBounds();
    const queryParams = new URLSearchParams();
    if (from) queryParams.set('from', String(from));
    if (to) queryParams.set('to', String(to));

    try {
      // Parallel requests
      const [ovRes, tsRes, pgRes, evRes, fnRes, lvRes] = await Promise.all([
        fetch(`/api/v1/analytics/overview?${queryParams}`),
        fetch(`/api/v1/analytics/timeseries?${queryParams}&grain=${grain}`),
        fetch(`/api/v1/analytics/pages?${queryParams}&limit=8`),
        fetch(`/api/v1/analytics/events?${queryParams}`),
        fetch(`/api/v1/analytics/funnel?${queryParams}`),
        fetch('/api/v1/analytics/live?limit=30'),
      ]);

      const [ovData, tsData, pgData, evData, fnData, lvData] = await Promise.all([
        ovRes.json(),
        tsRes.json(),
        pgRes.json(),
        evRes.json(),
        fnRes.json(),
        lvRes.json(),
      ]);

      setOverview(ovData);
      setTimeSeries(tsData.timeSeries || []);
      setPages(pgData.pages || []);
      setEventsBreakdown(evData.events || []);
      setFunnel(fnData.funnel || []);
      setLiveEvents(lvData.events || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getTimeBounds]);

  // Initial fetch and preset changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Seed demo data handler
  const handleSeedData = async () => {
    if (!confirm('Populate 7 days of realistic restaurant traffic and orders?')) return;
    setIsLoading(true);
    try {
      await fetch('/api/v1/analytics/seed', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('Seed error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset data handler
  const handleResetData = async () => {
    if (!confirm('Are you sure you want to clear all analytics and order records?')) return;
    setIsLoading(true);
    try {
      await fetch('/api/v1/analytics/reset', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter live events by name
  const filteredLiveEvents = liveEvents.filter((ev) =>
    selectedEventNameFilter === 'all' ? true : ev.event_name === selectedEventNameFilter
  );

  // Maximum value in time series for chart scaling
  const maxViewsInSeries = Math.max(
    ...timeSeries.map((t) => Math.max(t.pageViews, t.uniqueVisitors, 1)),
    10
  );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white">
              Analytics Control Center
            </h1>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Browser client streams, server-side business transactions, and conversion funnel metrics.
          </p>
        </div>

        {/* Date Filter & Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl p-1">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '24h', label: '24h' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'all', label: 'All' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  preset === p.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-stone-900 border-stone-800 text-stone-400'
            }`}
            title="Auto-refresh metrics every 5 seconds"
          >
            <Activity className={`w-3.5 h-3.5 ${autoRefresh ? 'text-emerald-400 animate-pulse' : ''}`} />
            <span>{autoRefresh ? 'Live' : 'Paused'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 transition-colors"
            title="Refresh metrics now"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Seed Historic Data */}
          <button
            onClick={handleSeedData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Populate 7 days of realistic restaurant traffic"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Seed 7-Day Data</span>
          </button>

          {/* Reset Data */}
          <button
            onClick={handleResetData}
            className="p-2 rounded-xl bg-stone-900 hover:bg-red-950/40 text-stone-400 hover:text-red-400 border border-stone-800 transition-colors"
            title="Clear all events and orders"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Page Views */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Page Views</span>
            <Eye className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {overview?.totalPageViews.toLocaleString() ?? '—'}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Browser tracking</span>
        </div>

        {/* Unique Visitors */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Unique Visitors</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {overview?.uniqueVisitors.toLocaleString() ?? '—'}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">Distinct Anonymous IDs</span>
        </div>

        {/* Sessions & Bounce Rate */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Sessions</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {overview?.totalSessions.toLocaleString() ?? '—'}
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            Bounce: <strong className="text-amber-400">{overview?.bounceRatePercent ?? 0}%</strong>
          </span>
        </div>

        {/* Orders Placed */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Orders Placed</span>
            <ShoppingBag className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {overview?.totalOrders.toLocaleString() ?? '—'}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Cart Adds: {overview?.cartAdditionCount ?? 0}
          </span>
        </div>

        {/* Total Revenue */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            ${overview?.totalRevenue.toLocaleString() ?? '0.00'}
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            AOV: ${overview?.avgOrderValue.toFixed(2) ?? '0.00'}
          </span>
        </div>

        {/* Source Split: Browser vs Server */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-stone-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Event Source</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-stone-950 p-1.5 rounded-lg border border-stone-800 text-center">
              <span className="text-[10px] uppercase text-sky-400 font-semibold block">Browser</span>
              <span className="text-sm font-mono font-bold text-white">
                {overview?.browserEventsCount ?? 0}
              </span>
            </div>
            <div className="flex-1 bg-stone-950 p-1.5 rounded-lg border border-stone-800 text-center">
              <span className="text-[10px] uppercase text-purple-400 font-semibold block">Server</span>
              <span className="text-sm font-mono font-bold text-white">
                {overview?.serverEventsCount ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row: Time Series Traffic & Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Time-Series Area Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-stone-900/80 border border-stone-800/80 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-serif font-bold text-lg text-white">Traffic & Orders Trend</h2>
              <p className="text-xs text-stone-400">
                Page views (blue), unique visitors (emerald), and orders created over time.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                Page Views
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Unique Visitors
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Orders
              </span>
            </div>
          </div>

          {/* Responsive SVG Bar / Area Chart */}
          {timeSeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-stone-500 text-xs">
              No traffic events recorded in this time range. Click &ldquo;Seed 7-Day Data&rdquo; or browse the restaurant to generate events.
            </div>
          ) : (
            <div className="h-64 flex items-end gap-2 pt-6 pb-2 border-b border-stone-800">
              {timeSeries.map((point) => {
                const pvHeight = Math.max(8, (point.pageViews / maxViewsInSeries) * 100);
                const uvHeight = Math.max(6, (point.uniqueVisitors / maxViewsInSeries) * 100);
                const orderHeight = Math.max(4, ((point.orders * 3) / maxViewsInSeries) * 100);

                return (
                  <div
                    key={point.timeBucket}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip on Hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center pointer-events-none whitespace-nowrap bg-stone-950 border border-stone-700 px-2.5 py-1.5 rounded-xl shadow-xl text-[10px]">
                      <span className="font-semibold text-white">{point.timeBucket}</span>
                      <span className="text-sky-300">Views: {point.pageViews}</span>
                      <span className="text-emerald-300">Visitors: {point.uniqueVisitors}</span>
                      <span className="text-amber-300">
                        Orders: {point.orders} (${point.revenue})
                      </span>
                    </div>

                    {/* Bars Stack / Group */}
                    <div className="w-full max-w-[28px] flex items-end justify-center gap-0.5 h-full">
                      <div
                        style={{ height: `${pvHeight}%` }}
                        className="w-1/2 bg-sky-500/80 group-hover:bg-sky-400 rounded-t transition-all"
                      />
                      <div
                        style={{ height: `${uvHeight}%` }}
                        className="w-1/2 bg-emerald-500/80 group-hover:bg-emerald-400 rounded-t transition-all"
                      />
                    </div>

                    <span className="text-[10px] text-stone-500 font-mono mt-2 truncate w-full text-center">
                      {point.timeBucket.slice(-5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Conversion Funnel (1 Col) */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-serif font-bold text-lg text-white mb-1">E-Commerce Funnel</h2>
            <p className="text-xs text-stone-400 mb-6">
              Step-by-step visitor progression from initial visit to completed order.
            </p>

            <div className="space-y-4">
              {funnel.map((step, idx) => (
                <div key={step.name} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-stone-200">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-stone-400">{step.count} sessions</span>
                      <span className="font-mono font-bold text-amber-400">
                        {step.conversionPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Funnel Progress Bar */}
                  <div className="w-full bg-stone-950 h-3 rounded-full overflow-hidden border border-stone-800">
                    <div
                      style={{ width: `${Math.max(step.conversionPercent, 3)}%` }}
                      className={`h-full rounded-full transition-all duration-700 ${
                        idx === 0
                          ? 'bg-sky-500'
                          : idx === 1
                          ? 'bg-blue-500'
                          : idx === 2
                          ? 'bg-indigo-500'
                          : idx === 3
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>

                  {idx > 0 && step.dropoffPercent > 0 && (
                    <span className="text-[10px] text-red-400/80 block text-right">
                      ↓ {step.dropoffPercent}% drop-off from previous step
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-stone-800 text-[11px] text-stone-400 flex items-center justify-between">
            <span>Overall Visitor-to-Order Conversion:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {funnel.length > 0 ? funnel[funnel.length - 1]?.conversionPercent : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Popular Pages & Event Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Pages Table */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif font-bold text-lg text-white">Popular Pages</h2>
              <p className="text-xs text-stone-400">Top visited URLs and visitor distribution.</p>
            </div>
            <Globe className="w-4 h-4 text-stone-400" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 font-semibold">Page Path</th>
                  <th className="py-2.5 font-semibold text-right">Views</th>
                  <th className="py-2.5 font-semibold text-right">Unique Visitors</th>
                  <th className="py-2.5 font-semibold text-right">Traffic Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {pages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-stone-500">
                      No page view data available.
                    </td>
                  </tr>
                ) : (
                  pages.map((p) => (
                    <tr key={p.path} className="hover:bg-stone-800/30 transition-colors">
                      <td className="py-3 font-mono text-stone-300">
                        <span className="text-white font-medium">{p.path}</span>
                        <span className="block text-[11px] text-stone-500 truncate max-w-xs">
                          {p.title}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-white">{p.views}</td>
                      <td className="py-3 text-right font-mono text-stone-400">{p.uniqueVisitors}</td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-stone-300">{p.sharePercent}%</span>
                          <div className="w-12 bg-stone-950 h-1.5 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${p.sharePercent}%` }}
                              className="bg-indigo-500 h-full rounded-full"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Event Breakdown */}
        <div className="bg-stone-900/80 border border-stone-800/80 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif font-bold text-lg text-white">Event Breakdown</h2>
              <p className="text-xs text-stone-400">Captured event types and delivery source.</p>
            </div>
            <Layers className="w-4 h-4 text-stone-400" />
          </div>

          <div className="space-y-3">
            {eventsBreakdown.map((ev) => (
              <div
                key={`${ev.eventName}_${ev.source}`}
                className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
                      ev.source === 'server'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {ev.source}
                  </span>
                  <div>
                    <span className="font-mono text-xs font-bold text-white">{ev.eventName}</span>
                    <span className="block text-[10px] text-stone-500">
                      {ev.source === 'server' ? 'Backend business event' : 'Browser SDK interaction'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-white">{ev.count}</span>
                  <span className="block text-[10px] text-stone-400">{ev.percentage}% of total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Event Stream & Raw JSON Inspector */}
      <div className="bg-stone-900/80 border border-stone-800/80 rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <h2 className="font-serif font-bold text-lg text-white">Real-Time Event Stream</h2>
            </div>
            <p className="text-xs text-stone-400">
              Inspect raw event payloads, client context, and identity lineage as they arrive.
            </p>
          </div>

          {/* Event Name Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={selectedEventNameFilter}
              onChange={(e) => setSelectedEventNameFilter(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-300 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Events</option>
              <option value="page_view">page_view</option>
              <option value="view_item">view_item</option>
              <option value="add_to_cart">add_to_cart</option>
              <option value="begin_checkout">begin_checkout</option>
              <option value="order_created">order_created (Server)</option>
              <option value="identify">identify</option>
            </select>
          </div>
        </div>

        {/* Events Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-800 text-stone-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 font-semibold">Event</th>
                <th className="py-2.5 font-semibold">Source</th>
                <th className="py-2.5 font-semibold">Anonymous ID / User</th>
                <th className="py-2.5 font-semibold">Session ID</th>
                <th className="py-2.5 font-semibold">Timestamp</th>
                <th className="py-2.5 font-semibold text-right">Inspect Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono text-[11px]">
              {filteredLiveEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    No recent events matched the filter.
                  </td>
                </tr>
              ) : (
                filteredLiveEvents.map((ev) => {
                  const isExpanded = expandedEventId === ev.id;
                  const timeFormatted = new Date(ev.timestamp).toLocaleTimeString();

                  return (
                    <React.Fragment key={ev.id}>
                      <tr
                        onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                        className={`hover:bg-stone-800/40 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-stone-800/30' : ''
                        }`}
                      >
                        <td className="py-3 font-bold text-white flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          {ev.event_name}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              ev.source === 'server'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {ev.source}
                          </span>
                        </td>
                        <td className="py-3 text-stone-300">
                          <div className="truncate max-w-[160px]" title={ev.anonymous_id}>
                            {ev.anonymous_id}
                          </div>
                          {ev.user_id && (
                            <span className="text-[10px] text-amber-300 font-medium block">
                              User: {ev.user_id}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-stone-400 truncate max-w-[120px]" title={ev.session_id}>
                          {ev.session_id}
                        </td>
                        <td className="py-3 text-stone-400">{timeFormatted}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedEventId(isExpanded ? null : ev.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300"
                          >
                            <span>{isExpanded ? 'Hide' : 'View JSON'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable JSON Details Row */}
                      {isExpanded && (
                        <tr className="bg-stone-950/80">
                          <td colSpan={6} className="p-4 border-b border-stone-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Properties */}
                              <div>
                                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                                  Custom Event Properties (JSON)
                                </span>
                                <pre className="bg-stone-900 border border-stone-800 p-3 rounded-xl text-[11px] text-amber-300 overflow-x-auto font-mono max-h-48">
                                  {JSON.stringify(ev.properties, null, 2)}
                                </pre>
                              </div>

                              {/* Client Context */}
                              <div>
                                <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                                  Device & Runtime Context
                                </span>
                                <pre className="bg-stone-900 border border-stone-800 p-3 rounded-xl text-[11px] text-sky-300 overflow-x-auto font-mono max-h-48">
                                  {JSON.stringify(ev.context, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

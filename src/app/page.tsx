'use client';

import React, { useState, useEffect } from 'react';
import { Navbar, type AppView } from '@/components/layout/Navbar';
import { RestaurantStore } from '@/components/restaurant/RestaurantStore';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';
import { SystemDocsView } from '@/components/docs/SystemDocsView';
import { EventDebuggerDrawer } from '@/components/debugger/EventDebuggerDrawer';
import { analytics } from '@/lib/analytics/browser-sdk';
import type { IngestEventInput } from '@/lib/analytics/types';

export default function HomePage() {
  const [currentView, setCurrentView] = useState<AppView>('restaurant');
  const [isDebuggerOpen, setIsDebuggerOpen] = useState(false);
  const [capturedEvents, setCapturedEvents] = useState<IngestEventInput[]>([]);

  // Initialize SDK and subscribe to event bus for real-time debugger
  useEffect(() => {
    analytics.init({
      debug: true,
      batchSize: 4,
      flushIntervalMs: 2000,
    });

    const unsubscribe = analytics.onEvent((event) => {
      setCapturedEvents((prev) => [event, ...prev].slice(0, 100));
    });

    // Check if initial seed is needed
    async function checkInitialSeed() {
      try {
        const res = await fetch('/api/v1/analytics/overview');
        const data = await res.json();
        // If totally empty, seed 7-day demo data automatically
        if (data.totalPageViews === 0 && data.browserEventsCount === 0) {
          await fetch('/api/v1/analytics/seed', { method: 'POST' });
        }
      } catch {
        // Ignore seed error
      }
    }
    checkInitialSeed();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        eventCount={capturedEvents.length}
        isDebuggerOpen={isDebuggerOpen}
        onToggleDebugger={() => setIsDebuggerOpen(!isDebuggerOpen)}
      />

      {/* Main View Display */}
      <div className="flex-1">
        {currentView === 'restaurant' && (
          <RestaurantStore onGoToDashboard={() => setCurrentView('dashboard')} />
        )}
        {currentView === 'dashboard' && <AnalyticsDashboard />}
        {currentView === 'docs' && <SystemDocsView />}
      </div>

      {/* Floating Real-Time Event Debugger */}
      <EventDebuggerDrawer
        isOpen={isDebuggerOpen}
        onClose={() => setIsDebuggerOpen(false)}
        events={capturedEvents}
        onClear={() => setCapturedEvents([])}
      />
    </div>
  );
}

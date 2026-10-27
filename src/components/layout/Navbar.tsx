'use client';

import React from 'react';
import { UtensilsCrossed, BarChart3, BookOpen, Activity, Sparkles, Terminal } from 'lucide-react';

export type AppView = 'restaurant' | 'dashboard' | 'docs';

interface NavbarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  eventCount: number;
  isDebuggerOpen: boolean;
  onToggleDebugger: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  eventCount,
  isDebuggerOpen,
  onToggleDebugger,
}) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-stone-900/90 border-b border-stone-800 text-stone-100 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => onViewChange('restaurant')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif tracking-wide font-bold text-lg text-white">KITCHEN SPURS</span>
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                Analytics Demo
              </span>
            </div>
            <p className="text-xs text-stone-400">Artisanal Grill & Real-Time Tracking</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center gap-1 bg-stone-950/70 p-1 rounded-xl border border-stone-800">
          <button
            onClick={() => onViewChange('restaurant')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'restaurant'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-md'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Restaurant Store</span>
          </button>

          <button
            onClick={() => onViewChange('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'dashboard'
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics Dashboard</span>
          </button>

          <button
            onClick={() => onViewChange('docs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'docs'
                ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/30'
                : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Architecture & SDKs</span>
          </button>
        </nav>

        {/* Right Action: Event count & Debugger toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDebugger}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
              isDebuggerOpen
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
            title="Toggle Live Event Debugger Dock"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Debugger</span>
            <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-stone-900 text-[11px] text-amber-400 font-bold border border-amber-500/30">
              {eventCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

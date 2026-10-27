'use client';

import React, { useState } from 'react';
import { Terminal, X, ChevronDown, ChevronUp, Copy, Check, Trash2, ArrowUpRight } from 'lucide-react';
import type { IngestEventInput } from '@/lib/analytics/types';

interface EventDebuggerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: IngestEventInput[];
  onClear: () => void;
}

export const EventDebuggerDrawer: React.FC<EventDebuggerDrawerProps> = ({
  isOpen,
  onClose,
  events,
  onClear,
}) => {
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-0 right-0 left-0 md:left-auto md:right-6 md:bottom-6 z-50 md:max-w-xl w-full bg-stone-900/95 backdrop-blur-xl border border-stone-800 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in slide-in-from-bottom-6 duration-200">
      {/* Header */}
      <div className="p-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-400" />
          <h3 className="font-mono font-bold text-xs text-white">Live Event Debugger</h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
            {events.length} captured
          </span>
        </div>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={onClear}
              className="p-1 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800 transition-colors"
              title="Clear debugger log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {events.length === 0 ? (
          <div className="py-12 text-center text-stone-500 text-xs">
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
            <p>No events captured in current session.</p>
            <p className="text-[11px] text-stone-600 mt-1">
              Interact with the restaurant (click items, add to cart, checkout) to watch events pulse live.
            </p>
          </div>
        ) : (
          events.map((ev, idx) => {
            const isSelected = selectedEventIndex === idx;
            const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : 'now';

            return (
              <div
                key={`${ev.eventId || idx}_${idx}`}
                className={`border rounded-2xl p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-stone-950 border-amber-500/50 shadow-md'
                    : 'bg-stone-950/60 border-stone-800/80 hover:border-stone-700'
                }`}
                onClick={() => setSelectedEventIndex(isSelected ? null : idx)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        ev.source === 'server' ? 'bg-purple-400' : 'bg-sky-400'
                      }`}
                    />
                    <span className="font-bold text-white text-[12px]">{ev.eventName}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold ${
                        ev.source === 'server'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {ev.source}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-400">{timeStr}</span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px] text-stone-400">
                  <span className="truncate max-w-[200px]">
                    anon: {ev.anonymousId?.slice(0, 16)}...
                  </span>
                  {ev.userId && (
                    <span className="text-amber-400 text-[10px]">user: {ev.userId}</span>
                  )}
                </div>

                {/* Expanded Payload */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-stone-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-stone-400">
                        Payload Details
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(ev);
                        }}
                        className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                    <pre className="p-2.5 bg-stone-900 rounded-xl text-[10px] text-amber-300 overflow-x-auto max-h-48">
                      {JSON.stringify(ev, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { useTimeframe, Timeframe } from '@/app/context/TimeframeContext';

export default function TopBar() {
  const { timeframe, setTimeframe } = useTimeframe();

  return (
    <header className="px-8 py-3.5 flex justify-between items-center border-b border-gray-100 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Workspace:
        </span>
        <span className="text-xs font-bold text-gray-800">
          Personal Vault
        </span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-700 bg-white outline-none focus:ring-2 focus:ring-[#6558D3]/30 cursor-pointer shadow-2xs hover:border-gray-300 transition"
        >
          <option value="all_time">All time</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
        </select>
      </div>
    </header>
  );
}

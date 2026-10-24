'use client';

import React from 'react';
import { useTimeframe } from '@/app/context/TimeframeContext';
import { useAuth } from '@/app/context/AuthContext';

export default function TopBar() {
  const { timeframe, setTimeframe, availablePeriods } = useTimeframe();
  const { user } = useAuth();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const fyLabel = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;

  return (
    <header className="px-8 py-3.5 flex justify-between items-center border-b border-gray-100 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Workspace:
        </span>
        <span className="text-xs font-bold text-gray-800">
          {user ? `${user.name}'s Vault` : "Personal Vault"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="top-timeframe-select" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:inline">
            Period:
          </label>
          <select
            id="top-timeframe-select"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white outline-none focus:ring-2 focus:ring-[#6558D3]/30 cursor-pointer shadow-2xs hover:border-gray-300 transition"
          >
            <optgroup label="Standard Ranges">
              <option value="all_time">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter (Q{currentQuarter + 1} {currentYear})</option>
              <option value="last_quarter">Last Quarter</option>
              <option value="half_year">Half Year (Last 6 Months)</option>
              <option value="this_year">This Year ({currentYear})</option>
              <option value="last_year">Last Year ({currentYear - 1})</option>
              <option value="this_fy">This Financial Year ({fyLabel})</option>
            </optgroup>

            {availablePeriods.months.length > 0 && (
              <optgroup label="Available Statement Months">
                {availablePeriods.months.map((m) => (
                  <option key={`month:${m.key}`} value={`month:${m.key}`}>
                    {m.label} {m.count ? `(${m.count} txns)` : ''}
                  </option>
                ))}
              </optgroup>
            )}

            {availablePeriods.years.length > 0 && (
              <optgroup label="Available Statement Years">
                {availablePeriods.years.map((y) => (
                  <option key={`year:${y}`} value={`year:${y}`}>
                    Year {y}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>
    </header>
  );
}

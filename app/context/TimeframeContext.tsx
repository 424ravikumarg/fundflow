'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AvailablePeriods, TimeframeMonth } from '@/lib/timeframe';

export type Timeframe = string;

interface TimeframeContextType {
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  availablePeriods: AvailablePeriods;
  refreshPeriods: () => Promise<void>;
}

const defaultPeriods: AvailablePeriods = {
  years: [],
  months: [],
};

const TimeframeContext = createContext<TimeframeContextType>({
  timeframe: 'all_time',
  setTimeframe: () => {},
  availablePeriods: defaultPeriods,
  refreshPeriods: async () => {},
});

export function TimeframeProvider({ children }: { children: React.ReactNode }) {
  const [timeframe, setTimeframeState] = useState<Timeframe>('all_time');
  const [availablePeriods, setAvailablePeriods] = useState<AvailablePeriods>(defaultPeriods);

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions?periods=true');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.months) && Array.isArray(data.years)) {
          setAvailablePeriods({
            years: data.years,
            months: data.months,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch available transaction periods:', e);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fundflow_timeframe');
      if (saved) {
        setTimeframeState(saved);
      }
    } catch (e) {
      // Ignore localStorage access issues
    }

    fetchPeriods();
  }, [fetchPeriods]);

  const setTimeframe = (tf: Timeframe) => {
    setTimeframeState(tf);
    try {
      localStorage.setItem('fundflow_timeframe', tf);
    } catch (e) {
      // Ignore localStorage write issues
    }
  };

  return (
    <TimeframeContext.Provider
      value={{
        timeframe,
        setTimeframe,
        availablePeriods,
        refreshPeriods: fetchPeriods,
      }}
    >
      {children}
    </TimeframeContext.Provider>
  );
}

export function useTimeframe() {
  return useContext(TimeframeContext);
}
export type { AvailablePeriods, TimeframeMonth };

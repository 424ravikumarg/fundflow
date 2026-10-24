'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Timeframe = 'all_time' | 'this_month' | 'last_month' | 'this_year';

interface TimeframeContextType {
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
}

const TimeframeContext = createContext<TimeframeContextType>({
  timeframe: 'all_time',
  setTimeframe: () => {},
});

export function TimeframeProvider({ children }: { children: React.ReactNode }) {
  const [timeframe, setTimeframeState] = useState<Timeframe>('all_time');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fundflow_timeframe') as Timeframe | null;
      if (saved && ['all_time', 'this_month', 'last_month', 'this_year'].includes(saved)) {
        setTimeframeState(saved);
      }
    } catch (e) {
      // Ignore localStorage access issues
    }
  }, []);

  const setTimeframe = (tf: Timeframe) => {
    setTimeframeState(tf);
    try {
      localStorage.setItem('fundflow_timeframe', tf);
    } catch (e) {
      // Ignore localStorage write issues
    }
  };

  return (
    <TimeframeContext.Provider value={{ timeframe, setTimeframe }}>
      {children}
    </TimeframeContext.Provider>
  );
}

export function useTimeframe() {
  return useContext(TimeframeContext);
}

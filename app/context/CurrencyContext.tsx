'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CurrencyInfo,
  SUPPORTED_CURRENCIES,
  getCurrencyInfo,
  formatCurrencyAmount,
} from '@/lib/currency';

interface CurrencyContextType {
  currency: string;
  currencyInfo: CurrencyInfo;
  symbol: string;
  setCurrency: (code: string) => Promise<void>;
  formatCurrency: (amount: number | string) => string;
  supportedCurrencies: CurrencyInfo[];
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'USD',
  currencyInfo: SUPPORTED_CURRENCIES[0],
  symbol: '$',
  setCurrency: async () => {},
  formatCurrency: (amount) => formatCurrencyAmount(amount, 'USD'),
  supportedCurrencies: SUPPORTED_CURRENCIES,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>('USD');

  // 1. Initial Load: check localStorage first for instant hydration, then sync with backend API
  useEffect(() => {
    const local = localStorage.getItem('ledgerly_currency');
    if (local) {
      setCurrencyState(local);
    }

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.currency) {
          setCurrencyState(data.settings.currency);
          localStorage.setItem('ledgerly_currency', data.settings.currency);
        }
      })
      .catch((err) => console.error('Failed to load currency setting:', err));
  }, []);

  const handleSetCurrency = async (newCode: string) => {
    const upper = newCode.toUpperCase();
    setCurrencyState(upper);
    localStorage.setItem('ledgerly_currency', upper);

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: upper }),
      });
    } catch (err) {
      console.error('Failed to persist currency setting:', err);
    }
  };

  const currencyInfo = getCurrencyInfo(currency);

  const formatCurrency = (amount: number | string) => {
    return formatCurrencyAmount(amount, currency);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyInfo,
        symbol: currencyInfo.symbol,
        setCurrency: handleSetCurrency,
        formatCurrency,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

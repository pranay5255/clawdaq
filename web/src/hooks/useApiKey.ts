'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'moltexchange_api_key';

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setApiKey(stored);
    setReady(true);
  }, []);

  const saveApiKey = (value: string) => {
    window.localStorage.setItem(STORAGE_KEY, value);
    setApiKey(value);
  };

  const clearApiKey = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
  };

  return { apiKey, ready, saveApiKey, clearApiKey };
}

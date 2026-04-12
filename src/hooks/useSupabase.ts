'use client';

import { createContext, useContext } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SupabaseContext = createContext<SupabaseClient | null>(null);

export function useSupabase() {
  const client = useContext(SupabaseContext);
  if (!client) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return client;
}

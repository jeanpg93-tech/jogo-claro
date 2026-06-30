import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Projeto Supabase externo (URL pública + chave publishable — seguras no cliente; RLS protege os dados).
const FALLBACK_URL = "https://xnfwakrndppkyxunvriq.supabase.co";
const FALLBACK_KEY = "sb_publishable_Z5sOnZ3VN_X53x_VMffNyQ_68QCC7pL";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? FALLBACK_URL;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? FALLBACK_KEY;

export const isSupabaseConfigured = Boolean(url && key);

function createStub(): SupabaseClient {
  const message =
    "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.";
  const reject = () => Promise.reject(new Error(message));
  // Minimal stub so the app boots without env vars during Fase 1 setup.
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signInWithPassword: reject,
      signUp: reject,
      signOut: () => Promise.resolve({ error: null }),
    },
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : createStub();

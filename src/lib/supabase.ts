import { createClient } from "@supabase/supabase-js";

// The publishable key is designed for browser use; RLS remains the authorization boundary.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  ?? "https://vxwjztlayceovovizvbu.supabase.co";
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  ?? "sb_publishable_onOqizdmoA9SBlR5ArQ68w_Se8zApFp";

export const supabaseConfigured = Boolean(url && publishableKey);
export const supabase = supabaseConfigured
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

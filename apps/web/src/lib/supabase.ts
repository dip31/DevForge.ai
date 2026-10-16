/**
 * Browser-side Supabase client.
 *
 * Only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are exposed here.
 * Never import SUPABASE_SECRET_KEY or SUPABASE_JWT_SECRET into frontend code.
 *
 * Required environment variables (set in apps/web/.env):
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
 *
 * When these variables are absent (e.g. local demo mode without a Supabase
 * project), `supabase` is null. Always check for null before calling auth
 * methods when operating in demo mode.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,

          autoRefreshToken: true,

          detectSessionInUrl: true,
        },
      })
    : null;

/** True when Supabase is configured and available. */

export const supabaseEnabled = supabase !== null;

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Koristi SAMO u Server Actions/Componentima - service role ključ zaobilazi
// sva RLS pravila i ne smije nikad dospjeti u kod koji se šalje browseru.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

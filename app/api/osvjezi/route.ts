import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { osvjeziSve } from "@/lib/sah/osvjezi";

export const maxDuration = 60;

// Gumb ↻ Osvježi i automatsko osvježavanje pri otvaranju aplikacije
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ greska: "Nisi prijavljen." }, { status: 401 });

  try {
    return NextResponse.json(await osvjeziSve(createAdminClient()));
  } catch (e) {
    return NextResponse.json({ greska: e instanceof Error ? e.message : "Osvježavanje nije uspjelo." }, { status: 502 });
  }
}

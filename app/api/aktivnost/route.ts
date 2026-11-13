import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Otkucaj iz otvorene aplikacije (svake minute dok je vidljiva)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ greska: "Nisi prijavljen." }, { status: 401 });

  const { nova } = await request.json().catch(() => ({ nova: false }));
  await createAdminClient().rpc("zabiljezi_aktivnost", { korisnik: user.id, nova_posjeta: nova === true });
  return new NextResponse(null, { status: 204 });
}

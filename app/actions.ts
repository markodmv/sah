"use server";

import { revalidatePath } from "next/cache";
import { zahtijevajOdobrenog } from "@/lib/auth";
import { osvjeziIgraca } from "@/lib/sah/osvjezi";
import { kljucImena } from "@/lib/sah/izvori";

export async function dodajIgraca(_prev: string | null, formData: FormData): Promise<string | null> {
  const ime = String(formData.get("ime") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const fide = String(formData.get("fide") ?? "").replace(/\D/g, "").slice(0, 10);
  if (!ime) return "Upiši ime i prezime.";

  const { supabase } = await zahtijevajOdobrenog();
  const { data: postojeci } = await supabase.from("igraci").select("ime, fide_id");
  if ((postojeci ?? []).some((p) => (fide && String(p.fide_id) === fide) || kljucImena(p.ime) === kljucImena(ime))) {
    return `${ime} se već prati.`;
  }

  const { data: novi, error } = await supabase
    .from("igraci")
    .insert({ ime, fide_id: fide ? Number(fide) : null })
    .select("id")
    .single();
  if (error || !novi) return "Spremanje nije uspjelo. Pokušaj ponovno.";

  // Odmah pronađi FIDE ID, rejting, prijave i rezultate
  await osvjeziIgraca(novi.id);
  revalidatePath("/");
  return null;
}

export async function ukloniIgraca(id: string) {
  const { supabase } = await zahtijevajOdobrenog();
  await supabase.from("igraci").delete().eq("id", id);
  revalidatePath("/");
}

"use server";

import { revalidatePath } from "next/cache";
import { promijeni } from "@/lib/sah/pohrana";
import { osvjeziIgraca } from "@/lib/sah/osvjezi";
import { kljucImena } from "@/lib/sah/izvori";

export async function dodajIgraca(_prev: string | null, formData: FormData): Promise<string | null> {
  const ime = String(formData.get("ime") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const fide = String(formData.get("fide") ?? "").replace(/\D/g, "").slice(0, 10);
  if (!ime) return "Upiši ime i prezime.";

  const id = crypto.randomUUID();
  const dodan = await promijeni((p) => {
    if (p.igraci.some((i) => (fide && String(i.fide_id) === fide) || kljucImena(i.ime) === kljucImena(ime))) return false;
    p.igraci.push({
      id, ime, fide_id: fide ? Number(fide) : null, titula: null, godina_rodenja: null, federacija: null,
      rejting: {}, promjena: {}, prijave: [], nedavno: [], napomena: null, azurirano: null,
    });
    return true;
  });
  if (!dodan) return `${ime} se već prati.`;

  await osvjeziIgraca(id);
  revalidatePath("/");
  return null;
}

export async function ukloniIgraca(id: string) {
  await promijeni((p) => { p.igraci = p.igraci.filter((i) => i.id !== id); });
  revalidatePath("/");
}

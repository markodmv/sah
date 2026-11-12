import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profil = { id: string; email: string; ime: string | null; odobren: boolean; admin: boolean; kreirano: string };

export async function trenutniKorisnik() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profil: null };
  const { data } = await supabase.from("profili").select("id, email, ime, odobren, admin, kreirano").eq("id", user.id).maybeSingle();
  return { supabase, user, profil: (data as Profil | null) ?? null };
}

// Stranice aplikacije: samo prijavljeni i odobreni korisnici
export async function zahtijevajOdobrenog() {
  const k = await trenutniKorisnik();
  if (!k.user) redirect("/login");
  if (!k.profil?.odobren) redirect("/cekanje");
  return { ...k, user: k.user, profil: k.profil };
}

export async function zahtijevajAdmina() {
  const k = await zahtijevajOdobrenog();
  if (!k.profil.admin) redirect("/");
  return k;
}

// API rute: umjesto preusmjeravanja vrati je li korisnik odobren
export async function jeOdobren() {
  const k = await trenutniKorisnik();
  return !!k.profil?.odobren;
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function prijava(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return /confirm/i.test(error.message)
      ? "Email još nije potvrđen. Otvori poveznicu iz emaila koji si dobio pri registraciji."
      : "Pogrešan email ili lozinka.";
  }
  redirect("/");
}

export type StanjeRegistracije = { greska?: string; poslano?: boolean } | null;

export async function registracija(_prev: StanjeRegistracije, formData: FormData): Promise<StanjeRegistracije> {
  const ime = String(formData.get("ime") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!ime) return { greska: "Upiši ime i prezime." };
  if (password.length < 8) return { greska: "Lozinka mora imati barem 8 znakova." };

  const h = await headers();
  const izvor = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { ime }, emailRedirectTo: `${izvor}/cekanje` },
  });
  if (error) {
    return { greska: /registered|exists/i.test(error.message) ? "Ovaj email je već registriran. Prijavi se." : "Registracija nije uspjela. Provjeri email i pokušaj ponovno." };
  }
  // Ako potvrda emaila nije uključena, korisnik je odmah prijavljen i čeka odobrenje
  if (data.session) redirect("/cekanje");
  return { poslano: true };
}

export async function odjava() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

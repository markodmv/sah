"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export type StanjeRegistracije = { greska?: string } | null;

// Registracija bez čekanja: račun se napravi već potvrđen i odobren, a korisnik se odmah prijavi
export async function registracija(_prev: StanjeRegistracije, formData: FormData): Promise<StanjeRegistracije> {
  const ime = String(formData.get("ime") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!ime) return { greska: "Upiši ime i prezime." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { greska: "Upiši ispravan email." };
  if (password.length < 8) return { greska: "Lozinka mora imati barem 8 znakova." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { ime },
  });
  if (error || !data.user) {
    return { greska: /registered|exists/i.test(error?.message ?? "") ? "Ovaj email je već registriran. Prijavi se." : "Registracija nije uspjela. Pokušaj ponovno." };
  }
  await admin.from("profili").update({ odobren: true }).eq("id", data.user.id);

  const supabase = await createClient();
  const { error: greskaPrijave } = await supabase.auth.signInWithPassword({ email, password });
  if (greskaPrijave) return { greska: "Račun je napravljen, ali prijava nije uspjela. Prijavi se ručno." };
  redirect("/");
}

export async function odjava() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

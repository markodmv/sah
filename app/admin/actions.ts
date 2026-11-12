"use server";

import { revalidatePath } from "next/cache";
import { zahtijevajAdmina } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function odobri(id: string) {
  await zahtijevajAdmina();
  await createAdminClient().from("profili").update({ odobren: true }).eq("id", id);
  revalidatePath("/admin");
}

// Odbij zahtjev ili ukloni korisnika: briše račun (i njegove praćene igrače)
export async function ukloni(id: string) {
  const { user } = await zahtijevajAdmina();
  if (id === user.id) return;
  await createAdminClient().auth.admin.deleteUser(id);
  revalidatePath("/admin");
}

export async function oduzmiPristup(id: string) {
  const { user } = await zahtijevajAdmina();
  if (id === user.id) return;
  await createAdminClient().from("profili").update({ odobren: false }).eq("id", id);
  revalidatePath("/admin");
}

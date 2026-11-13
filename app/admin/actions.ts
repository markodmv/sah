"use server";

import { revalidatePath } from "next/cache";
import { zahtijevajAdmina } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function postaviPristup(id: string, odobren: boolean) {
  const { user } = await zahtijevajAdmina();
  if (id === user.id) return;
  await createAdminClient().from("profili").update({ odobren }).eq("id", id);
  revalidatePath("/admin");
}

export async function blokiraj(id: string) {
  await postaviPristup(id, false);
}

export async function odblokiraj(id: string) {
  await postaviPristup(id, true);
}

// Briše račun zajedno s njegovim praćenim igračima i aktivnošću
export async function obrisi(id: string) {
  const { user } = await zahtijevajAdmina();
  if (id === user.id) return;
  await createAdminClient().auth.admin.deleteUser(id);
  revalidatePath("/admin");
}

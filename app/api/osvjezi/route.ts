import { NextResponse } from "next/server";
import { jeOdobren } from "@/lib/auth";
import { osvjeziSve } from "@/lib/sah/osvjezi";

export const maxDuration = 60;

// Gumb ↻ Osvježi i automatsko osvježavanje pri otvaranju aplikacije
export async function POST() {
  if (!(await jeOdobren())) return NextResponse.json({ greska: "Nemaš pristup." }, { status: 403 });
  try {
    return NextResponse.json(await osvjeziSve());
  } catch (e) {
    return NextResponse.json({ greska: e instanceof Error ? e.message : "Osvježavanje nije uspjelo." }, { status: 502 });
  }
}

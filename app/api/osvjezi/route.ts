import { NextResponse } from "next/server";
import { osvjeziSve } from "@/lib/sah/osvjezi";

export const maxDuration = 60;

// Gumb ↻ Osvježi i automatsko osvježavanje pri otvaranju aplikacije
export async function POST() {
  try {
    return NextResponse.json(await osvjeziSve());
  } catch (e) {
    return NextResponse.json({ greska: e instanceof Error ? e.message : "Osvježavanje nije uspjelo." }, { status: 502 });
  }
}

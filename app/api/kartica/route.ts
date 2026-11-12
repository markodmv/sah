import { NextResponse, type NextRequest } from "next/server";
import { kartica } from "@/lib/sah/chessresults";
import { jeOdobren } from "@/lib/auth";

// Kartica igrača u jednom turniru (poredak, bodovi, partije) za povijest turnira
export async function GET(request: NextRequest) {
  if (!(await jeOdobren())) return NextResponse.json({ greska: "Nemaš pristup." }, { status: 403 });
  const tnr = Number(request.nextUrl.searchParams.get("tnr"));
  const snr = Number(request.nextUrl.searchParams.get("snr"));
  if (!Number.isInteger(tnr) || !Number.isInteger(snr) || tnr <= 0 || snr <= 0) {
    return NextResponse.json({ greska: "Neispravan zahtjev." }, { status: 400 });
  }
  const k = await kartica(tnr, snr, request.nextUrl.searchParams.get("zivo") === "1");
  return k ? NextResponse.json(k) : NextResponse.json({ greska: "Kartica se ne može učitati." }, { status: 502 });
}

import { NextResponse, type NextRequest } from "next/server";
import { osvjeziSve } from "@/lib/sah/osvjezi";

export const maxDuration = 60;

// Dnevno osvježavanje (vercel.json). Vercel šalje CRON_SECRET u zaglavlju.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ greska: "Nije dopušteno." }, { status: 401 });
  }
  try {
    return NextResponse.json(await osvjeziSve());
  } catch (e) {
    return NextResponse.json({ greska: e instanceof Error ? e.message : "Osvježavanje nije uspjelo." }, { status: 502 });
  }
}

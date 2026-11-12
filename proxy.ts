import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // api/cron poziva Vercel bez prijave (štiti ga CRON_SECRET)
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

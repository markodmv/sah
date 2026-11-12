// Svi podaci aplikacije u jednoj privatnoj JSON datoteci u Vercel Blob pohrani.
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import type { Podaci } from "./tipovi";

const PUTANJA = "sah/podaci.json";

const prazno = (): Podaci => ({ turniri: [], igraci: [], osvjezeno: null, pokrenuto: null, greska: null });

export async function citaj(): Promise<{ podaci: Podaci; etag: string | null }> {
  const r = await get(PUTANJA, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return { podaci: prazno(), etag: null };
  const tekst = await new Response(r.stream).text();
  // get() vraća slabi ETag (W/"…"), a ifMatch kod spremanja traži jaki
  return { podaci: { ...prazno(), ...JSON.parse(tekst) }, etag: r.blob.etag.replace(/^W\//, "") };
}

async function spremi(podaci: Podaci, etag: string | null) {
  await put(PUTANJA, JSON.stringify(podaci), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...(etag ? { ifMatch: etag } : {}),
  });
}

// Pročitaj, promijeni i spremi; ako je netko drugi u međuvremenu spremio, pokušaj ponovno
export async function promijeni<T>(izmjena: (p: Podaci) => T): Promise<T> {
  for (let i = 0; ; i++) {
    const { podaci, etag } = await citaj();
    const rezultat = izmjena(podaci);
    try {
      await spremi(podaci, etag);
      return rezultat;
    } catch (e) {
      if (!(e instanceof BlobPreconditionFailedError) || i >= 4) throw e;
    }
  }
}

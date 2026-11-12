// Iz službene FIDE liste (players_list_foa.txt, stupci fiksne širine) izdvaja hrvatske igrače u fide/cro.json.
// Pokreće ga GitHub Actions (.github/workflows/fide.yml), jer ratings.fide.com ne odgovara Vercelovim serverima.
// Uporaba: node scripts/fide-lista.mjs <players_list_foa.txt> <fide/cro.json>
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";

const [ulaz, izlaz] = process.argv.slice(2);
const STUPCI = ["ID Number", "Name", "Fed", "Sex", "Tit", "WTit", "OTit", "FOA", "SRtng", "SGm", "SK", "RRtng", "RGm", "Rk", "BRtng", "BGm", "BK", "B-day", "Flag"];

let pocetci = null;
const igraci = {};
for await (const red of createInterface({ input: createReadStream(ulaz, "latin1") })) {
  if (!pocetci) {
    // Početak svakog stupca iz zaglavlja ("Rk" je i dio "RRtng", pa tražimo redom)
    let od = 0;
    pocetci = STUPCI.map((s) => (od = red.indexOf(s, od)));
    continue;
  }
  const polje = (i) => red.slice(pocetci[i], i + 1 < pocetci.length ? pocetci[i + 1] : undefined).trim();
  if (polje(2) !== "CRO") continue;
  const broj = (i) => Number(polje(i)) || 0;
  // [ime, standard, ubrzani, brzopotezni, godina rođenja, titula, neaktivan]
  igraci[polje(0)] = [polje(1), broj(8), broj(11), broj(14), broj(17), polje(4) || polje(5) || "", polje(18).includes("i") ? 1 : 0];
}

await mkdir(dirname(izlaz), { recursive: true });
await writeFile(izlaz, JSON.stringify({ preuzeto: new Date().toISOString().slice(0, 10), broj: Object.keys(igraci).length, igraci }) + "\n");
console.log(`Hrvatskih igrača: ${Object.keys(igraci).length}`);

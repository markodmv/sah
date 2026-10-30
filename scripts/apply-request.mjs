// Primjenjuje zahtjev iz aplikacije (GitHub issue) na docs/players.json.
// Naslov: "Prati: Ime Prezime" ili "Prati: Ime Prezime (FIDE 12345678)", odnosno "Ne prati: …".
// Ispisuje kratku poruku za komentar na issue.
import { readFile, writeFile } from "node:fs/promises";

const title = (process.env.ISSUE_TITLE || "").trim();
const m = title.match(/^(Prati|Ne prati):\s*(.+?)\s*(?:\(FIDE\s*(\d{4,10})\))?\s*$/i);
if (!m) { console.log("Naslov nije zahtjev za igrača, ništa nije promijenjeno."); process.exit(0); }

const remove = /^ne/i.test(m[1]);
const name = m[2].replace(/\s+/g, " ").slice(0, 80);
const fideId = m[3] ? +m[3] : null;
const key = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
const same = (p) => (fideId && p.fideId && +p.fideId === fideId) || key(p.name) === key(name);

const file = "docs/players.json";
const list = JSON.parse(await readFile(file, "utf8"));
let msg;
if (remove) {
  const next = list.filter((p) => !same(p));
  msg = next.length < list.length ? `Više se ne prati: ${name}.` : `${name} nije bio na popisu.`;
  await writeFile(file, JSON.stringify(next, null, 2) + "\n");
} else if (list.some(same)) {
  msg = `${name} se već prati.`;
} else {
  list.push({ name, fideId });
  await writeFile(file, JSON.stringify(list, null, 2) + "\n");
  msg = `Dodano praćenje: ${name}. Podaci će biti u aplikaciji za minutu-dvije.`;
}
console.log(msg);

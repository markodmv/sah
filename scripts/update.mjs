// Skuplja hrvatske šahovske turnire s chess-results.com i rejtinge praćenih igrača s FIDE.
// Ulaz: docs/players.json. Izlaz: docs/data.json (za aplikaciju) i cache/tournaments.json (interno).
import { readFile, writeFile, mkdir } from "node:fs/promises";

const FED_URL = "https://chess-results.com/fed.aspx?lan=1&fed=CRO";
const UA = "Mozilla/5.0 (sah-app; +https://github.com)";
const SHOW_PAST_DAYS = 14;    // koliko dugo se završeni turnir još prikazuje
const KEEP_CACHE_DAYS = 120;  // koliko dugo pamtimo turnir zbog rezultata igrača
const DELAY_MS = 700;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, redirect: "follow" });
      if (res.ok) { await sleep(DELAY_MS); return await res.text(); }
      console.warn(`HTTP ${res.status} ${url}`);
    } catch (e) { console.warn(`Greška ${url}: ${e.message}`); }
    await sleep(2000 * (i + 1));
  }
  return null;
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);
const text = (html) => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
const nameKey = (s) => norm(s).replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");

// ---------- chess-results ----------

function parseFedList(html) {
  const out = new Map();
  for (const m of html.matchAll(/href="(?:https?:\/\/[^"\/]*chess-results\.com\/)?tnr(\d+)\.aspx\?lan=1">([^<]+)</g)) {
    if (!out.has(m[1])) out.set(m[1], text(m[2]));
  }
  return [...out].map(([tnr, name]) => ({ tnr: +tnr, rawName: name }));
}

function field(html, label) {
  const re = new RegExp(`<td class="CR">${label}[^<]*</td><td class="CR">(.*?)</td></tr>`, "i");
  const m = html.match(re);
  return m ? text(m[1]) : null;
}

function shortTc(s) {
  if (!s) return null;
  const nums = s.match(/\d+/g) || [];
  if (nums.length >= 2 && s.includes("+")) return `${nums[0]}'+${nums[1]}"`;
  if (nums.length) return `${nums[0]}'`;
  return s.length > 24 ? s.slice(0, 24) + "…" : s;
}

function parseDetails(html) {
  const tcRow = html.match(/<td class="CR">Time control \(([^)]+)\)<\/td><td class="CR">(.*?)<\/td>/i);
  const kindRaw = tcRow ? tcRow[1].toLowerCase() : "";
  const kind = kindRaw.includes("blitz") ? "blitz" : kindRaw.includes("rapid") ? "rapid" : kindRaw ? "standard" : null;
  const date = field(html, "Date") || "";
  const dates = [...date.matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)].map((m) => `${m[1]}-${m[2]}-${m[3]}`);
  const rounds = parseInt(field(html, "Number of rounds") || "", 10);
  const titleM = html.match(/<h2>([^<]+)<\/h2>/);
  // Startna lista: ime + FIDE ID (ako ga ima)
  const entrants = [];
  for (const row of html.split(/<tr class="CRng?[12]/).slice(1)) {
    const nm = row.match(/art=9[^"]*">([^<]+)<\/a>/);
    if (!nm) continue;
    const id = row.match(/fide\.com\/profile\/(\d+)/);
    entrants.push({ n: text(nm[1]), f: id ? +id[1] : null });
  }
  return {
    title: titleM ? text(titleM[1]) : null,
    organizer: field(html, "Organi[sz]er\\(s\\)"),
    federation: field(html, "Federation"),
    place: field(html, "Location"),
    from: dates[0] || null,
    to: dates[1] || dates[0] || null,
    rounds: Number.isFinite(rounds) && rounds > 0 ? rounds : null,
    tc: tcRow ? shortTc(text(tcRow[2])) : null,
    kind,
    entrants,
  };
}

function parseFinalRanking(html) {
  const head = html.match(/<h2>((?:Final Ranking|Rank)[^<]*)<\/h2>/i);
  const rows = [];
  for (const row of html.split(/<tr class="CRg[12]/).slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => text(c[1]));
    const nm = row.match(/art=9[^"]*">([^<]+)<\/a>/);
    if (!nm || !cells.length) continue;
    const ptsIdx = cells.findIndex((c, i) => i > 3 && /^\d+(,5)?$/.test(c) && i >= cells.length - 4);
    rows.push({ rank: +cells[0] || null, name: text(nm[1]), pts: ptsIdx >= 0 ? cells[ptsIdx] : null });
  }
  return { final: !!head && /final/i.test(head[1]), rows };
}

// Dobne skupine i kategorije iz naziva turnira
function groupsOf(name) {
  const n = norm(name);
  const g = new Set();
  for (const m of n.matchAll(/do (\d{1,2}) god/g)) g.add("U" + m[1]);
  for (const m of n.matchAll(/\b(?:u|m|z)-?(\d{1,2})(?![\d:.,])\b/g)) if (+m[1] >= 6 && +m[1] <= 20) g.add("U" + m[1]);
  if (/\bz-?\d{1,2}(?![\d:.,])\b|zensk|djevoj|\bzene\b|women|girls/.test(n)) g.add("zene");
  if (/kadet/.test(n) && ![...g].some((x) => x.startsWith("U"))) g.add("kadeti");
  if (/\bmladi|mlade|juniori|youth/.test(n) && !g.size) g.add("mladi");
  if (/skol|ucenik|ucenic|\bssd\b|\bos\b|\bss\b|\bpuz\b|osnovn|srednj/.test(n)) g.add("skole");
  if (/50\+|65\+|veteran|seniori 50|seniori 65|senior 50|senior 65/.test(n)) g.add("seniori");
  if (!g.size) g.add("open");
  // U-skupine u redoslijedu
  return [...g].sort((a, b) => (a[0] === "U" && b[0] === "U" ? +a.slice(1) - +b.slice(1) : a[0] === "U" ? -1 : b[0] === "U" ? 1 : 0));
}

// Ljepši naziv: riječi pisane VELIKIM SLOVIMA → Velikim početnim, osim kratica
const KEEP_CAPS = new Set(["HV", "HŠS", "HSS", "KZŽ", "OBŽ", "PGŽ", "DNŽ", "OŠ", "SŠ", "ŠK", "ŠD", "ŠŠD", "ŠS", "PUŽ", "FIDE", "GP", "MO", "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIII", "XIV", "XV", "XX", "XXX", "A", "B", "C", "D"]);
function cleanName(s) {
  return s.replace(/_/g, " ").replace(/\s+-\s+-\s+/g, " – ").replace(/\s+/g, " ").replace(/\s+-\s*$/, "").trim()
    .replace(/[A-ZČĆŽŠĐ]{2,}/g, (w) => (KEEP_CAPS.has(w) ? w : w[0] + w.slice(1).toLowerCase()));
}

// ---------- FIDE ----------

function parseFide(html) {
  const num = (cls) => { const m = html.match(new RegExp(`profile-${cls} profile-game[^>]*>[\\s\\S]*?<p>(\\d+|Not rated)</p>`)); return m && /\d/.test(m[1]) ? +m[1] : null; };
  const name = html.match(/<h1 class="player-title">([^<]+)<\/h1>/);
  const by = html.match(/profile-info-byear[^>]*>\s*(\d{4})/);
  const title = html.match(/<h5>FIDE title<\/h5>\s*<div class="profile-info-title[^>]*>\s*<p>([^<]+)<\/p>/);
  const fed = html.match(/profile-info-country[^>]*>[\s\S]*?<\/div>/);
  if (!name) return null;
  const t = title ? text(title[1]) : "";
  const short = { "Grandmaster": "GM", "International Master": "IM", "FIDE Master": "FM", "Candidate Master": "CM", "Woman Grandmaster": "WGM", "Woman International Master": "WIM", "Woman FIDE Master": "WFM", "Woman Candidate Master": "WCM" }[t] || null;
  return {
    fideName: text(name[1]),
    birthYear: by ? +by[1] : null,
    title: short,
    federation: fed ? text(fed[0].replace(/^[^>]*>/, "")) : null,
    ratings: { std: num("standart"), rapid: num("rapid"), blitz: num("blitz") },
  };
}

// ---------- glavni tok ----------

const prev = await readJson("docs/data.json", { tournaments: [], players: [] });
const cache = await readJson("cache/tournaments.json", {});   // tnr -> detalji + startna lista + rezultati
const tracked = (await readJson("docs/players.json", [])).filter((p) => p && p.name);

const fedHtml = await get(FED_URL);
if (!fedHtml) { console.error("chess-results.com nije dostupan, prekidam bez promjena."); process.exit(1); }
const list = parseFedList(fedHtml);
console.log(`Na popisu federacije: ${list.length} turnira`);

for (const { tnr, rawName } of list) {
  const c = cache[tnr];
  // Detalje i startnu listu čitamo za nove i za one koji još nisu završili
  if (c && c.to && c.to < addDays(today, -2)) continue;
  const html = await get(`https://chess-results.com/tnr${tnr}.aspx?lan=1&turdet=YES`);
  if (!html) continue;
  const d = parseDetails(html);
  if (d.federation && !/CRO/.test(d.federation)) continue;
  cache[tnr] = { ...(c || {}), ...d, tnr, rawName, name: cleanName(d.title || rawName), groups: groupsOf(d.title || rawName), seenAt: today };
}

// Igrači: FIDE profil + nastupi po startnim listama
const prevPlayers = new Map((prev.players || []).map((p) => [p.key, p]));
const players = [];
for (const p of tracked) {
  const key = p.fideId ? String(p.fideId) : nameKey(p.name);
  const old = prevPlayers.get(key) || {};
  let fideId = p.fideId ? +p.fideId : null;
  const pk = nameKey(p.name);

  // Bez FIDE ID-a: potraži ga u startnim listama po imenu
  if (!fideId) {
    for (const t of Object.values(cache)) {
      const hit = (t.entrants || []).find((e) => e.f && nameKey(e.n) === pk);
      if (hit) { fideId = hit.f; break; }
    }
  }

  let info = null;
  if (fideId) {
    const html = await get(`https://ratings.fide.com/profile/${fideId}`);
    info = html ? parseFide(html) : null;
  }
  const ratings = info ? info.ratings : old.ratings || { std: null, rapid: null, blitz: null };
  const deltas = { ...(old.deltas || {}) };
  for (const k of ["std", "rapid", "blitz"]) {
    const a = old.ratings?.[k], b = ratings[k];
    if (a && b && a !== b) deltas[k] = b - a;
  }

  const isMe = (e) => (fideId && e.f === fideId) || nameKey(e.n) === pk || (info && nameKey(e.n) === nameKey(info.fideName));
  const upcoming = [], recent = [];
  for (const t of Object.values(cache)) {
    if (!(t.entrants || []).some(isMe)) continue;
    const url = `https://chess-results.com/tnr${t.tnr}.aspx?lan=1`;
    if (!t.to || t.to >= today) { upcoming.push({ tnr: t.tnr, name: t.name, url, from: t.from }); continue; }
    // Završen: jednom pročitaj konačni poredak i zapamti rezultat
    t.results ||= {};
    if (!t.results[key]) {
      const html = await get(`https://chess-results.com/tnr${t.tnr}.aspx?lan=1&art=1`);
      if (html) {
        const fr = parseFinalRanking(html);
        const row = fr.rows.find((r) => nameKey(r.name) === pk || (info && nameKey(r.name) === nameKey(info.fideName)));
        if (row) t.results[key] = { rank: row.rank, pts: row.pts, of: fr.rows.length, final: fr.final };
      }
    }
    const r = t.results[key];
    recent.push({ tnr: t.tnr, name: t.name, url, from: t.from, to: t.to, result: r ? `${r.pts ?? "?"} b · ${r.rank ?? "?"}./${r.of}` : null });
  }
  upcoming.sort((a, b) => (a.from || "").localeCompare(b.from || ""));
  recent.sort((a, b) => (b.to || "").localeCompare(a.to || ""));

  players.push({
    key, name: p.name, fideId, foundFideId: !p.fideId && !!fideId,
    title: info?.title ?? old.title ?? null, birthYear: info?.birthYear ?? old.birthYear ?? null,
    federation: info?.federation ?? old.federation ?? null,
    ratings, deltas,
    upcoming, recent: recent.slice(0, 8),
    note: fideId ? null : "FIDE ID nije pronađen. Dodaj ga ručno ako igrač ima FIDE rejting.",
  });
}

// Očisti stari cache i složi izlaz
for (const [k, t] of Object.entries(cache)) if (t.to && t.to < addDays(today, -KEEP_CACHE_DAYS)) delete cache[k];
const tournaments = Object.values(cache)
  .filter((t) => !t.to || t.to >= addDays(today, -SHOW_PAST_DAYS))
  .map(({ tnr, name, organizer, place, from, to, rounds, tc, kind, groups }) => ({
    tnr, name, url: `https://chess-results.com/tnr${tnr}.aspx?lan=1`, organizer, place, from, to, rounds, tc, kind, groups,
  }))
  .sort((a, b) => (a.from || "9999").localeCompare(b.from || "9999"));

await mkdir("cache", { recursive: true });
await writeFile("cache/tournaments.json", JSON.stringify(cache) + "\n");
await writeFile("docs/data.json", JSON.stringify({ updatedAt: new Date().toISOString(), source: FED_URL, tournaments, players }, null, 1) + "\n");
console.log(`Spremljeno: ${tournaments.length} turnira, ${players.length} igrača.`);

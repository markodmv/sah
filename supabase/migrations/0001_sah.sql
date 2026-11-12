-- Šah: turniri s chess-results.com i praćeni igrači.
-- Pokreni u Supabase SQL Editoru (ista baza kao Dnevnik rada, Projekti i Troškovnici).
-- Tablice imaju prefiks sah_ da se ne miješaju s ostalim aplikacijama.

-- Turniri su zajednički za sve prijavljene; piše ih samo server (service role).
create table if not exists sah_turniri (
  tnr        integer primary key,
  naziv      text not null,
  url        text not null,
  organizator text,
  mjesto     text,
  datum_od   date,
  datum_do   date,
  kola       integer,
  tempo      text,
  vrsta      text check (vrsta in ('standard', 'rapid', 'blitz')),
  skupine    text[] not null default '{}',
  -- startna lista [{n: ime, f: fide_id}] i rezultati praćenih igrača {kljuc: {...}}
  prijavljeni jsonb not null default '[]',
  rezultati  jsonb not null default '{}',
  azurirano  timestamptz not null default now()
);

alter table sah_turniri enable row level security;
drop policy if exists "sah_turniri_citanje" on sah_turniri;
create policy "sah_turniri_citanje" on sah_turniri
  for select to authenticated using (true);

-- Praćeni igrači: svaki korisnik vidi i uređuje samo svoje.
create table if not exists sah_igraci (
  id          uuid primary key default gen_random_uuid(),
  korisnik_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ime         text not null,
  fide_id     bigint,
  titula      text,
  godina_rodenja integer,
  federacija  text,
  rejting     jsonb not null default '{}',   -- {std, rapid, blitz}
  promjena    jsonb not null default '{}',   -- {std, rapid, blitz}
  prijave     jsonb not null default '[]',   -- nadolazeći turniri
  nedavno     jsonb not null default '[]',   -- završeni turniri s rezultatom
  napomena    text,
  azurirano   timestamptz,
  kreirano    timestamptz not null default now()
);

create index if not exists sah_igraci_korisnik on sah_igraci (korisnik_id);

alter table sah_igraci enable row level security;
drop policy if exists "sah_igraci_svoji" on sah_igraci;
create policy "sah_igraci_svoji" on sah_igraci
  for all to authenticated
  using (korisnik_id = auth.uid())
  with check (korisnik_id = auth.uid());

-- Stanje osvježavanja (jedan redak).
create table if not exists sah_stanje (
  id         integer primary key default 1 check (id = 1),
  osvjezeno  timestamptz,
  pokrenuto  timestamptz,
  greska     text
);
insert into sah_stanje (id) values (1) on conflict (id) do nothing;

alter table sah_stanje enable row level security;
drop policy if exists "sah_stanje_citanje" on sah_stanje;
create policy "sah_stanje_citanje" on sah_stanje
  for select to authenticated using (true);

-- Prenesi igrača iz prijašnje verzije aplikacije.
insert into sah_igraci (korisnik_id, ime, fide_id)
select u.id, 'David Vašek', 79326854
from auth.users u
where u.email = 'marko.vasek@gmail.com'
  and not exists (select 1 from sah_igraci i where i.korisnik_id = u.id and i.fide_id = 79326854);

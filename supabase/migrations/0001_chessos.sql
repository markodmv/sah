-- ChessOs: baza aplikacije Šah. Pokreni jednom u Supabase SQL Editoru projekta ChessOs.

-- ---------- korisnici i odobrenja ----------

create table if not exists profili (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  ime       text,
  odobren   boolean not null default false,
  admin     boolean not null default false,
  kreirano  timestamptz not null default now()
);

-- Svaka registracija dobiva profil na čekanju; administrator je odmah odobren.
create or replace function novi_korisnik() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profili (id, email, ime, odobren, admin)
  values (
    new.id, new.email, nullif(trim(new.raw_user_meta_data->>'ime'), ''),
    lower(new.email) = 'marko.vasek@gmail.com',
    lower(new.email) = 'marko.vasek@gmail.com'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists na_registraciju on auth.users;
create trigger na_registraciju after insert on auth.users
  for each row execute function novi_korisnik();

create or replace function je_odobren() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select odobren from profili where id = auth.uid()), false)
$$;

create or replace function je_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select admin and odobren from profili where id = auth.uid()), false)
$$;

alter table profili enable row level security;
drop policy if exists "profili_citanje" on profili;
create policy "profili_citanje" on profili
  for select to authenticated using (id = auth.uid() or je_admin());
drop policy if exists "profili_admin" on profili;
create policy "profili_admin" on profili
  for update to authenticated using (je_admin()) with check (je_admin());

-- ---------- turniri (zajednički, piše ih samo server) ----------

create table if not exists turniri (
  tnr         integer primary key,
  naziv       text not null,
  url         text not null,
  organizator text,
  mjesto      text,
  datum_od    date,
  datum_do    date,
  kola        integer,
  tempo       text,
  vrsta       text check (vrsta in ('standard', 'rapid', 'blitz')),
  skupine     text[] not null default '{}',
  prijavljeni jsonb not null default '[]',   -- startna lista [{n, f}]
  rezultati   jsonb not null default '{}',   -- rezultati praćenih igrača
  azurirano   timestamptz not null default now()
);
alter table turniri enable row level security;
drop policy if exists "turniri_citanje" on turniri;
create policy "turniri_citanje" on turniri
  for select to authenticated using (je_odobren());

-- ---------- praćeni igrači (svaki korisnik svoje) ----------

create table if not exists igraci (
  id             uuid primary key default gen_random_uuid(),
  korisnik_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ime            text not null,
  fide_id        bigint,
  titula         text,
  godina_rodenja integer,
  federacija     text,
  rejting        jsonb not null default '{}',
  promjena       jsonb not null default '{}',
  prijave        jsonb not null default '[]',
  nedavno        jsonb not null default '[]',
  napomena       text,
  azurirano      timestamptz,
  kreirano       timestamptz not null default now()
);
create index if not exists igraci_korisnik on igraci (korisnik_id);
alter table igraci enable row level security;
drop policy if exists "igraci_svoji" on igraci;
create policy "igraci_svoji" on igraci
  for all to authenticated
  using (korisnik_id = auth.uid() and je_odobren())
  with check (korisnik_id = auth.uid() and je_odobren());

-- ---------- stanje osvježavanja ----------

create table if not exists stanje (
  id        integer primary key default 1 check (id = 1),
  osvjezeno timestamptz,
  pokrenuto timestamptz,
  greska    text
);
insert into stanje (id) values (1) on conflict (id) do nothing;
alter table stanje enable row level security;
drop policy if exists "stanje_citanje" on stanje;
create policy "stanje_citanje" on stanje
  for select to authenticated using (je_odobren());

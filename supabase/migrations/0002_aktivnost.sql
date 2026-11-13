-- ChessOs: registracija bez odobrenja i bilježenje aktivnosti korisnika.
-- Pokreni jednom u Supabase SQL Editoru projekta ChessOs (nakon 0001_chessos.sql).

-- Novi korisnici su odmah odobreni; "odobren = false" sad znači da ih je administrator blokirao.
alter table profili alter column odobren set default true;

create or replace function novi_korisnik() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profili (id, email, ime, odobren, admin)
  values (
    new.id, new.email, nullif(trim(new.raw_user_meta_data->>'ime'), ''),
    true,
    lower(new.email) = 'marko.vasek@gmail.com'
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Koliko je tko koristio aplikaciju: po danu broj posjeta i aktivne minute.
create table if not exists aktivnost (
  korisnik_id uuid not null references auth.users(id) on delete cascade,
  dan         date not null,
  posjete     integer not null default 0,
  minute      integer not null default 0,
  zadnje      timestamptz not null default now(),
  primary key (korisnik_id, dan)
);

alter table aktivnost enable row level security;
drop policy if exists "aktivnost_admin" on aktivnost;
create policy "aktivnost_admin" on aktivnost
  for select to authenticated using (je_admin());

-- Poziva ga samo server (service role): +1 minuta, a na početku posjete i +1 posjeta.
create or replace function zabiljezi_aktivnost(korisnik uuid, nova_posjeta boolean)
returns void language sql security definer set search_path = public as $$
  insert into aktivnost (korisnik_id, dan, posjete, minute, zadnje)
  values (korisnik, (now() at time zone 'Europe/Zagreb')::date, case when nova_posjeta then 1 else 0 end, 1, now())
  on conflict (korisnik_id, dan) do update
    set posjete = aktivnost.posjete + case when nova_posjeta then 1 else 0 end,
        minute  = aktivnost.minute + 1,
        zadnje  = now();
$$;
revoke execute on function zabiljezi_aktivnost(uuid, boolean) from public, anon, authenticated;

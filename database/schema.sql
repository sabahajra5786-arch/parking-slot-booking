-- Run this script in the Supabase SQL Editor.
-- The backend uses the service-role key and performs authorization in Express.
-- Do not expose that key to the browser.

create extension if not exists btree_gist;

create table if not exists public.parking_spots (
  id text primary key check (char_length(id) between 1 and 30),
  level text not null check (char_length(level) between 1 and 40),
  type text not null check (type in ('standard', 'accessible', 'electric')),
  label text not null check (char_length(label) between 1 and 60),
  price_per_hour numeric(8, 2) not null check (price_per_hour >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.parking_bookings (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null references public.parking_spots(id) on update cascade on delete restrict,
  booking_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  driver_name text not null check (char_length(driver_name) between 1 and 60),
  vehicle_number text not null check (char_length(vehicle_number) between 1 and 15),
  cancel_token_hash text not null check (char_length(cancel_token_hash) = 64),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint valid_booking_time check (end_time > start_time),
  -- Half-open time ranges allow one booking to start exactly when another ends.
  constraint no_overlapping_active_bookings
    exclude using gist (
      spot_id with =,
      (tsrange(booking_date + start_time, booking_date + end_time, '[)')) with &&
    ) where (status = 'active')
);

create index if not exists parking_bookings_date_status_idx
  on public.parking_bookings (booking_date, status);
create index if not exists parking_bookings_spot_idx
  on public.parking_bookings (spot_id);

-- The Express backend accesses these tables using its server-only service-role key.
-- RLS is enabled so anonymous browser clients cannot access records directly.
alter table public.parking_spots enable row level security;
alter table public.parking_bookings enable row level security;

-- Useful demo data. The inserts are safe to run more than once.
insert into public.parking_spots (id, level, type, label, price_per_hour)
values
  ('A-01', 'Level 1', 'standard', 'Standard', 2.50),
  ('A-02', 'Level 1', 'electric', 'Electric charging', 3.50),
  ('A-03', 'Level 1', 'standard', 'Standard', 2.50),
  ('A-04', 'Level 1', 'accessible', 'Accessible', 2.50),
  ('B-01', 'Level 2', 'standard', 'Standard', 2.50),
  ('B-02', 'Level 2', 'electric', 'Electric charging', 3.50),
  ('B-03', 'Level 2', 'standard', 'Standard', 2.50),
  ('B-04', 'Level 2', 'accessible', 'Accessible', 2.50)
on conflict (id) do nothing;

-- Bench activity notifications
create table if not exists bench_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bench_id uuid not null references benches(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('rating', 'photo', 'confirmation', 'visit')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bench_notifications_user_id_idx on bench_notifications(user_id, created_at desc);

alter table bench_notifications enable row level security;

create policy "Users see own notifications"
  on bench_notifications for select
  using (auth.uid() = user_id);

create policy "Authenticated can insert notifications"
  on bench_notifications for insert
  with check (auth.uid() is not null);

create policy "Users can mark own notifications read"
  on bench_notifications for update
  using (auth.uid() = user_id);

alter publication supabase_realtime add table bench_notifications;

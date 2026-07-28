create table public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint user_progress_state_is_object check (jsonb_typeof(state) = 'object')
);

alter table public.user_progress enable row level security;

revoke all on table public.user_progress from anon;
grant select, insert, update, delete on table public.user_progress to authenticated;

create policy "Users can read their own progress"
on public.user_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own progress"
on public.user_progress
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own progress"
on public.user_progress
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own progress"
on public.user_progress
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Run this in your Supabase SQL editor to set up the YOUvolution database

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  age integer,
  height_inches integer,
  weight_lbs numeric(6,1),
  goal_weight_lbs numeric(6,1),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active')),
  fitness_goals text[],
  food_preferences text[],
  food_dislikes text[],
  injuries text[],
  gym_access boolean default false,
  maintenance_calories integer,
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, onboarding_complete)
  values (new.id, new.email, false);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Chat messages
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

-- Weekly plans
create table if not exists public.weekly_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  week_start date not null,
  meal_plan jsonb,
  workout_plan jsonb,
  calorie_target integer,
  protein_target integer,
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

-- Weight log
create table if not exists public.weight_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  weight_lbs numeric(6,1) not null,
  notes text,
  recorded_at timestamptz default now()
);

-- Meal logs
create table if not exists public.meal_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  description text not null,
  estimated_calories integer,
  estimated_protein integer,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at timestamptz default now()
);

-- Row Level Security (each user only sees their own data)
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.weight_entries enable row level security;
alter table public.meal_logs enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can view own messages" on public.messages for select using (auth.uid() = user_id);
create policy "Users can insert own messages" on public.messages for insert with check (auth.uid() = user_id);

create policy "Users can view own plans" on public.weekly_plans for select using (auth.uid() = user_id);
create policy "Users can upsert own plans" on public.weekly_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own plans" on public.weekly_plans for update using (auth.uid() = user_id);

create policy "Users can view own weights" on public.weight_entries for select using (auth.uid() = user_id);
create policy "Users can insert own weights" on public.weight_entries for insert with check (auth.uid() = user_id);

create policy "Users can view own meal logs" on public.meal_logs for select using (auth.uid() = user_id);
create policy "Users can insert own meal logs" on public.meal_logs for insert with check (auth.uid() = user_id);

-- Indexes for performance
create index if not exists messages_user_id_created_at on public.messages(user_id, created_at desc);
create index if not exists meal_logs_user_id_logged_at on public.meal_logs(user_id, logged_at desc);
create index if not exists weight_entries_user_id_recorded_at on public.weight_entries(user_id, recorded_at desc);
create index if not exists weekly_plans_user_week on public.weekly_plans(user_id, week_start desc);

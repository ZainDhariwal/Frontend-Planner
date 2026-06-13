-- Enable UUID generation extension if not exists
create extension if not exists "uuid-ossp";

-- PROFILES TABLE (Linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- PLANS TABLE
create table if not exists public.plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  title text not null,
  brief text,
  settings jsonb default '{}'::jsonb,
  llm_provider text default 'anthropic',
  total_cost numeric(15, 6) default 0.000000,
  is_public boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- PLAN NODES TABLE (Pages, components, hooks, etc.)
create table if not exists public.plan_nodes (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans on delete cascade not null,
  parent_id uuid references public.plan_nodes on delete cascade,
  type text not null check (type in ('page', 'component', 'hook', 'context', 'data_shape', 'mock_data', 'asset', 'lib')),
  name text not null,
  description text,
  status text not null check (status in ('draft', 'accepted', 'rejected', 'regenerating')) default 'draft',
  metadata jsonb default '{}'::jsonb,
  version integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- PLAN NODE DEPENDENCIES TABLE (Tracks connections between components/hooks/etc.)
create table if not exists public.plan_node_dependencies (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans on delete cascade not null,
  source_node_id uuid references public.plan_nodes on delete cascade not null,
  target_node_id uuid references public.plan_nodes on delete cascade not null,
  dependency_type text not null check (dependency_type in ('uses_component', 'uses_hook', 'uses_context', 'uses_data_shape', 'references')),
  created_at timestamp with time zone default now()
);

-- LLM USAGE LOGS TABLE
create table if not exists public.llm_usage_logs (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans on delete cascade not null,
  node_id uuid references public.plan_nodes on delete cascade,
  model_name text not null,
  key_type text not null,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cost numeric(15, 6) default 0.000000,
  action_type text not null, -- 'generate', 'decompose', 'regenerate'
  created_at timestamp with time zone default now()
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_nodes enable row level security;
alter table public.plan_node_dependencies enable row level security;
alter table public.llm_usage_logs enable row level security;

-- PROFILES Policies
drop policy if exists "Allow users to view their own profile" on public.profiles;
create policy "Allow users to view their own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Allow users to update their own profile" on public.profiles;
create policy "Allow users to update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- PLANS Policies
drop policy if exists "Allow users to manage their own plans" on public.plans;
create policy "Allow users to manage their own plans" on public.plans
  for all using (auth.uid() = user_id);

drop policy if exists "Allow public SELECT on shared plans" on public.plans;
create policy "Allow public SELECT on shared plans" on public.plans
  for select using (is_public = true);

-- PLAN NODES Policies
drop policy if exists "Allow users to manage nodes of their own plans" on public.plan_nodes;
create policy "Allow users to manage nodes of their own plans" on public.plan_nodes
  for all using (
    exists (
      select 1 from public.plans
      where plans.id = plan_nodes.plan_id
      and plans.user_id = auth.uid()
    )
  );

drop policy if exists "Allow public SELECT on nodes of shared plans" on public.plan_nodes;
create policy "Allow public SELECT on nodes of shared plans" on public.plan_nodes
  for select using (
    exists (
      select 1 from public.plans
      where plans.id = plan_nodes.plan_id
      and plans.is_public = true
    )
  );

-- PLAN NODE DEPENDENCIES Policies
drop policy if exists "Allow users to manage dependencies of their own plans" on public.plan_node_dependencies;
create policy "Allow users to manage dependencies of their own plans" on public.plan_node_dependencies
  for all using (
    exists (
      select 1 from public.plans
      where plans.id = plan_node_dependencies.plan_id
      and plans.user_id = auth.uid()
    )
  );

drop policy if exists "Allow public SELECT on dependencies of shared plans" on public.plan_node_dependencies;
create policy "Allow public SELECT on dependencies of shared plans" on public.plan_node_dependencies
  for select using (
    exists (
      select 1 from public.plans
      where plans.id = plan_node_dependencies.plan_id
      and plans.is_public = true
    )
  );

-- LLM USAGE LOGS Policies
drop policy if exists "Allow users to view usage logs of their own plans" on public.llm_usage_logs;
create policy "Allow users to view usage logs of their own plans" on public.llm_usage_logs
  for select using (
    exists (
      select 1 from public.plans
      where plans.id = llm_usage_logs.plan_id
      and plans.user_id = auth.uid()
    )
  );

drop policy if exists "Allow users to insert usage logs for their own plans" on public.llm_usage_logs;
create policy "Allow users to insert usage logs for their own plans" on public.llm_usage_logs
  for insert with check (
    exists (
      select 1 from public.plans
      where plans.id = llm_usage_logs.plan_id
      and plans.user_id = auth.uid()
    )
  );

-- Trigger to automatically create a profile for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'avatar_path', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger safely
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

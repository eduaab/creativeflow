/** DDL idempotente — roda a cada inicialização (PGlite ou Postgres). */
export const SCHEMA_SQL = `
create table if not exists users (
  id text primary key,
  name text not null,
  email text not null,
  role text not null
);

create table if not exists pracas (
  code text primary key,
  name text not null
);

create table if not exists segments (
  id text primary key,
  data jsonb not null
);

create table if not exists products (
  sku text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists offers (
  id text primary key,
  sku text not null,
  praca text not null,
  data jsonb not null,
  source text not null default 'seed',
  updated_at timestamptz not null default now()
);
create index if not exists offers_sku_praca on offers (sku, praca);

create table if not exists campaigns (
  id text primary key,
  name text not null,
  briefing jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_export_at timestamptz
);

create table if not exists concepts (
  id text primary key,
  campaign_id text not null,
  number int not null,
  data jsonb not null,
  source text not null,
  status text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz
);
create index if not exists concepts_campaign on concepts (campaign_id);

create table if not exists creatives (
  id text primary key,
  campaign_id text not null,
  format text not null,
  praca text not null,
  segment_id text not null,
  skus jsonb not null,
  current_version_id text,
  status text not null,
  exception_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creatives_campaign on creatives (campaign_id);

create table if not exists versions (
  id text primary key,
  creative_id text not null,
  number int not null,
  doc jsonb not null,
  origin text not null,
  concept_id text,
  author_id text not null,
  instruction text,
  ops jsonb,
  rejected jsonb,
  diff jsonb,
  validation jsonb,
  status text not null,
  created_at timestamptz not null default now()
);
create index if not exists versions_creative on versions (creative_id);

create table if not exists ai_proposals (
  id text primary key,
  creative_id text not null,
  base_version_id text not null,
  instruction text not null,
  scope text not null,
  data jsonb not null,
  status text not null,
  author_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id text primary key,
  creative_id text,
  version_id text,
  concept_id text,
  reviewer_id text not null,
  decision text not null,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  campaign_id text,
  creative_id text,
  version_id text,
  actor_id text,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_campaign on audit_events (campaign_id, created_at);

create table if not exists learnings (
  id text primary key,
  text text not null,
  source text not null,
  source_review_id text,
  status text not null,
  created_by text not null,
  decided_by text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create table if not exists exports (
  id text primary key,
  campaign_id text not null,
  file_name text not null,
  path text not null,
  count int not null,
  manifest jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists semantic_checks (
  hash text primary key,
  provider text not null,
  fallback boolean not null default false,
  error text,
  findings jsonb not null,
  dismissed jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists critiques (
  id text primary key,
  creative_id text not null,
  version_id text not null,
  provider text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
`;

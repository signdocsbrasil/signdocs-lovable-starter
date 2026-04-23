-- 0001_envelope_status.sql
-- Espelho local do status de cada sessão de assinatura SignDocs.
-- Escrita pelo webhook (bypassa RLS via service_role_key).
-- Leitura pelo frontend (usuário logado lê as próprias linhas via RLS).

create table if not exists public.envelope_status (
  session_id     text primary key,
  transaction_id text,
  user_id        uuid references auth.users(id) on delete cascade,
  status         text not null default 'PENDING',
  evidence_id    text,
  updated_at     timestamptz not null default now()
);

alter table public.envelope_status enable row level security;

create policy "owners read their sessions"
  on public.envelope_status for select
  using (auth.uid() = user_id);

-- Realtime: inclui envelope_status na publicação padrão do Supabase
-- para que mudanças sejam entregues ao frontend via subscribe().
alter publication supabase_realtime add table public.envelope_status;

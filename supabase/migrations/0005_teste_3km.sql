-- Histórico do teste de 3km (esforço máximo) por aluno — não é por ciclo.
-- O coach registra cada teste (normalmente a cada 8-12 semanas) pra
-- acompanhar a evolução do tempo e do pace de limiar (FTP) do aluno.

create table public.teste_3km (
  id            uuid primary key default gen_random_uuid(),
  aluno_id      uuid not null references public.aluno(id) on delete cascade,
  data_teste    date not null,
  tempo_sec     integer not null,       -- tempo total dos 3km
  ftp_pace_sec  integer,                -- pace de limiar resultante (seg/km), se calculado
  observacoes   text,
  criado_em     timestamptz not null default now()
);

create index teste_3km_aluno_idx on public.teste_3km (aluno_id, data_teste);

alter table public.teste_3km enable row level security;
create policy coach_all on public.teste_3km
  for all to authenticated using (true) with check (true);

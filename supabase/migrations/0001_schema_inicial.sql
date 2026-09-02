-- =============================================================================
-- Painel AGRUN — schema inicial (passo 1 da seção 11 da especificação)
--
-- Modelo de dados: seção 2 da ESPECIFICACAO_TECNICA.md
-- Single-tenant (só a AGRUN, seção 9): qualquer usuário autenticado é "o coach"
-- e tem acesso total. RLS fica ligado mesmo assim para bloquear acesso anônimo.
--
-- Convenções:
--   - PKs em uuid (gen_random_uuid)
--   - pace e duração sempre em segundos inteiros; formatação só na UI
--   - datas de calendário como `date`; timestamps de auditoria como `timestamptz`
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- aluno
-- -----------------------------------------------------------------------------
create table public.aluno (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  objetivo_atual  text,
  observacoes     text,                 -- texto livre, entra no prompt de feedback
  criado_em       timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- ciclo  (uma "planilha mensal" = um ciclo)
-- -----------------------------------------------------------------------------
create table public.ciclo (
  id              uuid primary key default gen_random_uuid(),
  aluno_id        uuid not null references public.aluno(id) on delete cascade,
  objetivo        text not null,        -- ex: "Planilha 21km"
  sequencia       integer not null,     -- ex: 2
  data_inicio     date not null,
  data_fim        date not null,
  ftp_pace_sec    integer,              -- ex: 4:36/km -> 276
  ftp_data_teste  date,
  criado_em       timestamptz not null default now(),
  constraint ciclo_periodo_valido check (data_fim >= data_inicio)
);

create index ciclo_aluno_idx on public.ciclo (aluno_id);
-- casamento plano x execução filtra por janela de datas (seção 5)
create index ciclo_periodo_idx on public.ciclo (data_inicio, data_fim);

-- -----------------------------------------------------------------------------
-- zona  (5 por ciclo — podem mudar entre ciclos)
-- -----------------------------------------------------------------------------
create table public.zona (
  id             uuid primary key default gen_random_uuid(),
  ciclo_id       uuid not null references public.ciclo(id) on delete cascade,
  codigo         text not null check (codigo in ('Z1','Z2','Z3','Z4','Z5')),
  pace_low_sec   integer,   -- limite "lento" da faixa; NULL quando não há (Z5)
  pace_high_sec  integer,   -- limite "rápido" da faixa
  descricao      text,
  unique (ciclo_id, codigo)
);

create index zona_ciclo_idx on public.zona (ciclo_id);

-- -----------------------------------------------------------------------------
-- treino_planejado  (as 16 sessões de um ciclo)
-- -----------------------------------------------------------------------------
create table public.treino_planejado (
  id                     uuid primary key default gen_random_uuid(),
  ciclo_id               uuid not null references public.ciclo(id) on delete cascade,
  codigo                 text not null,   -- T01..T16
  semana                 integer not null check (semana between 1 and 4),
  periodo_inicio         date,
  periodo_fim            date,
  tipo                   text,            -- ex: "Tempo Run", "Longão"
  estrutura              text,            -- ex: "5min Z1 + 18min Z3 + 5min Z1"
  duracao_planejada_sec  integer,
  volume_planejado_m     integer,
  unique (ciclo_id, codigo)
);

create index treino_planejado_ciclo_idx on public.treino_planejado (ciclo_id);

-- -----------------------------------------------------------------------------
-- treino_executado  (criado quando o .FIT de resultado é importado)
-- -----------------------------------------------------------------------------
create table public.treino_executado (
  id                   uuid primary key default gen_random_uuid(),
  treino_planejado_id  uuid references public.treino_planejado(id) on delete set null,
  aluno_id             uuid not null references public.aluno(id) on delete cascade,
  data_execucao        date not null,
  duracao_real_sec     integer,
  arquivo_fit_path     text,              -- caminho no bucket `fit-files`
  status_match         text not null
                         check (status_match in
                           ('auto_confirmado','pendente_revisao','confirmado_manual')),
  -- lista de etapas: [{nome, pace_sec, kph_med, kph_max,
  --                    fc_min, fc_med, fc_max, cadencia_med, cadencia_max, elevacao_med}]
  -- unidades já convertidas (seção 4): nunca m/s, nunca cadência sem o fator 2
  etapas               jsonb not null default '[]'::jsonb,
  criado_em            timestamptz not null default now()
);

create index treino_executado_aluno_idx on public.treino_executado (aluno_id);
create index treino_executado_planejado_idx on public.treino_executado (treino_planejado_id);

-- -----------------------------------------------------------------------------
-- feedback  (1:1 com treino_executado)
-- -----------------------------------------------------------------------------
create table public.feedback (
  id                   uuid primary key default gen_random_uuid(),
  treino_executado_id  uuid not null unique
                         references public.treino_executado(id) on delete cascade,
  texto_rascunho       text,             -- saída bruta da IA
  texto_final          text,             -- versão editada/aprovada pelo coach
  status               text not null default 'pendente'
                         check (status in ('pendente','rascunho','aprovado','enviado')),
  gerado_em            timestamptz,
  aprovado_em          timestamptz,
  enviado_em           timestamptz       -- V1: "enviar" só marca esta data
);

-- =============================================================================
-- RLS — single-tenant: autenticado = acesso total; anônimo = nada
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'aluno','ciclo','zona','treino_planejado','treino_executado','feedback'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy coach_all on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- =============================================================================
-- Storage — buckets privados para os arquivos crus (auditoria)
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('fit-files', 'fit-files', false),
       ('planilhas', 'planilhas', false)
on conflict (id) do nothing;

create policy "coach le fit-files"
  on storage.objects for select to authenticated
  using (bucket_id = 'fit-files');
create policy "coach grava fit-files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'fit-files');

create policy "coach le planilhas"
  on storage.objects for select to authenticated
  using (bucket_id = 'planilhas');
create policy "coach grava planilhas"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'planilhas');

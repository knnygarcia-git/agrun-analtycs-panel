-- Importa um ciclo inteiro (ciclo + zonas + treinos planejados) de forma atômica.
-- Chamada pelo frontend após a tela de conferência. SECURITY INVOKER: respeita o RLS
-- (o coach autenticado tem a policy `coach_all`).
--
-- Formato dos parâmetros:
--   p_ciclo   = {objetivo, sequencia, data_inicio, data_fim, ftp_pace_sec, ftp_data_teste}
--   p_zonas   = [{codigo, pace_rapido_sec, pace_lento_sec, descricao}, ...]  (5 itens)
--   p_treinos = [{codigo, semana, periodo_inicio, periodo_fim, tipo, estrutura,
--                 duracao_planejada_sec, volume_planejado_m}, ...]           (16 itens)

create or replace function public.importar_ciclo(
  p_aluno_id uuid,
  p_ciclo    jsonb,
  p_zonas    jsonb,
  p_treinos  jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_ciclo_id uuid;
begin
  if not exists (select 1 from public.aluno where id = p_aluno_id) then
    raise exception 'aluno % não encontrado', p_aluno_id;
  end if;

  insert into public.ciclo (aluno_id, objetivo, sequencia, data_inicio, data_fim,
                            ftp_pace_sec, ftp_data_teste)
  values (
    p_aluno_id,
    p_ciclo->>'objetivo',
    (p_ciclo->>'sequencia')::int,
    (p_ciclo->>'data_inicio')::date,
    (p_ciclo->>'data_fim')::date,
    nullif(p_ciclo->>'ftp_pace_sec', '')::int,
    nullif(p_ciclo->>'ftp_data_teste', '')::date
  )
  returning id into v_ciclo_id;

  insert into public.zona (ciclo_id, codigo, pace_rapido_sec, pace_lento_sec, descricao)
  select
    v_ciclo_id,
    z->>'codigo',
    nullif(z->>'pace_rapido_sec', '')::int,
    nullif(z->>'pace_lento_sec', '')::int,
    z->>'descricao'
  from jsonb_array_elements(p_zonas) as z;

  insert into public.treino_planejado (ciclo_id, codigo, semana, periodo_inicio, periodo_fim,
                                       tipo, estrutura, duracao_planejada_sec, volume_planejado_m)
  select
    v_ciclo_id,
    t->>'codigo',
    (t->>'semana')::int,
    nullif(t->>'periodo_inicio', '')::date,
    nullif(t->>'periodo_fim', '')::date,
    t->>'tipo',
    t->>'estrutura',
    nullif(t->>'duracao_planejada_sec', '')::int,
    nullif(t->>'volume_planejado_m', '')::int
  from jsonb_array_elements(p_treinos) as t;

  return v_ciclo_id;
end;
$$;

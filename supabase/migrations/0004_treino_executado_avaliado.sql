-- Marca manual do coach: "já avaliei este treino".
-- Independente do feedback — o coach pode marcar sem gerar rascunho de IA.
-- Na UI, um treino conta como "avaliado" quando:
--   avaliado_em IS NOT NULL  (marcado à mão)
--   OU o feedback dele está com status 'enviado' (aprovado + enviado ao aluno).

alter table public.treino_executado
  add column if not exists avaliado_em timestamptz;

-- Renomeia as colunas de pace da zona para nomes inequívocos.
--   pace_rapido_sec  = limite mais rápido da faixa  (coluna "De" / B na planilha; menor nº de segundos)
--   pace_lento_sec   = limite mais lento da faixa   (coluna "Até" / C na planilha; maior nº de segundos)
-- Z5 não tem limite rápido → pace_rapido_sec NULL.

alter table public.zona rename column pace_low_sec  to pace_rapido_sec;
alter table public.zona rename column pace_high_sec to pace_lento_sec;

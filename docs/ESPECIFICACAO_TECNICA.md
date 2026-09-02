# Painel AGRUN — Especificação Técnica (V1)

> Documento de handoff para implementação no Claude Code. Consolida tudo que foi validado
> em sessão de descoberta com dados reais do cliente (coach de corrida de rua, AGRUN) antes
> da construção do produto.

---

## 1. Problema e objetivo

O coach da AGRUN usa TrainingPeaks pra gerenciar treinos de ~15 alunos. Dois gargalos:

1. **Upload de treinos planejados** — hoje manual, treino por treino, por aluno.
2. **Feedback individualizado por treino** — demorado, mas é o diferencial competitivo dele.

**Escopo da V1:** resolver o gargalo do feedback com um painel onde o coach importa o
resultado de um treino, revisa uma análise + rascunho de feedback gerado por IA, edita se
quiser, e só então aprova o envio. **A IA nunca envia nada sozinha.**

O upload automatizado do plano pro TrainingPeaks fica fora do escopo da V1 (ver seção 9 —
a API oficial do TP exige aprovação de parceiro e não foi solicitada ainda).

---

## 2. Modelo de dados

```
aluno
  id, nome, objetivo_atual, observacoes (texto livre), criado_em

ciclo (uma "planilha mensal" = um ciclo)
  id, aluno_id, objetivo (ex: "Planilha 21km"), sequencia (ex: 2),
  data_inicio, data_fim, ftp_pace_sec, ftp_data_teste

zona (pertence a um ciclo — pode mudar entre ciclos)
  id, ciclo_id, codigo (Z1..Z5), pace_low_sec, pace_high_sec, descricao

treino_planejado (as 16 sessões de um ciclo)
  id, ciclo_id, codigo (T01..T16), semana (1-4), periodo_inicio, periodo_fim,
  tipo (ex: "Tempo Run", "Longão"), estrutura (texto, ex: "5min Z1 + 18min Z3..."),
  duracao_planejada_sec, volume_planejado_m

treino_executado (preenchido só quando o .FIT de resultado é importado)
  id, treino_planejado_id (nullable até confirmar o match), aluno_id,
  data_execucao, duracao_real_sec, arquivo_fit_raw (storage),
  status_match ("auto_confirmado" | "pendente_revisao" | "confirmado_manual"),
  etapas (json: lista de {nome, pace, kph, fc_min/med/max, cadencia_med/max, elevacao_med})

feedback
  id, treino_executado_id, texto_rascunho, texto_final, status
  ("pendente" | "rascunho" | "aprovado" | "enviado"), gerado_em, aprovado_em, enviado_em
```

---

## 3. Importador de planilha (Excel)

Estrutura real confirmada célula a célula (arquivo de referência: planilha do Arthur,
aba `"21km Planilha 02"`, mas o nome da aba muda por ciclo — buscar pelo padrão
`"21km Planilha NN"` ou pedir ao coach pra selecionar a aba).

**Cabeçalho do ciclo:**
```
A1  -> nome do aluno
J1  -> objetivo (ex: "Planilha 21km")
M1  -> sequência do ciclo (ex: 2)
F2  -> data início
H2  -> data fim
J3  -> FTP pace (formato hora, ex: 0:04:36)
L3  -> data do teste de limiar
```

**Zonas** (linhas fixas 7, 9, 11, 13, 15):
```
A{r} -> código da zona (Z1..Z5)
B{r} -> pace baixo (formato hora)
C{r} -> pace alto (formato hora)
```

**Treinos** — 16 blocos, cada um ancorado numa célula com o padrão `T\d+` (regex).
Blocos ímpares (T01, T03...) na coluna A; pares (T02, T04...) na coluna I — mas o código
real determina isso, não a paridade. Ao localizar a célula-âncora (ex: `T05` em `I20`):

```
offset +1 coluna, linhas [0,1,2]  -> estrutura (texto livre, 1-3 linhas)
offset +4 coluna, mesma linha     -> label "Duração"
offset +5 coluna, mesma linha     -> valor duração (formato hora)
offset +4 coluna, linha+1         -> label "Volume"
offset +5 coluna, linha+1         -> valor volume (metros, número)
offset +4 coluna, linha+3         -> tipo/tag do treino (ex: "Tempo Run")
```

Datas da semana vêm do cabeçalho de cada bloco de 4 treinos (linhas 19 e 40 no arquivo de
referência, mas variam — localizar por texto `"SEMANA"`).

**Biblioteca recomendada:** `openpyxl` (Python) ou `exceljs` (Node), com `data_only=True`
pra ler valores calculados, não fórmulas. Datas e durações vêm como tipo nativo
(`datetime.time`/`datetime.datetime`), não como texto — importante pra evitar parsing frágil.

**Tela de conferência obrigatória** antes de confirmar a importação: mostrar lado a lado o
que foi lido vs. o esperado, com destaque pra qualquer campo que não seguiu o padrão.

---

## 4. Importador de treino executado (.FIT)

Formato binário, decodificar com `fitparse` (Python) ou `fit-file-parser` (Node/JS).

**Do arquivo de plano (`workout_step` messages):** nome do treino, etapas com
`duration_time`, `intensity`, `custom_target_speed_low/high` (m/s).

**Do arquivo de resultado:**
- `lap` messages → uma por etapa, campo `wkt_step_index` linka à etapa do plano.
  ⚠️ **Bug conhecido:** o campo `timestamp` da lap vem incorreto (repete o primeiro
  horário do treino). Calcular o fim de cada etapa como `start_time + total_elapsed_time`,
  nunca ler `timestamp` direto.
- `record` messages → série de ~1 ponto/segundo com `heart_rate`, `enhanced_speed`,
  `enhanced_altitude`, `cadence`. Usar essa série (filtrada pela janela de tempo de cada
  lap) pra calcular mín/méd/máx de FC, cadência e elevação — a lap não traz mínimo nativo.

**Conversões de unidade obrigatórias:**
```
pace (min/km)     = 1000 / (velocidade_m_s * 60)
velocidade (km/h) = velocidade_m_s * 3.6
duração (min)     = segundos / 60
distância (km)    = metros / 1000
cadência (rpm)    = valor_bruto_do_fit * 2   // campo vem em strides/min, corrigir pra rpm
elevação (m)      = já vem nativa em metros, sem conversão
```
Nunca expor m/s, segundos brutos ou cadência sem o fator 2 em nenhuma tela ou no prompt da IA.

**Classificação de zona:** sempre calculada em código a partir da tabela de zonas do aluno
(nunca digitada ou inferida pela IA). Comparar o pace real de cada etapa contra as faixas
`pace_low/high` da zona do ciclo ativo.

---

## 5. Lógica de casamento (plano × execução)

Problema real identificado: nomes de treino se repetem entre ciclos (ex: "T05 Tempo Run"
existe em toda planilha mensal). Casar só por nome arrisca confundir meses diferentes.

**Algoritmo:**
1. Filtrar candidatos: `treino_planejado` cujo `ciclo.data_inicio <= data_execucao <= ciclo.data_fim`.
2. Dentro desse filtro, casar por `codigo` (T01..T16) extraído do nome do `.FIT`.
3. Validação cruzada: comparar `duracao_real_sec` do `.FIT` com `duracao_planejada_sec`.
   - Diferença ≤ 5% → `status_match = "auto_confirmado"`, processa direto.
   - Diferença > 5% → `status_match = "pendente_revisao"`, exige confirmação manual do coach
     antes de gerar feedback.

---

## 6. Motor de feedback (IA)

**Modelo recomendado:** Claude Haiku 4.5 (custo ~US$0,003/geração nesse volume — ver seção 8).
Se a qualidade não for suficiente em testes reais, subir pra Sonnet.

**System prompt (calibrado com exemplo real do coach — few-shot):**

```
Você é um assistente que ajuda um coach de corrida de rua a redigir feedbacks de treino
para seus alunos. Você escreve RASCUNHOS que o coach sempre revisa e edita antes de
enviar — nunca escreva como se a decisão final fosse sua.

ESTILO DE ESCRITA:
- Cumprimente o aluno pelo nome, tom direto e pessoal.
- Fale em termos de ZONAS (Z1 a Z5), nunca cite pace em min/km ou FC em bpm cru no texto.
- Percorra o treino na ordem cronológica das etapas.
- Tom encorajador e afirmativo por padrão. Só sinalize atenção quando houver justificativa
  clara nos dados ou histórico do aluno.
- Não dê nota numérica.
- Feche sempre reforçando o que foi positivo.
- Seja conciso: 4-6 frases.

EXEMPLO DE COMO ESTE COACH ESCREVE (few-shot):
"Olá Arthur, segue a avaliação do seu treino. [...]"
[ver histórico da sessão de descoberta pro texto completo do exemplo]

Retorne apenas o texto do feedback, em português, endereçado ao aluno. Nada de preâmbulo.
```

**Entrada dinâmica por geração:** nome do aluno, objetivo, observações do cadastro,
etapas com pace real + zona calculada + zona planejada + FC média + cadência média, e
qualquer nota de contexto relevante (ex: divergência fisiológica que não deve ser tratada
como alerta sem histórico que justifique).

**Fluxo de UI:** botão "Gerar rascunho" → chamada à API → texto editável em textarea →
"Aprovar e enviar" (grava `texto_final`, muda status) / "Gerar novo rascunho" / "Descartar".
Nunca enviar automaticamente.

---

## 7. Design system (já aplicado no protótipo)

**Cores:**
```css
--ink:#10151B        /* fundo */
--panel:#1B222B       /* superfície de card */
--panel-2:#212A34
--line:#2C3541         /* hairlines */
--text:#EDEFF2
--muted:#8B94A3
--muted-2:#5B6472

/* Espectro funcional de zona — NUNCA usar pra branding, só pra dado */
--z1:#4C8CFF  --z2:#35B7A0  --z3:#E8C547  --z4:#F2874A  --z5:#E23B3B

/* Marca AGRUN — extraídas do logo oficial, usar pra chrome de UI */
--brand-blue:#1C428F
--brand-orange:#F3911A
```

**Tipografia:** `Oswald` (headers, números grandes, efeito placar) + `Inter` (corpo,
tabelas). Números sempre com `font-variant-numeric: tabular-nums`.

**Logo:** duas versões — colorida (fundo claro) e branca/transparente (fundo escuro, a
usada no protótipo). Ambas fornecidas pelo cliente.

**Telas principais:**
- Sidebar: lista de alunos (avatar com gradiente brand-blue→brand-orange)
- Aba "Zonas": cabeçalho do ciclo (objetivo, sequência, FTP) + tabela Z1-Z5
- Aba "Treino": seletor horizontal dos 16 treinos do ciclo (bolinha verde = com dado,
  cinza = sem dado) → gráfico de ritmo+FC (estilo TrainingPeaks nativo, colorido por
  zona) → tabela plano×realizado por etapa com alerta de divergência de zona →
  seção de feedback (tudo numa aba só, nessa ordem)

**Protótipo de referência:** arquivo HTML único gerado durante a sessão de descoberta,
com dados reais do Arthur (zonas + treino T05 completo). Serve de referência visual e de
comportamento, não de arquitetura de código (é client-side puro, sem banco de dados).

---

## 8. Stack e custo

| Camada | Escolha | Custo |
|---|---|---|
| Hospedagem frontend | Cloudflare Pages | Grátis, uso comercial permitido |
| Banco de dados + Auth + Storage | Supabase | Grátis até 500MB/1GB (folgado pro volume atual) |
| Geração de feedback | API Claude (Haiku 4.5) | ~US$0,003/geração → menos de US$1/mês no volume atual |

⚠️ **Não usar Vercel Hobby** — termos restringem a uso pessoal/não-comercial, e este é um
negócio (viola os termos usar pra atender alunos pagantes).

⚠️ A assinatura paga do Claude (Pro/Max) do usuário **não pode ser reaproveitada** pra
API — são sistemas de billing separados. Precisa de conta de API própria (pode ser do
próprio dono do negócio).

---

## 9. Fora de escopo da V1 (backlog futuro)

- **Upload automático do plano pro TrainingPeaks** — requer aprovação de API parceira da
  TrainingPeaks (processo de ~7-10 dias, não solicitado ainda). `.zwo` foi testado e
  descartado — é formato de potência de ciclismo, não serve pra pace de corrida.
- **Zonas por FC** além de pace (hoje só pace, como na planilha original).
- **Sincronização de hover entre os dois gráficos** (ritmo/FC) — hoje independentes.
- **Multi-coach / múltiplas contas** — V1 é single-tenant (só o AGRUN).

---

## 10. Dados de teste (fixtures)

Usar o Arthur como aluno de referência pros testes de integração:

- **Ciclo:** Planilha 21km #2, 10/08/2026–07/09/2026, FTP 4:36/km (teste 08/07/2026)
- **Zonas:** Z1 6:03–7:40 · Z2 5:17–6:03 · Z3 4:36–4:57 · Z4 4:00–4:31 · Z5 <4:00 (min/km)
- **16 treinos completos** (código, tipo, estrutura, duração, volume) — ver planilha
  original ou o protótipo HTML (array `WORKOUTS`), já extraídos e validados.
- **T05 (Tempo Run) execução completa** — tabela plano×realizado por etapa, série de FC/pace
  ponto a ponto — já extraída e validada no protótipo HTML (arrays `ETAPAS` e `SERIES_T05`).
- **Exemplo real de feedback do coach** pro T05 — usado como few-shot no prompt (seção 6).

---

## 11. Roteiro sugerido de implementação

1. Banco de dados (schema da seção 2) + login do coach
2. Importador de Excel + tela de conferência
3. Importador de `.FIT` + lógica de casamento (seção 5)
4. Motor de feedback + tela de revisão/aprovação
5. Telas de cadastro (novo aluno, zonas) — hoje fixas no protótipo
6. Teste com Arthur + 2-3 alunos reais
7. Deploy (Cloudflare Pages + Supabase)

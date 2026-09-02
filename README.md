# Painel AGRUN

Painel web para o coach da AGRUN revisar e aprovar feedbacks de treino gerados por IA
antes de enviar aos alunos. **A IA nunca envia nada sozinha.**

Especificação completa: [`docs/ESPECIFICACAO_TECNICA.md`](docs/ESPECIFICACAO_TECNICA.md).

## Stack

| Camada | Escolha |
|---|---|
| Frontend | React + Vite + TypeScript → Cloudflare Pages |
| Banco / Auth / Storage | Supabase |
| Parsing de Excel e `.FIT` | No navegador (client-side), antes da tela de conferência |
| Geração de feedback | Google Gemini (`gemini-flash-lite-latest`, free tier) via Supabase Edge Function |

Decisões da V1: single-tenant (só a AGRUN); "Aprovar e enviar" apenas marca o feedback
como enviado (o coach copia o texto para o TrainingPeaks).

## Estrutura

```
web/                     app Vite (React + TS)
  src/lib/               supabase, auth, e (nos próximos passos) parsers e matching
  src/styles/            design system (seção 7)
  src/pages/ components/  telas e chrome
supabase/
  migrations/            schema versionado
  functions/             Edge Functions (proxy da API Claude — passo 4)
docs/                    especificação técnica
```

## Setup

### 1. Banco (Supabase)

1. Crie um projeto em <https://supabase.com>.
2. Aplique o schema. Com a CLI do Supabase:
   ```bash
   supabase link --project-ref <ref-do-projeto>
   supabase db push
   ```
   Ou cole o conteúdo de `supabase/migrations/0001_schema_inicial.sql` no SQL Editor do painel.
3. Em **Authentication → Providers**, confirme que "Enable email signups" está **desligado**.
4. Crie a conta do coach em **Authentication → Users → Add user** (e-mail + senha,
   marque "Auto confirm user").

### 2. Frontend

```bash
cd web
npm install
cp ../.env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Abra <http://localhost:5173>, entre com a conta do coach. A lista de alunos aparece
vazia até o passo 2 (cadastro / importação de planilha).

### 3. Edge Function de feedback (`gerar-feedback`)

1. Pegue uma chave da API do Gemini em <https://aistudio.google.com/apikey> (free tier).
2. No painel do Supabase → **Edge Functions** → *Deploy a new function* → nome `gerar-feedback`
   → cole o conteúdo de `supabase/functions/gerar-feedback/index.ts` → Deploy.
3. Em **Edge Functions → Secrets**, adicione `GEMINI_API_KEY` com o valor da chave.
   (`SUPABASE_URL` e `SUPABASE_ANON_KEY` já existem por padrão.)
4. Mantenha "Verify JWT" ligado — só o coach logado pode chamar a função.

Modelo usado: `gemini-flash-lite-latest`. Se o Google descontinuá-lo, troque a
constante `MODELO` no topo do arquivo da função.

## Roteiro (seção 11)

- [x] **1. Banco de dados + login do coach**
- [x] **2. Importador de Excel + tela de conferência**
- [x] **3. Importador de `.FIT` + lógica de casamento**
- [x] **4. Motor de feedback (Edge Function + Gemini) + tela de revisão/aprovação**
- [x] **5. Telas de cadastro/edição (aluno, ciclo, zonas) + navegação**
- [ ] 6. Teste com Arthur + 2-3 alunos reais
- [ ] 7. Deploy (Cloudflare Pages + Supabase)

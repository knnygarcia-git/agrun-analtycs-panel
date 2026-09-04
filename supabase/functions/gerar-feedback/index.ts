// Edge Function: gera um RASCUNHO de feedback de treino com a API do Google Gemini.
// A IA nunca envia nada — só devolve texto que o coach revisa, edita e aprova no painel.
//
// Deploy pelo painel do Supabase (Edge Functions → Deploy a new function).
// Secret necessária: GEMINI_API_KEY  (Edge Functions → Secrets)
// Secret opcional: GROQ_API_KEY — se configurada, é usada como plano B quando
// o Gemini está sobrecarregado (503/429) ou fora do ar, pra reduzir o erro de
// "alta demanda" pro coach sem depender de billing no Google.
// SUPABASE_URL e SUPABASE_ANON_KEY já são injetadas automaticamente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MODELO = "gemini-flash-lite-latest";
const GEMINI_URL = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

const GROQ_MODELO = "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Você é um assistente que ajuda o coach da AGRUN (corrida de rua) a redigir RASCUNHOS de feedback de treino. O coach sempre revisa e edita antes de enviar.

CONTEXTO IMPORTANTE:
- Os treinos são prescritos por ZONAS DE INTENSIDADE / VELOCIDADE (Z1 a Z5). NÃO existe prescrição por frequência cardíaca. Nunca fale em "zona de FC planejada" nem diga que a FC ficou "acima da zona".
- A frequência cardíaca é apenas OBSERVADA como resposta ao esforço. Comente-a só quando houver algo a dizer: ex. subiu muito num trecho de baixa intensidade sem subida no terreno, não recuperou nos trechos leves, ou (positivo) respondeu bem/controlada nas intensidades altas.
- Elevação (subida) pode explicar tanto uma FC mais alta quanto uma queda de ritmo — se a etapa teve ganho de elevação relevante, leve isso em conta antes de apontar como problema.

COMO ESTE COACH ESCREVE:
- Abre de forma casual: "Oi João, tudo bem?", "Bom dia João", "Conseguimos manter...".
- Fala em ZONAS. Nunca cita pace em min/km nem FC em bpm no texto.
- Percorre o treino: aquecimento → bloco principal → desaquecimento.
- Frases curtas e diretas. Tom majoritariamente positivo, mesmo quando houve deslizes — reconhece o que foi bem.
- Proibido: "picotado", "fragmentado", "laps manuais", "quedas fortes", "excelente", "perfeito", "totalmente dentro do esperado". Use no lugar: "algumas variações de velocidade", "algumas pausas", "o treino teve algumas interrupções", "momentos de aceleração", "algumas inconsistências".
- Não dá nota numérica. Não cita números de laps/segmentos/partes.
- **Sempre 5 a 6 frases, com o mesmo tamanho de um feedback para o outro** — não escreva bem mais num treino do que no outro. Mesmo num treino tranquilo, cubra: (a) o aquecimento, (b) o bloco principal — ficou na zona? está mais perto do limite rápido (evolução) ou do lento?, (c) os intervalos de recuperação ou o desaquecimento, (d) uma frase sobre a resposta da frequência cardíaca, (e) a pergunta "Tem algo que precisa relatar sobre esse treino?".

O QUE OBSERVAR (nessa ordem de prioridade):
1. O aluno ficou dentro da janela de intensidade prescrita por zona de velocidade em cada fase?
2. Ele conseguiu ficar mais perto do limite RÁPIDO da zona (sinal de evolução — mais resistência naquela intensidade) ou ficou mais no limite lento?
3. Nos intervalos de recuperação (Z1), ele descansou de verdade ou acelerou? Recomende manter leve nos intervalos.
4. FC: resposta coerente com a intensidade? Alguma variação inesperada (subida sem aumento de intensidade nem de terreno; falta de recuperação no leve)?
5. Se há dados de treinos ANTERIORES DO MESMO ALUNO, use para comentar evolução dentro das zonas. Nunca compare com outros atletas.

QUANDO ALGO SAIU DO PLANEJADO: aponte de forma leve, sem dramatizar, e pergunte ao aluno ("Tem algo que precisa relatar sobre?", "Aconteceu algo nesse treino que você precise relatar?"). Não invente a causa.

Retorne apenas o texto do feedback, em português, endereçado ao aluno. Sem preâmbulo, sem assinatura.`;

// ---- few-shots reais do coach -----------------------------------------------

const EX1_IN = `Aluno: João Antônio · Objetivo: prova de 5km
PLANO: T09 - Base aeróbia · 40:00 · 5min Z1 · 30min Z2 · 5min Z1
EXECUTADO: 40:25

Fases (nome | zona realizada | zona planejada | posição na faixa | % dentro da faixa | FC méd/máx | ganho de elevação):
Aquecimento | Z1 | Z1 | meio | 92% | 104/113 | 1 m
Bloco principal km 1 | Z2 | Z2 | perto do rápido | 83% | 155/180 | 24 m
Bloco principal km 2 | Z2 | Z2 | perto do rápido | 78% | 179/185 | 35 m
Bloco principal (resto) | Z2 | Z2 | meio | 96% | 161/171 | 0 m
Desaquecimento | Z1 | Z1 | mais lento que a faixa | 36% | 150/159 | 0 m
Corrida extra depois | Z2 | (sem prescrição) | — | — | 158/176 | 0 m

PONTOS DE ATENÇÃO:
- Bloco principal de 30min contínuo; teve algumas pausas no meio e ficou mais curto que o previsto.
- Algumas variações de velocidade dentro do bloco principal.
- Correu mais um trecho depois do desaquecimento.

Treinos anteriores deste aluno: sem histórico.`;

const EX1_OUT = `Bom dia João, tudo bem? No aquecimento você segurou bem a Z1. No bloco principal você manteve a intensidade em Z2 e ficou mais perto do limite rápido da zona, o que mostra evolução nessa faixa. No desaquecimento tivemos algumas interrupções e alguns trechos acima do leve — procure segurar bem devagar nessa parte final. A frequência cardíaca respondeu bem, subindo mais só nos trechos com um pouco de subida. Tem algo que precisa relatar sobre esse treino?`;

const EX2_IN = `Aluno: João Antônio · Objetivo: prova de 5km
PLANO: T06 - Base aeróbia · 45:00 · 5min Z1 · 35min Z2 · 5min Z1
EXECUTADO: 47:11

Fases (nome | zona realizada | zona planejada | posição na faixa | % dentro da faixa | FC méd/máx | ganho de elevação):
Aquecimento | Z1 | Z1 | meio | 90% | 105/116 | 0 m
Bloco principal km 1 | Z2 | Z2 | meio | 88% | 161/168 | 1 m
Bloco principal km 2 | Z2 | Z2 | meio | 74% | 170/181 | 24 m
Bloco principal km 3 | Z2 | Z2 | meio | 80% | 174/180 | 34 m
Bloco principal km 4 | Z2 | Z2 | perto do rápido | 92% | 159/168 | 0 m
Bloco principal (resto) | Z2 | Z2 | meio | 85% | 154/159 | 0 m
Desaquecimento | Z1 | Z1 | meio | 96% | 148/159 | 1 m
Trecho extra | Z2 | Z1 | mais rápido que a faixa | 30% | 147/169 | 2 m

PONTOS DE ATENÇÃO:
- Alguns momentos de aceleração dentro do bloco principal (km 4 mais rápido).
- No desaquecimento houve um trecho acima da Z1.
- FC mais alta nos km 2 e 3, que também tiveram subida no terreno.

Treinos anteriores deste aluno: no T09 (base aeróbia) ele ficou em média mais perto do limite lento da Z2; neste treino ficou mais no meio da faixa.`;

const EX2_OUT = `Oi João, tudo bem? No aquecimento você ficou certinho na Z1. Conseguimos manter as intensidades no bloco principal, oscilando pelo meio da Z2 e com alguns momentos de aceleração maiores no final. No desaquecimento também percebi algumas variações e um trecho acima do leve, procure segurar mais devagar nessa parte. A frequência cardíaca subiu um pouco nos trechos de subida, o que é esperado pelo terreno, de resto respondeu bem. Tem algo que precisa relatar sobre esse treino?`;

const EX3_IN = `Aluno: João Antônio · Objetivo: prova de 5km
PLANO: T05 - Corrida Rápida · 33:00 · 5min Z1 + 5min Z2 · 6 x (1min Z5 + 2min Z1) · 5min Z1
EXECUTADO: 33:10

Fases (nome | zona realizada | zona planejada | posição na faixa | % dentro da faixa | FC méd/máx | ganho de elevação):
Aquecimento | Z1 | Z1 | meio | 90% | 110/128 | 0 m
Aquecimento Z2 | Z2 | Z2 | meio | 88% | 140/150 | 0 m
Tiro 1 | Z5 | Z5 | mais rápido que a faixa | — | 168/178 | 0 m
Recuperação 1 | Z1 | Z1 | meio | 85% | 150/165 | 0 m
Tiro 2 | Z5 | Z5 | perto do rápido | — | 172/181 | 0 m
Recuperação 2 | Z1 | Z1 | meio | 88% | 148/160 | 0 m
Tiros 3 a 5 | Z5 | Z5 | perto do rápido | — | 175/184 | 0 m
Recuperação 5 | Z2 | Z1 | mais rápido que a faixa | 40% | 158/170 | 0 m
Tiro 6 | Z5 | Z5 | perto do rápido | — | 176/185 | 0 m
Desaquecimento | Z1 | Z1 | meio | 92% | 150/162 | 0 m

PONTOS DE ATENÇÃO:
- Tiro 1 saiu mais rápido que a faixa da Z5; do tiro 2 em diante ele ajustou.
- A recuperação após o 5º tiro ficou acima da Z1 (acelerou no intervalo).

Treinos anteriores deste aluno: FC média e máxima nos tiros parecidas com as das sessões intensas anteriores.`;

const EX3_OUT = `Oi João, tudo bem? No aquecimento você foi bem em Z1 e Z2. Você conseguiu manter bem os tiros em Z5 — o primeiro saiu um pouco mais rápido, mas nos outros você já ajustou. O intervalo de descanso depois do 5º tiro você acelerou um pouco, procure sempre manter em Z1, esses intervalos são para descansar. Sua frequência cardíaca está respondendo bem aos treinos mais intensos, tanto a média quanto a mínima e a máxima, está bem bom. Tem algo que precisa relatar sobre esse treino?`;

// -----------------------------------------------------------------------------

async function chamarGemini(
  geminiKey: string,
  mensagem: string,
): Promise<{ texto: string } | { erro: string; overload: boolean }> {
  const corpo = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      { role: "user", parts: [{ text: EX1_IN }] },
      { role: "model", parts: [{ text: EX1_OUT }] },
      { role: "user", parts: [{ text: EX2_IN }] },
      { role: "model", parts: [{ text: EX2_OUT }] },
      { role: "user", parts: [{ text: EX3_IN }] },
      { role: "model", parts: [{ text: EX3_OUT }] },
      { role: "user", parts: [{ text: mensagem }] },
    ],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
  });

  let resp: Response | null = null;
  let ultimoErro = "";
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (tentativa > 0) await new Promise((r) => setTimeout(r, 1500 * tentativa));
    try {
      resp = await fetch(GEMINI_URL(MODELO), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: corpo,
      });
    } catch (e) {
      ultimoErro = (e as Error).message;
      continue;
    }
    if (resp.status !== 503 && resp.status !== 429) break;
    ultimoErro = `HTTP ${resp.status}`;
  }
  if (!resp) return { erro: ultimoErro, overload: false };

  const gj = await resp.json();
  if (!resp.ok || gj.error) {
    return {
      erro: gj.error?.message ?? `HTTP ${resp.status}`,
      overload: resp.status === 503 || resp.status === 429,
    };
  }

  const texto: string | undefined = gj.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  if (!texto) return { erro: "o modelo devolveu resposta vazia", overload: false };
  return { texto };
}

/** Plano B quando o Gemini está sobrecarregado — mesmo prompt/few-shots, só
 *  reformatado pro formato de mensagens (OpenAI-style) que o Groq usa. */
async function chamarGroq(
  groqKey: string,
  mensagem: string,
): Promise<{ texto: string } | { erro: string }> {
  const corpo = JSON.stringify({
    model: GROQ_MODELO,
    temperature: 0.7,
    max_tokens: 1200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: EX1_IN },
      { role: "assistant", content: EX1_OUT },
      { role: "user", content: EX2_IN },
      { role: "assistant", content: EX2_OUT },
      { role: "user", content: EX3_IN },
      { role: "assistant", content: EX3_OUT },
      { role: "user", content: mensagem },
    ],
  });

  let resp: Response;
  try {
    resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: corpo,
    });
  } catch (e) {
    return { erro: (e as Error).message };
  }

  const gj = await resp.json();
  if (!resp.ok || gj.error) {
    return { erro: gj.error?.message ?? `HTTP ${resp.status}` };
  }
  const texto: string | undefined = gj.choices?.[0]?.message?.content?.trim();
  if (!texto) return { erro: "o modelo devolveu resposta vazia" };
  return { texto };
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function fmtSec(s: number | null | undefined): string {
  if (s == null) return "—";
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function contarSegmentosPlano(estrutura: string | null): number {
  if (!estrutura) return 0;
  const s = estrutura.replace(/(\d+)\s*x\s*\(([^)]+)\)/gi, (_m, n, inner) => {
    const c = inner.split(/\s*\+\s*/).filter(Boolean).length;
    return new Array(Number(n) * c).fill("·").join(" · ");
  });
  return s.split(/\s*[·+]\s*/).filter((p) => p.trim()).length;
}

function posTexto(pos: number | null): string {
  if (pos == null) return "—";
  if (pos > 1.05) return "mais rápido que a faixa";
  if (pos < -0.05) return "mais lento que a faixa";
  if (pos >= 0.62) return "perto do limite rápido";
  if (pos <= 0.38) return "perto do limite lento";
  return "meio da faixa";
}

interface Etapa {
  nome: string;
  fc_med: number | null;
  fc_max: number | null;
  pace_sec: number | null;
  zona_calculada: string | null;
  zona_planejada: string | null;
  pct_na_faixa: number | null;
  pos_na_zona: number | null;
  elevacao_ganho_m: number | null;
}

interface TP {
  codigo: string;
  tipo: string | null;
  estrutura: string | null;
  duracao_planejada_sec: number | null;
}

interface TE {
  aluno_id: string;
  duracao_real_sec: number | null;
  etapas: Etapa[];
  aluno: { nome: string; objetivo_atual: string | null; observacoes: string | null };
  treino_planejado: TP | null;
}

function resumoAnterior(atual: Etapa[], anteriores: { etapas: Etapa[] }[]): string {
  const media = (es: Etapa[]) => {
    const v = es
      .filter((e) => e.pos_na_zona != null && e.zona_planejada && e.zona_planejada !== "Z1")
      .map((e) => e.pos_na_zona as number);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const mAtual = media(atual);
  const mAnt =
    anteriores.length && media(anteriores[0].etapas) != null
      ? media(anteriores[0].etapas)
      : null;
  if (mAtual == null || mAnt == null) return "sem base de comparação clara.";
  const diff = mAtual - mAnt;
  if (Math.abs(diff) < 0.12) return "posição dentro das zonas parecida com a do treino anterior dele.";
  return diff > 0
    ? "neste treino ele ficou mais perto do limite rápido das zonas do que no treino anterior dele — sinal de evolução."
    : "neste treino ele ficou mais perto do limite lento das zonas do que no treino anterior dele.";
}

function construirMensagem(te: TE, anteriores: { etapas: Etapa[] }[]): string {
  const a = te.aluno;
  const tp = te.treino_planejado;
  const L: string[] = [
    `Aluno: ${a.nome} · Objetivo: ${a.objetivo_atual ?? "não informado"}`,
    a.observacoes ? `Observações do cadastro: ${a.observacoes}` : "",
    `PLANO: ${tp?.codigo ?? "?"} - ${tp?.tipo ?? "treino"} · ${fmtSec(
      tp?.duracao_planejada_sec,
    )} · ${tp?.estrutura ?? "—"}`,
    `EXECUTADO: ${fmtSec(te.duracao_real_sec)}`,
    "",
    "Fases (nome | zona realizada | zona planejada | posição na faixa | % dentro da faixa | FC méd/máx | ganho de elevação):",
  ].filter(Boolean);

  for (const e of te.etapas) {
    L.push(
      `${e.nome} | ${e.zona_calculada ?? "?"} | ${
        e.zona_planejada ?? "(sem prescrição)"
      } | ${posTexto(e.pos_na_zona)} | ${
        e.pct_na_faixa != null ? e.pct_na_faixa + "%" : "—"
      } | ${e.fc_med ?? "?"}/${e.fc_max ?? "?"} | ${
        e.elevacao_ganho_m != null ? e.elevacao_ganho_m + " m" : "—"
      }`,
    );
  }

  const pts: string[] = [];
  const pReal = te.duracao_real_sec ?? 0;
  const pPlan = tp?.duracao_planejada_sec ?? 0;
  if (pPlan && Math.abs(pReal - pPlan) / pPlan > 0.12) {
    pts.push(
      `Duração total (${fmtSec(pReal)}) diferente do plano (${fmtSec(pPlan)}).`,
    );
  }
  const zonaNum = (z: string | null) => (z ? Number(z.replace(/\D/g, "")) : 0);
  for (const e of te.etapas) {
    // desaquecimento/esfriar que saiu do leve (mesmo sem zona prescrita no passo aberto)
    if (/esfriar|desaquec|resfr/i.test(e.nome) && zonaNum(e.zona_calculada) >= 2) {
      pts.push(`"${e.nome}": no desaquecimento houve um trecho acima do leve (Z1).`);
    }
    if (!e.zona_planejada) continue;
    const recuperacao = /Z1/.test(e.zona_planejada) && /recup|intervalo/i.test(e.nome);
    if (
      e.zona_calculada &&
      e.zona_calculada !== e.zona_planejada &&
      (e.pos_na_zona == null || e.pos_na_zona > 1.05 || e.pos_na_zona < -0.05)
    ) {
      if (recuperacao || (e.pos_na_zona != null && e.pos_na_zona > 1.05)) {
        pts.push(
          `"${e.nome}": ficou mais rápido que a faixa da ${e.zona_planejada}${
            recuperacao ? " (era um trecho de recuperação, para descansar)" : ""
          }.`,
        );
      } else {
        pts.push(`"${e.nome}": ficou mais lento que a faixa da ${e.zona_planejada}.`);
      }
    } else if (e.pct_na_faixa != null && e.pct_na_faixa < 60 && !recuperacao) {
      pts.push(`"${e.nome}": passou boa parte do tempo fora da faixa da zona.`);
    }
    if (
      e.fc_med != null &&
      e.fc_med > 165 &&
      e.zona_planejada === "Z1" &&
      (e.elevacao_ganho_m ?? 0) < 10
    ) {
      pts.push(`"${e.nome}": FC alta para um trecho de baixa intensidade sem subida.`);
    }
  }
  const segPlano = contarSegmentosPlano(tp?.estrutura ?? null);
  if (segPlano > 0 && te.etapas.length > segPlano * 1.8 + 1) {
    pts.push("Houve várias pausas ao longo do treino, ele ficou fragmentado.");
  }

  L.push("");
  L.push(
    pts.length
      ? "PONTOS DE ATENÇÃO:\n- " + pts.join("\n- ")
      : "PONTOS DE ATENÇÃO: nenhum relevante. Variações fisiológicas normais (ex: FC subindo aos poucos num bloco com ritmo estável) não são problema.",
  );
  L.push("");
  L.push(`Treinos anteriores deste aluno: ${resumoAnterior(te.etapas, anteriores)}`);
  return L.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "não autenticado" }, 401);

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY não configurada" }, 500);
  const groqKey = Deno.env.get("GROQ_API_KEY");

  let treinoId: string | undefined;
  try {
    treinoId = (await req.json())?.treino_executado_id;
  } catch {
    return json({ error: "corpo inválido" }, 400);
  }
  if (!treinoId) return json({ error: "treino_executado_id obrigatório" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "sessão inválida" }, 401);

  const { data: te, error } = await supabase
    .from("treino_executado")
    .select(
      "aluno_id, data_execucao, duracao_real_sec, etapas, aluno:aluno(nome, objetivo_atual, observacoes), treino_planejado:treino_planejado(codigo, tipo, estrutura, duracao_planejada_sec)",
    )
    .eq("id", treinoId)
    .single();

  if (error || !te) return json({ error: "treino não encontrado" }, 404);
  if (!Array.isArray(te.etapas) || te.etapas.length === 0) {
    return json({ error: "treino sem etapas processadas" }, 422);
  }

  // treinos anteriores DO MESMO ALUNO (mesmo tipo primeiro), nunca de outros
  // deno-lint-ignore no-explicit-any
  const tipo = (te as any).treino_planejado?.tipo ?? null;
  let anteriores: { etapas: Etapa[] }[] = [];
  const { data: prev } = await supabase
    .from("treino_executado")
    .select("etapas, data_execucao, treino_planejado:treino_planejado(tipo)")
    .eq("aluno_id", te.aluno_id)
    .neq("id", treinoId)
    .lte("data_execucao", (te as any).data_execucao)
    .order("data_execucao", { ascending: false })
    .limit(6);
  if (Array.isArray(prev)) {
    // deno-lint-ignore no-explicit-any
    const mesmoTipo = prev.filter((p: any) => p.treino_planejado?.tipo === tipo);
    anteriores = (mesmoTipo.length ? mesmoTipo : prev).slice(0, 2);
  }

  // deno-lint-ignore no-explicit-any
  const mensagem = construirMensagem(te as any, anteriores);

  const viaGemini = await chamarGemini(geminiKey, mensagem);
  if ("texto" in viaGemini) return json({ texto: viaGemini.texto });

  if (groqKey) {
    const viaGroq = await chamarGroq(groqKey, mensagem);
    if ("texto" in viaGroq) return json({ texto: viaGroq.texto });
  }

  return json(
    {
      error: viaGemini.overload
        ? "O Gemini está com alta demanda agora. Tente gerar o rascunho de novo em alguns segundos."
        : `Gemini: ${viaGemini.erro}`,
    },
    502,
  );
});

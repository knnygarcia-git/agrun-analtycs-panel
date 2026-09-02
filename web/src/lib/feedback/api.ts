import { supabase } from "@/lib/supabase";

interface RespostaFeedback {
  texto?: string;
  error?: string;
}

/** Chama a Edge Function `gerar-feedback`. Devolve o texto do rascunho. */
export async function gerarRascunho(treinoExecutadoId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<RespostaFeedback>(
    "gerar-feedback",
    { body: { treino_executado_id: treinoExecutadoId } },
  );

  if (error) {
    // invoke embrulha respostas != 2xx; tenta ler a mensagem do corpo
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      } catch {
        /* mantém msg */
      }
    }
    throw new Error(msg);
  }

  if (data?.error) throw new Error(data.error);
  if (!data?.texto) throw new Error("O modelo não devolveu texto.");
  return data.texto;
}

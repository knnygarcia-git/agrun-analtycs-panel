import { gunzipSync, unzipSync } from "fflate";

export interface ArquivoFit {
  /** nome final, sempre terminando em .FIT */
  nome: string;
  bytes: ArrayBuffer;
}

const RE_FIT = /\.fit$/i;
const RE_GZ = /\.gz$/i;
const RE_ZIP = /\.zip$/i;

function paraArrayBuffer(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

/**
 * Extrai um ou mais arquivos .FIT do que o coach subiu:
 *  - `.FIT`      → ele mesmo
 *  - `.FIT.gz`   → descompactado (export de 1 treino do TrainingPeaks)
 *  - `.zip`      → todos os `.FIT` / `.FIT.gz` de dentro (export por período do TP)
 */
export async function extrairFits(file: File): Promise<ArquivoFit[]> {
  const buf = new Uint8Array(await file.arrayBuffer());

  // .zip — assinatura "PK"
  if (RE_ZIP.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    let entradas: Record<string, Uint8Array>;
    try {
      entradas = unzipSync(buf);
    } catch (e) {
      throw new Error(`Não consegui abrir o .zip: ${(e as Error).message}`);
    }
    const out: ArquivoFit[] = [];
    for (const [caminho, dados] of Object.entries(entradas)) {
      const base = caminho.split("/").pop() ?? caminho;
      if (!dados.length) continue;
      if (RE_GZ.test(base) && RE_FIT.test(base.replace(RE_GZ, ""))) {
        try {
          out.push({ nome: base.replace(RE_GZ, ""), bytes: paraArrayBuffer(gunzipSync(dados)) });
        } catch {
          /* ignora entrada corrompida */
        }
      } else if (RE_FIT.test(base)) {
        out.push({ nome: base, bytes: paraArrayBuffer(dados) });
      }
    }
    if (!out.length) throw new Error("O .zip não tem nenhum arquivo .FIT dentro.");
    // ordena por nome (que tem a data no padrão do TrainingPeaks)
    out.sort((a, b) => a.nome.localeCompare(b.nome));
    return out;
  }

  // .gz — assinatura 1f 8b
  if (RE_GZ.test(file.name) || (buf[0] === 0x1f && buf[1] === 0x8b)) {
    return [
      { nome: file.name.replace(RE_GZ, ""), bytes: paraArrayBuffer(gunzipSync(buf)) },
    ];
  }

  // .FIT direto
  return [{ nome: file.name, bytes: paraArrayBuffer(buf) }];
}

import { read, utils } from "xlsx";
import type { CellObject, WorkBook, WorkSheet } from "xlsx";
import { fmtSec, pad2 } from "@/lib/format";
import type {
  Campo,
  CicloParsed,
  PlanilhaParsed,
  Severidade,
  TreinoParsed,
  ZonaParsed,
} from "./types";

/* ============================================================================
   Config e helpers
   ============================================================================ */

// abas de ciclo: "21km Planilha 02", "5km Planilha 01", "10km Planilha 03"…
const RE_ABA_CICLO = /^\d+\s*km\s+Planilha\s+\d+$/i;
const RE_ANCORA = /^T\d{1,2}$/;
const RE_SEMANA = /^\s*SEMANA\s*0*(\d+)/i;

const ZONA_LINHAS = [7, 9, 11, 13, 15]; // 1-indexadas, fixas (seção 3)
const ZONA_CODIGOS = ["Z1", "Z2", "Z3", "Z4", "Z5"];

// faixas plausíveis para pegar leitura claramente fora do padrão
const PACE_SEC_MIN = 120; // 2:00/km
const PACE_SEC_MAX = 800; // 13:20/km
const DURACAO_SEC_MIN = 5 * 60;
const DURACAO_SEC_MAX = 4 * 3600;

function ok<T>(valor: T, celula: string, bruto: string): Campo<T> {
  return { valor, celula, bruto, severidade: "ok" };
}
function marca<T>(
  valor: T | null,
  celula: string,
  bruto: string,
  severidade: Severidade,
  nota: string,
): Campo<T> {
  return { valor, celula, bruto, severidade, nota };
}

function cell(ws: WorkSheet, addr: string): CellObject | undefined {
  return ws[addr] as CellObject | undefined;
}

/** coordenada relativa a uma âncora (0-indexado internamente, retorna "A1") */
function rel(addr: string, dCol: number, dRow: number): string {
  const { r, c } = utils.decode_cell(addr);
  return utils.encode_cell({ r: r + dRow, c: c + dCol });
}

/* ---- leitura tipada de células --------------------------------------------- */

function lerTexto(ws: WorkSheet, addr: string, rotulo: string): Campo<string> {
  const cv = cell(ws, addr);
  if (cv == null || cv.v == null || String(cv.v).trim() === "") {
    return marca<string>(null, addr, "—", "erro", `${rotulo} não encontrado`);
  }
  const t = String(cv.v).trim();
  return ok(t, addr, t);
}

function lerInteiro(ws: WorkSheet, addr: string, rotulo: string): Campo<number> {
  const cv = cell(ws, addr);
  if (cv == null || cv.v == null || cv.v === "") {
    return marca<number>(null, addr, "—", "erro", `${rotulo} não encontrado`);
  }
  const n = typeof cv.v === "number" ? cv.v : Number(String(cv.v).replace(",", "."));
  if (!Number.isFinite(n)) {
    return marca<number>(null, addr, String(cv.v), "erro", `${rotulo} não é número`);
  }
  return ok(Math.round(n), addr, String(Math.round(n)));
}

/** serial de data do Excel (sistema 1900) -> "YYYY-MM-DD", calculado em UTC
    para não sofrer com o fuso da máquina. 25569 = dias entre 1899-12-30 e 1970-01-01. */
function serialParaISO(serial: number): { iso: string; br: string } | null {
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dia = d.getUTCDate();
  return { iso: `${y}-${pad2(m)}-${pad2(dia)}`, br: `${pad2(dia)}/${pad2(m)}/${y}` };
}

function lerData(ws: WorkSheet, addr: string, rotulo: string): Campo<string> {
  const cv = cell(ws, addr);
  if (cv == null || cv.v == null || cv.v === "") {
    return marca<string>(null, addr, "—", "erro", `${rotulo} não encontrada`);
  }
  if (typeof cv.v !== "number") {
    return marca<string>(null, addr, String(cv.v), "erro", `${rotulo} não é data`);
  }
  const d = serialParaISO(cv.v);
  if (!d) return marca<string>(null, addr, String(cv.v), "erro", `${rotulo} inválida`);
  return ok(d.iso, addr, d.br);
}

/** fração de dia do Excel -> segundos */
function lerDuracao(
  ws: WorkSheet,
  addr: string,
  rotulo: string,
  min = DURACAO_SEC_MIN,
  max = DURACAO_SEC_MAX,
): Campo<number> {
  const cv = cell(ws, addr);
  if (cv == null || cv.v == null || cv.v === "") {
    return marca<number>(null, addr, "—", "erro", `${rotulo} não encontrada`);
  }
  if (typeof cv.v !== "number") {
    return marca<number>(null, addr, String(cv.v), "erro", `${rotulo} não é tempo`);
  }
  const sec = Math.round(cv.v * 86400);
  const campo = ok(sec, addr, fmtSec(sec));
  if (sec < min || sec > max) {
    campo.severidade = "aviso";
    campo.nota = `${rotulo} fora da faixa esperada (${fmtSec(min)}–${fmtSec(max)})`;
  }
  return campo;
}

/* ============================================================================
   Abas
   ============================================================================ */

export function carregarWorkbook(buf: ArrayBuffer): WorkBook {
  return read(buf, { cellDates: false, cellNF: false });
}

export function listarAbasCiclo(wb: WorkBook): string[] {
  return wb.SheetNames.filter((n) => RE_ABA_CICLO.test(n));
}

/* ============================================================================
   Parsing de um ciclo (uma aba)
   ============================================================================ */

export function parseAba(wb: WorkBook, aba: string): PlanilhaParsed {
  const ws = wb.Sheets[aba];
  if (!ws) throw new Error(`Aba "${aba}" não existe na planilha`);

  const ciclo = parseCabecalho(ws);
  const zonas = parseZonas(ws);
  const treinos = parseTreinos(ws);

  const campos: Campo<unknown>[] = [
    ...Object.values(ciclo),
    ...zonas.flatMap((z) => Object.values(z)),
    ...treinos.flatMap((t) => Object.values(t)),
  ];
  const temErro =
    campos.some((c) => c.severidade === "erro") ||
    zonas.length !== 5 ||
    treinos.length < 3;

  // planilhas conhecidas têm 12 (5km/10km) ou 16 (21km) treinos
  if (!temErro && treinos.length !== 12 && treinos.length !== 16) {
    const primeiro = treinos[0]?.codigo;
    if (primeiro)
      primeiro.severidade =
        primeiro.severidade === "erro" ? "erro" : "aviso";
    if (primeiro && !primeiro.nota)
      primeiro.nota = `Encontrei ${treinos.length} treinos (o normal é 12 ou 16). Confira se a aba está completa.`;
  }

  return { aba, ciclo, zonas, treinos, temErro };
}

function parseCabecalho(ws: WorkSheet): CicloParsed {
  const ciclo: CicloParsed = {
    nomeAlunoPlanilha: lerTexto(ws, "A1", "Nome do aluno (A1)"),
    objetivo: lerTexto(ws, "J1", "Objetivo (J1)"),
    sequencia: lerInteiro(ws, "M1", "Sequência (M1)"),
    dataInicio: lerData(ws, "F2", "Data de início (F2)"),
    dataFim: lerData(ws, "H2", "Data de fim (H2)"),
    ftpPaceSec: lerDuracao(ws, "J3", "FTP pace (J3)", PACE_SEC_MIN, PACE_SEC_MAX),
    ftpDataTeste: lerData(ws, "L3", "Data do teste (L3)"),
  };

  // nome do aluno na planilha é só informativo; não deve travar a importação
  if (ciclo.nomeAlunoPlanilha.severidade === "erro") {
    ciclo.nomeAlunoPlanilha.severidade = "aviso";
  }

  if (
    ciclo.dataInicio.valor &&
    ciclo.dataFim.valor &&
    ciclo.dataFim.valor < ciclo.dataInicio.valor
  ) {
    ciclo.dataFim.severidade = "erro";
    ciclo.dataFim.nota = "Data de fim antes da data de início";
  }
  return ciclo;
}

function parseZonas(ws: WorkSheet): ZonaParsed[] {
  return ZONA_LINHAS.map((linha, i) => {
    const esperado = ZONA_CODIGOS[i];
    const aCod = `A${linha}`;
    const aRap = `B${linha}`;
    const aLen = `C${linha}`;

    const codigo = lerTexto(ws, aCod, `Código da ${esperado}`);
    if (codigo.valor && codigo.valor.toUpperCase() !== esperado) {
      codigo.severidade = "erro";
      codigo.nota = `Esperado ${esperado} na linha ${linha}, veio "${codigo.valor}"`;
    }

    // Z5 não tem limite rápido: B15 costuma trazer "Máximo"
    const rapCell = cell(ws, aRap);
    let paceRapidoSec: Campo<number>;
    if (esperado === "Z5" && (rapCell == null || typeof rapCell.v !== "number")) {
      paceRapidoSec = ok<number | null>(null, aRap, String(rapCell?.v ?? "Máximo")) as Campo<number>;
    } else {
      paceRapidoSec = lerDuracao(ws, aRap, `Pace rápido da ${esperado}`, PACE_SEC_MIN, PACE_SEC_MAX);
    }

    const paceLentoSec = lerDuracao(ws, aLen, `Pace lento da ${esperado}`, PACE_SEC_MIN, PACE_SEC_MAX);

    if (
      paceRapidoSec.valor != null &&
      paceLentoSec.valor != null &&
      paceRapidoSec.valor > paceLentoSec.valor
    ) {
      paceLentoSec.severidade = "aviso";
      paceLentoSec.nota = "Pace lento menor que o rápido (colunas trocadas?)";
    }

    return { codigo, paceRapidoSec, paceLentoSec };
  });
}

interface Ancora {
  codigo: string;
  addr: string;
  r: number;
  c: number;
}

function acharAncoras(ws: WorkSheet): Ancora[] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = utils.decode_range(ref);
  const out: Ancora[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = utils.encode_cell({ r, c });
      const cv = cell(ws, addr);
      const txt = cv?.v != null ? String(cv.v).trim() : "";
      if (RE_ANCORA.test(txt)) {
        // normaliza T1..T9 -> T01..T09
        const n = txt.slice(1).padStart(2, "0");
        out.push({ codigo: `T${n}`, addr, r, c });
      }
    }
  }
  return out;
}

interface HeaderSemana {
  num: number;
  r: number;
  c: number;
}

function acharSemanas(ws: WorkSheet): HeaderSemana[] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = utils.decode_range(ref);
  const out: HeaderSemana[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cv = cell(ws, utils.encode_cell({ r, c }));
      const m = cv?.v != null ? RE_SEMANA.exec(String(cv.v)) : null;
      if (m) out.push({ num: Number(m[1]), r, c });
    }
  }
  return out;
}

/** monta o texto da estrutura a partir das 3 linhas da coluna (âncora +1) */
function lerEstrutura(ws: WorkSheet, addr: string): Campo<string> {
  const { r, c } = utils.decode_cell(addr);
  const partes: string[] = [];
  for (let dr = 0; dr < 3; dr++) {
    const cEstr = cell(ws, utils.encode_cell({ r: r + dr, c: c + 1 }));
    const cZona = cell(ws, utils.encode_cell({ r: r + dr, c: c + 2 }));
    if (cEstr?.v == null || String(cEstr.v).trim() === "") continue;
    if (typeof cEstr.v === "number") {
      const zona = cZona?.v != null ? ` ${String(cZona.v).trim()}` : "";
      partes.push(`${cEstr.v}m${zona}`);
    } else {
      partes.push(String(cEstr.v).trim());
    }
  }
  const cel = `${utils.encode_cell({ r, c: c + 1 })}:${utils.encode_cell({ r: r + 2, c: c + 1 })}`;
  if (partes.length === 0) {
    return marca<string>(null, cel, "—", "aviso", "Estrutura vazia");
  }
  const texto = partes.join(" · ");
  return ok(texto, cel, texto);
}

function parseTreinos(ws: WorkSheet): TreinoParsed[] {
  const ancoras = acharAncoras(ws).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const semanas = acharSemanas(ws);

  return ancoras.map((anc) => {
    // semana = header "SEMANA" na mesma coluna, na maior linha <= âncora
    const header = semanas
      .filter((s) => s.c === anc.c && s.r <= anc.r)
      .sort((a, b) => b.r - a.r)[0];

    const codigo = ok(anc.codigo, anc.addr, anc.codigo);

    let semana: Campo<number>;
    let periodoInicio: Campo<string>;
    let periodoFim: Campo<string>;
    if (header) {
      const rowHdr = header.r + 1; // 1-indexado p/ endereço
      const colHdr = utils.encode_col(header.c);
      semana = ok(header.num, `${colHdr}${rowHdr}`, `Semana ${header.num}`);
      periodoInicio = lerData(ws, rel(anc.addr, 4, -(anc.r - header.r)), "Início da semana");
      periodoFim = lerData(ws, rel(anc.addr, 5, -(anc.r - header.r)), "Fim da semana");
    } else {
      semana = marca<number>(null, anc.addr, "—", "erro", "Cabeçalho SEMANA não encontrado");
      periodoInicio = marca<string>(null, "—", "—", "aviso", "Sem cabeçalho de semana");
      periodoFim = marca<string>(null, "—", "—", "aviso", "Sem cabeçalho de semana");
    }

    const estrutura = lerEstrutura(ws, anc.addr);
    const duracaoPlanejadaSec = lerDuracao(ws, rel(anc.addr, 5, 0), `Duração de ${anc.codigo}`);
    const volumePlanejadoM = lerInteiro(ws, rel(anc.addr, 5, 1), `Volume de ${anc.codigo}`);
    const tipo = lerTexto(ws, rel(anc.addr, 4, 3), `Tipo de ${anc.codigo}`);
    if (tipo.severidade === "erro") tipo.severidade = "aviso";

    return {
      codigo,
      semana,
      periodoInicio,
      periodoFim,
      tipo,
      estrutura,
      duracaoPlanejadaSec,
      volumePlanejadoM,
    };
  });
}

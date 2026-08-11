/**
 * A declaração dos tipos de registro — um lugar só.
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO EXISTE
 *
 * Antes, um tipo de registro estava espalhado por oito lugares: a copy da tela,
 * os `useState`, a validação, a chamada de escrita, o JSX dos campos, o resumo
 * da lista, os campos do detalhe e a montagem em `listarRegistros`. Somar um
 * tipo custava oito edições coordenadas, e faltar uma não quebrava o build —
 * quebrava a tela, mais tarde, para a mãe.
 *
 * São 6 tipos hoje e 20 na fila. Oito vezes catorze é a conta que este arquivo
 * existe para não pagar.
 *
 * ------------------------------------------------------------------
 * O QUE MORA AQUI, E O QUE NÃO
 *
 * Mora: o que o tipo É — vocabulário, campos, regras de preenchimento, onde
 * grava, o que a mãe lê. É tudo **puro**: nenhuma linha aqui fala com o
 * Supabase, e por isso o teste roda no Node sem banco.
 *
 * Não mora: a escrita em si (`registros.ts`), a renderização (`app/registro`) e
 * qualquer regra que dependa de estado do banco — o "só um sono por vez", por
 * exemplo, precisa consultar, então fica do lado que consulta.
 *
 * ------------------------------------------------------------------
 * UM VOCABULÁRIO, DOIS RÓTULOS
 *
 * `left` é "Esquerdo" no chip e "Peito esquerdo" no resumo. Antes eram duas
 * listas em dois arquivos, e a primeira correção que só uma recebesse já as
 * separava. Aqui é uma opção com dois campos: `label` para tocar, `noResumo`
 * para ler. Divergir passa a exigir editar a mesma linha duas vezes.
 */

import type { Humor, Intensidade, LadoSeio, TipoLeite } from '../types/database';
import { formatarDuracaoMin, formatarMomento, minutosEntre } from './horario.ts';

/** Os atalhos da Home. Vale também como parâmetro da rota /registro/[tipo]. */
export type TipoRegistro = 'amamentar' | 'mamadeira' | 'fralda' | 'sono' | 'humor' | 'sintoma';

export const TIPOS_REGISTRO: TipoRegistro[] = [
  'amamentar',
  'mamadeira',
  'fralda',
  'sono',
  'humor',
  'sintoma',
];

export function ehTipoRegistro(valor: string | undefined): valor is TipoRegistro {
  return TIPOS_REGISTRO.includes(valor as TipoRegistro);
}

// ============================================================
// VOCABULÁRIO FECHADO
// A mãe toca rótulo em PT-BR; o banco recebe slug. Manter fechado é o que deixa
// o dado agregável para o motor de personalização.
// ============================================================

export type OpcaoCampo = {
  value: string;
  /** O que a mãe toca. */
  label: string;
  /** Como o valor aparece no resumo e no detalhe, quando difere do chip. */
  noResumo?: string;
};

export const LADOS: OpcaoCampo[] = [
  { value: 'left', label: 'Esquerdo', noResumo: 'Peito esquerdo' },
  { value: 'right', label: 'Direito', noResumo: 'Peito direito' },
  { value: 'both', label: 'Os dois', noResumo: 'Os dois peitos' },
];

export const LEITES: OpcaoCampo[] = [
  { value: 'breast_milk', label: 'Leite materno', noResumo: 'leite materno' },
  { value: 'formula', label: 'Fórmula', noResumo: 'fórmula' },
];

export const CONTEUDOS_FRALDA: OpcaoCampo[] = [
  { value: 'pee', label: 'Xixi' },
  { value: 'poop', label: 'Cocô' },
  { value: 'both', label: 'Os dois', noResumo: 'Xixi e cocô' },
];

/**
 * Rótulos de humor são SUBSTANTIVOS, nunca adjetivos: `sex` é nullable e o app
 * não sabe o gênero do bebê. "Agitação", nunca "agitado(a)".
 */
export const HUMORES: OpcaoCampo[] = [
  { value: 'happy', label: 'Alegria' },
  { value: 'calm', label: 'Tranquilidade' },
  { value: 'crying', label: 'Choro' },
  { value: 'sleepy', label: 'Com sono' },
  { value: 'agitated', label: 'Agitação' },
  { value: 'irritated', label: 'Incômodo' },
];

/**
 * Motivo provável do humor. 'unknown' ("Não sei") é resposta de primeira classe:
 * a mãe não precisa ter explicação para o que o bebê sente.
 */
export const MOTIVOS_HUMOR: OpcaoCampo[] = [
  { value: 'hunger', label: 'Fome' },
  { value: 'sleep', label: 'Sono' },
  { value: 'diaper', label: 'Fralda' },
  { value: 'colic', label: 'Cólica' },
  { value: 'holding', label: 'Colo' },
  { value: 'unknown', label: 'Não sei', noResumo: 'não identificado' },
];

/**
 * A coluna `symptom` não tem check no banco, mas o app trata como se tivesse:
 * texto livre nunca entra aqui. 'other' guarda a descrição da mãe em `notes`.
 */
export const SINTOMAS: OpcaoCampo[] = [
  { value: 'fever', label: 'Febre' },
  { value: 'runny_nose', label: 'Coriza' },
  { value: 'cough', label: 'Tosse' },
  { value: 'vomit', label: 'Vômito' },
  { value: 'diarrhea', label: 'Diarreia' },
  { value: 'colic', label: 'Cólica' },
  { value: 'rash', label: 'Manchas na pele' },
  { value: 'other', label: 'Outro' },
];

/**
 * Fora dos chips, mas ainda com rótulo: 'irritability' saiu da lista porque
 * colide com o humor 'irritated' ("Incômodo") — irritação é humor, não sintoma.
 * O banco não foi tocado, então registro antigo continua legível na lista.
 */
export const SINTOMAS_APOSENTADOS: OpcaoCampo[] = [
  { value: 'irritability', label: 'Irritação' },
];

export const INTENSIDADES: OpcaoCampo[] = [
  { value: 'mild', label: 'Leve' },
  { value: 'moderate', label: 'Moderada' },
  { value: 'high', label: 'Forte' },
];

/** Único valor de `symptom` que aceita descrição da mãe — e ela vai em `notes`. */
export const SINTOMA_OUTRO = 'other';

// ============================================================
// OS CAMPOS
// ============================================================

type CampoBase = {
  /** Nome no estado da tela, e chave nos valores que a validação recebe. */
  chave: string;
  /** Coluna do banco. `null` quando o valor não vai direto para uma coluna. */
  coluna: string | null;
  rotulo: string;
  obrigatorio: boolean;
  /** A frase exata que a mãe lê quando o campo falta. */
  erroFalta?: string;
  /**
   * Muda o campo conforme OUTRO campo. Hoje só o sintoma "Outro" usa: sem
   * descrição, um registro 'other' não diz nada nem para a mãe nem para o motor.
   */
  quando?: {
    chave: string;
    valor: string;
    vira: Partial<Pick<CampoBase, 'rotulo' | 'obrigatorio' | 'erroFalta'>> & {
      placeholder?: string;
    };
  };
};

export type CampoSchema =
  | (CampoBase & { entrada: 'hora' })
  | (CampoBase & { entrada: 'escolha'; opcoes: OpcaoCampo[] })
  | (CampoBase & {
      entrada: 'numero';
      min: number;
      max: number;
      /** Multiplicador até a unidade da coluna: minutos → segundos usa 60. */
      escala: number;
      digitos: number;
      placeholder: string;
      erroFaixa: string;
    })
  | (CampoBase & { entrada: 'texto'; max: number; placeholder: string; linhas: boolean });

export type SchemaRegistro = {
  tipo: TipoRegistro;
  titulo: string;
  subtitulo: string;
  acao: string;
  /** Tabela e coluna de tempo. Amamentar e mamadeira dividem a tabela. */
  tabela: string;
  colunaTempo: 'started_at' | 'recorded_at';
  /** Colunas com valor fixo — é o que separa peito de mamadeira na mesma tabela. */
  fixas?: Record<string, string>;
  /**
   * `true` quando o registro fica correndo até a mãe encerrar. Quem cuida disso
   * é `registros.ts`: a regra de "só um por vez" precisa consultar o banco.
   */
  emAberto?: boolean;
  campos: CampoSchema[];
};

const HORA = (rotulo: string): CampoSchema => ({
  entrada: 'hora',
  chave: 'hora',
  // O valor não vai direto: vira o instante ISO da coluna de tempo do schema.
  coluna: null,
  rotulo,
  obrigatorio: true,
  erroFalta: 'Coloca no formato HH:MM, ex.: 14:20.',
});

const OBSERVACAO: CampoSchema = {
  entrada: 'texto',
  chave: 'observacao',
  coluna: 'notes',
  rotulo: 'Observação (opcional)',
  placeholder: 'Algo que você queira lembrar depois',
  max: 280,
  linhas: true,
  obrigatorio: false,
};

export const MAX_DURACAO_MIN = 180;

export const SCHEMAS: Record<TipoRegistro, SchemaRegistro> = {
  amamentar: {
    tipo: 'amamentar',
    titulo: 'Amamentação',
    subtitulo: 'Anota rapidinho — dá pra ajustar depois.',
    acao: 'Salvar mamada',
    tabela: 'feeding_records',
    colunaTempo: 'started_at',
    fixas: { type: 'breast' },
    campos: [
      HORA('Começou às'),
      {
        entrada: 'escolha',
        chave: 'lado',
        coluna: 'side',
        rotulo: 'Lado',
        opcoes: LADOS,
        obrigatorio: true,
        erroFalta: 'De qual lado foi?',
      },
      {
        entrada: 'numero',
        chave: 'duracao',
        coluna: 'duration_seconds',
        rotulo: 'Duração em minutos (opcional)',
        placeholder: 'ex.: 12',
        min: 1,
        max: MAX_DURACAO_MIN,
        escala: 60,
        digitos: 3,
        obrigatorio: false,
        erroFaixa: `Duração em minutos, de 1 a ${MAX_DURACAO_MIN}.`,
      },
      OBSERVACAO,
    ],
  },

  mamadeira: {
    tipo: 'mamadeira',
    titulo: 'Mamadeira',
    subtitulo: 'Anota rapidinho — dá pra ajustar depois.',
    acao: 'Salvar mamadeira',
    tabela: 'feeding_records',
    colunaTempo: 'started_at',
    fixas: { type: 'bottle' },
    campos: [
      HORA('Começou às'),
      {
        entrada: 'numero',
        chave: 'quantidade',
        coluna: 'amount_ml',
        rotulo: 'Quantidade (ml)',
        placeholder: 'ex.: 90',
        min: 5,
        max: 500,
        escala: 1,
        digitos: 3,
        obrigatorio: true,
        erroFalta: 'Quantidade em ml, ex.: 90.',
        erroFaixa: 'Quantidade em ml, ex.: 90.',
      },
      {
        entrada: 'escolha',
        chave: 'leite',
        coluna: 'bottle_type',
        rotulo: 'O que tinha na mamadeira',
        opcoes: LEITES,
        obrigatorio: true,
        erroFalta: 'Era leite materno ou fórmula?',
      },
      OBSERVACAO,
    ],
  },

  fralda: {
    tipo: 'fralda',
    titulo: 'Troca de fralda',
    subtitulo: 'Um toque e já volto pra Home.',
    acao: 'Salvar troca',
    tabela: 'diaper_records',
    colunaTempo: 'recorded_at',
    campos: [
      HORA('Horário da troca'),
      {
        entrada: 'escolha',
        chave: 'conteudo',
        coluna: 'content',
        rotulo: 'O que tinha na fralda',
        opcoes: CONTEUDOS_FRALDA,
        obrigatorio: true,
        erroFalta: 'O que tinha na fralda?',
      },
      OBSERVACAO,
    ],
  },

  sono: {
    tipo: 'sono',
    titulo: 'Sono',
    subtitulo:
      'Deixo o sono correndo a partir desse horário — você encerra na Home quando acabar.',
    acao: 'Começar sono',
    tabela: 'sleep_records',
    colunaTempo: 'started_at',
    emAberto: true,
    // Sem observação: `sleep_records` é a única tabela de registro sem `notes`.
    campos: [HORA('Começou às')],
  },

  humor: {
    tipo: 'humor',
    titulo: 'Humor',
    subtitulo: 'O estado do momento. Não saber o motivo também é uma resposta.',
    acao: 'Salvar humor',
    tabela: 'mood_records',
    colunaTempo: 'recorded_at',
    campos: [
      HORA('Horário'),
      {
        entrada: 'escolha',
        chave: 'humor',
        coluna: 'mood',
        rotulo: 'Estado',
        opcoes: HUMORES,
        obrigatorio: true,
        erroFalta: 'Qual estado você percebeu?',
      },
      {
        entrada: 'escolha',
        chave: 'motivo',
        coluna: 'probable_reason',
        rotulo: 'O que pode ter causado (opcional)',
        opcoes: MOTIVOS_HUMOR,
        obrigatorio: false,
      },
      OBSERVACAO,
    ],
  },

  sintoma: {
    tipo: 'sintoma',
    titulo: 'Sintoma',
    subtitulo: 'Anotar ajuda a enxergar o padrão depois — aqui não é diagnóstico.',
    acao: 'Salvar sintoma',
    tabela: 'symptom_records',
    colunaTempo: 'recorded_at',
    campos: [
      HORA('Horário'),
      {
        entrada: 'escolha',
        chave: 'sintoma',
        coluna: 'symptom',
        rotulo: 'O que você notou',
        opcoes: SINTOMAS,
        obrigatorio: true,
        erroFalta: 'O que você notou?',
      },
      {
        entrada: 'escolha',
        chave: 'intensidade',
        coluna: 'intensity',
        rotulo: 'Intensidade (opcional)',
        opcoes: INTENSIDADES,
        obrigatorio: false,
      },
      {
        ...OBSERVACAO,
        // Em "Outro" este campo deixa de ser observação e passa a ser o registro:
        // sem ele, a linha não diz nada nem para a mãe nem para o motor.
        quando: {
          chave: 'sintoma',
          valor: SINTOMA_OUTRO,
          vira: {
            rotulo: 'O que você notou?',
            placeholder: 'Descreve com suas palavras',
            obrigatorio: true,
            erroFalta: 'Me conta em poucas palavras o que você notou.',
          },
        },
      },
    ],
  },
};

// ============================================================
// O CAMPO, JÁ RESOLVIDO PELO ESTADO ATUAL
// ============================================================

/** O que a tela guarda: tudo string, porque tudo vem de campo de texto ou chip. */
export type ValoresRegistro = Record<string, string | null>;

/**
 * Aplica o `quando` e devolve o campo como ele está AGORA.
 *
 * A tela e a validação chamam a mesma função — se divergissem, a mãe veria um
 * campo "opcional" reprovando por obrigatório.
 */
export function resolverCampo(campo: CampoSchema, valores: ValoresRegistro): CampoSchema {
  if (!campo.quando) return campo;
  if (valores[campo.quando.chave] !== campo.quando.valor) return campo;
  return { ...campo, ...campo.quando.vira } as CampoSchema;
}

// ============================================================
// VALIDAÇÃO — pura, e é a mesma que a tela usa
// ============================================================

export type ErrosRegistro = Record<string, string>;

/**
 * As frases de erro saem do schema, não daqui: o que esta função decide é
 * QUANDO reprovar, nunca o que dizer. Copy mora junto do campo.
 *
 * `horaValida` entra por parâmetro porque a conversão de "HH:MM" para instante é
 * do `horario.ts`, e este módulo não importa nada além de tipos — assim ele
 * continua rodando em qualquer runtime.
 */
export function validarRegistro(
  tipo: TipoRegistro,
  valores: ValoresRegistro,
  horaValida: (texto: string) => boolean
): ErrosRegistro {
  const erros: ErrosRegistro = {};

  for (const bruto of SCHEMAS[tipo].campos) {
    const campo = resolverCampo(bruto, valores);
    const valor = (valores[campo.chave] ?? '').trim();

    if (campo.entrada === 'hora') {
      if (!horaValida(valor) && campo.erroFalta) erros[campo.chave] = campo.erroFalta;
      continue;
    }

    if (!valor) {
      if (campo.obrigatorio && campo.erroFalta) erros[campo.chave] = campo.erroFalta;
      continue;
    }

    if (campo.entrada === 'numero') {
      const numero = Number(valor);
      if (!Number.isFinite(numero) || numero < campo.min || numero > campo.max) {
        erros[campo.chave] = campo.erroFaixa;
      }
    }

    if (campo.entrada === 'escolha') {
      // Valor fora do vocabulário não chega pela tela — chega por URL montada à
      // mão. Recusar aqui é o que mantém a coluna agregável.
      if (!campo.opcoes.some((o) => o.value === valor) && campo.erroFalta) {
        erros[campo.chave] = campo.erroFalta;
      }
    }
  }

  return erros;
}

// ============================================================
// O QUE VAI PARA O BANCO
// ============================================================

/**
 * Monta a linha a partir dos valores da tela.
 *
 * Assume validação já feita — é a mesma ordem da tela, e duplicar a checagem
 * aqui só criaria um segundo lugar para as regras discordarem.
 *
 * Campo vazio vira `null` e não string vazia: o motor conta `null` como "não
 * informado", e `''` como um valor que ele não sabe ler.
 */
export function linhaParaBanco(
  tipo: TipoRegistro,
  valores: ValoresRegistro,
  ocorridoEm: string
): Record<string, unknown> {
  const schema = SCHEMAS[tipo];
  const linha: Record<string, unknown> = {
    ...(schema.fixas ?? {}),
    [schema.colunaTempo]: ocorridoEm,
  };

  for (const bruto of schema.campos) {
    const campo = resolverCampo(bruto, valores);
    if (!campo.coluna) continue;

    const valor = (valores[campo.chave] ?? '').trim();
    if (!valor) {
      linha[campo.coluna] = null;
      continue;
    }

    linha[campo.coluna] = campo.entrada === 'numero' ? Number(valor) * campo.escala : valor;
  }

  return linha;
}

// ============================================================
// RÓTULOS PARA LEITURA
// ============================================================

/**
 * Slug → o que a mãe lê. `noResumo` ganha do `label` quando existe.
 *
 * Valor fora da lista não some da tela: cai no próprio slug. Registro antigo
 * continua legível mesmo depois de um vocabulário mudar — é a mesma razão dos
 * `SINTOMAS_APOSENTADOS`.
 */
export function rotularValor(opcoes: OpcaoCampo[], valor: string | null): string | null {
  if (!valor) return null;
  const opcao = opcoes.find((o) => o.value === valor);
  if (!opcao) return valor;
  return opcao.noResumo ?? opcao.label;
}

/** Tipos que compartilham tabela precisam da coluna fixa para se distinguir. */
export function tipoDaLinha(tabela: string, linha: Record<string, unknown>): TipoRegistro | null {
  const candidatos = TIPOS_REGISTRO.filter((t) => SCHEMAS[t].tabela === tabela);
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];

  return (
    candidatos.find((t) =>
      Object.entries(SCHEMAS[t].fixas ?? {}).every(([coluna, valor]) => linha[coluna] === valor)
    ) ?? null
  );
}

/** Ajuda os tipos: `LadoSeio` etc. continuam existindo, e o schema não os perde. */
export type ValorLado = LadoSeio;
export type ValorLeite = TipoLeite;
export type ValorHumor = Humor;
export type ValorIntensidade = Intensidade;

// ============================================================
// LEITURA — como o tipo se conta para a mãe
// ============================================================

/**
 * O resumo e o detalhe também moram no schema, e são FUNÇÃO por tipo, não
 * template declarativo.
 *
 * A tentação era descrever "resumo = campo A · campo B" numa mini-linguagem.
 * Não descreve: mamadeira junta com " de ", sono não lê coluna nenhuma e sim
 * calcula duração, e sintoma "Outro" troca o rótulo pelo texto que a mãe
 * escreveu. Uma linguagem que cobrisse os seis seria mais difícil de aprender do
 * que os seis, e cada tipo novo tentaria caber nela em vez de dizer a verdade.
 *
 * O que o bloco 2 promete não é "sem função por tipo" — é **um lugar por tipo**.
 * Aqui o tipo inteiro cabe numa entrada: o que ele pergunta, onde grava, e como
 * se conta.
 */

/** A linha crua do banco. Cada schema sabe ler as próprias colunas. */
export type LinhaRegistro = Record<string, unknown>;

/** Uma linha do registro aberto: "Lado" / "Peito esquerdo". */
export type CampoDetalhe = { rotulo: string; valor: string };

const texto = (linha: LinhaRegistro, coluna: string): string | null => {
  const valor = linha[coluna];
  return typeof valor === 'string' && valor.trim() ? valor : null;
};

const numero = (linha: LinhaRegistro, coluna: string): number | null => {
  const valor = linha[coluna];
  return typeof valor === 'number' ? valor : null;
};

/** Descarta o que não tem valor: campo vazio não vira linha em branco na tela. */
const listar = (pares: [string, string | null][]): CampoDetalhe[] =>
  pares
    .filter(([, valor]) => Boolean(valor))
    .map(([rotulo, valor]) => ({ rotulo, valor: valor as string }));

/**
 * Texto do sono ainda aberto. A Home recalcula isso num tick local, então é aqui
 * que mora a regra — abaixo de 2 minutos não vale falar em duração, o sono mal
 * começou.
 */
export function resumirSonoEmAndamento(startedAt: string, agora: Date = new Date()): string {
  const minutos = minutosEntre(startedAt, agora);
  if (minutos < 2) return 'Dormindo agora';
  return `Dormindo há ${formatarDuracaoMin(minutos)}`;
}

const minutosDe = (segundos: number | null) =>
  segundos ? formatarDuracaoMin(Math.round(segundos / 60)) : null;

/** Em "Outro" a descrição da mãe está em `notes` — é ela que diz alguma coisa. */
function nomeDoSintoma(linha: LinhaRegistro): string {
  const bruto = texto(linha, 'symptom');
  const nota = texto(linha, 'notes');
  if (bruto === SINTOMA_OUTRO && nota) return nota.trim();
  return rotularValor([...SINTOMAS, ...SINTOMAS_APOSENTADOS], bruto) ?? bruto ?? '';
}

type LeituraDoTipo = {
  /** Frase curta da lista, ex.: "Peito esquerdo · 12 min". */
  resumir: (linha: LinhaRegistro, agora: Date) => string;
  /** As linhas da tela de detalhe, já rotuladas em PT-BR. */
  detalhar: (linha: LinhaRegistro, agora: Date) => CampoDetalhe[];
  /** Só o sono sem `ended_at` — a Home oferece encerrar. */
  emAndamento?: (linha: LinhaRegistro) => boolean;
};

export const LEITURA: Record<TipoRegistro, LeituraDoTipo> = {
  amamentar: {
    resumir: (l) => {
      const lado = rotularValor(LADOS, texto(l, 'side')) ?? 'Peito';
      const duracao = minutosDe(numero(l, 'duration_seconds'));
      return duracao ? `${lado} · ${duracao}` : lado;
    },
    detalhar: (l, agora) =>
      listar([
        ['Lado', rotularValor(LADOS, texto(l, 'side'))],
        ['Duração', minutosDe(numero(l, 'duration_seconds'))],
        ['Início', formatarMomento(texto(l, 'started_at') ?? '', agora)],
      ]),
  },

  mamadeira: {
    resumir: (l) => {
      const leite = rotularValor(LEITES, texto(l, 'bottle_type'));
      const sufixo = leite ? ` de ${leite}` : '';
      const ml = numero(l, 'amount_ml');
      return ml ? `${ml} ml${sufixo}` : `Mamadeira${sufixo}`;
    },
    detalhar: (l, agora) => {
      const ml = numero(l, 'amount_ml');
      return listar([
        ['Quantidade', ml ? `${ml} ml` : null],
        ['Tipo de leite', rotularValor(LEITES, texto(l, 'bottle_type'))],
        ['Início', formatarMomento(texto(l, 'started_at') ?? '', agora)],
      ]);
    },
  },

  fralda: {
    resumir: (l) => rotularValor(CONTEUDOS_FRALDA, texto(l, 'content')) ?? '',
    detalhar: (l, agora) =>
      listar([
        ['Conteúdo', rotularValor(CONTEUDOS_FRALDA, texto(l, 'content'))],
        ['Quando', formatarMomento(texto(l, 'recorded_at') ?? '', agora)],
      ]),
  },

  sono: {
    resumir: (l, agora) => {
      const inicio = texto(l, 'started_at') ?? '';
      const fim = texto(l, 'ended_at');
      if (!fim) return resumirSonoEmAndamento(inicio, agora);
      return `${formatarDuracaoMin(minutosEntre(inicio, fim))} de sono`;
    },
    detalhar: (l, agora) => {
      const inicio = texto(l, 'started_at') ?? '';
      const fim = texto(l, 'ended_at');
      return listar([
        ['Começou', formatarMomento(inicio, agora)],
        ['Terminou', fim ? formatarMomento(fim, agora) : 'ainda dormindo'],
        [fim ? 'Duração' : 'Até agora', formatarDuracaoMin(minutosEntre(inicio, fim ?? agora))],
      ]);
    },
    emAndamento: (l) => texto(l, 'ended_at') === null,
  },

  humor: {
    resumir: (l) => {
      const bruto = texto(l, 'mood');
      const humor = rotularValor(HUMORES, bruto) ?? bruto ?? '';
      const motivo = rotularValor(MOTIVOS_HUMOR, texto(l, 'probable_reason'));
      if (!motivo) return humor;
      // 'unknown' vira "motivo não identificado", não "por Não sei".
      if (texto(l, 'probable_reason') === 'unknown') return `${humor} · motivo não identificado`;
      return `${humor} · ${motivo.toLowerCase()}`;
    },
    detalhar: (l, agora) => {
      const bruto = texto(l, 'mood');
      return listar([
        ['Estado', rotularValor(HUMORES, bruto) ?? bruto],
        ['Motivo provável', rotularValor(MOTIVOS_HUMOR, texto(l, 'probable_reason'))],
        ['Quando', formatarMomento(texto(l, 'recorded_at') ?? '', agora)],
      ]);
    },
  },

  sintoma: {
    resumir: (l) => {
      const nome = nomeDoSintoma(l);
      const intensidade = rotularValor(INTENSIDADES, texto(l, 'intensity'));
      return intensidade ? `${nome} · ${intensidade.toLowerCase()}` : nome;
    },
    detalhar: (l, agora) => {
      const bruto = texto(l, 'symptom');
      return listar([
        // No detalhe o rótulo é o do vocabulário, mesmo em "Outro": a descrição
        // que a mãe escreveu aparece inteira logo abaixo, no campo de observação.
        ['Sintoma', rotularValor([...SINTOMAS, ...SINTOMAS_APOSENTADOS], bruto) ?? bruto],
        ['Intensidade', rotularValor(INTENSIDADES, texto(l, 'intensity'))],
        ['Quando', formatarMomento(texto(l, 'recorded_at') ?? '', agora)],
      ]);
    },
  },
};

/** As tabelas distintas. A lista é consultada por TABELA, não por tipo. */
export const TABELAS_DE_REGISTRO: string[] = [
  ...new Set(TIPOS_REGISTRO.map((tipo) => SCHEMAS[tipo].tabela)),
];

/** Os tipos que gravam nesta tabela — dois, no caso de `feeding_records`. */
export function tiposDaTabela(tabela: string): TipoRegistro[] {
  return TIPOS_REGISTRO.filter((tipo) => SCHEMAS[tipo].tabela === tabela);
}

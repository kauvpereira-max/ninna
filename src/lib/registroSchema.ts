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
 * Mora: o que o tipo É — vocabulário, campos, regras de preenchimento, o que a
 * mãe lê. É tudo **puro**: nenhuma linha aqui fala com o Supabase, e por isso o
 * teste roda no Node sem banco.
 *
 * O que SAIU daqui no bloco 3: `tabela` e `colunaTempo`. Não existe mais tabela
 * por tipo — existe `registros`, e o tipo é uma coluna dela. `fixas` saiu junto:
 * ela existia só para separar amamentação de mamadeira dentro de
 * `feeding_records`, e agora `tipo` faz isso sozinho.
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

/** Os tipos de registro. `TipoRegistro` é também o parâmetro da rota /registro/[tipo]. */
export type TipoRegistro =
  | 'amamentar'
  | 'mamadeira'
  | 'fralda'
  | 'sono'
  | 'humor'
  | 'sintoma'
  | 'banho'
  | 'passeio'
  | 'leitura'
  | 'atividade';

export const TIPOS_REGISTRO: TipoRegistro[] = [
  'amamentar',
  'mamadeira',
  'fralda',
  'sono',
  'humor',
  'sintoma',
  'banho',
  'passeio',
  'leitura',
  'atividade',
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

/**
 * O que a Atividade foi. Vocabulário fechado, e não texto livre, pela mesma
 * razão de sempre: dado agregável é requisito do motor. "Atividade" sozinha, sem
 * dizer qual, é uma linha que não responde nada depois.
 *
 * A lista é curta de propósito — são as que uma mãe de bebê pequeno reconhece
 * sem pensar. `other` existe porque a alternativa é ela escolher a opção errada
 * para conseguir salvar, e aí o dado agregável vira dado agregado errado.
 *
 * Diferente do sintoma "Outro", aqui a descrição NÃO é obrigatória: no sintoma
 * ela é o registro inteiro; aqui o registro já diz que houve atividade e quanto
 * durou.
 */
export const ATIVIDADES: OpcaoCampo[] = [
  { value: 'tummy_time', label: 'Tempo de bruços' },
  { value: 'sunbath', label: 'Banho de sol' },
  { value: 'play', label: 'Brincadeira' },
  { value: 'music', label: 'Música' },
  { value: 'massage', label: 'Massagem' },
  { value: 'other', label: 'Outra' },
];

/** Único valor de `symptom` que aceita descrição da mãe — e ela vai em `notes`. */
export const SINTOMA_OUTRO = 'other';

// ============================================================
// OS CAMPOS
// ============================================================

/**
 * Os `coluna` que são coluna DE VERDADE em `registros`. Todo o resto vira chave
 * dentro do `dados`.
 *
 * `notes` fica de fora do jsonb porque é texto livre: não tem vocabulário para
 * checar, é consultado por presença, e sai mais barato como coluna. É a mesma
 * lista que `gerar-registros-sql.ts` usa para decidir o que vira `check` — ela
 * mora aqui para os dois lados não divergirem.
 */
export const COLUNAS_REAIS = new Set(['notes']);

type CampoBase = {
  /** Nome no estado da tela, e chave nos valores que a validação recebe. */
  chave: string;
  /**
   * Onde o valor mora na linha do banco: chave dentro de `dados`, ou coluna de
   * verdade quando está em `COLUNAS_REAIS`. `null` quando não vai para a linha.
   */
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
      /**
       * Casas decimais que a mãe pode digitar. Ausente ou 0 = inteiro puro.
       *
       * ------------------------------------------------------------------
       * POR QUE ISTO EXISTE — o crescimento, e só ele
       *
       * Peso é 4,350 kg. Altura é 52,5 cm. Perímetro cefálico é 38,2 cm. Até o
       * bloco 3 nenhum campo tinha casa decimal, e a máscara da tela fazia
       * `texto.replace(/\D/g, '')` — todo caractere não dígito descartado,
       * inclusive a vírgula. Estava certo: minutos e ml são inteiros.
       *
       * A alternativa era perguntar em grama e milímetro, o que custa zero de
       * código e produz "Altura em milímetros: 525" — copy que nenhuma mãe
       * escreve e que ela teria que converter de cabeça, com o bebê no colo.
       *
       * O BANCO CONTINUA INTEIRO. `escala` já fazia essa conversão para o sono
       * (minutos → segundos); aqui ela faz cm → mm. "52,5" com `escala: 10`
       * chega como `525`, que é o que a coluna gerada indexa, soma e checa. O
       * decimal existe na tela e some antes do banco.
       */
      decimais?: number;
    })
  | (CampoBase & { entrada: 'texto'; max: number; placeholder: string; linhas: boolean });

export type SchemaRegistro = {
  tipo: TipoRegistro;
  titulo: string;
  subtitulo: string;
  acao: string;
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

/**
 * O campo de duração, compartilhado entre os tipos que têm começo e fim.
 *
 * ⚠️ A FAIXA É A MESMA PARA TODOS, E ISSO NÃO É PREGUIÇA. `duration_seconds` é
 * uma coluna GERADA e compartilhada: dois tipos que declararem esta chave usam a
 * mesma coluna, e uma coluna tem uma faixa só. Declarar `max: 60` para leitura e
 * `max: 180` para passeio faria o gerador parar com uma colisão — de propósito,
 * porque a alternativa é o banco recusar um passeio de 2h em silêncio.
 *
 * O dia em que um tipo precisar de faixa própria, a saída é chave própria
 * (`duracao_leitura_s`) ou faixa condicionada ao tipo. Não é reduzir esta.
 */
const DURACAO = (rotulo: string, placeholder: string): CampoSchema => ({
  entrada: 'numero',
  chave: 'duracao',
  coluna: 'duration_seconds',
  rotulo,
  placeholder,
  min: 1,
  max: MAX_DURACAO_MIN,
  escala: 60,
  digitos: 3,
  obrigatorio: false,
  erroFaixa: `Duração em minutos, de 1 a ${MAX_DURACAO_MIN}.`,
});

export const SCHEMAS: Record<TipoRegistro, SchemaRegistro> = {
  amamentar: {
    tipo: 'amamentar',
    titulo: 'Amamentação',
    subtitulo: 'Anota rapidinho — dá pra ajustar depois.',
    acao: 'Salvar mamada',
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
      DURACAO('Duração em minutos (opcional)', 'ex.: 12'),
      OBSERVACAO,
    ],
  },

  mamadeira: {
    tipo: 'mamadeira',
    titulo: 'Mamadeira',
    subtitulo: 'Anota rapidinho — dá pra ajustar depois.',
    acao: 'Salvar mamadeira',
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
    emAberto: true,
    // Sem observação: o sono é o único tipo sem campo de texto livre.
    campos: [HORA('Começou às')],
  },

  humor: {
    tipo: 'humor',
    titulo: 'Humor',
    subtitulo: 'O estado do momento. Não saber o motivo também é uma resposta.',
    acao: 'Salvar humor',
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

  // ============================================================
  // OS EVENTOS SIMPLES — bloco 3, primeira leva
  //
  // Os quatro cabem inteiros nos campos que já existiam: hora, escolha, número e
  // texto. Nenhum deles pediu tela nova, motor novo, nem campo de tipo novo — é
  // por isso que vieram primeiro, e é a primeira vez que "somar um tipo é somar
  // uma entrada aqui" é dito e cobrado ao mesmo tempo.
  //
  // DURAÇÃO INFORMADA, NÃO REGISTRO EM ANDAMENTO. Passeio e Atividade poderiam
  // nascer abertos, como o sono, e a mãe encerrar depois. Decidido que não:
  // registro aberto e esquecido é o pior modo de falha que este app tem — ela
  // não sabe que deixou algo correndo, e o número fica errado sem ninguém notar.
  // O caminho contrário, promover depois, é reversível; o de nascer aberto e
  // simplificar deixa linha órfã no banco.
  // ============================================================

  banho: {
    tipo: 'banho',
    titulo: 'Banho',
    subtitulo: 'Um toque e já volto pra Home.',
    acao: 'Salvar banho',
    // Sem duração: ninguém abre cronômetro para dar banho. É um momento, e o que
    // se quer dele é a hora.
    campos: [HORA('Horário do banho'), OBSERVACAO],
  },

  passeio: {
    tipo: 'passeio',
    titulo: 'Passeio',
    subtitulo: 'Anota rapidinho — dá pra ajustar depois.',
    acao: 'Salvar passeio',
    campos: [
      HORA('Começou às'),
      DURACAO('Duração em minutos (opcional)', 'ex.: 40'),
      OBSERVACAO,
    ],
  },

  leitura: {
    tipo: 'leitura',
    titulo: 'Leitura',
    subtitulo: 'O que vocês leram juntas hoje.',
    acao: 'Salvar leitura',
    campos: [
      HORA('Começou às'),
      DURACAO('Duração em minutos (opcional)', 'ex.: 15'),
      {
        ...OBSERVACAO,
        rotulo: 'O livro (opcional)',
        placeholder: 'O nome do livro, ou o que chamou atenção',
      },
    ],
  },

  atividade: {
    tipo: 'atividade',
    titulo: 'Atividade',
    subtitulo: 'O que vocês fizeram, e por quanto tempo.',
    acao: 'Salvar atividade',
    campos: [
      HORA('Começou às'),
      {
        entrada: 'escolha',
        chave: 'atividade',
        coluna: 'activity',
        rotulo: 'O que foi',
        opcoes: ATIVIDADES,
        obrigatorio: true,
        erroFalta: 'O que vocês fizeram?',
      },
      DURACAO('Duração em minutos (opcional)', 'ex.: 15'),
      OBSERVACAO,
    ],
  },
};

// ============================================================
// NÚMERO — a tradução entre o que a mãe digita e o que a coluna guarda
// ============================================================

/**
 * O separador decimal é a VÍRGULA, porque o app é PT-BR nativo.
 *
 * Na entrada o ponto também é aceito: teclado de iPhone em inglês oferece ponto,
 * e recusar o que ela acabou de digitar por causa disso seria atrito puro. Na
 * saída é sempre vírgula — é o que ela escreveria.
 */
const SEPARADOR = ',';

type CampoNumero = Extract<CampoSchema, { entrada: 'numero' }>;

/**
 * Texto da tela → número na unidade do CAMPO (minutos, cm, ml).
 *
 * `null` quando não dá para ler. Não lança: função de schema que joga exceção
 * vira tela vermelha às 3h da manhã.
 */
export function numeroDoCampo(texto: string, campo: CampoNumero): number | null {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '' || !/^\d+(\.\d+)?$/.test(limpo)) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Número na unidade do campo → inteiro na unidade da COLUNA.
 *
 * O `Math.round` não é zelo: `4,35 * 1000` em ponto flutuante dá
 * `4350.000000000001`, e isso chegaria ao `dados` como decimal. A coluna gerada
 * faz `(dados->>'chave')::int`, que recusa isso com erro de cast (22P02) — a
 * mensagem mais feia que este banco sabe produzir, num caminho que a mãe alcança
 * digitando um peso perfeitamente normal.
 *
 * Para os campos inteiros que já existiam nada muda: `12 * 60` é 720 com ou sem
 * arredondamento.
 */
export function paraAColuna(valorDoCampo: number, campo: CampoNumero): number {
  return Math.round(valorDoCampo * campo.escala);
}

/** Inteiro da coluna → texto da tela, com vírgula e as casas que o campo pede. */
export function textoDoCampo(valorDaColuna: number, campo: CampoNumero): string {
  const naUnidadeDoCampo = valorDaColuna / campo.escala;
  if (!campo.decimais) return String(Math.round(naUnidadeDoCampo));
  return naUnidadeDoCampo.toFixed(campo.decimais).replace('.', SEPARADOR);
}

/**
 * A máscara, enquanto ela digita.
 *
 * Mora aqui, e não na tela, pela mesma razão que a validação mora aqui: a tela e
 * a gravação precisam concordar sobre o que é um número válido. Máscara que
 * aceita o que a validação recusa é campo que reprova o que ele deixou escrever.
 *
 * Sem `decimais`, o comportamento é o de antes — só dígitos, cortado no limite.
 */
export function mascaraNumero(texto: string, campo: CampoNumero): string {
  if (!campo.decimais) return texto.replace(/\D/g, '').slice(0, campo.digitos);

  // Um separador só, e o primeiro que ela digitou é o que vale.
  const normalizado = texto.replace(/\./g, SEPARADOR).replace(/[^\d,]/g, '');
  const [inteiro, ...resto] = normalizado.split(SEPARADOR);
  const cortado = inteiro.slice(0, campo.digitos);

  if (resto.length === 0) return cortado;
  return `${cortado}${SEPARADOR}${resto.join('').slice(0, campo.decimais)}`;
}

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
      // `numeroDoCampo` e não `Number`: é ela que sabe ler a vírgula, e é a mesma
      // que a gravação usa. Duas leituras diferentes do mesmo texto aprovariam
      // aqui um valor que o `linhaParaBanco` não consegue montar.
      const numero = numeroDoCampo(valor, campo);
      if (numero === null || numero < campo.min || numero > campo.max) {
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
 * Monta a linha de `registros` a partir dos valores da tela.
 *
 * Assume validação já feita — é a mesma ordem da tela, e duplicar a checagem
 * aqui só criaria um segundo lugar para as regras discordarem.
 *
 * ------------------------------------------------------------------
 * VAZIO É AUSÊNCIA NO `dados`, E `null` NA COLUNA
 *
 * São dois destinos com regras diferentes, e a diferença não é estética:
 *
 * - coluna de verdade (`notes`) vazia vira `null`. O motor conta `null` como
 *   "não informado" e `''` como um valor que ele não sabe ler;
 * - chave do `dados` vazia simplesmente **não é escrita**. É o
 *   `jsonb_strip_nulls` do backfill, do lado do app — e precisa ser, porque
 *   chave ausente e chave com valor nulo são estados diferentes para o
 *   Postgres: `dados ? 'amount_ml'` passa numa chave presente e nula, e o
 *   vocabulário não. Escrever `null` no jsonb criaria uma segunda forma de
 *   dizer "não informado", divergente da que as 97 linhas migradas usam.
 */
export function linhaParaBanco(
  tipo: TipoRegistro,
  valores: ValoresRegistro,
  ocorridoEm: string
): Record<string, unknown> {
  const linha: Record<string, unknown> = { tipo, ocorrido_em: ocorridoEm };
  const dados: Record<string, unknown> = {};

  for (const bruto of SCHEMAS[tipo].campos) {
    const campo = resolverCampo(bruto, valores);
    if (!campo.coluna) continue;

    const ehColuna = COLUNAS_REAIS.has(campo.coluna);
    const valor = (valores[campo.chave] ?? '').trim();

    if (!valor) {
      if (ehColuna) linha[campo.coluna] = null;
      continue;
    }

    let pronto: string | number = valor;
    if (campo.entrada === 'numero') {
      const numero = numeroDoCampo(valor, campo);
      // Já validado pela tela. Não conseguindo ler, o campo NÃO é escrito — que
      // é o mesmo destino do campo vazio, e nunca um `NaN` dentro do jsonb.
      if (numero === null) continue;
      pronto = paraAColuna(numero, campo);
    }

    if (ehColuna) linha[campo.coluna] = pronto;
    else dados[campo.coluna] = pronto;
  }

  linha.dados = dados;
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

/**
 * O tipo de uma linha de `registros`, se for um que este app conhece.
 *
 * Antes isto era dedução — qual tabela, e qual coluna fixa dentro dela. Agora é
 * leitura de uma coluna, e o que sobra da função é a única parte que importava:
 * linha de um tipo que o app ainda não conhece (um dos 14 que faltam, aberto
 * numa versão antiga do PWA) devolve `null` em vez de derrubar a lista.
 */
export function tipoDaLinha(linha: LinhaRegistro): TipoRegistro | null {
  const tipo = linha.tipo;
  return typeof tipo === 'string' && ehTipoRegistro(tipo) ? tipo : null;
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
 * Aqui o tipo inteiro cabe numa entrada: o que ele pergunta, o que ele guarda, e
 * se conta.
 */

/** A linha crua de `registros`. Cada schema sabe ler os próprios campos. */
export type LinhaRegistro = Record<string, unknown>;

/** Uma linha do registro aberto: "Lado" / "Peito esquerdo". */
export type CampoDetalhe = { rotulo: string; valor: string };

/**
 * O valor de um campo na linha, esteja ele onde estiver.
 *
 * `dados` primeiro, coluna depois. É o que permite a LEITURA abaixo continuar
 * pedindo `side` sem saber que `side` deixou de ser coluna — e é também o que
 * mantém `notes`, `ocorrido_em` e `terminou_em` alcançáveis pelo mesmo caminho.
 *
 * A ordem importa por um detalhe do banco: `duration_seconds` e `amount_ml`
 * existem nos DOIS lugares, porque são colunas geradas a partir do próprio
 * `dados`. Elas valem o mesmo, e ler sempre pelo jsonb é uma regra a menos para
 * lembrar.
 */
function valorDoCampo(linha: LinhaRegistro, chave: string): unknown {
  const dados = linha.dados;
  if (dados && typeof dados === 'object' && chave in dados) {
    return (dados as Record<string, unknown>)[chave];
  }
  return linha[chave];
}

const texto = (linha: LinhaRegistro, chave: string): string | null => {
  const valor = valorDoCampo(linha, chave);
  return typeof valor === 'string' && valor.trim() ? valor : null;
};

const numero = (linha: LinhaRegistro, chave: string): number | null => {
  const valor = valorDoCampo(linha, chave);
  return typeof valor === 'number' ? valor : null;
};

/** Descarta o que não tem valor: campo vazio não vira linha em branco na tela. */
const listar = (pares: [string, string | null][]): CampoDetalhe[] =>
  pares
    .filter(([, valor]) => Boolean(valor))
    .map(([rotulo, valor]) => ({ rotulo, valor: valor as string }));

/**
 * Texto do sono ainda aberto. A Home recalcula isso num tick local de 30s, então
 * é aqui que mora a regra.
 *
 * ------------------------------------------------------------------
 * CONTA DESDE O PRIMEIRO MINUTO, E ISSO MUDOU EM 11/08/2026
 *
 * O limiar era de 2 minutos, com o argumento de que "abaixo de 2 minutos não vale
 * falar em duração, o sono mal começou". O argumento está certo — para o resumo de
 * um sono ENCERRADO, onde "1 min de sono" não informa nada. Só que ele nunca
 * valeu ali: o encerrado é formatado uma função abaixo, sem limiar.
 *
 * Aqui a pergunta é outra. O contador em andamento responde "faz quanto tempo que
 * ela dormiu?", e nessa pergunta o primeiro minuto importa tanto quanto o
 * décimo — é justamente o minuto em que a mãe está de pé esperando o bebê pegar
 * no sono, olhando a tela.
 *
 * Com o limiar de 2 minutos e o tick de 30s, existia uma janela de até 2min30s em
 * que a Home dizia "Dormindo agora" e parecia congelada. Tela travada na hora em
 * que ela está esperando é pior que um número pequeno.
 *
 * O `< 1` que ficou não é limiar, é aritmética: abaixo de um minuto não existe
 * minuto inteiro para mostrar, e `formatarDuracaoMin(0)` diria "menos de 1 min" —
 * mais palavras para dizer o que "Dormindo agora" já diz melhor.
 */
export function resumirSonoEmAndamento(startedAt: string, agora: Date = new Date()): string {
  const minutos = minutosEntre(startedAt, agora);
  if (minutos < 1) return 'Dormindo agora';
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
  /** Só o sono sem `terminou_em` — a Home oferece encerrar. */
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
        ['Início', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
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
        ['Início', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
  },

  fralda: {
    resumir: (l) => rotularValor(CONTEUDOS_FRALDA, texto(l, 'content')) ?? '',
    detalhar: (l, agora) =>
      listar([
        ['Conteúdo', rotularValor(CONTEUDOS_FRALDA, texto(l, 'content'))],
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]),
  },

  sono: {
    resumir: (l, agora) => {
      const inicio = texto(l, 'ocorrido_em') ?? '';
      const fim = texto(l, 'terminou_em');
      if (!fim) return resumirSonoEmAndamento(inicio, agora);
      return `${formatarDuracaoMin(minutosEntre(inicio, fim))} de sono`;
    },
    detalhar: (l, agora) => {
      const inicio = texto(l, 'ocorrido_em') ?? '';
      const fim = texto(l, 'terminou_em');
      return listar([
        ['Começou', formatarMomento(inicio, agora)],
        ['Terminou', fim ? formatarMomento(fim, agora) : 'ainda dormindo'],
        [fim ? 'Duração' : 'Até agora', formatarDuracaoMin(minutosEntre(inicio, fim ?? agora))],
      ]);
    },
    emAndamento: (l) => texto(l, 'terminou_em') === null,
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
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
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
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
  },

  // Os quatro do bloco 3. O resumo do sono virou a forma dos que têm duração —
  // "40 min de passeio" —, e não "Passeio · 40 min": o badge da lista já diz o
  // tipo, e repetir a palavra gasta a linha inteira dizendo o que já está visto.
  banho: {
    resumir: () => 'Banho',
    detalhar: (l, agora) =>
      listar([['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)]]),
  },

  passeio: {
    resumir: (l) => {
      const duracao = minutosDe(numero(l, 'duration_seconds'));
      return duracao ? `${duracao} de passeio` : 'Passeio';
    },
    detalhar: (l, agora) =>
      listar([
        ['Duração', minutosDe(numero(l, 'duration_seconds'))],
        ['Começou', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]),
  },

  leitura: {
    resumir: (l) => {
      const duracao = minutosDe(numero(l, 'duration_seconds'));
      return duracao ? `${duracao} de leitura` : 'Leitura';
    },
    detalhar: (l, agora) =>
      listar([
        ['Duração', minutosDe(numero(l, 'duration_seconds'))],
        ['Começou', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]),
  },

  atividade: {
    resumir: (l) => {
      const bruto = texto(l, 'activity');
      const nome = rotularValor(ATIVIDADES, bruto) ?? bruto ?? 'Atividade';
      const duracao = minutosDe(numero(l, 'duration_seconds'));
      return duracao ? `${nome} · ${duracao}` : nome;
    },
    detalhar: (l, agora) => {
      const bruto = texto(l, 'activity');
      return listar([
        ['Atividade', rotularValor(ATIVIDADES, bruto) ?? bruto],
        ['Duração', minutosDe(numero(l, 'duration_seconds'))],
        ['Começou', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
  },
};

/**
 * O caminho de volta: linha do banco → valores do formulário.
 *
 * É o inverso exato de `linhaParaBanco`, e "exato" aqui é a propriedade que a
 * edição depende: abrir um registro e salvar sem tocar em nada não pode mudar a
 * linha. O teste guarda esse ida-e-volta, porque é ele que separa "editar" de
 * "reescrever com o que o formulário achou que entendeu".
 *
 * Número volta dividido pela escala — `duration_seconds` 720 vira "12" no campo
 * de minutos. Campo ausente vira `null`, nunca "null" nem string vazia — e
 * ausente é o normal agora: `linhaParaBanco` não escreve chave vazia no `dados`.
 */
export function valoresDaLinha(
  tipo: TipoRegistro,
  linha: LinhaRegistro,
  hora: string
): ValoresRegistro {
  const valores: ValoresRegistro = { hora };

  for (const campo of SCHEMAS[tipo].campos) {
    if (!campo.coluna) continue;

    const valor = valorDoCampo(linha, campo.coluna);
    if (valor === null || valor === undefined) {
      valores[campo.chave] = null;
      continue;
    }

    valores[campo.chave] =
      campo.entrada === 'numero' ? textoDoCampo(Number(valor), campo) : String(valor);
  }

  return valores;
}

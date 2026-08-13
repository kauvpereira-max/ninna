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
  | 'atividade'
  | 'comida'
  | 'hidratacao'
  | 'extracao'
  | 'peso'
  | 'altura'
  | 'circunferencia'
  | 'medicacao'
  | 'vitamina'
  | 'vacina';

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
  'comida',
  'hidratacao',
  'extracao',
  'peso',
  'altura',
  'circunferencia',
  'medicacao',
  'vitamina',
  'vacina',
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
 * Quanto da comida foi. Não é avaliação — é quantidade.
 *
 * Os rótulos de resumo são VERBO, não adjetivo: "comeu metade" não tem gênero, e
 * o app não sabe o do bebê. E nenhum deles julga: "Nada" vira "não quis", que é
 * o que aconteceu, e não "recusou", que soa como falta.
 */
export const ACEITACAO: OpcaoCampo[] = [
  { value: 'all', label: 'Tudo', noResumo: 'Comeu tudo' },
  { value: 'half', label: 'Metade', noResumo: 'Comeu metade' },
  { value: 'little', label: 'Pouco', noResumo: 'Comeu pouco' },
  { value: 'none', label: 'Nada', noResumo: 'Não quis' },
];

/** O que tinha no copo. Fechado, como todo vocabulário que o motor vai somar. */
export const LIQUIDOS: OpcaoCampo[] = [
  { value: 'water', label: 'Água', noResumo: 'água' },
  { value: 'tea', label: 'Chá', noResumo: 'chá' },
  { value: 'juice', label: 'Suco', noResumo: 'suco' },
  { value: 'other', label: 'Outro' },
];

/**
 * A unidade da dose. Ela muda o SIGNIFICADO do número, e por isso é obrigatória.
 *
 * "2,5" sozinho não é dose de nada. E o app não sabe qual unidade cada remédio
 * usa — ele registra o que a mãe leu na receita, não valida contra a bula.
 */
export const UNIDADES_DOSE: OpcaoCampo[] = [
  { value: 'ml', label: 'ml' },
  { value: 'mg', label: 'mg' },
  { value: 'drops', label: 'gotas', noResumo: 'gotas' },
  { value: 'ui', label: 'UI' },
];

/**
 * Qual dose da vacina foi. Fechado, e curto.
 *
 * ⚠️ Registrar qual dose foi tomada é REGISTRO. Dizer qual vem a seguir é
 * orientação de saúde, e a Ninna não faz — ver `PRODUTO.md` §3.4. Não existe
 * calendário aqui, e a ausência dele é o desenho.
 */
export const ETAPAS_VACINA: OpcaoCampo[] = [
  { value: 'first', label: '1ª dose' },
  { value: 'second', label: '2ª dose' },
  { value: 'third', label: '3ª dose' },
  { value: 'booster', label: 'Reforço' },
  { value: 'single', label: 'Dose única' },
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
      /**
       * De quanto em quanto o −/+ anda. **Presente = a tela desenha um STEPPER;
       * ausente = campo com máscara.**
       *
       * O protótipo tem stepper de 10 em 10 para mL (`Math.min(300, ml + 10)`),
       * e ele NÃO generaliza: dos 13 campos numéricos do app, `peso` vai de 0,5
       * a 30 e `dose` de 0,1 a 1000. Andar de 10 em 10 ali não é impreciso — é
       * inútil, e para a dose seria perigoso.
       *
       * Por isso o passo é declarado campo a campo em vez de global: quem tem
       * unidade grossa e faixa curta ganha stepper; quem precisa do número exato
       * continua digitando. A tela não decide isso, o schema decide.
       */
      passo?: number;
      /** A unidade ao lado do numero no stepper: "ml", "min". So faz sentido com `passo`. */
      unidade?: string;
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
   * Pede confirmação antes de salvar, com a frase que a mãe lê.
   *
   * Só o grupo de saúde usa. Dose errada é a única coisa neste app em que o erro
   * é dano físico, e uma etapa a mais no caminho é o preço certo — atrito onde
   * ele protege, e em lugar nenhum mais. Registrar continua sendo ação de
   * segundos para os outros treze tipos.
   */
  confirmaAntesDeSalvar?: string;
  /**
   * O registro não pode ser editado depois de salvo.
   *
   * É o que sustenta a mãe conferindo "já dei o remédio?": um histórico que se
   * reescreve não serve para isso. A flag esconde o botão de editar, e a defesa
   * de verdade está no banco — trigger na `007`, porque regra de tela se contorna
   * pela URL.
   *
   * ⚠️ APAGAR CONTINUA POSSÍVEL, e é decisão. Apagar é ação deliberada, com
   * confirmação e sem deixar meia-verdade para trás; editar troca o conteúdo
   * mantendo a aparência de registro conferido, que é o que estraga a conferência.
   */
  imutavel?: boolean;
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
/**
 * O campo de mililitros, compartilhado — e a faixa é a mesma pela mesma razão da
 * duração: `amount_ml` é UMA coluna gerada.
 *
 * ⚠️ A colisão que o pré-requisito 3 previu para este grupo **não aconteceu**, e
 * vale registrar por quê em vez de comemorar. Mamadeira, Hidratação e Extração
 * cabem todas em 5–500 ml de verdade: meio litro é um teto de sanidade para as
 * três, não um número escolhido para caber. O gerador aceita porque as faixas
 * concordam — é o caso `DEVE_PASSAR` do teste, e compartilhar coluna é o
 * desenho, não o erro.
 *
 * O dia em que uma delas precisar de faixa própria — e Extração é a candidata,
 * se um dia se quiser somar produção diária —, a saída é chave própria, não
 * alargar esta. Alargar para caber é como a faixa deixa de significar alguma
 * coisa.
 */
const MILILITROS = (rotulo: string, erroFalta: string): CampoSchema => ({
  entrada: 'numero',
  chave: 'quantidade',
  coluna: 'amount_ml',
  rotulo,
  placeholder: 'ex.: 90',
  min: 5,
  max: 500,
  escala: 1,
  digitos: 3,
  // Do protótipo: mlPlus anda de 10 em 10. A faixa dele era 0–300; aqui a
  // faixa do schema (5–500) manda, e o passo apenas anda dentro dela.
  passo: 10,
  unidade: 'ml',
  obrigatorio: true,
  erroFalta,
  erroFaixa: erroFalta,
});

/**
 * As medidas do crescimento. Cada uma com CHAVE PRÓPRIA, e isso é decisão.
 *
 * Altura e perímetro cefálico são as duas em milímetro, e seria tentador
 * compartilhar uma coluna `medida_mm`. Não compartilham: as faixas são
 * diferentes de verdade (20–120 cm contra 25–60 cm), e compartilhar obrigaria a
 * alargar a faixa até caber as duas — o que faria o banco aceitar 110 cm de
 * perímetro cefálico sem piscar.
 *
 * É a resposta que o guarda de colisão do gerador força a dar, e a resposta certa
 * quase sempre é esta: chave própria, não faixa maior.
 */
const MEDIDA = (opcoes: {
  chave: string;
  coluna: string;
  rotulo: string;
  placeholder: string;
  min: number;
  max: number;
  escala: number;
  decimais: number;
  digitos: number;
  erro: string;
}): CampoSchema => ({
  entrada: 'numero',
  chave: opcoes.chave,
  coluna: opcoes.coluna,
  rotulo: opcoes.rotulo,
  placeholder: opcoes.placeholder,
  min: opcoes.min,
  max: opcoes.max,
  escala: opcoes.escala,
  decimais: opcoes.decimais,
  digitos: opcoes.digitos,
  obrigatorio: true,
  erroFalta: opcoes.erro,
  erroFaixa: opcoes.erro,
});

/**
 * A dose, e a faixa dela é SANIDADE DE DIGITAÇÃO — não farmacologia.
 *
 * 0,1 a 1000 cobre gota, mililitro, miligrama e UI ao mesmo tempo, e é por isso
 * que ela é larga: a unidade muda o significado do número, e o app não sabe qual
 * remédio a mãe está dando. Recusar "500" para um mg legítimo seria o app fingir
 * que sabe de medicina; aceitar 50000 seria não fazer nada. Esta faixa pega o
 * dedo que escorregou no zero, e nada além disso.
 *
 * A defesa de verdade é a confirmação em duas etapas: ela lê o que digitou.
 */
const DOSE: CampoSchema = {
  entrada: 'numero',
  chave: 'dose',
  coluna: 'dose',
  rotulo: 'Dose',
  placeholder: 'ex.: 2,5',
  min: 0.1,
  max: 1000,
  // A coluna guarda em DÉCIMOS: 2,5 ml vira 25. É o mesmo mecanismo do peso, e
  // existe porque a coluna gerada é inteira.
  escala: 10,
  decimais: 1,
  digitos: 4,
  obrigatorio: true,
  erroFalta: 'Qual foi a dose?',
  erroFaixa: 'Dose de 0,1 a 1000.',
};

const UNIDADE: CampoSchema = {
  entrada: 'escolha',
  chave: 'unidade',
  coluna: 'dose_unit',
  rotulo: 'Unidade',
  opcoes: UNIDADES_DOSE,
  obrigatorio: true,
  erroFalta: 'Em que unidade?',
};

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
  // Minuto e unidade grossa e a faixa e curta (1–180): stepper serve.
  passo: 5,
  unidade: 'min',
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
        // Mesmo passo do `MILILITROS`, e a duplicação é o ponto: este campo é
        // declarado à mão em vez de usar a fábrica, então tudo que ela ganha
        // precisa ser copiado aqui. Foi assim que ele ficou de fora do stepper
        // na primeira tentativa — e ele é justamente o que o protótipo desenha.
        passo: 10,
        unidade: 'ml',
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

  // ============================================================
  // ALIMENTAÇÃO — bloco 3, segunda leva
  //
  // Também sem campo de tipo novo: `escolha` e `numero` bastam. O que este grupo
  // trouxe foi a primeira coluna gerada COMPARTILHADA de verdade — três tipos
  // escrevendo em `amount_ml` — e a armadilha de motor da Extração.
  // ============================================================

  comida: {
    tipo: 'comida',
    titulo: 'Comida',
    subtitulo: 'O que deu pra comer, e quanto foi.',
    acao: 'Salvar refeição',
    campos: [
      HORA('Horário'),
      {
        entrada: 'escolha',
        chave: 'aceitacao',
        coluna: 'acceptance',
        rotulo: 'Quanto comeu',
        opcoes: ACEITACAO,
        obrigatorio: true,
        erroFalta: 'Quanto comeu?',
      },
      {
        ...OBSERVACAO,
        rotulo: 'O que foi (opcional)',
        placeholder: 'Banana amassada, papinha de legumes…',
      },
    ],
  },

  hidratacao: {
    tipo: 'hidratacao',
    titulo: 'Hidratação',
    subtitulo: 'Água, chá ou suco — fora das mamadas.',
    acao: 'Salvar',
    campos: [
      HORA('Horário'),
      {
        entrada: 'escolha',
        chave: 'liquido',
        coluna: 'liquid',
        rotulo: 'O que tinha no copo',
        opcoes: LIQUIDOS,
        obrigatorio: true,
        erroFalta: 'Era água, chá ou suco?',
      },
      MILILITROS('Quantidade (ml)', 'Quantidade em ml, ex.: 50.'),
      OBSERVACAO,
    ],
  },

  /**
   * ⚠️ EXTRAÇÃO É DA MÃE, NÃO DO BEBÊ — e é a única entrada do schema que
   * registra algo que aconteceu com ela.
   *
   * O leite extraído pode nunca ter sido oferecido, ou ter sido horas depois — e
   * aí quem conta como alimentação é a mamadeira, não isto. Somá-la ao alvo
   * `mamada` do assistente faria a Ninna descrever uma rotina que não existe.
   *
   * O `teste-consultas.ts` já trava essa linha desde antes deste tipo existir, e
   * o motor está protegido por fora: `listarParaPadroes` lê por tipo, e nunca
   * pediu este.
   *
   * A linha continua pendurada no `baby_id` porque não existe entidade "mãe" no
   * banco, e criar uma para um tipo é caro. Fica registrado como o que é: uma
   * modelagem de conveniência, não uma afirmação de que a extração é do bebê.
   */
  extracao: {
    tipo: 'extracao',
    titulo: 'Extração',
    subtitulo: 'O leite que você tirou — só seu, não entra na conta das mamadas.',
    acao: 'Salvar extração',
    campos: [
      HORA('Começou às'),
      MILILITROS('Quantidade (ml)', 'Quantidade em ml, ex.: 120.'),
      {
        entrada: 'escolha',
        chave: 'lado',
        coluna: 'side',
        rotulo: 'Lado (opcional)',
        opcoes: LADOS,
        obrigatorio: false,
      },
      DURACAO('Duração em minutos (opcional)', 'ex.: 20'),
      OBSERVACAO,
    ],
  },

  // ============================================================
  // CRESCIMENTO — bloco 3, terceira leva
  //
  // ⚠️ ESTE GRUPO É SÓ REGISTRAR. A curva com a referência da OMS é bloco
  // próprio, e a separação é decisão de 12/08/2026: desenhar a referência é o
  // ponto do PRODUTO.md §0 virando código, e é o item de maior risco do produto
  // inteiro. Ele não deve competir por espaço com treze formulários.
  //
  // O que este grupo entrega, além do formulário, é a FRASE de comparação com a
  // medida anterior — "ganhou 340 g desde a pesagem anterior". Sem payoff a mãe
  // não anota, e sem anotar a série não enche para o gráfico ter o que mostrar.
  // E a frase é a tese no formato mais limpo que existe: a Liz com a Liz.
  //
  // É o primeiro grupo a usar `decimais`. Peso é 4,350 kg; nenhum dos dez tipos
  // anteriores precisou de casa decimal.
  // ============================================================

  peso: {
    tipo: 'peso',
    titulo: 'Peso',
    subtitulo: 'Anota como veio da balança.',
    acao: 'Salvar peso',
    campos: [
      HORA('Horário'),
      MEDIDA({
        chave: 'peso',
        coluna: 'peso_g',
        rotulo: 'Peso (kg)',
        placeholder: 'ex.: 4,350',
        min: 0.5,
        max: 30,
        // kg na tela, grama na coluna. É aqui que o arredondamento do
        // `paraAColuna` importa: 1,005 × 1000 dá 1004.9999999999999 em ponto
        // flutuante, e a coluna gerada recusaria isso com erro de cast.
        escala: 1000,
        decimais: 3,
        digitos: 2,
        erro: 'Peso em kg, de 0,5 a 30.',
      }),
      OBSERVACAO,
    ],
  },

  altura: {
    tipo: 'altura',
    titulo: 'Altura',
    subtitulo: 'Do topo da cabeça ao calcanhar.',
    acao: 'Salvar altura',
    campos: [
      HORA('Horário'),
      MEDIDA({
        chave: 'altura',
        coluna: 'altura_mm',
        rotulo: 'Altura (cm)',
        placeholder: 'ex.: 52,5',
        min: 20,
        max: 120,
        escala: 10,
        decimais: 1,
        digitos: 3,
        erro: 'Altura em cm, de 20 a 120.',
      }),
      OBSERVACAO,
    ],
  },

  circunferencia: {
    tipo: 'circunferencia',
    titulo: 'Perímetro cefálico',
    subtitulo: 'A medida da cabeça, como o pediatra faz.',
    acao: 'Salvar medida',
    campos: [
      HORA('Horário'),
      MEDIDA({
        chave: 'circunferencia',
        coluna: 'circunferencia_mm',
        rotulo: 'Perímetro cefálico (cm)',
        placeholder: 'ex.: 38,2',
        min: 25,
        max: 60,
        escala: 10,
        decimais: 1,
        digitos: 2,
        erro: 'Perímetro em cm, de 25 a 60.',
      }),
      OBSERVACAO,
    ],
  },

  // ============================================================
  // SAÚDE — bloco 3, última leva, e a única onde erro é dano físico
  //
  // Dois comportamentos que nenhum outro grupo tem, e os dois foram pedidos pelo
  // §3.4 antes de existir código:
  //
  //   · CONFIRMAÇÃO EM DUAS ETAPAS. Atrito onde ele protege, e em lugar nenhum
  //     mais — os outros treze tipos continuam salvando de primeira.
  //   · HISTÓRICO NÃO EDITÁVEL. É o que sustenta a mãe conferindo "já dei?".
  //     A flag esconde o botão; a defesa está no trigger da `007`.
  //
  // ⚠️ E UMA COISA QUE O APP NÃO FAZ: validar dose contra bula. A faixa aqui é
  // sanidade de digitação (0,1 a 1000), não conhecimento farmacológico. Recusar
  // "500" para um mg legítimo seria o app fingir que sabe de medicina — e
  // aceitar 50000 sem piscar seria não fazer nada. A defesa real é a mãe ler o
  // que digitou, e é para isso que a confirmação existe.
  // ============================================================

  medicacao: {
    tipo: 'medicacao',
    titulo: 'Medicação',
    subtitulo: 'O que foi dado, e quanto.',
    acao: 'Salvar medicação',
    confirmaAntesDeSalvar: 'Confere antes de salvar — depois este registro não pode ser editado.',
    imutavel: true,
    campos: [
      HORA('Horário'),
      {
        entrada: 'texto',
        chave: 'medicamento',
        // Texto livre, e não vocabulário: nome de medicamento é lista infinita e
        // muda. É a exceção que a convenção do `symptom` prevê — coluna sem check
        // não é convite a texto livre, mas aqui não existe vocabulário possível.
        coluna: 'medicine',
        rotulo: 'Qual medicamento',
        placeholder: 'Como está escrito na receita',
        max: 120,
        linhas: false,
        obrigatorio: true,
        erroFalta: 'Qual foi o medicamento?',
      },
      DOSE,
      UNIDADE,
      OBSERVACAO,
    ],
  },

  vitamina: {
    tipo: 'vitamina',
    titulo: 'Vitamina',
    subtitulo: 'A suplementação do dia.',
    acao: 'Salvar vitamina',
    confirmaAntesDeSalvar: 'Confere antes de salvar — depois este registro não pode ser editado.',
    imutavel: true,
    campos: [
      HORA('Horário'),
      {
        entrada: 'texto',
        chave: 'medicamento',
        coluna: 'medicine',
        rotulo: 'Qual vitamina',
        placeholder: 'Vitamina D, ferro…',
        max: 120,
        linhas: false,
        obrigatorio: true,
        erroFalta: 'Qual foi a vitamina?',
      },
      DOSE,
      UNIDADE,
      OBSERVACAO,
    ],
  },

  vacina: {
    tipo: 'vacina',
    titulo: 'Vacina',
    subtitulo: 'O que foi aplicado, como está na caderneta.',
    acao: 'Salvar vacina',
    confirmaAntesDeSalvar: 'Confere antes de salvar — depois este registro não pode ser editado.',
    imutavel: true,
    campos: [
      HORA('Horário'),
      {
        entrada: 'texto',
        chave: 'vacina',
        coluna: 'vaccine',
        rotulo: 'Qual vacina',
        placeholder: 'Como está escrito na caderneta',
        max: 120,
        linhas: false,
        obrigatorio: true,
        erroFalta: 'Qual foi a vacina?',
      },
      {
        entrada: 'escolha',
        // `etapa`, e NÃO `dose`: medicação declara `dose` como número, e a mesma
        // chave com formas diferentes faria a coluna gerada tentar converter
        // "primeira" em int. O gerador para nisso desde hoje.
        chave: 'etapa',
        coluna: 'stage',
        rotulo: 'Qual dose',
        opcoes: ETAPAS_VACINA,
        obrigatorio: true,
        erroFalta: 'Qual dose foi?',
      },
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

/**
 * Falta algum campo obrigatório? — a pergunta do BOTÃO, não a da validação.
 *
 * Ela é deliberadamente mais estreita que `validarRegistro`, e a diferença não é
 * economia: é mecânica da tela.
 *
 * As frases de erro só aparecem DEPOIS do toque, porque é o toque que chama
 * `validarRegistro` e preenche os erros. Então desabilitar por um erro que
 * precisa ser explicado — número fora de faixa, hora malformada — tira o único
 * caminho que explica: o botão fica morto e a mãe não descobre por quê.
 *
 * Aqui entra só campo obrigatório VAZIO, que é o estado que ela enxerga sozinha
 * ("não escolhi nada"), e é exatamente o que o protótipo desenha no CTA da
 * fralda.
 *
 * ------------------------------------------------------------------
 * A ÚNICA EXCEÇÃO É CAMPO DE HORA — E ELA TEM NOME E CASO
 *
 * Não basta dizer "hora fica de fora". Sem o caso concreto, daqui a seis meses
 * alguém lê a exceção como descuido e a "conserta".
 *
 * **O caso é o SONO**, e ele é extremo: o formulário de criar sono tem **um
 * campo só**, `hora` ("Começou às"), e ele é `obrigatorio: true`. O fim do sono
 * não mora aqui — é preenchido depois, pelo botão de encerrar na Home.
 *
 * Se hora entrasse na conta e a mãe apagasse o campo, o botão de começar o sono
 * morreria **com a tela vazia atrás dele**: nada mais para preencher, nenhuma
 * frase dizendo o que falta, e a frase só viria pelo toque que o botão morto
 * impede. Ela ficaria olhando para um botão apagado sem nada a fazer.
 *
 * Banho, Passeio e Leitura estão no mesmo desenho — hora obrigatória, todo o
 * resto opcional —, e por isso também nascem com o botão aceso.
 *
 * A hora, além disso, nasce preenchida com o horário atual: no caminho normal a
 * exceção nem é exercitada. Ela existe para o caminho em que a mãe limpa o
 * campo, que é justamente onde bloquear seria pior.
 * ------------------------------------------------------------------
 */
export function faltaObrigatorio(tipo: TipoRegistro, valores: ValoresRegistro): boolean {
  return SCHEMAS[tipo].campos.some((bruto) => {
    const campo = resolverCampo(bruto, valores);
    if (!campo.obrigatorio || campo.entrada === 'hora') return false;
    return (valores[campo.chave] ?? '').trim() === '';
  });
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
  /**
   * A comparação com o registro ANTERIOR do mesmo tipo — a tese em uma linha.
   *
   * Só o crescimento declara isto, e é o que dá à mãe uma razão para anotar
   * antes de existir gráfico: "ganhou 340 g desde a pesagem anterior" é a Liz
   * com a Liz, sem referência, sem faixa e sem julgamento.
   *
   * ⚠️ O QUE ELA NUNCA DIZ, e é o §0 virando código: nada de *abaixo*, *acima*,
   * *esperado*, *adequado*, *normal* ou percentil. A frase informa a diferença e
   * para. Ganho e perda usam a mesma construção e o mesmo tom — perda de peso em
   * bebê é assunto de pediatra, e a Ninna não alarma nem tranquiliza.
   *
   * `null` quando não há anterior: primeira medida não tem o que comparar, e
   * inventar uma frase para ela seria começar mentindo.
   */
  compararComAnterior?: (linha: LinhaRegistro, anterior: LinhaRegistro) => string | null;
};

/**
 * Dose em palavra: o número na unidade que a mãe digitou, com a unidade colada.
 *
 * A coluna guarda décimos (2,5 ml → 25), então a divisão por 10 acontece aqui —
 * e o `toFixed` some com o ",0" de dose inteira: "5 ml", não "5,0 ml".
 */
function doseEmPalavra(decimos: number, unidade: string | null): string {
  const valor = decimos / 10;
  const numeroEscrito = valor.toFixed(valor % 1 === 0 ? 0 : 1).replace('.', ',');
  const rotulo = unidade ? (UNIDADES_DOSE.find((o) => o.value === unidade)?.label ?? unidade) : null;
  return rotulo ? `${numeroEscrito} ${rotulo}` : numeroEscrito;
}

/** "Dipirona · 2,5 ml" — o nome sem a dose não responde "já dei, e quanto?". */
function resumoDeDose(linha: LinhaRegistro): string {
  const nome = texto(linha, 'medicine');
  const decimos = numero(linha, 'dose');
  const dose = decimos === null ? null : doseEmPalavra(decimos, texto(linha, 'dose_unit'));
  if (nome && dose) return `${nome} · ${dose}`;
  return nome ?? dose ?? 'Medicação';
}

function detalheDeDose(linha: LinhaRegistro, rotulo: string, agora: Date): CampoDetalhe[] {
  const decimos = numero(linha, 'dose');
  return listar([
    [rotulo, texto(linha, 'medicine')],
    ['Dose', decimos === null ? null : doseEmPalavra(decimos, texto(linha, 'dose_unit'))],
    ['Quando', formatarMomento(texto(linha, 'ocorrido_em') ?? '', agora)],
  ]);
}

/** Gramas em palavra curta: abaixo de um quilo conta em grama, acima em quilo. */
function pesoEmPalavra(gramas: number): string {
  if (gramas < 1000) return `${gramas} g`;
  const kg = gramas / 1000;
  return `${kg.toFixed(kg % 1 === 0 ? 0 : 2).replace('.', ',')} kg`;
}

/** Milímetros em centímetro, com uma casa e sem zero à toa. */
function cmEmPalavra(mm: number): string {
  const cm = mm / 10;
  return `${cm.toFixed(cm % 1 === 0 ? 0 : 1).replace('.', ',')} cm`;
}

/**
 * A construção compartilhada das três frases de crescimento.
 *
 * Uma função, porque a regra de tom é a mesma nas três e escrever três vezes é
 * como uma delas ganha um adjetivo que as outras não têm.
 */
function variacao(
  linha: LinhaRegistro,
  anterior: LinhaRegistro,
  chave: string,
  palavra: (v: number) => string,
  frases: { subiu: (v: string) => string; desceu: (v: string) => string; igual: string }
): string | null {
  const agora = numero(linha, chave);
  const antes = numero(anterior, chave);
  if (agora === null || antes === null) return null;

  const delta = agora - antes;
  if (delta === 0) return frases.igual;
  return delta > 0 ? frases.subiu(palavra(delta)) : frases.desceu(palavra(-delta));
}

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

  // Alimentação. O resumo da comida é o VERBO ("Comeu metade"), porque é o que
  // ela quer ler de relance — não "Comida · metade", que obriga a montar a frase
  // de cabeça.
  comida: {
    resumir: (l) => {
      const bruto = texto(l, 'acceptance');
      return rotularValor(ACEITACAO, bruto) ?? bruto ?? 'Comida';
    },
    detalhar: (l, agora) => {
      const bruto = texto(l, 'acceptance');
      return listar([
        ['Quanto comeu', bruto ? (ACEITACAO.find((o) => o.value === bruto)?.label ?? bruto) : null],
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
  },

  hidratacao: {
    /**
     * Os dois rótulos do mesmo valor, e é aqui que a distinção paga.
     *
     * `noResumo` é minúsculo porque existe para entrar no meio de uma frase —
     * "50 ml de água". Sozinho na lista, o resumo é o começo da linha e precisa
     * do `label`: "Chá", não "chá". Ler `noResumo` nos dois casos foi o primeiro
     * jeito que eu escrevi, e o teste pegou.
     */
    resumir: (l) => {
      const bruto = texto(l, 'liquid');
      const ml = numero(l, 'amount_ml');
      const naFrase = rotularValor(LIQUIDOS, bruto);
      if (ml && naFrase) return `${ml} ml de ${naFrase.toLowerCase()}`;
      if (ml) return `${ml} ml`;
      if (!bruto) return 'Hidratação';
      return LIQUIDOS.find((o) => o.value === bruto)?.label ?? bruto;
    },
    detalhar: (l, agora) => {
      const ml = numero(l, 'amount_ml');
      const bruto = texto(l, 'liquid');
      return listar([
        ['Quantidade', ml ? `${ml} ml` : null],
        ['O que era', bruto ? (LIQUIDOS.find((o) => o.value === bruto)?.label ?? bruto) : null],
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
  },

  /**
   * Saúde. O resumo carrega a DOSE junto do nome, e isso é o ponto do grupo.
   *
   * "Dipirona" sozinho não responde a pergunta que ela abre o app para fazer —
   * "já dei, e quanto?". O número tem que estar na linha da lista, sem exigir
   * que ela abra o registro.
   */
  medicacao: {
    resumir: (l) => resumoDeDose(l),
    detalhar: (l, agora) => detalheDeDose(l, 'Medicamento', agora),
  },

  vitamina: {
    resumir: (l) => resumoDeDose(l),
    detalhar: (l, agora) => detalheDeDose(l, 'Vitamina', agora),
  },

  vacina: {
    resumir: (l) => {
      const nome = texto(l, 'vaccine');
      const etapa = rotularValor(ETAPAS_VACINA, texto(l, 'stage'));
      if (nome && etapa) return `${nome} · ${etapa}`;
      return nome ?? etapa ?? 'Vacina';
    },
    detalhar: (l, agora) => {
      const bruto = texto(l, 'stage');
      return listar([
        ['Vacina', texto(l, 'vaccine')],
        ['Dose', bruto ? (ETAPAS_VACINA.find((o) => o.value === bruto)?.label ?? bruto) : null],
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
  },

  peso: {
    resumir: (l) => {
      const g = numero(l, 'peso_g');
      return g ? pesoEmPalavra(g) : 'Peso';
    },
    detalhar: (l, agora) => {
      const g = numero(l, 'peso_g');
      return listar([
        ['Peso', g ? pesoEmPalavra(g) : null],
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
    compararComAnterior: (l, anterior) =>
      variacao(l, anterior, 'peso_g', pesoEmPalavra, {
        subiu: (v) => `Ganhou ${v} desde a pesagem anterior.`,
        // Mesma construção, mesmo tom. Perda de peso em bebê é assunto de
        // pediatra: a Ninna informa a diferença e para.
        desceu: (v) => `${v} a menos que na pesagem anterior.`,
        igual: 'Mesmo peso da pesagem anterior.',
      }),
  },

  altura: {
    resumir: (l) => {
      const mm = numero(l, 'altura_mm');
      return mm ? cmEmPalavra(mm) : 'Altura';
    },
    detalhar: (l, agora) => {
      const mm = numero(l, 'altura_mm');
      return listar([
        ['Altura', mm ? cmEmPalavra(mm) : null],
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
    compararComAnterior: (l, anterior) =>
      variacao(l, anterior, 'altura_mm', cmEmPalavra, {
        subiu: (v) => `Cresceu ${v} desde a última medida.`,
        desceu: (v) => `${v} a menos que na última medida.`,
        igual: 'Mesma altura da última medida.',
      }),
  },

  circunferencia: {
    resumir: (l) => {
      const mm = numero(l, 'circunferencia_mm');
      return mm ? cmEmPalavra(mm) : 'Perímetro cefálico';
    },
    detalhar: (l, agora) => {
      const mm = numero(l, 'circunferencia_mm');
      return listar([
        ['Perímetro cefálico', mm ? cmEmPalavra(mm) : null],
        ['Quando', formatarMomento(texto(l, 'ocorrido_em') ?? '', agora)],
      ]);
    },
    compararComAnterior: (l, anterior) =>
      variacao(l, anterior, 'circunferencia_mm', cmEmPalavra, {
        subiu: (v) => `${v} a mais que na última medida.`,
        desceu: (v) => `${v} a menos que na última medida.`,
        igual: 'Mesma medida da anterior.',
      }),
  },

  extracao: {
    resumir: (l) => {
      const ml = numero(l, 'amount_ml');
      const lado = rotularValor(LADOS, texto(l, 'side'));
      if (ml && lado) return `${ml} ml · ${lado.toLowerCase()}`;
      if (ml) return `${ml} ml`;
      return 'Extração';
    },
    detalhar: (l, agora) => {
      const ml = numero(l, 'amount_ml');
      return listar([
        ['Quantidade', ml ? `${ml} ml` : null],
        ['Lado', rotularValor(LADOS, texto(l, 'side'))],
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

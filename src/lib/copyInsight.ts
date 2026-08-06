/**
 * Número vira frase. É aqui que o motor encosta na mãe.
 *
 * Módulo puro, sem React e sem Supabase — roda no Node, mesma razão de
 * `padroes.ts` e `paginacao.ts`. Copy é a parte do produto que mais precisa ser
 * testável: um adjetivo errado aqui custa mais que um número errado.
 *
 * ------------------------------------------------------------------
 * AS REGRAS DE TOM, QUE SÃO O PRODUTO
 *
 * Quem lê está acordada às 3h com um bebê no colo. Então:
 *
 * DESCREVER, NUNCA PRESCREVER. "Liz costuma mamar a cada três horas e meia",
 * nunca "o ideal seria". A Ninna não dá conselho de rotina e não é conselho
 * médico — mesma raiz da copy de saúde do BETA.md.
 *
 * NADA QUE SOE COMO DIAGNÓSTICO OU PREOCUPAÇÃO. Não existe ramo de copy que
 * comente dado atípico: a frase descreve o que a conta deu, no mesmo tom, seja
 * qual for o número. Se não houver o que descrever, cala.
 *
 * NENHUM JULGAMENTO. Nem elogio, nem alerta, nem adjetivo sobre o padrão
 * ("pouco", "irregular", "constante"). A faixa de confiança se expressa na
 * AUSÊNCIA de hedge, não em adjetivo: "vem passando" (pouco dado) vira "passa"
 * (muito dado), e é só isso que muda.
 *
 * SEM GÊNERO. Nunca `ele`/`ela`/`dele`/`dela`, nunca artigo antes do nome
 * ("de Liz", jamais "da Liz"). `sex` é opcional no cadastro, e a copy não pode
 * assumir o que o formulário não exige.
 *
 * SEM LINGUAGEM DE PAINEL. Nada de "média", "dados", "métrica", "registros",
 * porcentagem, minuto cru ou decimal. "Pouco mais de uma hora", não "70 min".
 *
 * A FRASE DE APRENDIZADO NÃO É ERRO. Não é falha do app nem cobrança da mãe:
 * "ainda estou conhecendo", nunca "dados insuficientes" ou "registre mais pra
 * desbloquear".
 */

import type { Metrica, Padroes } from './padroes';

// ------------------------------------------------------------------
// Números em palavras
// ------------------------------------------------------------------

const arredondarPara = (minutos: number, passo: number) => Math.round(minutos / passo) * passo;

/**
 * Horário do dia, arredondado para a meia hora mais próxima.
 *
 * É o arredondamento que o "por volta de" da frase compra: a conta tem precisão
 * de minuto, mas prometer minuto seria falsa exatidão sobre o sono de um bebê.
 */
export function formatarHorario(minutosDoDia: number): string {
  const total = arredondarPara(minutosDoDia, 30) % 1440;
  const hora = Math.floor(total / 60);
  const minuto = total % 60;

  if (hora === 0 && minuto === 0) return 'meia-noite';
  if (hora === 12 && minuto === 0) return 'meio-dia';
  if (hora === 12 && minuto === 30) return 'meio-dia e meia';

  return minuto === 0 ? `${hora}h` : `${hora}h${minuto}`;
}

/** Duração de soneca, no quarto de hora mais próximo. */
export function formatarDuracao(minutos: number): string {
  const m = arredondarPara(minutos, 15);

  if (m <= 30) return 'meia hora';
  if (m === 45) return 'uns quarenta e cinco minutos';
  if (m === 60) return 'cerca de uma hora';
  if (m === 75) return 'pouco mais de uma hora';
  if (m === 90) return 'uma hora e meia';
  if (m === 105) return 'quase duas horas';
  if (m === 120) return 'cerca de duas horas';
  if (m < 45) return 'uns quarenta minutos';

  const horas = Math.floor(m / 60);
  return m % 60 >= 30 ? `${horas} horas e meia` : `cerca de ${horas} horas`;
}

/** Intervalo entre mamadas, na meia hora mais próxima. */
export function formatarIntervalo(minutos: number): string {
  const m = arredondarPara(minutos, 30);
  const horas = Math.floor(m / 60);
  const meia = m % 60 >= 30;

  if (horas === 0) return 'menos de uma hora';
  if (horas === 1) return meia ? 'uma hora e meia' : 'uma hora';
  if (horas === 2) return meia ? 'duas horas e meia' : 'duas horas';
  if (horas === 3) return meia ? 'três horas e meia' : 'três horas';
  if (horas === 4) return meia ? 'quatro horas e meia' : 'quatro horas';
  if (horas === 5) return meia ? 'cinco horas e meia' : 'cinco horas';
  return `mais de ${horas} horas`;
}

// ------------------------------------------------------------------
// Faixas de confiança
// ------------------------------------------------------------------

export type Faixa = 'comecando' | 'firme' | 'bemMarcado';

/**
 * A faixa muda o grau de certeza da frase, nunca o conteúdo. Poucos registros
 * pedem hedge ("vem passando"); muitos dispensam ("passa").
 */
export function faixaDe(amostras: number): Faixa {
  if (amostras <= 7) return 'comecando';
  if (amostras <= 14) return 'firme';
  return 'bemMarcado';
}

// ------------------------------------------------------------------
// As frases
// ------------------------------------------------------------------

type Montador = (nome: string, valor: number) => string;

const FRASES: Record<'intervalo' | 'duracao' | 'horario', Record<Faixa, Montador[]>> = {
  intervalo: {
    comecando: [
      (n, v) =>
        `Está começando a aparecer um ritmo: entre uma mamada e outra, ${n} vem passando ${formatarIntervalo(v)}.`,
      (n, v) =>
        `Pelos últimos dias, as mamadas de ${n} têm ficado a ${formatarIntervalo(v)} uma da outra.`,
    ],
    firme: [
      (n, v) => `Entre uma mamada e outra, ${n} costuma passar ${formatarIntervalo(v)}.`,
      (n, v) => `As mamadas de ${n} vêm se espaçando a cada ${formatarIntervalo(v)}.`,
    ],
    bemMarcado: [
      (n, v) =>
        `Entre uma mamada e outra, ${n} passa ${formatarIntervalo(v)} — contando o dia e a madrugada.`,
      (n, v) =>
        `São ${formatarIntervalo(v)} entre uma mamada e outra de ${n}, contando o dia e a madrugada.`,
    ],
  },
  duracao: {
    comecando: [
      (n, v) => `Pelas últimas sonecas, ${n} vem dormindo ${formatarDuracao(v)} de cada vez.`,
      (n, v) => `As sonecas de ${n} têm durado ${formatarDuracao(v)} nos últimos dias.`,
    ],
    firme: [
      (n, v) => `As sonecas de ${n} costumam durar ${formatarDuracao(v)}.`,
      (n, v) => `Cada soneca de ${n} tem durado ${formatarDuracao(v)}.`,
    ],
    bemMarcado: [
      (n, v) => `As sonecas de ${n} duram ${formatarDuracao(v)}.`,
      (n, v) => `${n} dorme ${formatarDuracao(v)} em cada soneca.`,
    ],
  },
  horario: {
    comecando: [
      (n, v) => `As sonecas de ${n} vêm caindo por volta de ${formatarHorario(v)}.`,
      (n, v) => `Pelos últimos dias, ${n} tem pegado no sono por volta de ${formatarHorario(v)}.`,
    ],
    firme: [
      (n, v) => `A soneca de ${n} costuma ser por volta de ${formatarHorario(v)}.`,
      (n, v) => `${n} costuma tirar a soneca por volta de ${formatarHorario(v)}.`,
    ],
    bemMarcado: [
      (n, v) => `A soneca de ${n} é por volta de ${formatarHorario(v)}.`,
      (n, v) => `${n} tira a soneca por volta de ${formatarHorario(v)}.`,
    ],
  },
};

/**
 * Sem número e sem cobrança. Não diz o que falta nem quanto falta: a mãe não
 * está prestando conta pro app, e transformar registro em meta é o caminho mais
 * curto pra ela abandonar.
 */
const APRENDIZADO: ((nome: string) => string)[] = [
  (n) => `Ainda estou conhecendo ${n} — cada registro ajuda a desenhar esse ritmo.`,
  (n) => `Ainda estou aprendendo o ritmo de ${n}. Daqui a alguns dias eu te conto o que percebi.`,
  (n) => `Por enquanto ainda estou olhando os dias de ${n}. Logo te mostro o que se repete.`,
];

// ------------------------------------------------------------------
// Escolha
// ------------------------------------------------------------------

/**
 * Índice estável dentro do dia, diferente entre dias.
 *
 * A frase não pode trocar a cada foco de tela — a mãe abre a Home dez vezes por
 * dia, e texto que muda a cada abertura parece instável, não vivo. Muda uma vez
 * por dia, no calendário LOCAL dela.
 */
function indiceDoDia(agora: Date, fusoHorario?: string): number {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);

  let soma = 0;
  for (const c of partes) soma = (soma * 31 + c.charCodeAt(0)) % 100_000;
  return soma;
}

export type InsightDaHome = {
  texto: string;
  /** `true` quando é a frase de aprendizado, não um padrão de verdade. */
  aprendendo: boolean;
};

/**
 * A frase do card.
 *
 * Só entram métricas com confiança `suficiente`. `nao_se_aplica` fica de fora em
 * silêncio — não vira frase de aprendizado, porque não é falta de dado: é conta
 * que não descreve este bebê. Se sobrar mais de uma, o dia escolhe qual aparece.
 */
export function escolherInsight(
  padroes: Padroes | null,
  nomeBebe: string,
  opcoes: { agora?: Date; fusoHorario?: string } = {}
): InsightDaHome {
  const agora = opcoes.agora ?? new Date();
  const semente = indiceDoDia(agora, opcoes.fusoHorario);

  const candidatas: { chave: 'intervalo' | 'duracao' | 'horario'; metrica: Metrica }[] = padroes
    ? [
        { chave: 'intervalo' as const, metrica: padroes.intervaloMedioMamadas },
        { chave: 'duracao' as const, metrica: padroes.duracaoMediaSoneca },
        { chave: 'horario' as const, metrica: padroes.horarioMedioSoneca },
      ].filter((c) => c.metrica.confianca === 'suficiente' && c.metrica.valor !== null)
    : [];

  if (candidatas.length === 0) {
    return { texto: APRENDIZADO[semente % APRENDIZADO.length](nomeBebe), aprendendo: true };
  }

  const escolhida = candidatas[semente % candidatas.length];
  const variacoes = FRASES[escolhida.chave][faixaDe(escolhida.metrica.amostras)];
  // Divide antes do módulo pra variação e métrica não andarem juntas: sem isso,
  // dias que caem na mesma métrica cairiam sempre na mesma frase.
  const variacao = variacoes[Math.floor(semente / candidatas.length) % variacoes.length];

  return { texto: variacao(nomeBebe, escolhida.metrica.valor!), aprendendo: false };
}

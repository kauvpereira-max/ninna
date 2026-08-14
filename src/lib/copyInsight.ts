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

import type { Metrica, Padroes } from './padroes.ts';
import {
  RESPOSTA_DESCONHECIDA,
  RESPOSTA_SAUDE,
  type Alvo,
  type Dia,
  type Resultado,
} from './consultas.ts';

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

export type ChaveDePadrao = 'intervalo' | 'duracao' | 'horario';

export type InsightDaHome = {
  texto: string;
  /** `true` quando é a frase de aprendizado, não um padrão de verdade. */
  aprendendo: boolean;
  /**
   * Qual métrica virou frase hoje — `null` quando é a de aprendizado.
   *
   * Existe para a seção "Padrões" poder EXCLUIR esta métrica dos cards dela. Sem
   * isso, a mesma frase apareceria duas vezes na mesma rolagem: uma no card de
   * monitoramento e outra no carrossel logo abaixo.
   */
  chave: ChaveDePadrao | null;
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
    return {
      texto: APRENDIZADO[semente % APRENDIZADO.length](nomeBebe),
      aprendendo: true,
      chave: null,
    };
  }

  const escolhida = candidatas[semente % candidatas.length];
  const variacoes = FRASES[escolhida.chave][faixaDe(escolhida.metrica.amostras)];
  // Divide antes do módulo pra variação e métrica não andarem juntas: sem isso,
  // dias que caem na mesma métrica cairiam sempre na mesma frase.
  const variacao = variacoes[Math.floor(semente / candidatas.length) % variacoes.length];

  return { texto: variacao(nomeBebe, escolhida.metrica.valor!), aprendendo: false, chave: escolhida.chave };
}

/**
 * Todas as métricas publicáveis, cada uma já virada frase — os cards de "Padrões".
 *
 * ------------------------------------------------------------------
 * MESMO FILTRO E MESMAS FRASES DO CARD DE MONITORAMENTO
 *
 * O filtro é o do `escolherInsight`: só `suficiente` com valor. `nao_se_aplica`
 * fica de fora em silêncio, porque não é falta de dado — é conta que não
 * descreve este bebê.
 *
 * E as frases saem do MESMO `FRASES`. Um texto próprio para o carrossel seria um
 * segundo lugar onde a Ninna fala sobre o bebê, e o segundo lugar é onde a copy
 * deriva: o `teste-copy-insight` varre o que sai daqui e do `escolherInsight`
 * contra as nove proibições, e frase que nasce fora dos dois não é varrida.
 *
 * ⚠️ Quem chama é responsável por tirar a métrica que o card já está narrando —
 * é para isso que o `escolherInsight` devolve a `chave`.
 */
export function descreverPadroes(
  padroes: Padroes | null,
  nomeBebe: string,
  opcoes: { agora?: Date; fusoHorario?: string } = {}
): { chave: ChaveDePadrao; texto: string }[] {
  if (!padroes) return [];
  const semente = indiceDoDia(opcoes.agora ?? new Date(), opcoes.fusoHorario);

  return (
    [
      { chave: 'intervalo' as const, metrica: padroes.intervaloMedioMamadas },
      { chave: 'duracao' as const, metrica: padroes.duracaoMediaSoneca },
      { chave: 'horario' as const, metrica: padroes.horarioMedioSoneca },
    ]
      .filter((c) => c.metrica.confianca === 'suficiente' && c.metrica.valor !== null)
      .map(({ chave, metrica }) => {
        const variacoes = FRASES[chave][faixaDe(metrica.amostras)];
        // A variação anda com o dia, como no card — mas somando o índice da
        // métrica, para as duas não caírem sempre na mesma posição da lista.
        const i = (semente + chave.length) % variacoes.length;
        return { chave, texto: variacoes[i](nomeBebe, metrica.valor!) };
      })
  );
}

// ==================================================================
// RESPOSTAS DO ASSISTENTE — o Desenho B
// ==================================================================
//
// A superfície de consulta devolve números; aqui eles viram frase. No Desenho B
// é ESTE módulo que escreve a resposta, e não o modelo — o modelo só interpreta
// a pergunta.
//
// POR QUE A FRASE NÃO SAI DO MODELO
//
// Recall é a pergunta mais frequente de mãe de recém-nascido. Se o modelo
// narrasse, a resposta mais lida do app seria a menos verificada — e o tom é o
// produto. Aqui a frase é determinística: passa nas mesmas varreduras de gênero
// e de linguagem de média que o resto da copy, e é ancorada por construção,
// porque o número vem do motor e não de uma geração.
//
// ------------------------------------------------------------------
// UMA EMENDA CONSCIENTE À REGRA "SEM DURAÇÃO EM NÚMERO"
//
// A regra do topo deste arquivo proíbe minuto cru — "70 min" — e está certa para
// o CARD, que descreve um padrão: prometer precisão sobre o sono de um bebê é
// falsa exatidão, e "pouco mais de uma hora" é mais honesto que "70 min".
//
// Recall é o caso oposto. "Faz quanto tempo desde a última mamada?" é uma
// pergunta sobre um fato que a mãe pode conferir na lista, e responder "faz
// pouco mais de duas horas e meia" seria vagueza falsa — ela vai decidir se
// amamenta agora com base nisso. Então:
//
//   * PADRÃO descreve com palavra ("cerca de uma hora");
//   * RECALL, CONTAGEM e COMPARAÇÃO respondem com número ("faz 2h40", "6
//     mamadas"), porque o número É a resposta.
//
// O que continua proibido nas duas é a ABREVIAÇÃO de painel: "45 min" não, "45
// minutos" sim. Abreviação é vocabulário de planilha; a palavra inteira é fala.

/**
 * Gênero GRAMATICAL do substantivo — "a mamada", "o sono".
 *
 * ⚠️ Não confundir com o gênero do bebê, que o app não sabe e nunca escolhe.
 * Aqui é concordância com a palavra, não com a criança.
 */
type RotuloAlvo = {
  ultimo: string;
  /**
   * "a última mamada e a anterior", e não "as duas últimas mamadas".
   *
   * Não é preferência de estilo: "duas" é palavra de número, e o validador de
   * ancoragem — corretamente — não sabe distinguir um número estrutural da frase
   * de um número que veio do motor. Escrever sem numeral mantém o validador
   * afiado em vez de obrigá-lo a abrir exceção.
   */
  ultimaEAnterior: string;
  singular: string;
  plural: string;
  registrada: string;
};

const ROTULO_ALVO: Record<Alvo, RotuloAlvo> = {
  mamada: {
    ultimo: 'A última mamada',
    ultimaEAnterior: 'a última mamada e a anterior',
    singular: 'mamada',
    plural: 'mamadas',
    registrada: 'registrada',
  },
  sono: {
    ultimo: 'O último sono',
    ultimaEAnterior: 'o último sono e o anterior',
    singular: 'sono',
    plural: 'sonos',
    registrada: 'registrado',
  },
  fralda: {
    ultimo: 'A última troca',
    ultimaEAnterior: 'a última troca e a anterior',
    singular: 'troca',
    plural: 'trocas',
    registrada: 'registrada',
  },
  humor: {
    ultimo: 'O último registro de humor',
    ultimaEAnterior: 'o último registro de humor e o anterior',
    singular: 'registro de humor',
    plural: 'registros de humor',
    registrada: 'registrado',
  },
  sintoma: {
    ultimo: 'O último registro de sintoma',
    ultimaEAnterior: 'o último registro de sintoma e o anterior',
    singular: 'registro de sintoma',
    plural: 'registros de sintoma',
    registrada: 'registrado',
  },
  // Os quatro do bloco 3. A concordância aqui é com a PALAVRA — "o banho", "a
  // leitura" —, nunca com o bebê, cujo gênero o app não sabe e não escolhe.
  banho: {
    ultimo: 'O último banho',
    ultimaEAnterior: 'o último banho e o anterior',
    singular: 'banho',
    plural: 'banhos',
    registrada: 'registrado',
  },
  passeio: {
    ultimo: 'O último passeio',
    ultimaEAnterior: 'o último passeio e o anterior',
    singular: 'passeio',
    plural: 'passeios',
    registrada: 'registrado',
  },
  leitura: {
    ultimo: 'A última leitura',
    ultimaEAnterior: 'a última leitura e a anterior',
    singular: 'leitura',
    plural: 'leituras',
    registrada: 'registrada',
  },
  atividade: {
    ultimo: 'A última atividade',
    ultimaEAnterior: 'a última atividade e a anterior',
    singular: 'atividade',
    plural: 'atividades',
    registrada: 'registrada',
  },
  comida: {
    ultimo: 'A última refeição',
    ultimaEAnterior: 'a última refeição e a anterior',
    singular: 'refeição',
    plural: 'refeições',
    registrada: 'registrada',
  },
  hidratacao: {
    ultimo: 'A última vez que bebeu água',
    ultimaEAnterior: 'a última vez que bebeu água e a anterior',
    singular: 'registro de hidratação',
    plural: 'registros de hidratação',
    registrada: 'registrado',
  },
  extracao: {
    ultimo: 'A última extração',
    ultimaEAnterior: 'a última extração e a anterior',
    singular: 'extração',
    plural: 'extrações',
    registrada: 'registrada',
  },
};

/** Horário de relógio, exato — recall não arredonda (ver a emenda acima). */
export function formatarHorarioExato(minutosDoDia: number): string {
  const total = ((minutosDoDia % 1440) + 1440) % 1440;
  const hora = Math.floor(total / 60);
  const minuto = total % 60;
  return minuto === 0 ? `${hora}h` : `${hora}h${String(minuto).padStart(2, '0')}`;
}

/** "faz 2h40", "faz 45 minutos", "agora há pouco". */
export function formatarFaz(minutos: number): string {
  if (minutos < 5) return 'agora há pouco';
  if (minutos < 60) return `faz ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `faz ${horas}h` : `faz ${horas}h${String(resto).padStart(2, '0')}`;
}

/** Diferença entre duas medidas de tempo, em fala e não em planilha. */
function formatarDiferenca(minutos: number): string {
  if (minutos < 60) return `${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`;
}

const QUANDO: Record<Dia, string> = { hoje: 'Hoje', ontem: 'Ontem' };

// ------------------------------------------------------------------
// A narração
// ------------------------------------------------------------------

const CHAVE_DO_PADRAO = {
  intervalo_mamadas: 'intervalo',
  duracao_soneca: 'duracao',
  horario_soneca: 'horario',
} as const;

function narrarOk(r: Extract<Resultado, { estado: 'ok' }>, nome: string): string {
  const c = r.consulta;
  const n = r.numeros;

  switch (c.nome) {
    case 'ultimo_registro': {
      const rotulo = ROTULO_ALVO[c.alvo];
      const faz = formatarFaz(n.faz_minutos.valor);
      // O horário pode faltar quando o fuso não resolve o instante — a frase
      // continua verdadeira sem ele, então ela encolhe em vez de sumir.
      if (!n.horario) return `${rotulo.ultimo} foi ${faz}.`;
      const hora = formatarHorarioExato(n.horario.valor);
      return faz === 'agora há pouco'
        ? `${rotulo.ultimo} foi agora há pouco, às ${hora}.`
        : `${rotulo.ultimo} foi às ${hora} — ${faz}.`;
    }

    case 'contagem_do_dia': {
      const rotulo = ROTULO_ALVO[c.alvo];
      const quantos = n.quantos.valor;
      const quando = QUANDO[c.dia];
      const ateAgora = c.dia === 'hoje' ? ' até agora' : '';

      if (quantos === 0) {
        return `${quando} ainda não tem ${rotulo.singular} ${rotulo.registrada}.`;
      }
      if (quantos === 1) {
        return `${quando} teve ${rotulo.registrada === 'registrada' ? 'uma' : 'um'} ${rotulo.singular}${ateAgora}.`;
      }
      return `${quando} foram ${quantos} ${rotulo.plural}${ateAgora}.`;
    }

    case 'total_sono_do_dia': {
      const quando = QUANDO[c.dia];
      const duracao = formatarDuracao(n.total_minutos.valor);
      const vezes = n.quantos_sonos.valor;
      return vezes === 1
        ? `${quando} deu ${duracao} de sono.`
        : `${quando} deu ${duracao} de sono, em ${vezes} vezes.`;
    }

    case 'intervalo_entre_ultimos': {
      const rotulo = ROTULO_ALVO[c.alvo];
      return `Entre ${rotulo.ultimaEAnterior} deu ${formatarIntervalo(n.intervalo_minutos.valor)}.`;
    }

    case 'comparar_dias': {
      const hoje = n.hoje.valor;
      const ontem = n.ontem.valor;

      if (c.metrica === 'sono_total') {
        if (hoje === ontem) {
          return `Até essa hora, hoje e ontem deram o mesmo tanto de sono: ${formatarDuracao(hoje)}.`;
        }
        return `Até essa hora, hoje deu ${formatarDuracao(hoje)} de sono; ontem, ${formatarDuracao(ontem)}.`;
      }

      const plural = c.metrica === 'mamadas' ? 'mamadas' : 'trocas';
      if (hoje === ontem) {
        return `Até essa hora, hoje e ontem estão iguais: ${hoje} ${plural}.`;
      }
      return `Até essa hora, hoje foram ${hoje} ${plural}; ontem, tinham sido ${ontem}.`;
    }

    case 'comparar_semanas': {
      const esta = n.esta_semana.valor;
      const passada = n.semana_passada.valor;
      const diferenca = n.diferenca.valor;

      const plural = c.metrica === 'mamadas' ? 'mamadas' : 'trocas';

      if (diferenca === 0) {
        return c.metrica === 'sono_total'
          ? `Essa semana o sono de ${nome} deu o mesmo tanto da passada.`
          : `Essa semana e a passada tiveram o mesmo tanto: ${esta} ${plural}.`;
      }

      const aMais = esta > passada ? 'a mais' : 'a menos';

      if (c.metrica === 'sono_total') {
        return `${nome} dormiu ${formatarDiferenca(diferenca)} ${aMais} essa semana que na passada.`;
      }

      return `Essa semana foram ${esta} ${plural}; na semana passada, ${passada}.`;
    }

    case 'padrao': {
      // Reusa as frases do card: o padrão é a mesma resposta, perguntada em vez
      // de oferecida. Variação por dia não entra — quem perguntou quer a
      // resposta, não novidade.
      const chave = CHAVE_DO_PADRAO[c.metrica];
      return FRASES[chave][faixaDe(n.amostras.valor)][0](nome, n.valor.valor);
    }
  }
}

function narrarSemDado(r: Extract<Resultado, { estado: 'sem_dado' }>, nome: string): string {
  const c = r.consulta;

  switch (c.nome) {
    case 'ultimo_registro': {
      const rotulo = ROTULO_ALVO[c.alvo];
      return `Ainda não tem ${rotulo.singular} ${rotulo.registrada} por aqui.`;
    }

    case 'contagem_do_dia':
      return 'Ontem eu ainda não estava acompanhando, então não sei te dizer.';

    case 'total_sono_do_dia':
      return `${QUANDO[c.dia]} ainda não tem sono encerrado por aqui.`;

    case 'intervalo_entre_ultimos': {
      const rotulo = ROTULO_ALVO[c.alvo];
      const tem = r.falta.motivo === 'poucos_registros' ? r.falta.tem : 0;
      const artigo = rotulo.registrada === 'registrada' ? 'uma' : 'um';
      return tem === 0
        ? `Ainda não tem ${rotulo.singular} ${rotulo.registrada} por aqui.`
        : `Por enquanto tem ${artigo} ${rotulo.singular} só, então ainda não dá pra falar de intervalo.`;
    }

    case 'comparar_dias':
      return 'Ainda não dá pra comparar com ontem — o dia de ontem começou antes de eu estar acompanhando.';

    case 'comparar_semanas':
      return 'Ainda não tenho duas semanas inteiras pra comparar.';

    case 'padrao':
      // A mesma frase de aprendizado do card, e pelo mesmo motivo: não é erro do
      // app nem cobrança da mãe.
      return APRENDIZADO[0](nome);
  }
}

/**
 * A resposta do assistente, inteira, sem passar por modelo nenhum.
 *
 * Ancorada por construção: cada número da frase sai de `resultado.numeros`, que
 * é o mesmo objeto que `ancoragem.ts` usa para validar. O teste confere isso
 * frase por frase, e não por confiança.
 */
export function narrar(resultado: Resultado, nomeBebe: string): string {
  switch (resultado.estado) {
    case 'ok':
      return narrarOk(resultado, nomeBebe);
    case 'sem_dado':
      return narrarSemDado(resultado, nomeBebe);
    case 'fora_de_escopo':
      return resultado.razao === 'saude' ? RESPOSTA_SAUDE : RESPOSTA_DESCONHECIDA;
  }
}

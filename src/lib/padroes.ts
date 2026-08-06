/**
 * O motor de personalização — as três métricas do BETA.md §3.3.
 *
 * Função pura e síncrona: recebe registros, devolve números. Sem Supabase, sem
 * React, sem `Date.now()` escondido (o "agora" entra por parâmetro). É o que
 * permite rodar no Node e conferir cada número na calculadora, do mesmo jeito
 * que `paginacao.ts`.
 *
 * Ligar isto no app é o D9. Aqui não há nada de UI.
 *
 * ------------------------------------------------------------------
 * AS TRÊS COISAS QUE NÃO PODEM ESTAR ERRADAS
 *
 * 1. HORÁRIO MÉDIO É MÉDIA CIRCULAR. Hora do dia é um círculo: sonecas às 23h e
 *    à 1h têm média meia-noite, não meio-dia. A média aritmética diria "a soneca
 *    de Liz costuma ser ao meio-dia" para um bebê que dorme à meia-noite — e
 *    número errado com cara de certeza é o R3, que custa a embaixadora.
 *
 * 2. SONECA E NOITE SÃO COISAS DIFERENTES. Uma noite de 9h misturada com sonecas
 *    de 40min produz "média de 3h20", que não descreve nenhum sono que aquele
 *    bebê teve. Sono iniciado entre 19h e 6h é noite e fica FORA das duas
 *    métricas de soneca.
 *
 * 3. HORA LOCAL, NUNCA UTC. "Horário médio da soneca" é conceito de hora local:
 *    em UTC-3, uma soneca das 23h de terça é 2h de quarta em UTC. O fuso entra
 *    por parâmetro justamente para o teste poder injetá-lo — depender do fuso da
 *    máquina foi o erro que o `teste-horario.ts` já pegou uma vez.
 */

/**
 * `nao_se_aplica` é um terceiro estado, e não um sinônimo de `insuficiente`.
 *
 * Insuficiente = ainda não sei (faltam registros). Não se aplica = eu sei, e a
 * conta não descreve nada deste bebê. Um bebê com sonecas às 9h, 13h e 16h30 tem
 * média em torno de meio-dia e meia — horário em que ele não costuma dormir. O
 * número existe e é inútil.
 *
 * A tela trata os dois de forma diferente: `insuficiente` vira a frase de
 * aprendizado; `nao_se_aplica` simplesmente não vira frase nenhuma, e outra
 * métrica ocupa o card. É a regra do silêncio honesto do §3.3 estendida —
 * métrica que não descreve nada não é publicada, mesmo com registros de sobra.
 */
export type Confianca = 'suficiente' | 'insuficiente' | 'nao_se_aplica';

export type Metrica = {
  /**
   * Em minutos. Para `horarioMedioSoneca`, minutos desde a meia-noite local
   * (0 a 1439). `null` sempre que a confiança for insuficiente — não existe
   * "número provisório": ou o valor se sustenta, ou a tela não mostra nada.
   */
  valor: number | null;
  confianca: Confianca;
  /** Quantos registros da métrica havia na janela. Alimenta a copy do D10. */
  amostras: number;
};

export type Padroes = {
  /** Intervalo médio entre mamadas consecutivas, em minutos. */
  intervaloMedioMamadas: Metrica;
  /** Duração média das SONECAS, em minutos. Noite não entra. */
  duracaoMediaSoneca: Metrica;
  /** Horário médio das SONECAS, em minutos desde a meia-noite local. */
  horarioMedioSoneca: Metrica;
};

export type MamadaBruta = { started_at: string };
export type SonoBruto = { started_at: string; ended_at: string | null };

export type EntradaPadroes = {
  mamadas: MamadaBruta[];
  sonos: SonoBruto[];
};

export type OpcoesPadroes = {
  /** Fim da janela. Default: o instante da chamada. */
  agora?: Date;
  /** IANA, ex.: 'America/Sao_Paulo'. Default: o fuso do dispositivo. */
  fusoHorario?: string;
  janelaDias?: number;
};

/**
 * Mínimo de registros da métrica na janela para o card mostrar número.
 *
 * Abaixo disso a Home mostra a frase de aprendizado e NENHUM número (item 8 da
 * checklist §8). Silêncio honesto é melhor que número errado — mesmo princípio
 * da copy de saúde.
 */
export const MINIMO_REGISTROS = 5;

export const JANELA_DIAS = 7;

/**
 * Espalhamento máximo, em minutos, para o horário médio de soneca ser publicado.
 *
 * Acima disso a média existe mas não descreve nenhuma soneca daquele bebê, e a
 * métrica sai como `nao_se_aplica`. 1h30 separa os dois casos reais:
 *
 *   * bebê de soneca única, tudo em volta do mesmo horário → dispersão ~45 min,
 *     e "por volta das 13h" descreve mesmo o que acontece;
 *   * bebê de três sonecas (9h, 13h, 16h30) → dispersão ~3h, e a média cai em
 *     meio-dia e meia, horário em que ele justamente não dorme.
 *
 * É o mesmo bebê envelhecendo: quando as sonecas se juntam numa só, a dispersão
 * cai e a métrica volta a significar algo. O limiar é o que faz ela aparecer na
 * hora certa em vez de sempre.
 */
export const DISPERSAO_MAXIMA_MINUTOS = 90;

/** Sono que COMEÇA nesta faixa (hora local) é noite, não soneca. */
export const HORA_INICIO_NOITE = 19;
export const HORA_FIM_NOITE = 6;

const MINUTOS_NO_DIA = 1440;

// ------------------------------------------------------------------
// Hora local — o único ponto onde o fuso importa
// ------------------------------------------------------------------

const formatadores = new Map<string, Intl.DateTimeFormat>();
const formatadoresDeDia = new Map<string, Intl.DateTimeFormat>();

/**
 * `Intl` com `timeZone` explícito, e não `getHours()`, porque `getHours()` lê o
 * fuso da máquina e não há como injetar outro num teste. No Windows a variável
 * de ambiente `TZ` é ignorada para nomes IANA — foi exatamente assim que o teste
 * do D6 passou verde durante um tempo sem provar nada.
 */
function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatadores.set(fuso, f);
  }
  return f;
}

export function fusoDoDispositivo(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Minutos desde a meia-noite local, ou null se a data não for utilizável. */
export function minutosDoDiaLocal(iso: string, fuso: string): number | null {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;

  const partes = formatador(fuso).formatToParts(instante);
  const hora = Number(partes.find((p) => p.type === 'hour')?.value);
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value);
  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) return null;

  // `hourCycle: 'h23'` já devolve 0 para meia-noite, mas o `% 24` protege contra
  // implementações que devolvem 24.
  return (hora % 24) * 60 + minuto;
}

/**
 * A que DIA local um instante pertence — 'AAAA-MM-DD'.
 *
 * Existe aqui, e não em `horario.ts`, porque o `chaveDoDia` de lá usa
 * `getFullYear()` e amigos: lê o fuso da máquina, que é o certo para agrupar a
 * lista na tela da mãe e é impossível de injetar num teste. As consultas de
 * "ontem" e de "essa semana contra a passada" têm a mesma exigência do motor —
 * fuso por parâmetro — então a primitiva mora junto do motor, reusando o mesmo
 * cache de formatador.
 *
 * `en-CA` porque o formato dele já é AAAA-MM-DD; a chave é ordenável como string.
 */
export function diaLocal(iso: string, fuso: string): string | null {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;

  let f = formatadoresDeDia.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatadoresDeDia.set(fuso, f);
  }
  return f.format(instante);
}

/** Classificação pelo INÍCIO do sono, em hora local. */
export function ehSonoNoturno(inicioMinutosLocais: number): boolean {
  const hora = Math.floor(inicioMinutosLocais / 60);
  return hora >= HORA_INICIO_NOITE || hora < HORA_FIM_NOITE;
}

// ------------------------------------------------------------------
// Média circular
// ------------------------------------------------------------------

/**
 * Média de horários do dia tratando o dia como círculo.
 *
 * Cada horário vira um ângulo (1440 min = 360°), soma-se os vetores unitários e
 * o ângulo da resultante volta a ser minuto. Assim 23h e 1h dão 0h.
 *
 * Devolve `null` quando a resultante é curta demais: horários espalhados de
 * forma quase uniforme pelo dia (ou dois grupos opostos, tipo 6h e 18h) não têm
 * "horário típico" nenhum, e a direção que sobra é ruído. Preferimos não dizer
 * nada a dizer um horário que o vetor não sustenta — mesmo princípio do limiar
 * de confiança.
 */
export function mediaCircularMinutos(minutos: number[]): number | null {
  if (minutos.length === 0) return null;

  let somaSeno = 0;
  let somaCosseno = 0;
  for (const m of minutos) {
    const angulo = (2 * Math.PI * m) / MINUTOS_NO_DIA;
    somaSeno += Math.sin(angulo);
    somaCosseno += Math.cos(angulo);
  }

  const resultante = Math.sqrt(somaSeno ** 2 + somaCosseno ** 2) / minutos.length;
  if (resultante < 0.1) return null;

  let angulo = Math.atan2(somaSeno / minutos.length, somaCosseno / minutos.length);
  if (angulo < 0) angulo += 2 * Math.PI;

  const resultado = (angulo * MINUTOS_NO_DIA) / (2 * Math.PI);
  // O módulo fecha a borda: 1439,7 arredondado viraria 1440, que não existe.
  return Math.round(resultado) % MINUTOS_NO_DIA;
}

/**
 * Quanto os horários se espalham em volta da média circular, em minutos.
 *
 * Desvio padrão circular: `sqrt(-2 ln R)`, onde R é o comprimento da resultante
 * usada na média. R perto de 1 = horários agrupados (dispersão perto de zero);
 * R perto de 0 = espalhados pelo dia inteiro.
 *
 * Não é a mesma pergunta do limiar de confiança. Confiança pergunta "tenho
 * registros bastante?"; dispersão pergunta "esses registros descrevem um
 * horário?". Dá pra ter vinte sonecas e nenhuma resposta.
 */
export function dispersaoCircularMinutos(minutos: number[]): number | null {
  if (minutos.length === 0) return null;

  let somaSeno = 0;
  let somaCosseno = 0;
  for (const m of minutos) {
    const angulo = (2 * Math.PI * m) / MINUTOS_NO_DIA;
    somaSeno += Math.sin(angulo);
    somaCosseno += Math.cos(angulo);
  }

  const resultante = Math.sqrt(somaSeno ** 2 + somaCosseno ** 2) / minutos.length;
  if (resultante <= 0) return null;

  const desvioRadianos = Math.sqrt(-2 * Math.log(Math.min(resultante, 1)));
  return Math.round((desvioRadianos * MINUTOS_NO_DIA) / (2 * Math.PI));
}

// ------------------------------------------------------------------
// Métricas
// ------------------------------------------------------------------

const insuficiente = (amostras: number): Metrica => ({
  valor: null,
  confianca: 'insuficiente',
  amostras,
});

function media(valores: number[]): number {
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function dentroDaJanela(iso: string, inicio: number, fim: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= inicio && t <= fim;
}

/**
 * Intervalo médio entre mamadas consecutivas.
 *
 * Aritmética simples e instante puro: diferença entre `started_at` consecutivos,
 * ordenados. Fuso não entra aqui — a distância entre dois instantes é a mesma em
 * qualquer fuso, e é por isso que esta é a métrica que o R4 não ameaça.
 *
 * O limiar conta MAMADAS, não intervalos: o item 8 da checklist fala em "menos
 * de 5 mamadas registradas". Com 5 mamadas há 4 intervalos.
 */
function calcularIntervaloMamadas(mamadas: MamadaBruta[]): Metrica {
  const instantes = mamadas
    .map((m) => new Date(m.started_at).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  if (instantes.length < MINIMO_REGISTROS) return insuficiente(instantes.length);

  const intervalos: number[] = [];
  for (let i = 1; i < instantes.length; i++) {
    intervalos.push((instantes[i] - instantes[i - 1]) / 60_000);
  }

  return {
    valor: Math.round(media(intervalos)),
    confianca: 'suficiente',
    amostras: instantes.length,
  };
}

type Soneca = { inicioLocal: number; duracaoMinutos: number | null };

/**
 * Separa sonecas de sono noturno, em hora local.
 *
 * Sono ainda em andamento (`ended_at` null) entra na conta de HORÁRIO — a hora
 * em que ela pegou no sono já aconteceu — mas fica fora da conta de DURAÇÃO, que
 * ainda não existe. Contá-lo como duração zero puxaria a média para baixo.
 */
function extrairSonecas(sonos: SonoBruto[], fuso: string): Soneca[] {
  const sonecas: Soneca[] = [];

  for (const sono of sonos) {
    const inicioLocal = minutosDoDiaLocal(sono.started_at, fuso);
    if (inicioLocal === null) continue;
    if (ehSonoNoturno(inicioLocal)) continue;

    let duracaoMinutos: number | null = null;
    if (sono.ended_at) {
      const inicio = new Date(sono.started_at).getTime();
      const fim = new Date(sono.ended_at).getTime();
      if (Number.isFinite(inicio) && Number.isFinite(fim) && fim > inicio) {
        duracaoMinutos = (fim - inicio) / 60_000;
      }
    }

    sonecas.push({ inicioLocal, duracaoMinutos });
  }

  return sonecas;
}

// ------------------------------------------------------------------
// Entrada única
// ------------------------------------------------------------------

export function calcularPadroes(entrada: EntradaPadroes, opcoes: OpcoesPadroes = {}): Padroes {
  const fuso = opcoes.fusoHorario ?? fusoDoDispositivo();
  const janelaDias = opcoes.janelaDias ?? JANELA_DIAS;
  const fim = (opcoes.agora ?? new Date()).getTime();
  const inicio = fim - janelaDias * 24 * 60 * 60_000;

  const mamadas = entrada.mamadas.filter((m) => dentroDaJanela(m.started_at, inicio, fim));
  const sonos = entrada.sonos.filter((s) => dentroDaJanela(s.started_at, inicio, fim));

  const sonecas = extrairSonecas(sonos, fuso);
  const duracoes = sonecas
    .map((s) => s.duracaoMinutos)
    .filter((d): d is number => d !== null);

  const duracaoMediaSoneca: Metrica =
    duracoes.length < MINIMO_REGISTROS
      ? insuficiente(duracoes.length)
      : { valor: Math.round(media(duracoes)), confianca: 'suficiente', amostras: duracoes.length };

  let horarioMedioSoneca: Metrica;
  if (sonecas.length < MINIMO_REGISTROS) {
    horarioMedioSoneca = insuficiente(sonecas.length);
  } else {
    const inicios = sonecas.map((s) => s.inicioLocal);
    const circular = mediaCircularMinutos(inicios);
    const dispersao = dispersaoCircularMinutos(inicios);

    if (circular === null || dispersao === null || dispersao > DISPERSAO_MAXIMA_MINUTOS) {
      // Registros de sobra e nenhuma resposta: as sonecas deste bebê estão
      // espalhadas demais pra existir "o horário da soneca". A métrica sai de
      // cena em silêncio, e o card usa outra.
      horarioMedioSoneca = { valor: null, confianca: 'nao_se_aplica', amostras: sonecas.length };
    } else {
      horarioMedioSoneca = { valor: circular, confianca: 'suficiente', amostras: sonecas.length };
    }
  }

  return {
    intervaloMedioMamadas: calcularIntervaloMamadas(mamadas),
    duracaoMediaSoneca,
    horarioMedioSoneca,
  };
}

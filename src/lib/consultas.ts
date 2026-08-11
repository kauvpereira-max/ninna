/**
 * A superfície de consulta — o que a Ninna sabe responder sobre ESTE bebê.
 *
 * Módulo puro: recebe registros, devolve números. Sem Supabase, sem React, sem
 * `Date.now()` escondido. Roda no Node e se confere na calculadora, mesma regra
 * de `padroes.ts`, `copyInsight.ts` e `paginacao.ts`.
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO EXISTE, E POR QUE ELE É A BARREIRA
 *
 * O assistente da Ninna não é chat sobre bebês: é linguagem natural sobre os
 * registros dela. A pergunta vira uma `Consulta` desta lista, o motor devolve um
 * número, e a frase sai desse número.
 *
 * A consequência é a segurança, e ela é estrutural em vez de exortativa:
 * **não existe consulta que avalie gravidade.** "38,5 e não mama, o que eu
 * faço?" não tem como virar `Consulta` — não há `avaliarGravidade()` para o
 * interpretador escolher. A pergunta cai em `fora_de_escopo` e recebe texto
 * fixo. Nenhum prompt precisa segurar isso, porque a capacidade não existe.
 *
 * O mesmo vale para a tese (PRODUTO.md §0): não existe consulta que leia
 * população. Toda resposta é comparação da Liz com a Liz, porque os únicos dados
 * que entram aqui são os registros da Liz.
 *
 * ------------------------------------------------------------------
 * O CONTRATO DE ANCORAGEM
 *
 * Toda resposta `ok` carrega `numeros` — cada número que a frase pode conter,
 * com unidade. É o que `ancoragem.ts` usa para provar que a frase não inventou
 * magnitude. Número que a frase diz e que não está aqui é alucinação, e o
 * validador reprova antes de a mãe ler.
 *
 * ------------------------------------------------------------------
 * A JANELA FRIA (PRODUTO.md §4)
 *
 * O limiar de 5 registros é do PADRÃO, não da superfície. Recall e contagem
 * respondem com UM registro, e "faz quanto tempo desde a última mamada?" é a
 * pergunta mais frequente de mãe de recém-nascido. Nas primeiras 48h o produto é
 * memória, não insight — e memória é tão sobre este bebê quanto padrão.
 */

import {
  calcularPadroes,
  diaLocal,
  fusoDoDispositivo,
  type Metrica,
  MINIMO_REGISTROS,
  minutosDoDiaLocal,
} from './padroes.ts';
/**
 * A união é declarada AQUI, e não importada de `registros.ts`.
 *
 * Ela é idêntica à `TipoRegistro` de lá, e a duplicação é deliberada: este
 * módulo roda em três lugares — no app, no Node dos testes e no Deno da Edge
 * Function — e `registros.ts` só serve num deles, porque importa o Supabase e o
 * AsyncStorage do React Native.
 *
 * Importar só o TIPO parecia resolver, já que tipo some na compilação. Não
 * resolveu: o empacotador do Supabase segue o import antes de apagá-lo, subiu o
 * `registros.ts` inteiro junto com a função e depois falhou em achar as
 * dependências dele. O bundle foi para produção incompleto, com aviso em vez de
 * erro — o pior desfecho possível.
 *
 * A trava contra deriva está no outro lado: `registros.ts` confere em tempo de
 * compilação que as duas uniões continuam iguais.
 */
export type TipoEvento =
  | 'amamentar'
  | 'mamadeira'
  | 'fralda'
  | 'sono'
  | 'humor'
  | 'sintoma';

// ------------------------------------------------------------------
// Entrada
// ------------------------------------------------------------------

/**
 * Um registro, reduzido ao que qualquer consulta precisa.
 *
 * `fimEm` só existe para sono. Sono em andamento tem `fimEm` null, e isso não é
 * detalhe: a duração dele ainda não aconteceu, então ele conta para "quando
 * começou" e não conta para "quanto durou" — mesma regra do motor.
 */
export type EventoBruto = {
  tipo: TipoEvento;
  ocorridoEm: string;
  fimEm?: string | null;
};

/**
 * O alvo é como a mãe fala, não como o banco guarda.
 *
 * "Mamada" cobre amamentação e mamadeira — são a mesma pergunta para quem
 * pergunta, e são a mesma tabela no banco. Separar aqui obrigaria a mãe a saber
 * qual dos dois ela quer, que é exatamente o tipo de atrito que o assistente
 * existe para remover.
 */
export type Alvo = 'mamada' | 'sono' | 'fralda' | 'humor' | 'sintoma';

export const ALVOS: Alvo[] = ['mamada', 'sono', 'fralda', 'humor', 'sintoma'];

const TIPOS_DO_ALVO: Record<Alvo, TipoEvento[]> = {
  mamada: ['amamentar', 'mamadeira'],
  sono: ['sono'],
  fralda: ['fralda'],
  humor: ['humor'],
  sintoma: ['sintoma'],
};

export type Contexto = {
  agora: Date;
  /** IANA. Default: o fuso do dispositivo. */
  fusoHorario?: string;
};

// ------------------------------------------------------------------
// As consultas
// ------------------------------------------------------------------

export type MetricaComparavel = 'sono_total' | 'mamadas' | 'trocas';
export type MetricaDePadrao = 'intervalo_mamadas' | 'duracao_soneca' | 'horario_soneca';
export type Dia = 'hoje' | 'ontem';

export type Consulta =
  | { nome: 'ultimo_registro'; alvo: Alvo }
  | { nome: 'contagem_do_dia'; alvo: Alvo; dia: Dia }
  | { nome: 'total_sono_do_dia'; dia: Dia }
  | { nome: 'intervalo_entre_ultimos'; alvo: Alvo }
  | { nome: 'comparar_dias'; metrica: MetricaComparavel }
  | { nome: 'comparar_semanas'; metrica: MetricaComparavel }
  | { nome: 'padrao'; metrica: MetricaDePadrao };

export type NomeConsulta = Consulta['nome'];

export const NOMES_CONSULTA: NomeConsulta[] = [
  'ultimo_registro',
  'contagem_do_dia',
  'total_sono_do_dia',
  'intervalo_entre_ultimos',
  'comparar_dias',
  'comparar_semanas',
  'padrao',
];

/**
 * O manifesto da superfície: o que cada consulta responde, que dado ela exige, e
 * o que devolve quando não tem.
 *
 * Não é documentação — é dado. É daqui que sai a gramática que o modelo recebe
 * no Desenho B, e é isto que o teste varre para garantir que nenhuma consulta
 * entrou na união de tipos sem declarar o que faz.
 */
export type DescricaoConsulta = {
  responde: string;
  /**
   * ⚠️ Os exemplos vão para o prompt do modelo, e exemplo é o sinal mais forte
   * que um prompt tem. Por isso eles são escritos SEM pronome, mesmo que a mãe
   * escreva "ela" à vontade — ela sabe o gênero da filha, o app não, e um
   * exemplo com "ela" ensina o modelo a devolver "ela" na resposta.
   * A varredura de gênero cobre este arquivo e reprova se alguém esquecer.
   */
  exemplos: string[];
  precisa: string;
  semDado: string;
};

export const SUPERFICIE: Record<NomeConsulta, DescricaoConsulta> = {
  ultimo_registro: {
    responde: 'Quando foi o último registro de um tipo, e há quanto tempo.',
    exemplos: [
      'quando foi a última mamada?',
      'faz quanto tempo desde a última mamada?',
      'a última troca foi quando?',
    ],
    precisa: '1 registro do alvo',
    semDado: 'Diz que ainda não há registro desse tipo, sem cobrar.',
  },
  contagem_do_dia: {
    responde: 'Quantos registros de um tipo houve hoje ou ontem.',
    exemplos: ['quantas fraldas hoje?', 'quantas mamadas ontem?'],
    precisa: 'nada — zero é resposta válida para hoje',
    semDado: 'Só falta dado para "ontem" antes de o app ter um dia inteiro.',
  },
  total_sono_do_dia: {
    responde: 'Quanto tempo de sono, somado, houve hoje ou ontem.',
    exemplos: ['quanto tempo de sono ontem?', 'quanto de sono hoje?'],
    precisa: '1 sono encerrado no dia',
    semDado: 'Diz que ainda não há sono encerrado nesse dia.',
  },
  intervalo_entre_ultimos: {
    responde: 'Quanto tempo passou entre os dois últimos registros de um tipo.',
    exemplos: ['de quanto em quanto tempo estão as mamadas?'],
    precisa: '2 registros do alvo',
    semDado: 'Diz que ainda só há um registro — sem transformar isso em meta.',
  },
  comparar_dias: {
    responde:
      'Compara o que houve hoje até agora com o mesmo período de ontem, na mesma hora.',
    exemplos: ['hoje está diferente de ontem?', 'teve mais mamada hoje?'],
    precisa: 'registros de ontem (a comparação é até a mesma hora, não o dia todo)',
    semDado: 'Diz que ainda não dá para comparar — falta o dia de ontem.',
  },
  comparar_semanas: {
    responde: 'Compara os últimos 7 dias com os 7 anteriores.',
    exemplos: ['essa semana foi diferente da passada?', 'teve mais sono essa semana?'],
    precisa: '14 dias de histórico — as duas janelas precisam ser inteiras',
    semDado: 'Diz que ainda não há duas semanas para comparar.',
  },
  padrao: {
    responde: 'O padrão do bebê numa das três métricas do motor.',
    exemplos: ['que horas costuma pegar no sono?', 'de quanto em quanto tempo costuma mamar?'],
    precisa: `${MINIMO_REGISTROS} registros da métrica na janela de 7 dias`,
    semDado: 'Cai na frase de aprendizado — "ainda estou conhecendo", sem número.',
  },
};

// ------------------------------------------------------------------
// Saída
// ------------------------------------------------------------------

export type Unidade =
  /** Duração ou distância entre instantes. */
  | 'minutos'
  /** Minutos desde a meia-noite local — vira horário na frase. */
  | 'minutos_do_dia'
  /** Quantidade de registros. */
  | 'contagem';

export type NumeroAncorado = { valor: number; unidade: Unidade };

export type Falta =
  | { motivo: 'nenhum_registro' }
  | { motivo: 'poucos_registros'; tem: number; precisa: number }
  | { motivo: 'nenhum_sono_encerrado' }
  | { motivo: 'periodo_incompleto' };

/**
 * `fora_de_escopo` não é erro: é a superfície funcionando.
 *
 * `saude` existe separada de `desconhecida` porque a resposta é diferente — uma
 * devolve a decisão à mãe e aponta o pediatra, a outra admite que não entendeu.
 */
export type RazaoForaDeEscopo = 'saude' | 'desconhecida';

export type Resultado =
  | { estado: 'ok'; consulta: Consulta; numeros: Record<string, NumeroAncorado> }
  | { estado: 'sem_dado'; consulta: Consulta; falta: Falta }
  | { estado: 'fora_de_escopo'; razao: RazaoForaDeEscopo };

/**
 * Copy travada, derivada das regras de saúde do CLAUDE.md.
 *
 * Não avalia gravidade, não sugere urgência, não lista sinal de alarme, não cita
 * número, não diagnostica, não tranquiliza e não alarma. Diz o que a Ninna é —
 * memória do que foi registrado — e devolve a decisão para a mãe.
 *
 * Ao mexer aqui, mexer também no texto da tela de sintoma: os dois fazem a mesma
 * promessa, e divergir entre eles é como uma promessa se perde.
 */
export const RESPOSTA_SAUDE =
  'Não consigo te ajudar com isso — eu só sei o que você registrou. Se você estiver ' +
  'preocupada, confie no seu instinto e fala com o pediatra.';

export const RESPOSTA_DESCONHECIDA =
  'Essa eu não sei responder. Eu consigo te contar o que já foi registrado: horários, ' +
  'quantidades, e o que vem se repetindo nos últimos dias.';

// ------------------------------------------------------------------
// Interpretação — a fronteira
// ------------------------------------------------------------------

const ehAlvo = (v: unknown): v is Alvo => ALVOS.includes(v as Alvo);
const ehDia = (v: unknown): v is Dia => v === 'hoje' || v === 'ontem';
const ehComparavel = (v: unknown): v is MetricaComparavel =>
  v === 'sono_total' || v === 'mamadas' || v === 'trocas';
const ehPadrao = (v: unknown): v is MetricaDePadrao =>
  v === 'intervalo_mamadas' || v === 'duracao_soneca' || v === 'horario_soneca';

/**
 * Converte o que o modelo devolveu numa `Consulta` — ou recusa.
 *
 * É aqui que a barreira encosta no mundo. O modelo pode devolver qualquer coisa;
 * o que não couber exatamente na união acima **não vira consulta**, e portanto
 * não vira resposta. Uma alucinação de nome de função morre nesta linha, não
 * numa camada de prompt pedindo bom comportamento.
 */
export function interpretar(bruto: unknown): Consulta | { fora: RazaoForaDeEscopo } {
  if (typeof bruto !== 'object' || bruto === null) return { fora: 'desconhecida' };
  const b = bruto as Record<string, unknown>;

  if (b.fora === 'saude') return { fora: 'saude' };

  switch (b.nome) {
    case 'ultimo_registro':
      return ehAlvo(b.alvo) ? { nome: 'ultimo_registro', alvo: b.alvo } : { fora: 'desconhecida' };
    case 'contagem_do_dia':
      return ehAlvo(b.alvo) && ehDia(b.dia)
        ? { nome: 'contagem_do_dia', alvo: b.alvo, dia: b.dia }
        : { fora: 'desconhecida' };
    case 'total_sono_do_dia':
      return ehDia(b.dia) ? { nome: 'total_sono_do_dia', dia: b.dia } : { fora: 'desconhecida' };
    case 'intervalo_entre_ultimos':
      return ehAlvo(b.alvo)
        ? { nome: 'intervalo_entre_ultimos', alvo: b.alvo }
        : { fora: 'desconhecida' };
    case 'comparar_dias':
      return ehComparavel(b.metrica)
        ? { nome: 'comparar_dias', metrica: b.metrica }
        : { fora: 'desconhecida' };
    case 'comparar_semanas':
      return ehComparavel(b.metrica)
        ? { nome: 'comparar_semanas', metrica: b.metrica }
        : { fora: 'desconhecida' };
    case 'padrao':
      return ehPadrao(b.metrica) ? { nome: 'padrao', metrica: b.metrica } : { fora: 'desconhecida' };
    default:
      return { fora: 'desconhecida' };
  }
}

// ------------------------------------------------------------------
// Ajuda interna
// ------------------------------------------------------------------

const DIA_MS = 24 * 60 * 60_000;

const instante = (iso: string) => new Date(iso).getTime();
const valido = (e: EventoBruto) => Number.isFinite(instante(e.ocorridoEm));

function doAlvo(eventos: EventoBruto[], alvo: Alvo): EventoBruto[] {
  const tipos = TIPOS_DO_ALVO[alvo];
  return eventos
    .filter((e) => tipos.includes(e.tipo) && valido(e))
    .sort((a, b) => instante(a.ocorridoEm) - instante(b.ocorridoEm));
}

/** A chave do dia local pedido. "Ontem" é 24h antes — o Brasil não tem horário de verão desde 2019. */
function chaveDoDiaPedido(dia: Dia, ctx: Required<Contexto>): string | null {
  const base = dia === 'hoje' ? ctx.agora.getTime() : ctx.agora.getTime() - DIA_MS;
  return diaLocal(new Date(base).toISOString(), ctx.fusoHorario);
}

function duracaoMinutos(e: EventoBruto): number | null {
  if (!e.fimEm) return null;
  const inicio = instante(e.ocorridoEm);
  const fim = instante(e.fimEm);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return null;
  return (fim - inicio) / 60_000;
}

/**
 * As janelas são MEIO-ABERTAS — `[de, ate)`.
 *
 * As comparações usam duas janelas encostadas (esta semana começa onde a
 * passada termina). Com o topo inclusivo, um registro que caia exatamente na
 * fronteira entra nas duas e a diferença sai inflada — foi o que o teste pegou:
 * 7 sonecas de 100 min viraram 760 em vez de 700, porque a última da semana
 * anterior foi contada de novo.
 */
function naJanela(t: number, de: number, ate: number): boolean {
  return Number.isFinite(t) && t >= de && t < ate;
}

/** Minutos de sono somados numa janela, atribuindo o sono ao instante em que COMEÇOU. */
function somaSonoNaJanela(eventos: EventoBruto[], de: number, ate: number): number {
  let total = 0;
  for (const e of eventos) {
    if (e.tipo !== 'sono') continue;
    if (!naJanela(instante(e.ocorridoEm), de, ate)) continue;
    const d = duracaoMinutos(e);
    if (d !== null) total += d;
  }
  return total;
}

function contarNaJanela(eventos: EventoBruto[], alvo: Alvo, de: number, ate: number): number {
  return doAlvo(eventos, alvo).filter((e) => naJanela(instante(e.ocorridoEm), de, ate)).length;
}

const ALVO_DA_COMPARAVEL: Record<Exclude<MetricaComparavel, 'sono_total'>, Alvo> = {
  mamadas: 'mamada',
  trocas: 'fralda',
};

function medirComparavel(
  eventos: EventoBruto[],
  metrica: MetricaComparavel,
  de: number,
  ate: number
): number {
  return metrica === 'sono_total'
    ? Math.round(somaSonoNaJanela(eventos, de, ate))
    : contarNaJanela(eventos, ALVO_DA_COMPARAVEL[metrica], de, ate);
}

const unidadeDa = (metrica: MetricaComparavel): Unidade =>
  metrica === 'sono_total' ? 'minutos' : 'contagem';

/** O instante do registro mais antigo — é o que diz se uma janela histórica é inteira. */
function primeiroRegistro(eventos: EventoBruto[]): number | null {
  const validos = eventos.filter(valido).map((e) => instante(e.ocorridoEm));
  return validos.length === 0 ? null : Math.min(...validos);
}

// ------------------------------------------------------------------
// Execução
// ------------------------------------------------------------------

export function responder(
  consulta: Consulta,
  eventos: EventoBruto[],
  contexto: Contexto
): Resultado {
  const ctx: Required<Contexto> = {
    agora: contexto.agora,
    fusoHorario: contexto.fusoHorario ?? fusoDoDispositivo(),
  };
  const agora = ctx.agora.getTime();

  switch (consulta.nome) {
    // --- Recall: 1 registro basta ---
    case 'ultimo_registro': {
      const lista = doAlvo(eventos, consulta.alvo);
      const ultimo = lista[lista.length - 1];
      if (!ultimo) return { estado: 'sem_dado', consulta, falta: { motivo: 'nenhum_registro' } };

      const numeros: Record<string, NumeroAncorado> = {
        faz_minutos: {
          valor: Math.max(0, Math.round((agora - instante(ultimo.ocorridoEm)) / 60_000)),
          unidade: 'minutos',
        },
      };

      // O horário só entra se o fuso souber resolvê-lo. Número que não se
      // sustenta não vai para `numeros` — o contrato de ancoragem é justamente
      // que tudo que está aqui é publicável.
      const horario = minutosDoDiaLocal(ultimo.ocorridoEm, ctx.fusoHorario);
      if (horario !== null) numeros.horario = { valor: horario, unidade: 'minutos_do_dia' };

      return { estado: 'ok', consulta, numeros };
    }

    // --- Contagem: zero é resposta, não ausência ---
    case 'contagem_do_dia': {
      const chave = chaveDoDiaPedido(consulta.dia, ctx);
      if (chave === null) return { estado: 'sem_dado', consulta, falta: { motivo: 'nenhum_registro' } };

      const quantos = doAlvo(eventos, consulta.alvo).filter(
        (e) => diaLocal(e.ocorridoEm, ctx.fusoHorario) === chave
      ).length;

      // "Ontem" só é respondível se o app já existia ontem. Dizer "nenhuma troca
      // ontem" para quem instalou hoje seria falso — não houve zero trocas, houve
      // zero registro.
      if (consulta.dia === 'ontem' && quantos === 0) {
        const primeiro = primeiroRegistro(eventos);
        if (primeiro === null || primeiro > ctx.agora.getTime() - DIA_MS) {
          return { estado: 'sem_dado', consulta, falta: { motivo: 'periodo_incompleto' } };
        }
      }

      return { estado: 'ok', consulta, numeros: { quantos: { valor: quantos, unidade: 'contagem' } } };
    }

    case 'total_sono_do_dia': {
      const chave = chaveDoDiaPedido(consulta.dia, ctx);
      if (chave === null) return { estado: 'sem_dado', consulta, falta: { motivo: 'nenhum_registro' } };

      const doDia = eventos.filter(
        (e) => e.tipo === 'sono' && valido(e) && diaLocal(e.ocorridoEm, ctx.fusoHorario) === chave
      );
      const encerrados = doDia.map(duracaoMinutos).filter((d): d is number => d !== null);
      if (encerrados.length === 0) {
        return { estado: 'sem_dado', consulta, falta: { motivo: 'nenhum_sono_encerrado' } };
      }

      return {
        estado: 'ok',
        consulta,
        numeros: {
          total_minutos: {
            valor: Math.round(encerrados.reduce((s, d) => s + d, 0)),
            unidade: 'minutos',
          },
          quantos_sonos: { valor: encerrados.length, unidade: 'contagem' },
        },
      };
    }

    // --- Intervalo: 2 registros ---
    case 'intervalo_entre_ultimos': {
      const lista = doAlvo(eventos, consulta.alvo);
      if (lista.length < 2) {
        return {
          estado: 'sem_dado',
          consulta,
          falta: { motivo: 'poucos_registros', tem: lista.length, precisa: 2 },
        };
      }

      const ultimo = instante(lista[lista.length - 1].ocorridoEm);
      const penultimo = instante(lista[lista.length - 2].ocorridoEm);
      return {
        estado: 'ok',
        consulta,
        numeros: {
          intervalo_minutos: { valor: Math.round((ultimo - penultimo) / 60_000), unidade: 'minutos' },
        },
      };
    }

    // --- Comparação dela com ela ---
    case 'comparar_dias': {
      // Até a MESMA HORA de ontem, e não o dia inteiro: comparar um dia pela
      // metade com um dia completo diria "hoje foi menos" toda manhã. O erro
      // seria invisível e a frase, sempre desanimadora.
      const inicioHoje = inicioDoDiaLocal(ctx.agora, ctx.fusoHorario);
      const inicioOntem = inicioHoje - DIA_MS;
      const decorrido = agora - inicioHoje;

      const primeiro = primeiroRegistro(eventos);
      if (primeiro === null || primeiro > inicioOntem) {
        return { estado: 'sem_dado', consulta, falta: { motivo: 'periodo_incompleto' } };
      }

      const hoje = medirComparavel(eventos, consulta.metrica, inicioHoje, agora + 1);
      const ontem = medirComparavel(eventos, consulta.metrica, inicioOntem, inicioOntem + decorrido);
      const unidade = unidadeDa(consulta.metrica);

      return {
        estado: 'ok',
        consulta,
        numeros: {
          hoje: { valor: hoje, unidade },
          ontem: { valor: ontem, unidade },
          diferenca: { valor: Math.abs(hoje - ontem), unidade },
        },
      };
    }

    case 'comparar_semanas': {
      const inicioEstaSemana = agora - 7 * DIA_MS;
      const inicioSemanaPassada = agora - 14 * DIA_MS;

      // As duas janelas precisam ser inteiras. Comparar 7 dias com 3 dias de
      // histórico diria "dormiu muito mais essa semana" sobre uma semana que
      // simplesmente não existia.
      const primeiro = primeiroRegistro(eventos);
      if (primeiro === null || primeiro > inicioSemanaPassada) {
        return { estado: 'sem_dado', consulta, falta: { motivo: 'periodo_incompleto' } };
      }

      const estaSemana = medirComparavel(eventos, consulta.metrica, inicioEstaSemana, agora + 1);
      const passada = medirComparavel(
        eventos,
        consulta.metrica,
        inicioSemanaPassada,
        inicioEstaSemana
      );
      const unidade = unidadeDa(consulta.metrica);

      return {
        estado: 'ok',
        consulta,
        numeros: {
          esta_semana: { valor: estaSemana, unidade },
          semana_passada: { valor: passada, unidade },
          diferenca: { valor: Math.abs(estaSemana - passada), unidade },
        },
      };
    }

    // --- Padrão: delega ao motor, sem recalcular nada ---
    case 'padrao': {
      const padroes = calcularPadroes(
        {
          mamadas: doAlvo(eventos, 'mamada').map((e) => ({ started_at: e.ocorridoEm })),
          sonos: doAlvo(eventos, 'sono').map((e) => ({
            started_at: e.ocorridoEm,
            ended_at: e.fimEm ?? null,
          })),
        },
        { agora: ctx.agora, fusoHorario: ctx.fusoHorario }
      );

      const metrica: Metrica =
        consulta.metrica === 'intervalo_mamadas'
          ? padroes.intervaloMedioMamadas
          : consulta.metrica === 'duracao_soneca'
            ? padroes.duracaoMediaSoneca
            : padroes.horarioMedioSoneca;

      // `nao_se_aplica` chega aqui como falta de dado de propósito. A diferença
      // entre "ainda não sei" e "sei e não descreve nada" importa para o card
      // escolher outra métrica; para quem PERGUNTOU, as duas terminam no mesmo
      // lugar — a Ninna não tem esse número para dar.
      if (metrica.confianca !== 'suficiente' || metrica.valor === null) {
        return {
          estado: 'sem_dado',
          consulta,
          falta: { motivo: 'poucos_registros', tem: metrica.amostras, precisa: MINIMO_REGISTROS },
        };
      }

      return {
        estado: 'ok',
        consulta,
        numeros: {
          valor: {
            valor: metrica.valor,
            unidade: consulta.metrica === 'horario_soneca' ? 'minutos_do_dia' : 'minutos',
          },
          amostras: { valor: metrica.amostras, unidade: 'contagem' },
        },
      };
    }
  }
}

// ------------------------------------------------------------------
// Hora local — usa o motor, não reimplementa
// ------------------------------------------------------------------

/**
 * Instante da meia-noite local do dia em que `agora` cai.
 *
 * Sai de `minutosDoDiaLocal`, do motor, em vez de um `Intl` próprio: duas
 * implementações de hora local no mesmo projeto divergem no dia em que uma
 * delas for corrigida, e essa é a classe de erro que o R4 descreve.
 */
function inicioDoDiaLocal(agora: Date, fuso: string): number {
  const minutos = minutosDoDiaLocal(agora.toISOString(), fuso) ?? 0;
  return agora.getTime() - minutos * 60_000;
}

// ------------------------------------------------------------------
// A gramática que o modelo recebe — gerada daqui, nunca escrita à mão
// ------------------------------------------------------------------

export const DIAS: Dia[] = ['hoje', 'ontem'];
export const METRICAS_COMPARAVEIS: MetricaComparavel[] = ['sono_total', 'mamadas', 'trocas'];
export const METRICAS_DE_PADRAO: MetricaDePadrao[] = [
  'intervalo_mamadas',
  'duracao_soneca',
  'horario_soneca',
];

/** Que parâmetros cada consulta aceita. Runtime, porque tipo não existe em runtime. */
export const PARAMETROS: Record<NomeConsulta, ('alvo' | 'dia' | 'comparavel' | 'padrao')[]> = {
  ultimo_registro: ['alvo'],
  contagem_do_dia: ['alvo', 'dia'],
  total_sono_do_dia: ['dia'],
  intervalo_entre_ultimos: ['alvo'],
  comparar_dias: ['comparavel'],
  comparar_semanas: ['comparavel'],
  padrao: ['padrao'],
};

/**
 * O prompt e o schema que o modelo recebe, montados a partir do manifesto.
 *
 * Gerar em vez de escrever à mão não é elegância: é o que garante que a
 * gramática e a superfície não divirjam. Consulta nova entra na união de tipos,
 * ganha entrada no `SUPERFICIE`, e aparece aqui sozinha — sem ninguém lembrar de
 * atualizar um texto solto.
 *
 * O modelo faz UMA coisa: escolher a consulta. Ele não vê registro nenhum, não
 * calcula nada e não escreve a resposta — a frase sai de `copyInsight.ts`.
 * É o Desenho B do PRODUTO.md §3.1.
 */
export function gramaticaParaModelo(): { instrucoes: string; schema: Record<string, unknown> } {
  const linhas = NOMES_CONSULTA.map((nome) => {
    const d = SUPERFICIE[nome];
    const params = PARAMETROS[nome];
    const assinatura = params.length === 0 ? '' : ` (${params.join(', ')})`;
    return [
      `- ${nome}${assinatura}: ${d.responde}`,
      `  exemplos: ${d.exemplos.map((e) => `"${e}"`).join(' · ')}`,
    ].join('\n');
  }).join('\n');

  const instrucoes = [
    'Você recebe a pergunta de uma mãe sobre o próprio bebê e escolhe UMA consulta da lista.',
    '',
    'Você NÃO responde a pergunta. Você não tem conhecimento geral nenhum, não tem',
    'acesso a registro nenhum e não escreve texto para a mãe. Sua única saída é a',
    'consulta escolhida.',
    '',
    'CONSULTAS DISPONÍVEIS',
    linhas,
    '',
    'PARÂMETROS',
    `- alvo: ${ALVOS.join(' | ')}`,
    `- dia: ${DIAS.join(' | ')}`,
    `- comparavel: ${METRICAS_COMPARAVEIS.join(' | ')}`,
    `- padrao: ${METRICAS_DE_PADRAO.join(' | ')}`,
    '',
    'QUANDO NÃO ESCOLHER NENHUMA',
    '- Pergunta sobre saúde, sintoma, febre, remédio, se algo é normal, se deve procurar',
    '  atendimento, ou qualquer avaliação clínica: responda {"fora": "saude"}.',
    '  Isso vale mesmo que a pergunta pareça simples. Não existe consulta que avalie nada.',
    '- Qualquer outra coisa que não caiba na lista: responda {"fora": "desconhecida"}.',
    '',
    'Na dúvida entre uma consulta e "fora", escolha "fora".',
  ].join('\n');

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      nome: { type: 'string', enum: NOMES_CONSULTA },
      alvo: { type: 'string', enum: ALVOS },
      dia: { type: 'string', enum: DIAS },
      metrica: {
        type: 'string',
        enum: [...METRICAS_COMPARAVEIS, ...METRICAS_DE_PADRAO],
      },
      fora: { type: 'string', enum: ['saude', 'desconhecida'] },
    },
    required: [],
  };

  return { instrucoes, schema };
}

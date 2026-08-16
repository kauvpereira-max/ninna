/**
 * As regras e a copy das notificações — módulo PURO.
 *
 * ------------------------------------------------------------------
 * ⚠️ SÃO DUAS, E NENHUMA DELAS É RETENÇÃO
 *
 * Decidido em 16/08/2026, e registrado no `PRODUTO.md` §3.2 porque a tentação
 * volta: o bloco entrou na fila como resposta a "a mãe registra dois dias e
 * esquece o app", e **a solução não segue do diagnóstico**.
 *
 * A notificação de retenção do mercado é "você não registrou nada hoje". Isso é
 * culpa, e culpa é o que o tom deste app proíbe — não é redação a ajustar, é a
 * categoria inteira. E "está na hora da mamada" é previsão e prescrição sobre um
 * motor que só descreve o passado.
 *
 * O que sobra é honesto e raro:
 *
 * | `sono_aberto`  | fato sobre o ESTADO DO APP, não sobre o bebê |
 * | `padrao_novo`  | a promessa do produto se cumprindo — 3 vezes na vida da conta |
 *
 * **A retenção depende de o produto ter valor de uso diário, não de avisar mais.**
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO É MÓDULO PURO
 *
 * Porque a decisão de enviar é regra, e regra sem teste é intenção. Este arquivo
 * não importa `./supabase` e roda no Node — quem envia é a Edge Function, que lê
 * daqui em vez de reimplementar. Duas cópias divergiriam no primeiro ajuste de
 * horário que só uma recebesse.
 */

import type { MetricaDePadrao } from './consultas.ts';

export type TipoDeAviso = 'sono_aberto' | 'padrao_novo';

/** O que a Edge Function manda ao service worker. */
export type Aviso = {
  titulo: string;
  corpo: string;
  url: string;
  /** Colapsa repetidos: dois avisos do mesmo sono viram um. */
  tag: string;
};

// ------------------------------------------------------------------
// O silêncio noturno
// ------------------------------------------------------------------
//
// ⚠️ Ela ESTÁ acordada às 3h — e é exatamente por isso que o telefone não pode
// vibrar. A mãe de recém-nascido não está dormindo; está no meio de uma mamada,
// com o bebê no colo, no escuro. Uma notificação nesse momento não informa nada
// que não possa esperar, e interrompe o único trabalho que importa ali.
//
// Nada é enfileirado para depois: quem decide é o agendador, no momento do envio,
// olhando a condição de novo. Aviso guardado é aviso que chega quando já não é
// verdade — "o sono ainda está correndo" às 8h, sobre um sono encerrado às 6h.

export const SILENCIO_COMECA = 21;
export const SILENCIO_TERMINA = 8;

/** `hora` é a hora local da mãe, 0–23. */
export function dentroDoSilencio(hora: number): boolean {
  return hora >= SILENCIO_COMECA || hora < SILENCIO_TERMINA;
}

// ------------------------------------------------------------------
// Os tetos
// ------------------------------------------------------------------
//
// `padrao_novo` tem teto diário de UM. Ele acontece três vezes na vida da conta;
// o teto existe para o caso de o motor oscilar na fronteira dos 5 registros e
// atravessar a mesma métrica duas vezes no mesmo dia.
//
// `sono_aberto` NÃO entra no teto diário, e é a única exceção. Ele é o único
// sensível a tempo — segurá-lo por causa de outro aviso do mesmo dia seria
// segurar justamente o que tem prazo. Em troca, ele é limitado por SONO: uma vez
// por registro, nunca duas.

export const TETO_DIARIO_PADRAO = 1;

export type Estado = {
  /** Hora local da mãe, 0–23. */
  hora: number;
  /** Quantos `padrao_novo` já saíram hoje. */
  padroesHoje: number;
  /** Ids de sono que já foram avisados. */
  sonosAvisados: string[];
};

export type Pedido =
  | { tipo: 'sono_aberto'; sonoId: string; horaDeInicio: string }
  | { tipo: 'padrao_novo'; metrica: MetricaDePadrao; nome: string };

/** Por que um aviso não sai. `null` quer dizer que sai. */
export type Impedimento = 'silencio' | 'teto' | 'ja_avisado';

export function impedimentoDoAviso(pedido: Pedido, estado: Estado): Impedimento | null {
  // O silêncio vem primeiro, e vale para os dois: nem o sono em aberto justifica
  // acordar alguém. O sono continua em aberto às 8h, e o registro é editável —
  // o valor do aviso é fazer a mãe CORRIGIR, não impedir. Isso espera.
  if (dentroDoSilencio(estado.hora)) return 'silencio';

  if (pedido.tipo === 'sono_aberto') {
    return estado.sonosAvisados.includes(pedido.sonoId) ? 'ja_avisado' : null;
  }

  return estado.padroesHoje >= TETO_DIARIO_PADRAO ? 'teto' : null;
}

// ------------------------------------------------------------------
// A copy
// ------------------------------------------------------------------
//
// Passa nas mesmas varreduras da copy do app: sem pronome de gênero, sem plural
// de população, sem faixa etária, sem adjetivo de adequação.
//
// ⚠️ O NOME DO BEBÊ APARECE EM `padrao_novo` E NÃO EM `sono_aberto`, e a
// diferença é deliberada: o primeiro é sobre o bebê dela e o nome é o que o torna
// dela; o segundo é sobre o estado do app, e o nome ali não acrescentaria nada
// além de exposição na tela de bloqueio.

const FRASES_DE_PADRAO: Record<MetricaDePadrao, (nome: string) => string> = {
  intervalo_mamadas: (nome) => `Já dá pra ver o intervalo entre as mamadas de ${nome}.`,
  duracao_soneca: (nome) => `Já dá pra ver quanto duram as sonecas de ${nome}.`,
  horario_soneca: (nome) => `Já dá pra ver que horas ${nome} costuma pegar no sono.`,
};

export function montarAviso(pedido: Pedido): Aviso {
  if (pedido.tipo === 'sono_aberto') {
    return {
      titulo: 'Sono em aberto',
      // Sem "esqueceu", sem "você não". O fato, e a mãe decide o que fazer com
      // ele — inclusive nada, se o bebê está mesmo dormindo desde então.
      corpo: `O sono que começou às ${pedido.horaDeInicio} ainda está correndo.`,
      url: '/rotina',
      tag: `sono-${pedido.sonoId}`,
    };
  }

  return {
    titulo: 'A Ninna já tem o ritmo',
    corpo: FRASES_DE_PADRAO[pedido.metrica](pedido.nome),
    url: '/',
    tag: `padrao-${pedido.metrica}`,
  };
}

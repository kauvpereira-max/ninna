/**
 * O validador de ancoragem — prova que a frase não inventou número.
 *
 * A superfície de consulta garante que o assistente só *pergunte* coisas sobre
 * este bebê. Ela não garante que a frase *diga* o que o motor calculou: entre o
 * número e o texto existe um modelo, e modelo erra magnitude. Dizer "faz 3h20"
 * quando o motor calculou 2h40 é a falha mais provável do Desenho A, e ela passa
 * despercebida — a frase fica plausível, o tom fica certo, e o número está
 * errado.
 *
 * ------------------------------------------------------------------
 * COMO FUNCIONA: TIRA O QUE FOI AUTORIZADO, OLHA O QUE SOBROU
 *
 * Para cada número que o motor devolveu, geram-se as formas em que ele pode
 * aparecer escrito — dígitos, "2h40", "duas horas e meia", "meio-dia e meia".
 * Todas são removidas do texto, da mais longa para a mais curta. Se depois
 * disso ainda sobrar um algarismo ou uma palavra de número, essa quantidade não
 * veio do motor.
 *
 * O caminho contrário — procurar o número certo no texto — não pega nada: uma
 * frase que diz 2h40 E 3h20 passaria, porque o número certo está lá.
 *
 * ------------------------------------------------------------------
 * O QUE ELE NÃO PEGA, E É PRECISO SABER
 *
 * Ele valida MAGNITUDE, não RÓTULO. "As sonecas duram cerca de duas horas"
 * quando o número era o intervalo entre mamadas passa aqui — o número é o
 * autorizado, a frase é que o pendurou na coisa errada. Trocar rótulo é erro do
 * Desenho A; no Desenho B a frase sai de `copyInsight.ts`, e o rótulo vem do
 * mesmo lugar que o número.
 */

import { formatarDuracao, formatarHorario, formatarIntervalo } from './copyInsight.ts';
import type { NumeroAncorado, Unidade } from './consultas.ts';

export type ProblemaAncoragem = {
  tipo: 'numero_nao_autorizado';
  /** O que sobrou depois de remover tudo que o motor autorizou. */
  trecho: string;
};

/**
 * Palavras que só aparecem em português para dizer quantidade.
 *
 * `um`/`uma` ficam DE FORA de propósito: em "uma mamada" são artigo, não número,
 * e incluí-los reprovaria toda frase bem escrita. A troca é consciente — o
 * validador deixa passar uma alucinação que diga exatamente "uma hora" onde o
 * motor disse outra coisa, e em troca não gera falso positivo em nenhuma frase
 * correta. Falso positivo desliga validador; buraco estreito, não.
 */
const PALAVRAS_DE_NUMERO = [
  'meia-noite',
  'meio-dia',
  'quarenta e cinco',
  'cinquenta',
  'quarenta',
  'trinta',
  'vinte',
  'quinze',
  'dez',
  'nove',
  'oito',
  'sete',
  'seis',
  'cinco',
  'quatro',
  'três',
  'duas',
  'dois',
  'meia',
  'meio',
];

const arredondar = (m: number, passo: number) => Math.round(m / passo) * passo;

/** "160" → ["2h40", "2h 40min", "160"] — as formas em dígitos de uma duração. */
function formasEmDigitos(minutos: number): string[] {
  const formas = new Set<string>([String(minutos)]);
  for (const passo of [1, 5, 15, 30]) {
    const m = arredondar(minutos, passo);
    const horas = Math.floor(m / 60);
    const resto = m % 60;
    formas.add(String(m));
    if (horas > 0) {
      formas.add(`${horas}h`);
      if (resto > 0) {
        formas.add(`${horas}h${resto}`);
        formas.add(`${horas}h${String(resto).padStart(2, '0')}`);
        formas.add(`${horas}h ${resto}min`);
        formas.add(`${horas}h${resto}min`);
      }
    } else if (m > 0) {
      formas.add(`${m}min`);
      formas.add(`${m} min`);
    }
  }
  return [...formas];
}

/** Todas as escritas aceitáveis de um número, dada a unidade dele. */
export function formasAutorizadas(numero: NumeroAncorado): string[] {
  const { valor, unidade } = numero;
  const formas = new Set<string>();

  const adicionar = (s: string) => {
    if (s.trim().length > 0) formas.add(s);
  };

  if (unidade === 'contagem') {
    adicionar(String(valor));
    // Contagem pequena costuma ser escrita por extenso.
    const extenso = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
    if (valor >= 0 && valor < extenso.length) adicionar(extenso[valor]);
    return [...formas];
  }

  if (unidade === 'minutos_do_dia') {
    // As duas escritas são legítimas, e por motivos diferentes: o padrão
    // arredonda ("por volta de 13h", que é o que o "por volta de" compra), o
    // recall não ("a última mamada foi às 14h20" — arredondar aqui seria mentir
    // sobre um instante que a mãe pode conferir na lista).
    adicionar(formatarHorario(valor));
    for (const total of [valor % 1440, arredondar(valor, 30) % 1440]) {
      const hora = Math.floor(total / 60);
      const minuto = total % 60;
      adicionar(`${hora}h`);
      if (minuto > 0) {
        adicionar(`${hora}h${minuto}`);
        adicionar(`${hora}h${String(minuto).padStart(2, '0')}`);
      }
    }
    adicionar(String(valor));
    return [...formas];
  }

  // minutos
  for (const forma of formasEmDigitos(valor)) adicionar(forma);
  adicionar(formatarDuracao(valor));
  adicionar(formatarIntervalo(valor));
  return [...formas];
}

/**
 * `escapar` porque as formas entram numa regex, e "2h40" é inofensivo mas
 * `formatarDuracao` pode devolver algo com parêntese um dia.
 */
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function validarAncoragem(
  texto: string,
  numeros: Record<string, NumeroAncorado>
): ProblemaAncoragem[] {
  const autorizadas = Object.values(numeros)
    .flatMap(formasAutorizadas)
    // Da mais longa para a mais curta: sem isso, remover "cinco" antes de
    // "quarenta e cinco" deixa "quarenta e " no texto e reprova a frase certa.
    .sort((a, b) => b.length - a.length);

  let resto = texto.toLowerCase();
  for (const forma of autorizadas) {
    resto = resto.replace(new RegExp(escapar(forma.toLowerCase()), 'g'), ' ');
  }

  const problemas: ProblemaAncoragem[] = [];

  const digitos = resto.match(/\d+/g);
  if (digitos) {
    for (const d of digitos) problemas.push({ tipo: 'numero_nao_autorizado', trecho: d });
  }

  for (const palavra of PALAVRAS_DE_NUMERO) {
    if (new RegExp(`(^|[^a-zà-ú])${escapar(palavra)}([^a-zà-ú]|$)`, 'i').test(resto)) {
      problemas.push({ tipo: 'numero_nao_autorizado', trecho: palavra });
    }
  }

  return problemas;
}

/** Atalho para o caminho de produção: ou a frase está ancorada, ou não sai. */
export function estaAncorada(texto: string, numeros: Record<string, NumeroAncorado>): boolean {
  return validarAncoragem(texto, numeros).length === 0;
}

export type { NumeroAncorado, Unidade };

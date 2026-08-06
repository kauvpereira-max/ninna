// O extrator compartilhado das varreduras de copy.
//
//   teste-copy-telas.ts     → gênero
//   teste-linguagem-media.ts → tese (PRODUTO.md §0)
//
// POR QUE UM MÓDULO E NÃO DUAS CÓPIAS
//
// As duas varreduras precisam da mesma resposta para "o que neste arquivo é
// texto que a mãe lê?". Duas implementações divergem no dia em que uma delas for
// corrigida — e a que ficar para trás passa a varrer menos achando que varre
// tudo, que é exatamente a falha que a primeira versão do teste-copy-telas teve
// (111 trechos em vez de 355, com a violação real dentro do que ela pulava).
//
// Este arquivo não tem regra nenhuma sobre o conteúdo do texto. Ele só decide o
// que é texto. As regras moram em cada teste.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const RAIZ = join(import.meta.dirname, '..');
export const PASTAS_DE_COPY = ['app', 'src'];

export type Achado = { arquivo: string; linha: number; texto: string; tipo: 'literal' | 'jsx' };

function arquivosDe(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDe(caminho));
      continue;
    }
    if (/\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

/**
 * Percorre caractere a caractere em vez de usar regex numa passada só porque
 * comentário e string se confundem: `'https://...'` tem `//` dentro, e um
 * comentário pode conter aspas. Errar isso faria a varredura ler comentário
 * (cheio de prosa sobre a mãe e sobre médias) e ignorar string de verdade.
 */
export function extrair(fonte: string, arquivo: string): Achado[] {
  const achados: Achado[] = [];
  let i = 0;
  let linha = 1;

  while (i < fonte.length) {
    const c = fonte[i];

    if (c === '\n') {
      linha++;
      i++;
      continue;
    }

    if (c === '/' && fonte[i + 1] === '/') {
      while (i < fonte.length && fonte[i] !== '\n') i++;
      continue;
    }

    if (c === '/' && fonte[i + 1] === '*') {
      i += 2;
      while (i < fonte.length && !(fonte[i] === '*' && fonte[i + 1] === '/')) {
        if (fonte[i] === '\n') linha++;
        i++;
      }
      i += 2;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const aspas = c;
      const inicio = linha;
      let texto = '';
      i++;
      while (i < fonte.length && fonte[i] !== aspas) {
        if (fonte[i] === '\\') {
          texto += fonte[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (fonte[i] === '\n') linha++;
        texto += fonte[i];
        i++;
      }
      i++;
      if (pareceCopy(texto)) achados.push({ arquivo, linha: inicio, texto, tipo: 'literal' });
      continue;
    }

    // Texto solto de JSX: o que vem entre `>` e `<` sem ser código.
    //
    // Espia sem consumir — e isso não é detalhe. Consumindo, todo `=>` de arrow
    // function viraria início de captura e engoliria o código até o próximo `<`,
    // com as strings de dentro junto.
    if (c === '>') {
      const fim = fonte.indexOf('<', i + 1);
      if (fim > i) {
        const limpo = fonte.slice(i + 1, fim).replace(/\s+/g, ' ').trim();
        if (pareceCopyJsx(limpo)) achados.push({ arquivo, linha, texto: limpo, tipo: 'jsx' });
      }
      i++;
      continue;
    }

    i++;
  }

  return achados;
}

/** Corta nome de estilo, chave, rota e classe: copy tem espaço e palavra inteira. */
export function pareceCopy(texto: string): boolean {
  const t = texto.trim();
  if (t.includes('://') || t.startsWith('/') || t.startsWith('.')) return false;
  if (/[_\d]/.test(t)) return false;
  if (!/[a-zà-ú]{3}/i.test(t)) return false;
  if (/ /.test(t) && t.length >= 6) return true;

  // Copy de uma palavra só existe, e é justamente onde o gênero se esconde:
  // rótulo de chip e de botão. O que separa rótulo de valor de prop do React
  // Native é a maiúscula ou o acento — `portrait`, `none` e `words` são
  // minúsculos e secos.
  return /^[A-ZÀ-Ú]/.test(t) || /[à-úÀ-Ú]/.test(t);
}

/**
 * O mesmo para texto de JSX, que é mais barulhento: entre `>` e `<` também cai
 * pedaço de código (`) : (`, `=> setX(true)}`). Pontuação de código reprova —
 * prosa não tem parêntese nem ponto e vírgula.
 */
export function pareceCopyJsx(texto: string): boolean {
  if (texto.length < 8) return false;
  if (/[()[\];:/\\|&$#=`]/.test(texto)) return false;
  if (!/[a-zà-ú]{3}/i.test(texto)) return false;
  return texto.split(' ').filter((p) => /[a-zà-ú]{2}/i.test(p)).length >= 2;
}

/** Todos os trechos de copy do app, prontos para uma varredura aplicar suas regras. */
export function varrerCopy(pastas: string[] = PASTAS_DE_COPY): Achado[] {
  const achados: Achado[] = [];
  for (const pasta of pastas) {
    for (const caminho of arquivosDe(join(RAIZ, pasta))) {
      achados.push(...extrair(readFileSync(caminho, 'utf8'), relative(RAIZ, caminho)));
    }
  }
  return achados;
}

/**
 * Prova de que o extrator enxerga o que diz enxergar.
 *
 * Chamada pelas duas varreduras antes de varrer, porque varredura que não acha
 * nada tem dois significados — a copy está limpa, ou o extrator quebrou.
 */
export function provarExtrator(): string[] {
  const falhas: string[] = [];

  if (!extrair('<Text>Olá, tudo certo por aqui</Text>', 'prova.tsx').length) {
    falhas.push('o extrator não enxerga texto solto de JSX');
  }
  if (!extrair('const x = "Conta pra mim como seu bebê se chama.";', 'prova.tsx').length) {
    falhas.push('o extrator não enxerga string literal');
  }
  if (extrair('// comentário sobre ela, a mãe, e sobre a média\n', 'prova.tsx').length) {
    falhas.push('o extrator está varrendo comentário — vai reprovar prosa de código');
  }

  return falhas;
}

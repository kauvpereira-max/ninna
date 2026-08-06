// Varredura de gênero na copy das TELAS — o irmão do teste-copy-insight.
//
//   node scripts/teste-copy-telas.ts            roda a verificação
//   node scripts/teste-copy-telas.ts --listar    mostra tudo que foi varrido
//
// POR QUE ESTE ARQUIVO EXISTE
//
// O `teste-copy-insight.ts` prova que nenhuma frase do card tem gênero. Isso
// cobre `copyInsight.ts` e mais nada — e a violação que foi ao ar em produção
// não estava no card: estava no subtítulo do login ("a rotina dela"), escrito
// meses antes do motor existir. O teste mais rigoroso do projeto vigiava o
// arquivo mais recente.
//
// A regra (BETA.md §7.4 P4, CLAUDE.md): `sex` é nullable e opcional no cadastro.
// O app frequentemente NÃO SABE o gênero do bebê — então nenhum texto pode
// escolher um. Nem pronome, nem artigo antes do nome.
//
// O QUE ELE NÃO CONSEGUE FAZER, E POR ISSO EXISTE A LISTA DE EXCEÇÕES
//
// "ela" na copy pode ser a MÃE (que é sempre ela, e falar com ela no feminino é
// correto), pode ser o registro apagado, pode ser o pediatra. Nenhuma varredura
// resolve referência de pronome — quem resolve é quem escreve. Então o teste
// reprova TODO pronome com gênero e obriga a exceção a ser declarada em
// `PERMITIDOS`, com o motivo escrito. Frase nova com "ela" falha até alguém
// dizer por escrito a quem esse "ela" se refere.
//
// É de propósito que a exceção seja o texto exato: reescreveu a frase, o teste
// volta a perguntar. Uma frase sobre a mãe vira uma frase sobre o bebê com uma
// palavra de diferença.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const PASTAS = ['app', 'src'];

// ------------------------------------------------------------------
// Coleta: o que é texto que a mãe lê, e o que é código
// ------------------------------------------------------------------

type Achado = { arquivo: string; linha: number; texto: string; tipo: 'literal' | 'jsx' };

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
 * comentário pode conter aspas. Errar isso faria o teste varrer comentário
 * (cheio de "ela" falando da mãe) e ignorar string de verdade.
 */
function extrair(fonte: string, arquivo: string): Achado[] {
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
    // com as strings de dentro junto. Foi assim que a primeira versão deste
    // teste varreu 111 trechos achando que tinha varrido as telas: metade da
    // copy estava dentro do que ele pulava, incluindo a linha do login que
    // motivou o arquivo.
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
function pareceCopy(texto: string): boolean {
  const t = texto.trim();
  if (t.includes('://') || t.startsWith('/') || t.startsWith('.')) return false;
  if (/[_\d]/.test(t)) return false;
  if (!/[a-zà-ú]{3}/i.test(t)) return false;
  if (/ /.test(t) && t.length >= 6) return true;

  // Copy de uma palavra só existe, e é justamente onde o gênero se esconde:
  // rótulo de chip e de botão. Exigir espaço deixaria "Menina" fora da
  // varredura. O que separa rótulo de valor de prop do React Native é a
  // maiúscula ou o acento — `portrait`, `none` e `words` são minúsculos e secos.
  return /^[A-ZÀ-Ú]/.test(t) || /[à-úÀ-Ú]/.test(t);
}

/**
 * O mesmo para texto de JSX, que é mais barulhento: entre `>` e `<` também cai
 * pedaço de código (`) : (`, `=> setX(true)}`). Pontuação de código reprova —
 * prosa não tem parêntese nem ponto e vírgula.
 */
function pareceCopyJsx(texto: string): boolean {
  if (texto.length < 8) return false;
  if (/[()[\];:/\\|&$#=`]/.test(texto)) return false;
  if (!/[a-zà-ú]{3}/i.test(texto)) return false;
  return texto.split(' ').filter((p) => /[a-zà-ú]{2}/i.test(p)).length >= 2;
}

// ------------------------------------------------------------------
// As regras
// ------------------------------------------------------------------

/**
 * `alvo` existe por causa do falso positivo que apareceu na primeira rodada:
 * "de 1 a ${MAX_DURACAO_MIN}" tem "a" antes de interpolação e está correto — é
 * preposição, não artigo. O que a regra proíbe é artigo antes do NOME, então a
 * expressão interpolada precisa ser o nome do bebê para a violação existir.
 * Sem isso o teste vira barulho, e teste barulhento é desligado.
 */
const REGRAS: { nome: string; padrao: RegExp; alvo?: RegExp; explica: string }[] = [
  {
    nome: 'pronome com gênero',
    padrao: /\b(ele|ela|eles|elas|dele|dela|deles|delas|nele|nela)\b/i,
    explica: 'o app não sabe o gênero do bebê — descreva sem pronome',
  },
  {
    nome: 'artigo de gênero antes do nome',
    // `\s*` e o `d` sozinho cobrem a forma colada — `d${nome}` —, que é como o
    // erro chega de verdade: ninguém escreve "da Liz" à mão, escreve o artigo
    // grudado na interpolação e não relê.
    padrao: /\b(?:[ao]s?|d[ao]?s?|n[ao]?s?|pel[ao]s?|a[ao]s?)\s*\$?\{\s*([^}]+?)\s*\}/gi,
    alvo: /(^|[^a-z])(nome|name|n)([^a-z]|$)/i,
    explica: '"a rotina de Liz", nunca "d{a/o} Liz"',
  },
  {
    // O jeito mais tentador de "resolver" o gênero: consultar `sex` e escolher a
    // palavra. Não resolve — `sex` é nullable, e a mãe que não preencheu recebe
    // o ramo errado sem que nada avise.
    nome: 'gênero decidido em código a partir de sex',
    padrao: /\$?\{[^}]*\bsex[oe]?\b[^}]*\?/i,
    explica: 'sex é opcional: não existe ramo certo quando ele é null',
  },
  {
    nome: 'palavra que escolhe o gênero do bebê',
    padrao: /\b(filh[oa]s?|menin[oa]s?|garot[oa]s?|beb[êe]zinh[oa])\b/i,
    explica: 'use "bebê" ou o nome cadastrado',
  },
  {
    nome: 'gênero entre parênteses ou barra',
    padrao: /\([oa]s?\)|\b[oa]\/[oa]\b/i,
    explica: '"agitado(a)" não resolve: vira substantivo ("Agitação")',
  },
];

/**
 * Exceção precisa do texto exato e do motivo. `arquivo` é prefixo do caminho
 * para o teste não quebrar com a barra do Windows.
 */
const PERMITIDOS: { arquivo: string; texto: string; porque: string }[] = [
  {
    arquivo: 'app/(onboarding)/cadastro-bebe.tsx',
    texto: 'Menina',
    porque:
      'é a opção do campo `sex` — o único lugar onde o app PERGUNTA o gênero, em vez de presumir. E segue opcional.',
  },
  {
    arquivo: 'app/(onboarding)/cadastro-bebe.tsx',
    texto: 'Menino',
    porque: 'idem — a outra opção do mesmo campo.',
  },
  {
    arquivo: 'app/registro/[tipo].tsx',
    texto:
      'Anotado. Se você estiver preocupada com isso, confie no seu instinto e fale com o pediatra — o Ninna acompanha, mas quem examina é ele.',
    porque:
      'o "ele" é o PEDIATRA. Copy de saúde travada em CLAUDE.md — não se reescreve por varredura.',
  },
];

function permitido(achado: Achado): boolean {
  const arquivo = achado.arquivo.replace(/\\/g, '/');
  const texto = achado.texto.replace(/\s+/g, ' ').trim();
  return PERMITIDOS.some((p) => arquivo.endsWith(p.arquivo) && texto === p.texto.replace(/\s+/g, ' ').trim());
}

// ------------------------------------------------------------------
// Execução
// ------------------------------------------------------------------

const achados: Achado[] = [];
for (const pasta of PASTAS) {
  for (const caminho of arquivosDe(join(RAIZ, pasta))) {
    achados.push(...extrair(readFileSync(caminho, 'utf8'), relative(RAIZ, caminho)));
  }
}

if (process.argv.includes('--listar')) {
  for (const a of achados) {
    console.log(`${a.arquivo}:${a.linha} [${a.tipo}] ${a.texto}`);
  }
  console.log(`\n${achados.length} trechos varridos.`);
  process.exit(0);
}

let falhas = 0;

// ------------------------------------------------------------------
// Prova das regras — antes de varrer as telas
// ------------------------------------------------------------------
//
// Uma varredura que não acha nada tem dois significados: a copy está limpa, ou
// o extrator quebrou e varreu o vazio. Já aconteceu neste arquivo — a primeira
// versão engolia código no ramo do JSX e passava com metade das telas fora.
// Então o teste primeiro se prova capaz de reprovar.

const DEVE_REPROVAR = [
  'Entra pra continuar acompanhando a rotina dela',
  'Vamos ver a rotina da ${nome} hoje',
  'O sono d${bebeAtivo.name} costuma começar cedo',
  'Como você chama ele ou ela',
  'Seu filho dormiu bem',
  'Ele está agitado(a) hoje',
  "Bem-vind${sexo === 'F' ? 'a' : 'o'} de volta",
];

const DEVE_PASSAR = [
  'Entra pra continuar acompanhando a rotina do seu bebê',
  'A rotina de ${nome} nos últimos dias',
  'Duração em minutos, de 1 a ${MAX_DURACAO_MIN}.',
  'Pelos últimos dias, as mamadas de ${n} têm ficado a ${formatarIntervalo(v)} uma da outra.',
  'Bem-vinda de volta',
  'Já registrei — pode conferir na aba Rotina.',
];

for (const texto of DEVE_REPROVAR) {
  const pega = REGRAS.some((r) => viola(r, texto));
  if (!pega) {
    falhas++;
    console.log(`[ FALHA] a regra deixou passar o que ela existe pra pegar: "${texto}"`);
  }
}

for (const texto of DEVE_PASSAR) {
  const regra = REGRAS.find((r) => viola(r, texto));
  if (regra) {
    falhas++;
    console.log(`[ FALHA] falso positivo em "${texto}" — regra "${regra.nome}"`);
  }
}

if (!extrair('<Text>Olá, tudo certo por aqui</Text>', 'prova.tsx').length) {
  falhas++;
  console.log('[ FALHA] o extrator não enxerga texto solto de JSX');
}
if (!extrair('const x = "Conta pra mim como seu bebê se chama.";', 'prova.tsx').length) {
  falhas++;
  console.log('[ FALHA] o extrator não enxerga string literal');
}
if (extrair('// comentário sobre ela, a mãe\n', 'prova.tsx').length) {
  falhas++;
  console.log('[ FALHA] o extrator está varrendo comentário — vai reprovar prosa de código');
}

const usadas = new Set<string>();

function viola(regra: (typeof REGRAS)[number], texto: string): boolean {
  if (!regra.alvo) return new RegExp(regra.padrao.source, 'i').test(texto);
  // Com `alvo`, não basta casar: o que foi interpolado tem que ser o nome.
  const varredura = new RegExp(regra.padrao.source, 'gi');
  for (const m of texto.matchAll(varredura)) {
    if (regra.alvo.test(m[1] ?? '')) return true;
  }
  return false;
}

for (const a of achados) {
  for (const regra of REGRAS) {
    if (!viola(regra, a.texto)) continue;
    if (permitido(a)) {
      usadas.add(a.texto.replace(/\s+/g, ' ').trim());
      continue;
    }
    falhas++;
    console.log(`[ FALHA] ${a.arquivo}:${a.linha} — ${regra.nome}`);
    console.log(`         "${a.texto}"`);
    console.log(`         ${regra.explica}`);
  }
}

// Exceção que não é mais alcançada virou permissão órfã: some da lista, senão
// ela passa a autorizar em silêncio uma frase que ninguém escreveu ainda.
for (const p of PERMITIDOS) {
  if (usadas.has(p.texto.replace(/\s+/g, ' ').trim())) continue;
  falhas++;
  console.log(`[ FALHA] exceção sem uso em PERMITIDOS — ${p.arquivo}`);
  console.log(`         "${p.texto}"`);
  console.log('         a frase mudou ou saiu: reveja o motivo e ajuste ou apague a exceção');
}

const arquivosVarridos = new Set(achados.map((a) => a.arquivo)).size;
console.log(
  `\n${falhas === 0 ? 'Copy das telas sem gênero' : `${falhas} violação(ões)`} — ${achados.length} trechos em ${arquivosVarridos} arquivos.`
);

process.exit(falhas === 0 ? 0 : 1);

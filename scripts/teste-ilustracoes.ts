// A tabela de ilustrações — `src/theme/ilustracoes.ts`.
//
//   node scripts/teste-ilustracoes.ts
//
// POR QUE ESTE ARQUIVO EXISTE
//
// A tabela liga tipo de registro a PNG, e erra de três jeitos que nenhum dos
// três do fechamento pega:
//
//   - arquivo renomeado ou ausente: o `tsc` não abre o disco, e só o
//     `expo export` reclama — depois de dois minutos de build;
//   - tipo sem ilustração: cai na silhueta em SILÊNCIO. Isso é o desenho, mas
//     ninguém distingue "de propósito" de "esqueceram", e a tela fica com um
//     ícone de outra época sem nada avisar;
//   - mapeamento trocado: fralda apontando para o PNG do banho compila, exporta,
//     e desenha a coisa errada — que é exatamente o defeito que já passou por
//     aqui uma vez, com os paths do `D`.
//
// A terceira é a que dói, então o teste não confere só "existe": confere contra
// o `PHOTO_ID` do PRÓPRIO PROTÓTIPO, que é a origem do mapeamento.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let falhas = 0;

function conferir(nome: string, ok: boolean, detalhe?: string) {
  if (ok) return;
  falhas++;
  console.log(`[ FALHA] ${nome}${detalhe ? `\n         ${detalhe}` : ''}`);
}

// ------------------------------------------------------------------
// O extrator, provado antes de extrair
// ------------------------------------------------------------------
//
// A varredura vazia é o modo de falha desta casa: um regex que deixa de casar
// devolve "0 divergências" com a mesma cara de "tudo certo". Já aconteceu duas
// vezes só nesta sessão — o `head -3` truncado e a comparação de paths que
// passou com zero paths lidos.

function extrairTabela(fonte: string): Record<string, string> {
  const tabela: Record<string, string> = {};
  for (const m of fonte.matchAll(/^\s{2}([a-z]+):\s*require\('([^']+)'\)/gm)) {
    tabela[m[1]] = m[2];
  }
  return tabela;
}

{
  const amostra = [
    'export const ILUSTRACAO = {',
    "  fralda: require('../../assets/icones/ic-diaper.png'),",
    "  sono: require('../../assets/icones/ic-moon.png'),",
    '};',
  ].join('\n');
  const provado = extrairTabela(amostra);
  conferir('o extrator lê uma tabela conhecida', Object.keys(provado).length === 2, JSON.stringify(provado));
  conferir('o extrator lê o caminho, não só a chave', provado.fralda === '../../assets/icones/ic-diaper.png');
  conferir(
    'o extrator ignora require que não é da tabela',
    Object.keys(extrairTabela("const x = require('outro.png');")).length === 0,
  );
}

// ------------------------------------------------------------------

const fonte = fs.readFileSync(path.join(raiz, 'src/theme/ilustracoes.ts'), 'utf8');
const ILUSTRACAO = extrairTabela(fonte);

conferir('a tabela não veio vazia', Object.keys(ILUSTRACAO).length > 0, 'o regex deixou de casar — nada foi conferido');
if (Object.keys(ILUSTRACAO).length === 0) process.exit(1);

// 1. Todo arquivo apontado existe, e é PNG de verdade.
for (const [tipo, rel] of Object.entries(ILUSTRACAO)) {
  const arq = path.resolve(raiz, 'src/theme', rel);
  if (!fs.existsSync(arq)) {
    conferir(`o PNG de "${tipo}" existe`, false, rel);
    continue;
  }
  const assinatura = fs.readFileSync(arq).subarray(1, 4).toString('ascii');
  conferir(`o arquivo de "${tipo}" é PNG`, assinatura === 'PNG', `${rel} começa com "${assinatura}"`);
}

// 2. Todo tipo do app está coberto — ou declarado ausente aqui, com motivo.
//
// A lista é curta de propósito: ela é o lugar onde "não tem ilustração" para de
// ser silêncio e vira uma frase que alguém escreveu.
const SEM_ILUSTRACAO: Record<string, string> = {};

const tiposDoApp = [
  ...fs
    .readFileSync(path.join(raiz, 'src/theme/categorias.ts'), 'utf8')
    .matchAll(/key: '([a-z]+)'/g),
].map((m) => m[1]);

conferir('achei os tipos em categorias.ts', tiposDoApp.length >= 19, `achei ${tiposDoApp.length}`);

for (const tipo of tiposDoApp) {
  if (ILUSTRACAO[tipo]) continue;
  conferir(
    `"${tipo}" tem ilustração ou ausência declarada`,
    tipo in SEM_ILUSTRACAO,
    'cai na silhueta. Se for de propósito, escreva o motivo em SEM_ILUSTRACAO',
  );
}

for (const tipo of Object.keys(ILUSTRACAO)) {
  conferir(`"${tipo}" da tabela é um tipo de registro`, tiposDoApp.includes(tipo), 'sobrou da tabela ou o tipo saiu');
}

// 3. ⚠️ O MAPEAMENTO É O DO PROTÓTIPO — a conferência que importa.
//
// Existir e ser PNG não impede fralda de apontar para o desenho do banho. Estes
// pares são o `PHOTO_ID` + `PHOTO_SRC` do protótipo, transcritos; se alguém
// trocar dois, o teste reprova antes de a mãe ver.
const PHOTO_ID: Record<string, string> = {
  amamentar: 'liz-full.png',
  fralda: 'ic-diaper.png',
  sono: 'ic-moon.png',
  comida: 'ic-plate.png',
  medicacao: 'ic-pill.png',
  hidratacao: 'ic-cup.png',
  altura: 'ic-ruler.png',
  peso: 'ic-scale.png',
  banho: 'ic-soap.png',
  extracao: 'ic-pump.png',
  circunferencia: 'ic-head.png',
  mamadeira: 'ic-bottle.png',
  vitamina: 'ic-vitamin.png',
  leitura: 'ic-book.png',
  vacina: 'ic-syringe.png',
  passeio: 'ic-stroller.png',
  humor: 'ic-mood.png',
  sintoma: 'ic-thermo.png',
  atividade: 'ic-blocks.png',
};

for (const [tipo, rel] of Object.entries(ILUSTRACAO)) {
  const esperado = PHOTO_ID[tipo];
  if (!esperado) {
    conferir(`"${tipo}" está no PHOTO_ID do protótipo`, false, 'tipo fora do mapeamento original — decida e registre');
    continue;
  }
  const posto = path.basename(rel);
  conferir(
    `"${tipo}" aponta para o PNG do protótipo`,
    posto === esperado,
    `o protótipo diz ${esperado}, a tabela diz ${posto}`,
  );
}

// 4. Nenhum PNG serve a dois tipos — colisão é sintoma de copiar-e-colar.
const porArquivo = new Map<string, string[]>();
for (const [tipo, rel] of Object.entries(ILUSTRACAO)) {
  const b = path.basename(rel);
  porArquivo.set(b, [...(porArquivo.get(b) ?? []), tipo]);
}
for (const [arq, tipos] of porArquivo) {
  conferir(`"${arq}" serve a um tipo só`, tipos.length === 1, `usado por ${tipos.join(', ')}`);
}

console.log(
  falhas === 0
    ? `\nIlustrações: ${Object.keys(ILUSTRACAO).length} tipos, arquivos no disco, mapeamento igual ao do protótipo.`
    : `\n${falhas} falha(s) nas ilustrações.`,
);

process.exit(falhas === 0 ? 0 : 1);

// Varredura de LINGUAGEM DE MÉDIA — a tese do PRODUTO.md §0 virando teste.
//
//   node scripts/teste-linguagem-media.ts            roda a verificação
//   node scripts/teste-linguagem-media.ts --listar    mostra tudo que foi varrido
//
// POR QUE ESTE ARQUIVO EXISTE
//
// A tese é: tudo que a Ninna diz sai dos registros daquele bebê — comparação da
// Liz com a Liz, nunca da Liz com a média. É o produto inteiro, e é a única
// coisa que separa a Ninna de um concorrente que já tem 50 mil downloads.
//
// Tese que depende de alguém lembrar dela não sobrevive. Este é o N8 do §9 — a
// deriva — e a lição vem do `teste-copy-telas.ts`, que só existiu DEPOIS de uma
// violação de gênero ir a produção. Aqui a ordem está invertida de propósito: a
// varredura é escrita junto com o bloco 1, antes de haver o que reprovar.
//
// ------------------------------------------------------------------
// AS DUAS FAMÍLIAS, E POR QUE SÃO DUAS
//
// 1. CONTEÚDO POPULACIONAL — a Ninna afirmando algo sobre a Liz a partir de
//    população: "bebês nessa idade dormem 14h". Proibido sempre.
//
// 2. JULGAMENTO SOBRE REFERÊNCIA — a Ninna lendo a curva por conta própria:
//    "a Liz está abaixo do esperado". Proibido — e é a família que passou a
//    importar mais desde que a curva da OMS foi PERMITIDA no §0.
//
// A distinção do §0: referência clínica rotulada é permitida (a curva tracejada
// atrás da linha da Liz, atribuída à fonte); narrá-la não é. Uma deriva da
// outra em um passo, e a segunda família é a trava.
//
// ------------------------------------------------------------------
// VARRE TEXTO, NUNCA RÓTULO DE EIXO
//
// "Referência OMS" num eixo é o uso permitido, e não casa com regra nenhuma
// daqui — as regras procuram AFIRMAÇÃO sobre o bebê, não nome de fonte. Um
// rótulo que precise mesmo de exceção (um eixo escrito "percentil 50") entra em
// `PERMITIDOS` com o motivo, do mesmo jeito que a varredura de gênero faz.

import { provarExtrator, varrerCopy, type Achado } from './varredura.ts';

// ------------------------------------------------------------------
// As regras
// ------------------------------------------------------------------

type Regra = { nome: string; familia: 'conteudo' | 'julgamento'; padrao: RegExp; explica: string };

const REGRAS: Regra[] = [
  {
    nome: 'população como sujeito da frase',
    familia: 'conteudo',
    padrao: /\b(beb[êe]s|crian[çc]as|rec[ée]m[- ]nascidos)\b/i,
    explica: 'a Ninna fala do bebê desta mãe, no singular — o plural é o concorrente',
  },
  {
    nome: 'faixa etária como referência',
    familia: 'conteudo',
    padrao: /\b(nessa|dessa|para a|pra) idade\b|\bde \d+ (meses|semanas|anos)\b|\bnessa fase\b/i,
    explica: '"para a idade" é a assinatura da estatística populacional',
  },
  {
    nome: 'média ou típico como afirmação',
    familia: 'conteudo',
    padrao: /\b(a m[ée]dia|na m[ée]dia|em m[ée]dia|o t[íi]pico|o esperado|o normal|o habitual)\b/i,
    explica: 'a Ninna descreve o que aconteceu, não o que costuma acontecer com outros',
  },
  {
    nome: 'comparação com outros bebês',
    familia: 'conteudo',
    padrao: /\b(a maioria|outros beb[êe]s|outras m[ãa]es|comparado a|em rela[çc][ãa]o a outros)\b/i,
    explica: 'o app nunca compara bebês — regra travada desde o P4',
  },
  {
    nome: 'julgamento sobre referência',
    familia: 'julgamento',
    padrao: /\b(abaixo|acima|dentro|fora) d[oa] (esperado|normal|m[ée]dia|padr[ãa]o|curva|faixa)\b/i,
    explica: 'ler a posição na curva é do pediatra; desenhar a curva é do app (§0)',
  },
  {
    nome: 'percentil em texto',
    familia: 'julgamento',
    padrao: /\bpercentil\b|\bp\d{1,2}\b(?![a-z])/i,
    explica: 'a Ninna não calcula percentil em texto — §0, trava 3',
  },
  {
    nome: 'adjetivo de adequação',
    familia: 'julgamento',
    padrao: /\b(adequad[oa]|inadequad[oa]|atrasad[oa]|avan[çc]ad[oa]|dentro do previsto)\b/i,
    explica: 'adjetivo de adequação é julgamento com autoridade emprestada',
  },
];

/**
 * Exceção precisa do texto exato e do motivo, igual à varredura de gênero.
 *
 * O caso previsto: quando a tela de Evolução chegar (bloco 5), um eixo escrito
 * "percentil 50" é rótulo de referência clínica, e entra aqui citando o §0 —
 * referência é DESENHADA, e o rótulo faz parte do desenho. Uma FRASE com
 * "percentil" não entra: é a trava 3 sendo violada.
 *
 * Lista vazia hoje. Ela existir vazia é o ponto: a fronteira já está escrita
 * antes de alguém precisar dela.
 */
const PERMITIDOS: { arquivo: string; texto: string; porque: string }[] = [];

function permitido(achado: Achado): boolean {
  const arquivo = achado.arquivo.replace(/\\/g, '/');
  const texto = achado.texto.replace(/\s+/g, ' ').trim();
  return PERMITIDOS.some(
    (p) => arquivo.endsWith(p.arquivo) && texto === p.texto.replace(/\s+/g, ' ').trim()
  );
}

// ------------------------------------------------------------------
// Execução
// ------------------------------------------------------------------

const achados = varrerCopy();

if (process.argv.includes('--listar')) {
  for (const a of achados) console.log(`${a.arquivo}:${a.linha} [${a.tipo}] ${a.texto}`);
  console.log(`\n${achados.length} trechos varridos.`);
  process.exit(0);
}

let falhas = 0;

// ------------------------------------------------------------------
// Prova das regras — antes de varrer
// ------------------------------------------------------------------

const DEVE_REPROVAR: { texto: string; porque: string }[] = [
  { texto: 'Bebês nessa idade costumam dormir 14 horas por dia.', porque: 'o concorrente inteiro' },
  { texto: 'Liz dorme menos que a média para a idade dela.', porque: 'média com o nome colado' },
  { texto: 'O esperado é que ela mame a cada três horas.', porque: 'norma disfarçada de descrição' },
  { texto: 'Liz está abaixo do esperado para o peso.', porque: 'a frase que o §0 usa como exemplo' },
  { texto: 'O peso de Liz está no percentil 40.', porque: 'percentil em texto — trava 3' },
  { texto: 'O ganho de peso está adequado.', porque: 'adjetivo de adequação' },
  { texto: 'A maioria dos bebês já dorme a noite toda nessa fase.', porque: 'comparação com outros' },
];

const DEVE_PASSAR: { texto: string; porque: string }[] = [
  { texto: 'Liz ganhou 340 g desde a última pesagem.', porque: 'comparação dela com ela' },
  { texto: 'Referência OMS', porque: 'rótulo de eixo — o uso permitido pelo §0' },
  {
    texto: 'Pelos últimos dias, Liz tem pegado no sono por volta de 13h.',
    porque: 'padrão do próprio bebê, que é o produto',
  },
  {
    texto: 'Dormiu 40 minutos a mais essa semana que na passada.',
    porque: 'o exemplo da tese, palavra por palavra',
  },
  {
    texto: 'Ainda estou conhecendo Liz — cada registro ajuda a desenhar esse ritmo.',
    porque: 'frase de aprendizado, sem número e sem cobrança',
  },
  {
    texto: 'Não consigo te ajudar com isso — eu só sei o que você registrou.',
    porque: 'a recusa de saúde não pode ser confundida com linguagem de média',
  },
  { texto: 'Quantas mamadas ontem?', porque: 'exemplo de pergunta da superfície' },
];

const viola = (regra: Regra, texto: string) => regra.padrao.test(texto);

for (const caso of DEVE_REPROVAR) {
  if (!REGRAS.some((r) => viola(r, caso.texto))) {
    falhas++;
    console.log(`[ FALHA] deixou passar o que existe pra pegar: "${caso.texto}" (${caso.porque})`);
  }
}

for (const caso of DEVE_PASSAR) {
  const regra = REGRAS.find((r) => viola(r, caso.texto));
  if (regra) {
    falhas++;
    console.log(`[ FALHA] falso positivo em "${caso.texto}" — regra "${regra.nome}" (${caso.porque})`);
  }
}

for (const falha of provarExtrator()) {
  falhas++;
  console.log(`[ FALHA] ${falha}`);
}

// ------------------------------------------------------------------
// A varredura
// ------------------------------------------------------------------

const usadas = new Set<string>();

for (const a of achados) {
  for (const regra of REGRAS) {
    if (!viola(regra, a.texto)) continue;
    if (permitido(a)) {
      usadas.add(a.texto.replace(/\s+/g, ' ').trim());
      continue;
    }
    falhas++;
    console.log(`[ FALHA] ${a.arquivo}:${a.linha} — ${regra.nome} [${regra.familia}]`);
    console.log(`         "${a.texto}"`);
    console.log(`         ${regra.explica}`);
  }
}

for (const p of PERMITIDOS) {
  if (usadas.has(p.texto.replace(/\s+/g, ' ').trim())) continue;
  falhas++;
  console.log(`[ FALHA] exceção sem uso em PERMITIDOS — ${p.arquivo}`);
  console.log(`         "${p.texto}"`);
  console.log('         a frase mudou ou saiu: reveja o motivo e ajuste ou apague a exceção');
}

const arquivos = new Set(achados.map((a) => a.arquivo)).size;
console.log(
  `\n${falhas === 0 ? 'Copy sem linguagem de média' : `${falhas} violação(ões)`} — ${achados.length} trechos em ${arquivos} arquivos, ${REGRAS.length} regras em 2 famílias.`
);

process.exit(falhas === 0 ? 0 : 1);

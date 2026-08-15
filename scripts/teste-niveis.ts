// Os níveis da afiliada — `src/lib/niveis.ts`.
//
//   node scripts/teste-niveis.ts
//
// POR QUE ESTE ARQUIVO EXISTE
//
// Não é pela aritmética: comparar um número com quatro limiares não erra.
//
// É pelo REBAIXAMENTO. O nível é derivado da contagem, não guardado — e a
// consequência é que mexer num limiar reescreve o passado de todo mundo,
// silenciosamente. Subir o de Prata de 5 para 8 tira o selo de quem tem 6, sem
// migration, sem aviso, sem nada no diff que pareça perigoso. A afiliada
// descobre abrindo o painel.
//
// A decisão de 14/08/2026 foi: limiar existente **só pode baixar**; nível novo
// **só pode ser acrescentado acima**. Este arquivo guarda uma cópia congelada
// dos limiares originais e transforma a decisão em asserção.
//
// A segunda coisa que ele defende é a copy. As frases do nível são das poucas do
// app que falam de conquista, e conquista é onde o "calor extra" entra — a
// tentação de escrever "você é incrível" ou "faltam 2 para ganhar a placa". A
// primeira é elogio vazio; a segunda é promessa de entrega física numa tela.

import {
  NIVEIS,
  faltamPara,
  fraseDoNivel,
  fraseDoProgresso,
  nivelDe,
  proximoNivel,
} from '../src/lib/niveis.ts';

let falhas = 0;
function conferir(nome: string, ok: boolean, detalhe?: string) {
  if (ok) return;
  falhas++;
  console.log(`[ FALHA] ${nome}${detalhe ? `\n         ${detalhe}` : ''}`);
}

// ------------------------------------------------------------------
// 1. ⚠️ NINGUÉM É REBAIXADO POR MUDANÇA DE RÉGUA
// ------------------------------------------------------------------
//
// A cópia abaixo é de 14/08/2026 e NÃO SE ATUALIZA junto com o módulo. É esse o
// ponto: ela é a régua contra a qual toda revisão futura é medida.
//
// Se você veio aqui porque este teste reprovou depois de mexer nos limiares —
// ele está fazendo o trabalho dele. Baixar um limiar passa. Subir, não.

const ORIGINAIS: { nome: string; minimo: number }[] = [
  { nome: 'Parceira', minimo: 1 },
  { nome: 'Prata', minimo: 5 },
  { nome: 'Ouro', minimo: 15 },
  { nome: 'Diamante', minimo: 40 },
];

conferir(
  'nenhum nível original foi removido',
  NIVEIS.length >= ORIGINAIS.length,
  `eram ${ORIGINAIS.length}, agora são ${NIVEIS.length} — remover nível apaga o selo de quem o tem`,
);

for (let i = 0; i < ORIGINAIS.length && i < NIVEIS.length; i++) {
  conferir(
    `o limiar de "${ORIGINAIS[i].nome}" não subiu`,
    NIVEIS[i].minimo <= ORIGINAIS[i].minimo,
    `era ${ORIGINAIS[i].minimo}, virou ${NIVEIS[i].minimo} — quem tinha entre os dois perde o nível`,
  );
  conferir(
    `"${ORIGINAIS[i].nome}" continua na mesma posição`,
    NIVEIS[i].nome === ORIGINAIS[i].nome,
    `a posição ${i} virou "${NIVEIS[i].nome}" — reordenar troca o selo de quem já subiu`,
  );
}

// ------------------------------------------------------------------
// 2. A escada é uma escada
// ------------------------------------------------------------------

conferir('há pelo menos um nível', NIVEIS.length > 0);
for (let i = 1; i < NIVEIS.length; i++) {
  conferir(
    `"${NIVEIS[i].nome}" exige mais que "${NIVEIS[i - 1].nome}"`,
    NIVEIS[i].minimo > NIVEIS[i - 1].minimo,
    `${NIVEIS[i - 1].minimo} → ${NIVEIS[i].minimo}`,
  );
}
conferir('nomes não se repetem', new Set(NIVEIS.map((n) => n.nome)).size === NIVEIS.length);
conferir('nenhum limiar é zero', NIVEIS.every((n) => n.minimo >= 1), 'selo que todo mundo tem no dia 1 não reconhece nada');

// ------------------------------------------------------------------
// 3. A derivação
// ------------------------------------------------------------------

conferir('zero assinaturas não dá nível', nivelDe(0) === null);
conferir('1 assinatura dá Parceira', nivelDe(1)?.nome === 'Parceira');
conferir('4 ainda é Parceira', nivelDe(4)?.nome === 'Parceira');
conferir('5 vira Prata', nivelDe(5)?.nome === 'Prata');
conferir('14 ainda é Prata', nivelDe(14)?.nome === 'Prata');
conferir('15 vira Ouro', nivelDe(15)?.nome === 'Ouro');
conferir('40 vira Diamante', nivelDe(40)?.nome === 'Diamante');
conferir('acima do topo continua no topo', nivelDe(4000)?.nome === 'Diamante');

// Cada limiar é o primeiro número do seu nível — pega erro de `>` contra `>=`,
// que é o clássico e desloca a escada inteira em um.
for (const n of NIVEIS) {
  conferir(`${n.minimo} já é "${n.nome}"`, nivelDe(n.minimo)?.nome === n.nome);
  conferir(`${n.minimo - 1} ainda não é "${n.nome}"`, nivelDe(n.minimo - 1)?.nome !== n.nome);
}

conferir('o próximo de 0 é Parceira', proximoNivel(0)?.nome === 'Parceira');
conferir('o próximo de 5 é Ouro', proximoNivel(5)?.nome === 'Ouro');
conferir('no topo não há próximo', proximoNivel(40) === null);
conferir('faltam 4 de 1 para Prata', faltamPara(1) === 4);
conferir('falta 1 de 14 para Ouro', faltamPara(14) === 1);
conferir('no topo não falta nada', faltamPara(99) === null);

// ------------------------------------------------------------------
// 4. A copy — o que ela pode e o que ela não pode dizer
// ------------------------------------------------------------------

const FRASES = [
  ...[0, 1, 2, 4, 5, 14, 15, 39, 40, 100].map(fraseDoNivel),
  ...[0, 1, 4, 5, 14, 39].map((n) => fraseDoProgresso(n) ?? ''),
];

conferir('no topo não há frase de progresso', fraseDoProgresso(40) === null);
conferir('singular no 1', fraseDoNivel(1).includes('1 mãe assinou'));
conferir('plural no 2', fraseDoNivel(2).includes('2 mães assinaram'));
conferir('"falta" no singular', fraseDoProgresso(14) === 'Falta 1 assinatura para Ouro.');
conferir('"faltam" no plural', fraseDoProgresso(1) === 'Faltam 4 assinaturas para Prata.');

// ⚠️ Nada de promessa de entrega. A placa existe FORA do app e é combinada por
// fora — uma tela que a menciona vira dívida que outra pessoa cumpre à mão.
const PROIBIDO: { padrao: RegExp; porque: string }[] = [
  { padrao: /placa|troféu|trofeu|brinde|prêmio|premio|kit|camiseta|caneca/i, porque: 'entrega física não se promete em tela' },
  { padrao: /\bganh(a|ar|ou|e)\b|receb(a|er|erá)|vai receber/i, porque: 'promete entrega' },
  { padrao: /incrível|incrivel|arrasou|parabéns|parabens|orgulho|especial|melhor/i, porque: 'elogio vazio — o número é o elogio' },
  { padrao: /\bmeta\b|objetivo|desafio|falta pouco|quase l[áa]/i, porque: 'linguagem de meta cria pressão para vender' },
  { padrao: /\b(ele|ela|eles|elas|dele|dela)\b/i, porque: 'pronome de gênero' },
  // A folga de 24 caracteres não é preguiça: o verbo entra no meio ("comissão
  // FICA maior", "percentual SOBE para"), e exigir adjacência deixaria passar a
  // forma mais natural de escrever justamente o que está proibido.
  {
    padrao: /comiss(ão|ao)[^.!?]{0,24}(maior|extra|sobe|dobra)|percentual[^.!?]{0,24}(maior|sobe)/i,
    porque: 'nível não muda comissão',
  },
];

for (const frase of FRASES) {
  if (frase === '') continue;
  for (const r of PROIBIDO) {
    conferir(`a frase não cruza a linha (${r.porque})`, !r.padrao.test(frase), `"${frase}"`);
  }
}

// A prova de que as proibições mordem: frases que elas TÊM que pegar.
const DEVE_REPROVAR = [
  'Faltam 2 assinaturas para você ganhar a placa.',
  'Parabéns, você é uma parceira incrível!',
  'Sua meta deste mês está quase lá.',
  'Ela assinou pelo seu link.',
  'No Ouro sua comissão fica maior.',
];
for (const frase of DEVE_REPROVAR) {
  conferir(
    `a lista pega "${frase.slice(0, 40)}…"`,
    PROIBIDO.some((r) => r.padrao.test(frase)),
    'uma proibição deixou passar o que ela existe pra pegar',
  );
}

// E o controle: frase legítima não pode ser reprovada, senão a lista vira
// barulho e alguém a desliga levando junto o que ela pegava.
const DEVE_PASSAR = [
  'Faltam 4 assinaturas para Prata.',
  '12 mães assinaram pelo seu link.',
  'Nenhuma assinatura pelo seu link ainda.',
];
for (const frase of DEVE_PASSAR) {
  const pega = PROIBIDO.find((r) => r.padrao.test(frase));
  conferir(`"${frase}" passa`, !pega, pega ? `falso positivo em: ${pega.porque}` : '');
}

console.log(
  falhas === 0
    ? `\nNíveis: ${NIVEIS.length} degraus, ninguém rebaixado por mudança de régua, e a copy sem promessa.`
    : `\n${falhas} falha(s) nos níveis.`,
);

process.exit(falhas === 0 ? 0 : 1);

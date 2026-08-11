// A guarda da copy de saúde.
//
//   node scripts/teste-copy-saude.ts
//
// POR QUE ESTE ARQUIVO EXISTE
//
// A Ninna diz duas coisas sobre saúde, em momentos diferentes: ao salvar um
// sintoma e ao recusar uma pergunta clínica no assistente. Os dois textos fazem
// a MESMA promessa à mãe — registrar, não avaliar, devolver a decisão.
//
// Eles nasceram como dois literais soltos em arquivos distantes, e já estavam
// divergindo ("fale" num, "fala" no outro) sem que nada notasse. A diferença era
// inofensiva; o mecanismo que a produziu, não. No dia em que alguém reescrevesse
// uma delas, a outra ficaria para trás — e a promessa que o termo LGPD faz à
// embaixadora passaria a existir em duas versões.
//
// Agora a promessa é uma constante única (`DEVOLVE_A_DECISAO`) e as duas frases
// a compõem. Este teste garante que continue assim: que as duas a contenham
// LITERALMENTE, e que nenhuma delas cruze as linhas travadas no CLAUDE.md.
//
// A escolha de não fundir as duas numa só é deliberada, e o teste a preserva:
// "Anotado" confirma um registro, "Não consigo te ajudar" recusa. Texto único
// diria a coisa errada em um dos dois momentos.

import {
  AVISO_AO_SALVAR_SINTOMA,
  DEVOLVE_A_DECISAO,
  RECUSA_DE_SAUDE,
} from '../src/lib/copySaude.ts';
import { RESPOSTA_SAUDE } from '../src/lib/consultas.ts';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

const AS_DUAS: { onde: string; texto: string }[] = [
  { onde: 'tela de sintoma', texto: AVISO_AO_SALVAR_SINTOMA },
  { onde: 'recusa do assistente', texto: RECUSA_DE_SAUDE },
];

// ------------------------------------------------------------------
// 1. Prova de que o teste sabe reprovar
// ------------------------------------------------------------------

console.log('--- prova: as regras pegam o que existem pra pegar ---');

const DEVE_REPROVAR: { texto: string; porque: string }[] = [
  { texto: 'Anotado. Isso costuma não ser nada.', porque: 'tranquiliza' },
  { texto: 'Anotado. Procure atendimento agora.', porque: 'sugere urgência' },
  { texto: 'Anotado. Acima de 38 graus, ligue para o pediatra.', porque: 'cita número e faixa' },
  { texto: 'Anotado. Fique atenta a manchas na pele.', porque: 'lista sinal de alarme' },
  { texto: 'Anotado. Isso é normal nessa idade.', porque: 'normaliza e usa faixa etária' },
];

// ------------------------------------------------------------------
// 2. As linhas travadas
// ------------------------------------------------------------------

const PROIBIDO: { rotulo: string; re: RegExp }[] = [
  {
    rotulo: 'sugere urgência',
    re: /\b(agora mesmo|imediatamente|urgent\w*|emerg\w*|corra|procure atendimento|v[áa] ao pronto)\b/i,
  },
  {
    rotulo: 'avalia gravidade',
    re: /\b(grave|s[ée]rio|leve demais|preocupante|alarmante|sem gravidade)\b/i,
  },
  {
    // A flexão importa: a primeira versão desta regra só pegava "não é nada" e
    // deixou passar "costuma não ser nada", que é a mesma tranquilização com
    // outro verbo — e a forma mais provável de ela aparecer de verdade, porque
    // vem com hedge junto.
    rotulo: 'tranquiliza',
    re: /n[ãa]o\s+(?:[ée]|ser|seja|for|costuma ser|deve ser)\s+nada\b|\b(nada demais|fique tranquila|relaxa|normal)\b/i,
  },
  { rotulo: 'cita número, faixa ou temperatura', re: /\d|\bgraus\b|\btemperatura\b/i },
  {
    rotulo: 'lista sinal de alarme',
    re: /\b(fique atenta|observe se|sinais? de|se piorar|caso apare[çc]a)\b/i,
  },
  { rotulo: 'diagnostica', re: /\b(pode ser|provavelmente|indica|sugere que|quadro de)\b/i },
  { rotulo: 'linguagem de média', re: /\bbeb[êe]s\b|\bnessa idade\b|\bpara a idade\b/i },
];

for (const caso of DEVE_REPROVAR) {
  if (!PROIBIDO.some((p) => p.re.test(caso.texto))) {
    falhas++;
    console.log(`[ FALHA] deixou passar: "${caso.texto}" (${caso.porque})`);
  }
}
conferir(
  'as regras reprovam as 5 frases que deveriam reprovar',
  DEVE_REPROVAR.every((c) => PROIBIDO.some((p) => p.re.test(c.texto)))
);

// ------------------------------------------------------------------
// 3. A promessa é a mesma nas duas — literalmente
// ------------------------------------------------------------------

console.log('\n--- a promessa única ---');

for (const { onde, texto } of AS_DUAS) {
  conferir(`${onde}: contém a promessa, palavra por palavra`, texto.includes(DEVOLVE_A_DECISAO));
}

conferir(
  'a promessa aponta o pediatra e devolve a decisão',
  /pediatra/i.test(DEVOLVE_A_DECISAO) && /instinto/i.test(DEVOLVE_A_DECISAO),
  DEVOLVE_A_DECISAO
);

conferir(
  'a Edge Function usa exatamente a mesma recusa',
  RESPOSTA_SAUDE === RECUSA_DE_SAUDE,
  'consultas.ts reexporta a constante em vez de repetir o texto'
);

// ------------------------------------------------------------------
// 4. E as duas continuam sendo frases DIFERENTES
// ------------------------------------------------------------------

// Passa por `string` porque o tsc conhece os dois literais e reclama de
// comparação "sem sobreposição". A checagem continua valendo em runtime: se
// alguém fundir as duas num texto só, ela falha aqui.
const aviso: string = AVISO_AO_SALVAR_SINTOMA;
const recusa: string = RECUSA_DE_SAUDE;

conferir(
  'as duas não viraram o mesmo texto',
  aviso !== recusa,
  'uma confirma um registro, a outra recusa — fundir diria a coisa errada em uma delas'
);
conferir(
  'a que confirma o registro começa confirmando',
  /^Anotado\./.test(AVISO_AO_SALVAR_SINTOMA)
);
conferir(
  'a que recusa começa recusando, sem se desculpar',
  /^Não consigo te ajudar/.test(RECUSA_DE_SAUDE) && !/desculp/i.test(RECUSA_DE_SAUDE)
);

// ------------------------------------------------------------------
// 5. Nenhuma das duas cruza as linhas travadas
// ------------------------------------------------------------------

console.log('\n--- as linhas travadas ---');

for (const { onde, texto } of AS_DUAS) {
  const cruzadas = PROIBIDO.filter((p) => p.re.test(texto));
  conferir(
    `${onde}: dentro das regras de saúde`,
    cruzadas.length === 0,
    cruzadas.length === 0 ? `${PROIBIDO.length} regras` : cruzadas.map((c) => c.rotulo).join(', ')
  );
}

// O único pronome de gênero permitido em toda a copy do app é este, e ele é o
// pediatra. A varredura de gênero abre exceção declarada para ele; aqui a
// exceção é conferida pelo outro lado — que ele continue sendo só este.
conferir(
  'o único "ele" da copy de saúde é o pediatra',
  (AVISO_AO_SALVAR_SINTOMA.match(/\b(ele|ela|dele|dela)\b/gi) ?? []).length === 1 &&
    /quem examina é ele/.test(AVISO_AO_SALVAR_SINTOMA),
  'e a recusa do assistente não tem nenhum'
);
conferir(
  'a recusa do assistente não tem pronome de gênero',
  !/\b(ele|ela|dele|dela)\b/i.test(RECUSA_DE_SAUDE)
);

console.log(
  `\n${falhas === 0 ? 'Copy de saúde: uma promessa, duas frases, nenhuma linha cruzada.' : `${falhas} falha(s).`}`
);
process.exit(falhas === 0 ? 0 : 1);

// Teste da fronteira entre grátis e pago — puro, sem Stripe e sem banco.
//
//   node scripts/teste-acesso.ts
//
// POR QUE ISTO TEM TESTE
//
// É a única regra do projeto que decide se a mãe consegue usar alguma coisa. Ela
// erra para os dois lados, e os dois doem: liberar sem pagamento vira prejuízo
// silencioso, e negar a quem pagou é a mãe descobrindo às 3h da manhã que o app
// parou de responder o que respondia ontem.
//
// Os casos que importam não são "assinou / não assinou" — são os do meio:
// pagamento atrasado, assinatura cancelada com mês pago, webhook chegando antes
// de a Stripe preencher a data.

import {
  assinaturaValida,
  RECURSOS_PAGOS,
  SEM_ASSINATURA,
  temAcesso,
  type Assinatura,
  type Recurso,
  type StatusAssinatura,
} from '../src/lib/acesso.ts';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

const AGORA = new Date('2026-08-11T12:00:00Z');
const emDias = (d: number) => new Date(AGORA.getTime() + d * 24 * 60 * 60_000).toISOString();

const assinatura = (status: StatusAssinatura, validaAte: string | null = null): Assinatura => ({
  status,
  validaAte,
});

// ------------------------------------------------------------------
// 1. A fronteira
// ------------------------------------------------------------------

console.log('--- a fronteira ---');

const TODOS: Recurso[] = ['registro', 'historico', 'insight', 'assistente'];
const GRATIS = TODOS.filter((r) => !RECURSOS_PAGOS.includes(r));

conferir(
  'registrar, ver histórico e ler o insight são grátis',
  GRATIS.every((r) => temAcesso(r, SEM_ASSINATURA, AGORA)),
  GRATIS.join(', ')
);
conferir(
  'o assistente é o único pago',
  RECURSOS_PAGOS.length === 1 && RECURSOS_PAGOS[0] === 'assistente',
  'é o único recurso com custo marginal por usuária'
);
conferir(
  'sem assinatura, o assistente não abre',
  !temAcesso('assistente', SEM_ASSINATURA, AGORA)
);
conferir(
  'quem nunca assinou ainda vê o insight do bebê dela',
  temAcesso('insight', SEM_ASSINATURA, AGORA),
  'é o que ela precisa ter visto funcionar antes de pagar por qualquer coisa'
);

// ------------------------------------------------------------------
// 2. Os casos do meio — onde a regra ganha ou perde
// ------------------------------------------------------------------

console.log('\n--- os casos do meio ---');

conferir('assinatura ativa e no prazo abre', assinaturaValida(assinatura('active', emDias(20)), AGORA));
conferir('período de teste abre', assinaturaValida(assinatura('trialing', emDias(5)), AGORA));

conferir(
  'pagamento atrasado NÃO corta enquanto o mês pago não vence',
  assinaturaValida(assinatura('past_due', emDias(9)), AGORA),
  'cartão vencido na virada do mês é quase sempre isso, não desistência'
);
conferir(
  'mas atrasado com o mês já vencido corta',
  !assinaturaValida(assinatura('past_due', emDias(-1)), AGORA)
);

conferir(
  'cancelada continua valendo até o fim do mês pago',
  assinaturaValida(assinatura('canceled', emDias(12)), AGORA),
  'ela cancelou, mas o mês está pago — cortar antes é ficar com o dinheiro'
);
conferir(
  'e para de valer depois disso',
  !assinaturaValida(assinatura('canceled', emDias(-2)), AGORA)
);

conferir(
  'ativa sem data ainda abre',
  assinaturaValida(assinatura('active', null), AGORA),
  'o webhook pode chegar antes de a Stripe preencher o período; negar a quem acabou de pagar é o pior primeiro minuto possível'
);
conferir(
  'mas cancelada sem data NÃO abre',
  !assinaturaValida(assinatura('canceled', null), AGORA),
  'aqui o crédito vem justamente da data — sem ela não há crédito'
);
conferir(
  'e atrasada sem data também não',
  !assinaturaValida(assinatura('past_due', null), AGORA)
);

for (const status of ['unpaid', 'incomplete', 'incomplete_expired', 'paused'] as StatusAssinatura[]) {
  conferir(`${status} não abre nem com data no futuro`, !assinaturaValida(assinatura(status, emDias(30)), AGORA));
}

// ------------------------------------------------------------------
// 3. Data quebrada não vira acesso por acidente
// ------------------------------------------------------------------

console.log('\n--- entrada estragada ---');

conferir(
  'data inválida não derruba nem libera quem não deveria',
  assinaturaValida({ status: 'active', validaAte: 'nao-e-data' }, AGORA) &&
    !assinaturaValida({ status: 'canceled', validaAte: 'nao-e-data' }, AGORA),
  'ativa segue valendo; cancelada sem data legível não'
);

conferir(
  'expirar exatamente agora conta como expirado',
  !assinaturaValida({ status: 'canceled', validaAte: AGORA.toISOString() }, AGORA) &&
    !assinaturaValida({ status: 'past_due', validaAte: AGORA.toISOString() }, AGORA),
  'a comparação é por instante, não por dia — a virada não tem meio-termo'
);

console.log(
  `\n${falhas === 0 ? 'Fronteira entre grátis e pago correta.' : `${falhas} falha(s).`}`
);
process.exit(falhas === 0 ? 0 : 1);

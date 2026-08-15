// As regras do saque — `src/lib/saque.ts` contra `supabase/migrations/011_saques.sql`.
//
//   node scripts/teste-saque.ts
//
// POR QUE ESTE ARQUIVO EXISTE
//
// O mínimo do saque está escrito DUAS VEZES: na função `solicitar_saque()`, que
// é a regra, e no módulo puro, que só desabilita o botão antes. A duplicação é
// deliberada — a tela não pode perguntar ao banco a cada tecla — mas duplicação
// de regra de dinheiro é exatamente o tipo de coisa que diverge em silêncio seis
// meses depois, quando alguém mexe num lado só.
//
// Então o teste não confere a aritmética do módulo: ele confere o módulo CONTRA
// O SQL. Se o `minimo constant int := 2000` da 011 virar 5000 e o TypeScript não
// acompanhar, isto reprova.
//
// O mesmo vale para os quatro estados: eles vivem num `check` do Postgres e num
// `Record` do TypeScript, e nada além deste arquivo obriga os dois a serem a
// mesma lista.
//
// ⚠️ O QUE ELE **NÃO** ALCANÇA, e por isso não basta
//
// Nada aqui prova que o banco recusa de verdade — regra 2b. Um cliente
// fabricado à mão não passa por `impedimentoDoSaque()`, passa pelo PostgREST. A
// prova de que `saques` não aceita insert direto mora no `teste-rls-delete.mjs`,
// que roda contra o banco real.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SAQUE_MINIMO_CENTAVOS,
  centavosDoTexto,
  comprometeSaldo,
  ehCodigoDoSaque,
  fraseDoSaque,
  impedimentoDoSaque,
  rotuloDoEstado,
  type CodigoDoSaque,
  type EstadoDoSaque,
} from '../src/lib/saque.ts';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQL = fs.readFileSync(path.join(raiz, 'supabase/migrations/011_saques.sql'), 'utf8');

let falhas = 0;
function conferir(nome: string, ok: boolean, detalhe?: string) {
  if (ok) return;
  falhas++;
  console.log(`[ FALHA] ${nome}${detalhe ? `\n         ${detalhe}` : ''}`);
}

// ------------------------------------------------------------------
// Os extratores, provados antes de extrair
// ------------------------------------------------------------------

const minimoDoSql = (sql: string) => {
  const m = sql.match(/minimo\s+constant\s+int\s*:=\s*(\d+)/);
  return m ? Number(m[1]) : null;
};

const estadosDoSql = (sql: string) => {
  const m = sql.match(/check\s*\(\s*estado\s+in\s*\(([^)]+)\)/);
  return m ? [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]) : null;
};

conferir('o extrator do mínimo lê um valor conhecido', minimoDoSql('  minimo constant int := 4200;') === 4200);
conferir('o extrator do mínimo não inventa', minimoDoSql('nada aqui') === null);
conferir(
  'o extrator de estados lê uma lista conhecida',
  JSON.stringify(estadosDoSql("check (estado in ('a', 'b'))")) === JSON.stringify(['a', 'b']),
);
conferir('o extrator de estados não inventa', estadosDoSql('nada aqui') === null);

// ------------------------------------------------------------------
// 1. O módulo bate com o SQL
// ------------------------------------------------------------------

const minimoSql = minimoDoSql(SQL);
conferir('achei o mínimo na 011', minimoSql !== null, 'o `minimo constant` mudou de forma — o teste ficou cego');
conferir(
  'o mínimo do módulo é o mesmo da 011',
  minimoSql === SAQUE_MINIMO_CENTAVOS,
  `SQL diz ${minimoSql}, o módulo diz ${SAQUE_MINIMO_CENTAVOS}`,
);

const estadosSql = estadosDoSql(SQL);
const ESTADOS: EstadoDoSaque[] = ['pendente', 'aprovado', 'pago', 'recusado'];
conferir('achei os estados na 011', estadosSql !== null);
conferir(
  'os estados do módulo são os do check da 011',
  JSON.stringify(estadosSql) === JSON.stringify(ESTADOS),
  `SQL: ${JSON.stringify(estadosSql)} · módulo: ${JSON.stringify(ESTADOS)}`,
);

// `comprometeSaldo` é a mesma regra do `estado <> 'recusado'` da RPC. Divergir
// aqui faria a tela mostrar um saldo que o servidor não honraria.
conferir('a 011 solta o saldo só no recusado', /s\.estado\s*<>\s*'recusado'/.test(SQL));
for (const e of ESTADOS) {
  conferir(`"${e}" compromete saldo igual à 011`, comprometeSaldo(e) === (e !== 'recusado'));
}

// ------------------------------------------------------------------
// 2. Todo código tem frase, e frase nenhuma some
// ------------------------------------------------------------------

const CODIGOS: CodigoDoSaque[] = [
  'ok', 'sem_sessao', 'sem_cadastro', 'pausada', 'minimo', 'chave', 'saldo', 'aberto', 'erro',
];

for (const c of CODIGOS) {
  conferir(`"${c}" tem frase própria`, fraseDoSaque(c).length > 10, fraseDoSaque(c));
  conferir(`"${c}" é reconhecido`, ehCodigoDoSaque(c));
}
conferir('frases não se repetem', new Set(CODIGOS.map(fraseDoSaque)).size === CODIGOS.length);

// Os códigos que o BANCO devolve têm que existir aqui. 'erro' é só do cliente.
const codigosDoSql = [...SQL.matchAll(/return\s+'([a-z_]+)'/g)].map((m) => m[1]);
conferir('achei os returns da 011', codigosDoSql.length >= 7, `achei ${codigosDoSql.length}`);
for (const c of new Set(codigosDoSql)) {
  conferir(`o código "${c}" da 011 é conhecido pelo módulo`, ehCodigoDoSaque(c), 'a 011 devolve algo que a tela não traduz');
}

// Texto de fora nunca vira estado.
for (const lixo of ['', 'OK', 'sucesso', 'null', null, undefined, 42, {}]) {
  conferir(`"${String(lixo)}" não é código`, !ehCodigoDoSaque(lixo));
}

conferir('todo estado tem rótulo', ESTADOS.every((e) => rotuloDoEstado(e).length > 2));
conferir('rótulos não se repetem', new Set(ESTADOS.map(rotuloDoEstado)).size === ESTADOS.length);

// ------------------------------------------------------------------
// 3. Leitura do valor
// ------------------------------------------------------------------

const CASOS: [string, number | null][] = [
  ['20', 2000],
  ['20,00', 2000],
  ['20.00', 2000],
  ['12,50', 1250],
  ['0,01', 1],
  ['1234,56', 123456],
  [' 20 ', 2000],
  ['', null],
  ['abc', null],
  ['20,', null],
  [',50', null],
  ['20,555', null],   // três casas é erro de digitação, não precisão
  ['-20', null],
  ['20,00,00', null],
  ['R$ 20', null],
];
for (const [texto, esperado] of CASOS) {
  const veio = centavosDoTexto(texto);
  conferir(`"${texto}" → ${esperado}`, veio === esperado, `veio ${veio}`);
}

// ------------------------------------------------------------------
// 4. A ordem do impedimento é a da 011
// ------------------------------------------------------------------
//
// Mínimo, depois chave, depois saldo. Se a tela conferisse em outra ordem, a
// mesma solicitação errada apontaria campos diferentes conforme a rede.

const ordemSql = ['minimo', 'chave', 'saldo'].map((c) => SQL.indexOf(`return '${c}'`));
conferir('a 011 confere na ordem mínimo → chave → saldo', ordemSql[0] < ordemSql[1] && ordemSql[1] < ordemSql[2]);

conferir('abaixo do mínimo reprova antes de tudo', impedimentoDoSaque(1999, 'x', 999999) === 'minimo');
conferir('valor ilegível conta como abaixo do mínimo', impedimentoDoSaque(null, 'chave@boa.com', 999999) === 'minimo');
conferir('chave curta reprova depois do mínimo', impedimentoDoSaque(5000, 'ab', 999999) === 'chave');
conferir('chave longa demais reprova', impedimentoDoSaque(5000, 'a'.repeat(141), 999999) === 'chave');
conferir('acima do saldo reprova por último', impedimentoDoSaque(5000, 'chave@boa.com', 4999) === 'saldo');
conferir('exatamente o saldo passa', impedimentoDoSaque(5000, 'chave@boa.com', 5000) === null);
conferir('exatamente o mínimo passa', impedimentoDoSaque(SAQUE_MINIMO_CENTAVOS, 'chave@boa.com', 999999) === null);

// O caso que o índice parcial da 011 existe para pegar, e que a tela sozinha não
// vê: saldo zero com valor válido continua sendo 'saldo', nunca `null`.
conferir('saldo zero nunca libera', impedimentoDoSaque(SAQUE_MINIMO_CENTAVOS, 'chave@boa.com', 0) === 'saldo');

// ------------------------------------------------------------------
// 5. As mutações — o teste tem que morder
// ------------------------------------------------------------------
//
// Cada uma é uma divergência plausível entre o SQL e o módulo. Se alguma
// PASSAR, a bateria acima não está provando o que diz.

const MUTACOES: { nome: string; sql: string; deveReprovar: (s: string) => boolean }[] = [
  {
    nome: 'a 011 sobe o mínimo e o módulo não acompanha',
    sql: SQL.replace(/minimo\s+constant\s+int\s*:=\s*\d+/, 'minimo constant int := 5000'),
    deveReprovar: (s) => minimoDoSql(s) !== SAQUE_MINIMO_CENTAVOS,
  },
  {
    nome: 'a 011 ganha um estado que o módulo não conhece',
    sql: SQL.replace(/check\s*\(\s*estado\s+in\s*\([^)]+\)/, "check (estado in ('pendente', 'aprovado', 'pago', 'recusado', 'cancelado')"),
    deveReprovar: (s) => JSON.stringify(estadosDoSql(s)) !== JSON.stringify(ESTADOS),
  },
  {
    nome: 'a 011 passa a soltar saldo também no pago',
    sql: SQL.replace(/s\.estado\s*<>\s*'recusado'/, "s.estado not in ('recusado', 'pago')"),
    deveReprovar: (s) => !/s\.estado\s*<>\s*'recusado'/.test(s),
  },
  {
    nome: 'a 011 devolve um código novo que a tela não traduz',
    sql: SQL.replace("return 'saldo';", "return 'saldo_insuficiente';"),
    deveReprovar: (s) => [...s.matchAll(/return\s+'([a-z_]+)'/g)].some((m) => !ehCodigoDoSaque(m[1])),
  },
];

for (const m of MUTACOES) {
  conferir(`a mutação "${m.nome}" é reprovada`, m.deveReprovar(m.sql), 'a bateria passou numa divergência real');
}

console.log(
  falhas === 0
    ? '\nSaque: o módulo bate com a 011 — mínimo, estados, códigos e ordem. 4 mutações reprovadas.'
    : `\n${falhas} falha(s) no saque.`,
);

process.exit(falhas === 0 ? 0 : 1);

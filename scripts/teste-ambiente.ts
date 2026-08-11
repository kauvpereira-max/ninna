/**
 * O que este teste defende: a leitura de ambiente das três Edge Functions.
 *
 * Um `\t` colado no `STRIPE_PRICE_MENSAL` derrubou o Checkout em 11/08/2026, e
 * `lerAmbiente` existe para que a classe inteira pare de doer. Mas aparar em
 * silêncio troca um problema por outro — o secret continua torto no painel e
 * ninguém fica sabendo. Então o teste guarda as DUAS metades:
 *
 *   1. apara — o valor volta limpo;
 *   2. avisa — e o aviso nomeia a variável.
 *
 * E guarda uma terceira, que é de segurança e não de comportamento: o aviso
 * **nunca** imprime o valor. São chaves de API, e log é lugar que muita gente lê.
 *
 * Roda no Node, então o `Deno.env` é encenado aqui. Isso é a regra 2b assumida:
 * o que este teste prova é a LÓGICA de aparar, não o comportamento no Deno. A
 * prova no runtime certo é o deploy respondendo, e ela é feita por curl.
 */

import { lerAmbiente } from '../supabase/functions/_shared/ambiente.ts';

const ambienteFalso = new Map<string, string>();
const avisos: string[] = [];
const warnOriginal = console.warn;

// Encenação mínima do que o módulo usa. Import estático basta: `Deno.env` só é
// tocado DENTRO de `lerAmbiente`, nunca no corpo do módulo — se um dia for
// tocado lá, este teste quebra no import, que é o aviso certo na hora certa.
(globalThis as Record<string, unknown>).Deno = {
  env: { get: (nome: string) => ambienteFalso.get(nome) },
};

let falhas = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

/** Prepara o ambiente, zera os avisos e lê. */
function ler(nome: string, valor?: string) {
  ambienteFalso.clear();
  avisos.length = 0;
  if (valor !== undefined) ambienteFalso.set(nome, valor);
  console.warn = (...args: unknown[]) => void avisos.push(args.join(' '));
  const resultado = lerAmbiente(nome);
  console.warn = warnOriginal;
  return resultado;
}

console.log('\n— valor limpo passa intacto e em silêncio —\n');

const PRECO = 'price_1U3FxhPcpMk0DJ4dM6n5UuBZ';
checar('valor sem espaço volta idêntico', ler('STRIPE_PRICE_MENSAL', PRECO) === PRECO);
checar('e não gera aviso nenhum', avisos.length === 0, `${avisos.length} aviso(s)`);

console.log('\n— o caractere invisível do incidente —\n');

const comTab = ler('STRIPE_PRICE_MENSAL', `\t${PRECO}`);
checar('tab no início é aparado', comTab === PRECO, JSON.stringify(comTab));
checar('e o aviso nomeia a variável', avisos.length === 1 && avisos[0].includes('STRIPE_PRICE_MENSAL'));
checar(
  'o aviso NÃO imprime o valor — é chave de API, e log muita gente lê',
  avisos.every((a) => !a.includes(PRECO)),
  avisos[0] ?? ''
);

const comEspacos = ler('STRIPE_API_KEY', `  rk_test_exemplo\n`);
checar('espaço e quebra de linha nas duas pontas somem', comEspacos === 'rk_test_exemplo');
checar('e também avisam', avisos.length === 1);

console.log('\n— o meio da string é intocado: aparar não é limpar —\n');

const comEspacoNoMeio = ler('QUALQUER', ' antes meio depois ');
checar(
  'espaço interno permanece',
  comEspacoNoMeio === 'antes meio depois',
  JSON.stringify(comEspacoNoMeio)
);

console.log('\n— ausente, vazia e só-espaço dão no mesmo: undefined —\n');

checar('variável ausente é undefined', ler('NAO_EXISTE') === undefined);
checar('e não avisa — ausente não é torta', avisos.length === 0);
checar('string vazia é undefined', ler('VAZIA', '') === undefined);
checar('só espaços é undefined, e não string vazia', ler('SO_ESPACOS', '   ') === undefined);
checar('mas só-espaços avisa, porque alguém digitou alguma coisa lá', avisos.length === 1);

console.log('\n— a prova de que este teste sabe reprovar —\n');

// Sem isto, tudo acima passaria com um `lerAmbiente` que devolve o que recebe.
const semAparar = (nome: string) => ambienteFalso.get(nome);
ambienteFalso.clear();
ambienteFalso.set('X', `\t${PRECO}`);
checar(
  'uma leitura que NÃO apara seria pega pela asserção do tab',
  semAparar('X') !== PRECO,
  'o teste falha quando o trim some'
);

console.log(
  falhas === 0
    ? '\nLeitura de ambiente: apara, avisa, e nunca imprime o valor.\n'
    : `\n${falhas} falha(s).\n`
);
process.exit(falhas === 0 ? 0 : 1);

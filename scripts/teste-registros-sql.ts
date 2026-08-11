/**
 * O que este teste defende: que a migration da tabela de eventos continua sendo
 * o que o `registroSchema.ts` diz.
 *
 * A opção B move os `check` de vocabulário do banco para dentro do `jsonb`, e a
 * resposta para "o que substitui isso" é: `check` de tabela, condicionado ao
 * tipo, GERADO a partir do schema. Se ninguém conferir a geração, o vocabulário
 * volta a existir em dois lugares — TypeScript e SQL — e diverge na primeira
 * correção que só um receber. Foi assim com "Esquerdo"/"Peito esquerdo".
 *
 * Aqui não há como divergir em silêncio: somar um humor sem regerar o SQL
 * reprova, e a frase diz o comando.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/005_registros.sql';
const COMANDO = 'npx tsx scripts/gerar-registros-sql.ts > supabase/migrations/005_registros.sql';

let falhas = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

if (!existsSync(MIGRATION)) {
  console.log(`[ FALHA] ${MIGRATION} não existe — gere com:\n         ${COMANDO}`);
  process.exit(1);
}

const noRepositorio = readFileSync(MIGRATION, 'utf8').replace(/\r\n/g, '\n').trim();
const gerado = execFileSync('npx', ['tsx', 'scripts/gerar-registros-sql.ts'], {
  encoding: 'utf8',
  shell: true,
})
  .replace(/\r\n/g, '\n')
  .trim();

console.log('\n— a migration é o schema, escrito em SQL —\n');

if (noRepositorio !== gerado) {
  // Mostra a primeira linha divergente: dizer "diferente" sem dizer onde
  // transforma o teste em adivinhação.
  const a = noRepositorio.split('\n');
  const b = gerado.split('\n');
  const i = a.findIndex((linha, n) => linha !== b[n]);
  console.log(`         primeira divergência na linha ${i + 1}:`);
  console.log(`         no arquivo: ${a[i] ?? '(acabou)'}`);
  console.log(`         no schema:  ${b[i] ?? '(acabou)'}`);
}

checar(
  'o arquivo no repositório é exatamente o que o schema gera hoje',
  noRepositorio === gerado,
  noRepositorio === gerado ? '' : `regere com: ${COMANDO}`
);

console.log('\n— e ela garante o que precisa garantir —\n');

// Sem estas, o teste acima passaria com um gerador que não gera check nenhum:
// arquivo e gerador concordariam, os dois vazios.
const exigencias: [string, string][] = [
  ['a RLS é ligada', 'enable row level security'],
  ['existe policy de posse do bebê', 'create policy'],
  ['a exclusão de conta alcança os registros', 'on delete cascade'],
  ['o tipo é checado no banco', "check (tipo in ("],
  ['o vocabulário da fralda está no SQL', "in ('pee', 'poop', 'both')"],
  ['o vocabulário do humor está no SQL', "'agitated'"],
  ['campo obrigatório vira exigência de chave', 'dados ?'],
  ['número vira coluna gerada, indexável e checável', 'generated always as'],
  ['a lista tem índice por tempo', '(baby_id, ocorrido_em desc)'],
  ['e a lista filtrada por tipo também', '(baby_id, tipo, ocorrido_em desc)'],
];

for (const [nome, trecho] of exigencias) {
  checar(nome, gerado.includes(trecho), gerado.includes(trecho) ? '' : `faltou: ${trecho}`);
}

console.log(
  falhas === 0
    ? '\nMigration 005 em dia com o schema, e com as travas no lugar.\n'
    : `\n${falhas} falha(s).\n`
);
process.exit(falhas === 0 ? 0 : 1);

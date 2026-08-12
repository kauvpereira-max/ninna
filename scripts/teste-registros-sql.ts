/**
 * O que este teste defende: que as restrições de `registros` continuam sendo o
 * que o `registroSchema.ts` diz, e que o gerador sabe recusar o que não pode
 * decidir sozinho.
 *
 * A tabela de eventos move os `check` de vocabulário para dentro do `jsonb`, e a
 * resposta para "o que substitui isso" é: `check` de tabela, condicionado ao
 * tipo, GERADO a partir do schema. Se ninguém conferir a geração, o vocabulário
 * volta a existir em dois lugares — TypeScript e SQL — e diverge na primeira
 * correção que só um receber. Foi assim com "Esquerdo"/"Peito esquerdo", e com
 * "fale"/"fala com o pediatra".
 *
 * ------------------------------------------------------------------
 * O QUE MUDOU EM 11/08/2026
 *
 * O gerador emitia a `005` inteira, e isso serviu uma vez. Agora ele emite
 * `supabase/restricoes/registros.sql` — o estado desejado das restrições, em
 * `drop constraint if exists` + `add constraint`, seguro de rodar de novo.
 *
 * Então este teste passou a defender DUAS coisas, com naturezas opostas:
 *
 *   · a `005` é HISTÓRIA e está congelada. Ela criou a tabela, a RLS, a policy e
 *     os índices, e isso não muda mais. O teste confere que continua lá;
 *   · o arquivo de restrições é ESTADO, e tem que bater com o schema de hoje.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { montarSql } from './gerar-registros-sql.ts';
import type { SchemaRegistro } from '../src/lib/registroSchema.ts';

const CRIACAO = 'supabase/migrations/005_registros.sql';
const RESTRICOES = 'supabase/restricoes/registros.sql';
const COMANDO = `npx tsx scripts/gerar-registros-sql.ts > ${RESTRICOES}`;

let falhas = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

for (const arquivo of [CRIACAO, RESTRICOES]) {
  if (!existsSync(arquivo)) {
    console.log(`[ FALHA] ${arquivo} não existe — gere com:\n         ${COMANDO}`);
    process.exit(1);
  }
}

const semCr = (texto: string) => texto.replace(/\r\n/g, '\n').trim();

const criacao = semCr(readFileSync(CRIACAO, 'utf8'));
const noRepositorio = semCr(readFileSync(RESTRICOES, 'utf8'));
const gerado = semCr(
  execFileSync('npx', ['tsx', 'scripts/gerar-registros-sql.ts'], {
    encoding: 'utf8',
    shell: true,
  })
);

console.log('\n— o arquivo de restrições é o schema, escrito em SQL —\n');

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

console.log('\n— e ele é seguro de rodar de novo —\n');

/**
 * A propriedade que faz somar um tipo ser UMA edição: o arquivo descreve estado,
 * não passo. Sem ela, o segundo `alter` do mesmo dia falha com "constraint já
 * existe", e a saída é editar SQL à mão — que é exatamente o que o gerador
 * existe para não fazer.
 */
const adicoes = [...gerado.matchAll(/add {2}constraint (\w+) check/g)].map((m) => m[1]);
const semDrop = adicoes.filter(
  (nome) => !gerado.includes(`drop constraint if exists ${nome};`)
);

checar(
  'toda restrição é derrubada antes de ser criada',
  adicoes.length > 0 && semDrop.length === 0,
  semDrop.length > 0 ? `sem drop: ${semDrop.join(', ')}` : `${adicoes.length} restrições`
);

/**
 * Ancorado no começo da linha, e não solto no texto: o cabeçalho do arquivo
 * gerado FALA sobre `add column`, explicando que ele não troca a expressão de
 * uma coluna que já existe. A primeira versão desta asserção casou com a prosa e
 * reprovou um arquivo correto — varredura que não sabe distinguir código de
 * comentário é a regra 2 outra vez, do lado do falso positivo.
 */
const colunasSemGuarda = [
  ...gerado.matchAll(/^alter table registros add column (?!if not exists)(\w+)/gm),
].map((m) => m[1]);

checar(
  'toda coluna gerada entra com if not exists',
  colunasSemGuarda.length === 0,
  colunasSemGuarda.length > 0 ? `sem guarda: ${colunasSemGuarda.join(', ')}` : ''
);

checar(
  'o arquivo de restrições não recria a tabela',
  !gerado.includes('create table'),
  'create table aqui significaria que o gerador voltou a servir uma vez só'
);

/**
 * O `check` inline da `005` não tem nome, então o Postgres o chamou de
 * `registros_tipo_check`. Sem derrubá-lo, o banco ficaria com DOIS checks de
 * tipo: o velho, que não conhece os tipos novos, e o novo. O velho venceria.
 */
checar(
  'o check de tipo da 005 é derrubado pelo nome automático',
  gerado.includes('drop constraint if exists registros_tipo_check'),
  'sem isso, um tipo novo passaria no check novo e morreria no antigo'
);

console.log('\n— e ele garante o que precisa garantir —\n');

// Sem estas, a comparação acima passaria com um gerador que não gera check
// nenhum: arquivo e gerador concordariam, os dois vazios.
const noGerado: [string, string][] = [
  ['o tipo é checado no banco', 'tipo in ('],
  ['o vocabulário da fralda está no SQL', "in ('pee', 'poop', 'both')"],
  ['o vocabulário do humor está no SQL', "'agitated'"],
  ['campo obrigatório vira exigência de chave', 'dados ?'],
  ['número vira coluna gerada, indexável e checável', 'generated always as'],
  ['a faixa do número vira check', 'between'],
];

for (const [nome, trecho] of noGerado) {
  checar(nome, gerado.includes(trecho), gerado.includes(trecho) ? '' : `faltou: ${trecho}`);
}

console.log('\n— a 005 é história, e continua contando a mesma história —\n');

// Estas moram na criação e não voltam a ser geradas. Elas continuam sendo o que
// protege a tabela, então continuam sendo conferidas — só que no arquivo certo.
const naCriacao: [string, string][] = [
  ['a tabela é criada lá, e só lá', 'create table registros'],
  ['a RLS é ligada', 'enable row level security'],
  ['existe policy de posse do bebê', 'create policy'],
  ['a exclusão de conta alcança os registros', 'on delete cascade'],
  ['a lista tem índice por tempo', '(baby_id, ocorrido_em desc)'],
  ['e a lista filtrada por tipo também', '(baby_id, tipo, ocorrido_em desc)'],
  ['o sono em aberto tem índice parcial', 'where terminou_em is null'],
];

for (const [nome, trecho] of naCriacao) {
  checar(nome, criacao.includes(trecho), criacao.includes(trecho) ? '' : `faltou: ${trecho}`);
}

console.log('\n— a colisão de coluna compartilhada REPROVA, e o compartilhamento não —\n');

/**
 * A guarda que o bloco dos 14 tipos vai exercitar, provada aqui com schema
 * SINTÉTICO — é por isso que `montarSql` é exportada e recebe os schemas em vez
 * de lê-los.
 *
 * Mesma chave em tipos diferentes é a MESMA coluna no banco. Antes, a coleta
 * guardava as colunas num `Map` chaveado pela DDL, que não contém a faixa: dois
 * tipos com faixas diferentes se sobrescreviam em silêncio, e qual vencia
 * dependia da ordem do `TIPOS_REGISTRO`.
 *
 * Guarda que ninguém exercita é guarda que ninguém sabe se funciona. As duas
 * asserções abaixo são irmãs e nenhuma serve sozinha: a primeira prova que ela
 * pega o caso ruim, a segunda que ela não pega o caso bom — uma guarda que
 * reprova tudo passaria na primeira e travaria o projeto.
 */
const numero = (coluna: string, max: number): SchemaRegistro['campos'][number] => ({
  entrada: 'numero',
  chave: 'quantidade',
  coluna,
  rotulo: 'Quantidade',
  obrigatorio: true,
  min: 5,
  max,
  escala: 1,
  digitos: 4,
  placeholder: 'ex.: 90',
  erroFaixa: 'fora da faixa',
});

const tipoFalso = (nome: string, coluna: string, max: number): SchemaRegistro =>
  ({
    tipo: nome,
    titulo: nome,
    subtitulo: '',
    acao: 'Salvar',
    campos: [numero(coluna, max)],
  }) as unknown as SchemaRegistro;

function montarEsperandoErro(schemas: Record<string, SchemaRegistro>, tipos: string[]) {
  try {
    montarSql(schemas, tipos);
    return null;
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
}

const DEVE_REPROVAR = montarEsperandoErro(
  {
    mamadeira: tipoFalso('mamadeira', 'amount_ml', 500),
    hidratacao: tipoFalso('hidratacao', 'amount_ml', 1000),
  },
  ['mamadeira', 'hidratacao']
);

checar(
  'duas faixas diferentes na mesma coluna param o gerador',
  DEVE_REPROVAR !== null && DEVE_REPROVAR.includes('amount_ml'),
  DEVE_REPROVAR ? DEVE_REPROVAR.split('\n')[0] : 'passou em silêncio — a colisão voltou'
);

checar(
  'e o erro diz QUAIS tipos discordam, senão a mensagem não ajuda',
  DEVE_REPROVAR !== null &&
    DEVE_REPROVAR.includes('mamadeira') &&
    DEVE_REPROVAR.includes('hidratacao')
);

const DEVE_PASSAR = montarEsperandoErro(
  {
    atividade: tipoFalso('atividade', 'duration_seconds', 180),
    passeio: tipoFalso('passeio', 'duration_seconds', 180),
  },
  ['atividade', 'passeio']
);

checar(
  'e a MESMA faixa em dois tipos continua passando',
  DEVE_PASSAR === null,
  DEVE_PASSAR
    ? `reprovou o caso bom: ${DEVE_PASSAR.split('\n')[0]}`
    : 'compartilhar coluna é o desenho, não o erro'
);

console.log('\n— e a mesma chave com FORMAS diferentes também reprova —\n');

/**
 * O guarda irmão, encontrado desenhando o grupo de saúde.
 *
 * Medicação queria `dose` como número (2,5 ml) e vacina queria `dose` como
 * escolha (1ª dose, reforço). Não são o mesmo campo — têm o mesmo nome em
 * português e nada mais.
 *
 * O guarda de faixa NÃO pega isso: ele só compara `min`/`max` entre campos
 * numéricos, e aqui um dos dois nem é numérico. O gerador produziria uma coluna
 * com `(dados->>'dose')::int` **e** um check de vocabulário com palavras sobre a
 * mesma chave — e a primeira vacina salva explodiria no cast, com 22P02, sem
 * nada apontar para o gerador.
 */
const escolha = (coluna: string): SchemaRegistro['campos'][number] => ({
  entrada: 'escolha',
  chave: 'dose',
  coluna,
  rotulo: 'Dose',
  obrigatorio: true,
  erroFalta: 'falta',
  opcoes: [{ value: 'first', label: '1ª dose' }],
});

const tipoComEscolha = (nome: string, coluna: string): SchemaRegistro =>
  ({
    tipo: nome,
    titulo: nome,
    subtitulo: '',
    acao: 'Salvar',
    campos: [escolha(coluna)],
  }) as unknown as SchemaRegistro;

const FORMAS_DIFERENTES = montarEsperandoErro(
  {
    medicacao: tipoFalso('medicacao', 'dose', 1000),
    vacina: tipoComEscolha('vacina', 'dose'),
  },
  ['medicacao', 'vacina']
);

checar(
  'número num tipo e escolha noutro, na mesma chave, param o gerador',
  FORMAS_DIFERENTES !== null && FORMAS_DIFERENTES.includes('dose'),
  FORMAS_DIFERENTES
    ? FORMAS_DIFERENTES.split('\n')[0]
    : 'passou — o cast da coluna gerada explodiria na primeira linha'
);
checar(
  'e o erro diz as duas formas, senão não dá para agir',
  FORMAS_DIFERENTES !== null &&
    FORMAS_DIFERENTES.includes('numero') &&
    FORMAS_DIFERENTES.includes('escolha')
);

// O controle: a mesma chave com a MESMA forma continua sendo compartilhamento
// legítimo, e é o que `duration_seconds` faz em quatro tipos.
const MESMA_FORMA = montarEsperandoErro(
  {
    vacina: tipoComEscolha('vacina', 'stage'),
    reforco: tipoComEscolha('reforco', 'stage'),
  },
  ['vacina', 'reforco']
);

checar(
  'e a mesma chave com a mesma forma continua passando',
  MESMA_FORMA === null,
  MESMA_FORMA ? `reprovou o caso bom: ${MESMA_FORMA.split('\n')[0]}` : ''
);

console.log(
  falhas === 0
    ? '\nRestrições em dia com o schema, idempotentes, e a colisão travada.\n'
    : `\n${falhas} falha(s).\n`
);
process.exit(falhas === 0 ? 0 : 1);

/**
 * Gera as RESTRIÇÕES da tabela `registros` A PARTIR do `registroSchema.ts`.
 *
 *   npx tsx scripts/gerar-registros-sql.ts > supabase/restricoes/registros.sql
 *
 * ------------------------------------------------------------------
 * POR QUE GERADO, E NÃO ESCRITO À MÃO
 *
 * A tabela de eventos tem um custo real: o banco perde os `check` de coluna,
 * porque o valor passa a morar dentro de um `jsonb`. A resposta é que o check
 * não se perde — ele vira `check` de tabela, condicionado ao tipo:
 *
 *     check (tipo <> 'fralda' or dados->>'content' in ('pee','poop','both'))
 *
 * Só que isso reintroduziria o problema que o bloco 2 matou: o vocabulário
 * declarado em DOIS lugares, TypeScript e SQL, divergindo na primeira correção
 * que só um receber. Por isso o SQL sai daqui, como o `gramaticaParaModelo()`
 * gera o prompt do assistente a partir da superfície de consulta.
 *
 * ------------------------------------------------------------------
 * POR QUE ELE DEIXOU DE EMITIR `create table` — 11/08/2026
 *
 * Ele emitia a `005` inteira, e isso funcionou exatamente uma vez.
 *
 * A `005` já foi aplicada. Somar um tipo muda o `check (tipo in (…))` e
 * acrescenta os checks de vocabulário dele — e aí o arquivo gerado passa a ser
 * um `create table` de uma tabela que existe. Não há caminho do arquivo novo até
 * o banco, e o teste reprova sem ter o que oferecer como conserto.
 *
 * Migration que só sabe criar do zero serve uma vez. Então este gerador passou a
 * emitir o ESTADO DESEJADO das restrições, de forma idempotente:
 *
 *     alter table registros drop constraint if exists X;
 *     alter table registros add  constraint X check (…);
 *
 * Roda quantas vezes for preciso e sempre leva o banco ao que o `SCHEMAS` diz. A
 * `005` fica congelada como história — ela criou a tabela, e isso não muda mais.
 *
 * O custo aceito: `migrations/` deixa de contar a história das restrições. Quem
 * quiser saber o vocabulário de hoje lê o arquivo gerado, não a sequência.
 *
 * ------------------------------------------------------------------
 * O QUE ISTO NÃO ALCANÇA, E PRECISA DE MIGRATION À MÃO
 *
 * 1. **Mudar a expressão de uma coluna gerada que já existe.** O
 *    `add column if not exists` pula em silêncio quando a coluna está lá — ele
 *    não compara a expressão. Trocar a fórmula de `duration_seconds` exige um
 *    `drop column` + `add column`, que reescreve a tabela e é decisão consciente.
 *
 * 2. **Apagar restrição que saiu do schema.** Este arquivo derruba e recria o
 *    que o schema declara HOJE; uma constraint removida do TypeScript continua
 *    no banco, invisível. Por isso a conferência do rodapé lista o que existe no
 *    banco e não foi gerado aqui — leftover não some sozinho, mas para de ser
 *    silencioso.
 */

import {
  COLUNAS_REAIS,
  SCHEMAS,
  TIPOS_REGISTRO,
  type CampoSchema,
  type SchemaRegistro,
} from '../src/lib/registroSchema.ts';

// `COLUNAS_REAIS` — o que vira coluna de verdade em vez de chave no `dados` —
// mora no `registroSchema.ts`, e não aqui. Ela decide duas coisas ao mesmo
// tempo: o que este gerador transforma em `check`, e onde o `linhaParaBanco`
// escreve o valor. Duas listas divergiriam na primeira coluna nova.

const aspas = (valor: string) => `'${valor.replace(/'/g, "''")}'`;

function chaveNoJson(campo: CampoSchema): string | null {
  if (!campo.coluna || COLUNAS_REAIS.has(campo.coluna)) return null;
  return campo.coluna;
}

type Restricao = { nome: string; corpo: string };

/** O vocabulário fechado de um campo de escolha, como `check` condicionado ao tipo. */
function checkDeVocabulario(tipo: string, campo: CampoSchema): Restricao | null {
  if (campo.entrada !== 'escolha') return null;
  const chave = chaveNoJson(campo);
  if (!chave) return null;

  const valores = campo.opcoes.map((o) => aspas(o.value)).join(', ');
  const leitura = `dados->>${aspas(chave)}`;

  // Campo opcional aceita ausência; o que nenhum dos dois aceita é valor de fora.
  const ausencia = campo.obrigatorio ? '' : `${leitura} is null or `;
  return {
    nome: `vocab_${tipo}_${chave}`,
    corpo: `tipo <> ${aspas(tipo)} or ${ausencia}${leitura} in (${valores})`,
  };
}

/** Campo obrigatório do schema vira exigência de chave presente no `dados`. */
function checkDeObrigatorio(tipo: string, campo: CampoSchema): Restricao | null {
  // `quando` deixa o campo obrigatório só em certas combinações — isso é regra de
  // formulário, não invariante da linha, e forçá-la aqui recusaria registro
  // antigo legítimo. Fica com o app, que é quem conhece o contexto.
  if (!campo.obrigatorio || campo.quando) return null;
  const chave = chaveNoJson(campo);
  if (!chave) return null;

  return {
    nome: `exige_${tipo}_${chave}`,
    corpo: `tipo <> ${aspas(tipo)} or dados ? ${aspas(chave)}`,
  };
}

/**
 * Os campos numéricos viram coluna GERADA, não check dentro do jsonb.
 *
 * Duas razões, e a segunda decide: o check de faixa fica legível, e a coluna
 * passa a ser um inteiro de verdade — indexável, agregável em SQL, e visível
 * para quem abre o SQL Editor às pressas. É o campo que o motor soma.
 */
type ColunaGerada = { chave: string; ddl: string; faixa: Restricao; declaradaPor: string };

function colunaGerada(tipo: string, campo: CampoSchema): ColunaGerada | null {
  if (campo.entrada !== 'numero') return null;
  const chave = chaveNoJson(campo);
  if (!chave) return null;

  const naUnidadeDaColuna = (valor: number) => valor * campo.escala;

  return {
    chave,
    declaradaPor: tipo,
    ddl: `${chave} int generated always as ((dados->>${aspas(chave)})::int) stored`,
    faixa: {
      nome: `faixa_${chave}`,
      corpo: `${chave} is null or ${chave} between ${naUnidadeDaColuna(campo.min)} and ${naUnidadeDaColuna(campo.max)}`,
    },
  };
}

// ------------------------------------------------------------------
// Coleta
// ------------------------------------------------------------------

export function montarSql(
  schemas: Record<string, SchemaRegistro>,
  tipos: string[]
): string {
const geradas = new Map<string, ColunaGerada>();
const restricoes: Restricao[] = [];

for (const tipo of tipos) {
  for (const campo of schemas[tipo].campos) {
    const vocab = checkDeVocabulario(tipo, campo);
    if (vocab) restricoes.push(vocab);

    const exige = checkDeObrigatorio(tipo, campo);
    if (exige) restricoes.push(exige);

    const gerada = colunaGerada(tipo, campo);
    if (!gerada) continue;

    /**
     * COLISÃO DE COLUNA COMPARTILHADA — falha alto, e este `throw` é novo.
     *
     * Mesma chave em tipos diferentes é a MESMA coluna no banco: `amount_ml`
     * hoje só existe na mamadeira, mas `duration_seconds` já nasceu
     * compartilhável, e o bloco dos 14 tipos traz Hidratação e Extração, que
     * também querem ml — com faixas próprias.
     *
     * Antes disto, a coleta era um `Map` cuja chave era a DDL da coluna. A DDL
     * não contém a faixa, então dois tipos com faixas diferentes se
     * sobrescreviam: **o último iterado vencia, sem aviso**, e qual era o último
     * dependia da ordem do `TIPOS_REGISTRO`. O banco passaria a recusar um valor
     * legítimo, ou a aceitar um absurdo, e nada apontaria para cá.
     *
     * Não dá para resolver sozinho: unir as faixas perde rigor, e escolher uma
     * delas é escolher por quem escreve. As saídas são de produto — chaves
     * distintas (`amount_ml` e `volume_ml`), ou faixa condicionada ao tipo. As
     * duas exigem decisão, e é por isso que aqui só cabe parar.
     */
    const jaExiste = geradas.get(gerada.chave);
    if (jaExiste && jaExiste.faixa.corpo !== gerada.faixa.corpo) {
      throw new Error(
        `Colisão na coluna gerada '${gerada.chave}':\n` +
          `  ${jaExiste.declaradaPor} declara  ${jaExiste.faixa.corpo}\n` +
          `  ${gerada.declaradaPor} declara  ${gerada.faixa.corpo}\n\n` +
          `Mesma chave é a mesma coluna no banco, e uma coluna tem uma faixa só.\n` +
          `Saídas: usar chaves distintas, ou condicionar a faixa ao tipo.\n` +
          `Escolher em silêncio seria deixar o banco recusar registro legítimo.`
      );
    }
    if (!jaExiste) geradas.set(gerada.chave, gerada);
  }
}

const colunas = [...geradas.values()];
const tiposValidos = tipos.map((t) => aspas(t)).join(', ');

/**
 * O check do `tipo` ganhou nome. Na `005` ele é inline e sem nome, então o
 * Postgres o batizou de `registros_tipo_check` — o padrão `<tabela>_<coluna>_check`.
 * Este arquivo derruba os dois: o nome automático da criação e o nome próprio,
 * para poder recriá-lo sabendo como ele se chama.
 */
const CHECK_DO_TIPO: Restricao = {
  nome: 'tipo_conhecido',
  corpo: `tipo in (${tiposValidos})`,
};

const todas = [CHECK_DO_TIPO, ...colunas.map((c) => c.faixa), ...restricoes];

const alterar = (r: Restricao) =>
  `alter table registros drop constraint if exists ${r.nome};\n` +
  `alter table registros add  constraint ${r.nome} check (\n  ${r.corpo}\n);`;

return `-- Ninna — restrições de \`registros\`, geradas do registroSchema.ts
--
-- ⚠️ ARQUIVO GERADO. Não edite à mão.
--    npx tsx scripts/gerar-registros-sql.ts > supabase/restricoes/registros.sql
--    O teste-registros-sql.ts reprova se este arquivo divergir do schema.
--
-- ------------------------------------------------------------------
-- É SEGURO RODAR QUANTAS VEZES FOR PRECISO
--
-- Cada restrição é derrubada e recriada, e cada coluna gerada entra com
-- \`if not exists\`. O arquivo descreve o ESTADO DESEJADO, não um passo — rodá-lo
-- num banco que já está certo não muda nada.
--
-- É isso que faz somar um tipo de registro ser UMA edição: mexe no
-- \`registroSchema.ts\`, regera este arquivo, roda no SQL Editor.
--
-- A criação da tabela mora na \`005_registros.sql\`, que está congelada. Ela
-- aconteceu uma vez e não volta a acontecer.
--
-- ------------------------------------------------------------------
-- ⚠️ DUAS COISAS QUE ELE NÃO FAZ
--
-- 1. Não muda a expressão de coluna gerada que já existe: \`add column if not
--    exists\` pula em silêncio sem comparar a fórmula. Trocar a fórmula é
--    migration à mão, com \`drop column\`, e reescreve a tabela.
--
-- 2. Não apaga restrição que saiu do schema. A conferência do rodapé lista o que
--    está no banco e não foi gerado aqui — leftover não some sozinho, mas para
--    de ser invisível.

-- ============================================================
-- COLUNAS GERADAS
-- ============================================================
--
-- O número sai do \`dados\` e vira inteiro de verdade: indexável, somável em SQL,
-- e com faixa checável. É o campo que o motor lê.

${colunas.map((c) => `alter table registros add column if not exists ${c.ddl};`).join('\n')}

-- ============================================================
-- O TIPO
-- ============================================================
--
-- A única coluna cuja integridade não pode depender do app: é por ela que tudo
-- se filtra. O \`drop\` do nome automático limpa o check inline da 005.

alter table registros drop constraint if exists registros_tipo_check;
${alterar(CHECK_DO_TIPO)}

-- ============================================================
-- FAIXAS NUMÉRICAS
-- ============================================================

${colunas.map((c) => alterar(c.faixa)).join('\n\n')}

-- ============================================================
-- VOCABULÁRIO E CAMPOS OBRIGATÓRIOS, POR TIPO
-- ============================================================
--
-- O que o Postgres garantia com \`check\` de coluna ele continua garantindo. A
-- diferença é que a regra passou a ter uma origem só.

${restricoes.map(alterar).join('\n\n')}

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- 1 · As restrições esperadas estão todas lá?
--     Esperado: ${todas.length} linhas, nenhuma com faltando = true.
--
-- select nome, not exists (
--          select 1 from pg_constraint
--          where conrelid = 'registros'::regclass and conname = nome
--        ) as faltando
-- from unnest(array[${todas.map((r) => aspas(r.nome)).join(', ')}]) as nome
-- order by faltando desc, nome;
--
-- 2 · Sobrou alguma que o schema não declara mais?
--     Esperado: nenhuma linha. Cada uma que aparecer é regra que o TypeScript
--     esqueceu e o banco continua aplicando — ver o aviso do cabeçalho.
--
-- select conname
-- from pg_constraint
-- where conrelid = 'registros'::regclass
--   and contype = 'c'
--   and conname <> all (array[${todas.map((r) => aspas(r.nome)).join(', ')}]);`;
}

/**
 * A casca. `montarSql` é exportada e pura para o teste poder chamá-la com um
 * schema SINTÉTICO — é assim que a colisão de coluna se prova: montando dois
 * tipos que a provocam e exigindo que ela estoure. Guarda que não é exercitada
 * é guarda que ninguém sabe se funciona.
 */
const ehEntrada = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/gerar-registros-sql.ts');
if (ehEntrada) console.log(montarSql(SCHEMAS, TIPOS_REGISTRO));

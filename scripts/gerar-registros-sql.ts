/**
 * Gera o SQL da tabela `registros` A PARTIR do `registroSchema.ts`.
 *
 * ------------------------------------------------------------------
 * POR QUE GERADO, E NÃO ESCRITO À MÃO
 *
 * A opção B (tabela de eventos) tem um custo real: o banco perde os `check` de
 * coluna, porque o valor passa a morar dentro de um `jsonb`. A resposta é que o
 * check não se perde — ele vira `check` de tabela, condicionado ao tipo:
 *
 *     check (tipo <> 'fralda' or dados->>'content' in ('pee','poop','both'))
 *
 * Testado no Postgres do projeto em 11/08/2026, numa sandbox descartada depois:
 * valor fora do vocabulário é recusado com 23514, campo obrigatório ausente
 * também, e coluna gerada a partir do jsonb aceita `check` de faixa.
 *
 * Só que isso reintroduz o problema que o bloco 2 acabou de matar: o vocabulário
 * declarado em DOIS lugares — no TypeScript e no SQL — divergindo na primeira
 * correção que só um receber.
 *
 * Por isso o SQL é gerado daqui, como o `gramaticaParaModelo()` gera o prompt do
 * assistente a partir da superfície de consulta. O `teste-registros-sql.ts`
 * confere que a migration no repositório é exatamente o que este gerador produz
 * hoje — mexer no vocabulário sem regerar quebra o teste.
 *
 *   npx tsx scripts/gerar-registros-sql.ts > supabase/migrations/005_registros.sql
 */

import {
  COLUNAS_REAIS,
  SCHEMAS,
  TIPOS_REGISTRO,
  type CampoSchema,
  type TipoRegistro,
} from '../src/lib/registroSchema.ts';

// `COLUNAS_REAIS` — o que vira coluna de verdade em vez de chave no `dados` —
// mora no `registroSchema.ts`, e não aqui. Ela decide duas coisas ao mesmo
// tempo: o que este gerador transforma em `check`, e onde o `linhaParaBanco`
// escreve o valor. Duas listas divergiriam na primeira coluna nova, e a
// divergência apareceria como campo que o app grava e o banco não confere.

const aspas = (valor: string) => `'${valor.replace(/'/g, "''")}'`;

function chaveNoJson(campo: CampoSchema): string | null {
  if (!campo.coluna || COLUNAS_REAIS.has(campo.coluna)) return null;
  return campo.coluna;
}

/** O vocabulário fechado de um campo de escolha, como `check` condicionado ao tipo. */
function checkDeVocabulario(tipo: TipoRegistro, campo: CampoSchema): string | null {
  if (campo.entrada !== 'escolha') return null;
  const chave = chaveNoJson(campo);
  if (!chave) return null;

  const valores = campo.opcoes.map((o) => aspas(o.value)).join(', ');
  const leitura = `dados->>${aspas(chave)}`;

  // Campo opcional aceita ausência; o que nenhum dos dois aceita é valor de fora.
  const ausencia = campo.obrigatorio ? '' : `${leitura} is null or `;
  return (
    `  constraint vocab_${tipo}_${chave} check (\n` +
    `    tipo <> ${aspas(tipo)} or ${ausencia}${leitura} in (${valores})\n` +
    `  )`
  );
}

/** Campo obrigatório do schema vira exigência de chave presente no `dados`. */
function checkDeObrigatorio(tipo: TipoRegistro, campo: CampoSchema): string | null {
  // `quando` deixa o campo obrigatório só em certas combinações — isso é regra de
  // formulário, não invariante da linha, e forçá-la aqui recusaria registro
  // antigo legítimo. Fica com o app, que é quem conhece o contexto.
  if (!campo.obrigatorio || campo.quando) return null;
  const chave = chaveNoJson(campo);
  if (!chave) return null;

  return (
    `  constraint exige_${tipo}_${chave} check (\n` +
    `    tipo <> ${aspas(tipo)} or dados ? ${aspas(chave)}\n` +
    `  )`
  );
}

/**
 * Os campos numéricos viram coluna GERADA, não check dentro do jsonb.
 *
 * Duas razões, e a segunda é a que decide: o check de faixa fica legível, e a
 * coluna passa a ser um inteiro de verdade — indexável, agregável em SQL, e
 * visível para quem abre o SQL Editor às pressas. É o campo que o motor soma.
 */
function colunaGerada(campo: CampoSchema): { coluna: string; check: string } | null {
  if (campo.entrada !== 'numero') return null;
  const chave = chaveNoJson(campo);
  if (!chave) return null;

  const naUnidadeDaColuna = (valor: number) => valor * campo.escala;

  return {
    coluna: `  ${chave} int generated always as ((dados->>${aspas(chave)})::int) stored`,
    check:
      `  constraint faixa_${chave} check (\n` +
      `    ${chave} is null or ${chave} between ${naUnidadeDaColuna(campo.min)} ` +
      `and ${naUnidadeDaColuna(campo.max)}\n` +
      `  )`,
  };
}

// ------------------------------------------------------------------

const geradas = new Map<string, { coluna: string; check: string }>();
const restricoes: string[] = [];

for (const tipo of TIPOS_REGISTRO) {
  for (const campo of SCHEMAS[tipo].campos) {
    const vocab = checkDeVocabulario(tipo, campo);
    if (vocab) restricoes.push(vocab);

    const exige = checkDeObrigatorio(tipo, campo);
    if (exige) restricoes.push(exige);

    const gerada = colunaGerada(campo);
    // Mesma chave em tipos diferentes é a mesma coluna — `amount_ml` só existe
    // na mamadeira hoje, mas `duration_seconds` já nasce compartilhável.
    if (gerada) geradas.set(gerada.coluna, gerada);
  }
}

const tiposValidos = TIPOS_REGISTRO.map((t) => aspas(t)).join(', ');
const colunasGeradas = [...geradas.values()];

console.log(`-- Ninna — migration 005: a tabela de eventos
--
-- ⚠️ ARQUIVO GERADO. Não edite à mão.
--    npx tsx scripts/gerar-registros-sql.ts > supabase/migrations/005_registros.sql
--    O teste-registros-sql.ts reprova se este arquivo divergir do schema.
--
-- Decisão e alternativas: docs/decisao-tabela-de-registros.md
--
-- POR QUE UMA TABELA E NÃO DEZENOVE
--
-- Com uma tabela por tipo, esquecer o RLS numa das 19 não quebra nada visível: a
-- tabela fica legível e gravável por qualquer usuária autenticada, e o app da
-- dona funciona igual. Aqui existe uma policy só, e não há como esquecê-la.
--
-- O QUE SUBSTITUI OS CHECK DE COLUNA
--
-- Eles não se perdem: viram check de tabela condicionados ao tipo, e são gerados
-- a partir do mesmo vocabulário que o app usa. O que o Postgres garantia, ele
-- continua garantindo — a diferença é que a regra passou a ter uma origem só.

create table registros (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies on delete cascade not null,

  -- O tipo é coluna de verdade, com check: é por ele que tudo se filtra, e é o
  -- único campo cuja integridade não pode depender do app.
  tipo text not null check (tipo in (${tiposValidos})),

  -- Ancora o registro na linha do tempo. Substitui started_at/recorded_at.
  ocorrido_em timestamptz not null,

  -- Fim do evento, quando ele tem duração. Não é o sono puxando a colcha:
  -- Extração, Atividade, Passeio e Leitura também têm começo e fim.
  terminou_em timestamptz,

  -- O que varia por tipo. Vocabulário fechado, garantido pelos check abaixo.
  dados jsonb not null default '{}',

  -- Texto livre da mãe. Coluna, e não chave no jsonb: não tem vocabulário para
  -- checar e é consultado por presença.
  notes text,

  created_at timestamptz default now(),

${colunasGeradas.map((g) => g.coluna).join(',\n')},

${[...colunasGeradas.map((g) => g.check), ...restricoes].join(',\n\n')}
);

alter table registros enable row level security;

-- Uma policy, uma tabela. O modo de falha silencioso da opção A não existe aqui.
create policy "acesso via posse do bebê"
  on registros for all using (
    exists (select 1 from babies where babies.id = registros.baby_id and babies.user_id = auth.uid())
  );

-- A lista unificada: uma consulta, ordenação e cursor no banco. Deixa de ser
-- merge de k listas no cliente porque deixa de haver k listas.
create index idx_registros_baby_tempo on registros (baby_id, ocorrido_em desc);

-- A mesma lista filtrada por tipo, e as leituras do motor.
create index idx_registros_baby_tipo_tempo on registros (baby_id, tipo, ocorrido_em desc);

-- Sono em aberto: a Home procura por isto a cada carga.
create index idx_registros_em_aberto on registros (baby_id)
  where terminou_em is null;

comment on table registros is
  'Eventos de rotina do bebê. Uma linha por registro, o que varia por tipo mora em dados.';

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- Esperado: rls_ligada = true, policies = 1, indices = 4 (3 + a chave primária),
-- e restricoes = o número de check gerados acima.
--
-- select
--   (select relrowsecurity from pg_class where relname = 'registros') as rls_ligada,
--   (select count(*) from pg_policy where polrelid = 'registros'::regclass) as policies,
--   (select count(*) from pg_indexes where tablename = 'registros') as indices,
--   (select count(*) from pg_constraint where conrelid = 'registros'::regclass
--      and contype = 'c') as restricoes;`);

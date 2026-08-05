// Teste de RLS de DELETE entre duas contas — roda contra o Supabase de verdade.
//
//   node scripts/teste-rls-delete.mjs
//
// Por que script e não checklist manual: são 6 tipos × 3 verificações × 2 contas.
// Feito à mão isso é executado uma vez, na correria, e nunca mais — e é justamente
// o teste que precisa ser repetido depois de qualquer mexida em policy.
//
// O que ele prova, por tipo de registro:
//   1. NEGATIVO   conta A não consegue apagar registro da conta B
//   2. PERMANÊNCIA depois da tentativa, a linha de B AINDA está no banco
//   3. POSITIVO   conta B consegue apagar o próprio registro
//
// O passo 3 não é decoração. Sem ele, uma policy que negasse absolutamente tudo
// passaria no teste com louvor — e o app inteiro estaria quebrado.
//
// Este script usa apenas a anon key (a mesma do app), nunca a service_role: o que
// está sendo testado é exatamente o que o navegador da mãe consegue fazer. Com a
// service_role a RLS é ignorada por definição e o teste não valeria nada.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// Ambiente
// ------------------------------------------------------------------

function lerEnv() {
  const texto = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const linha of texto.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = lerEnv();
const URL_SUPABASE = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_SUPABASE || !ANON) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY no .env');
  process.exit(1);
}

// Contas descartáveis, criadas na primeira execução e reaproveitadas depois.
// Trocar por contas suas com CONTA_A_EMAIL=... no ambiente, se preferir.
const CONTAS = {
  A: {
    email: process.env.CONTA_A_EMAIL ?? 'ninna-rls-a@teste-ninna.com',
    senha: process.env.CONTA_A_SENHA ?? 'teste-rls-ninna-a',
  },
  B: {
    email: process.env.CONTA_B_EMAIL ?? 'ninna-rls-b@teste-ninna.com',
    senha: process.env.CONTA_B_SENHA ?? 'teste-rls-ninna-b',
  },
};

// ------------------------------------------------------------------
// Sessões independentes
// ------------------------------------------------------------------

/**
 * Um cliente por conta, com persistência desligada: os dois precisam coexistir no
 * mesmo processo sem que o login de um sobrescreva o token do outro.
 */
function novoCliente() {
  return createClient(URL_SUPABASE, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function entrar(rotulo, { email, senha }) {
  const cliente = novoCliente();

  let { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });

  if (error) {
    // Primeira execução: a conta ainda não existe. Depende de "Confirm email"
    // desligado no painel — que é a configuração do beta (BETA.md §3.8).
    const criada = await cliente.auth.signUp({
      email,
      password: senha,
      options: { data: { nome: `Teste RLS ${rotulo}` } },
    });
    if (criada.error) {
      throw new Error(`não consegui criar/entrar na conta ${rotulo}: ${criada.error.message}`);
    }
    if (!criada.data.session) {
      throw new Error(
        `conta ${rotulo} criada mas sem sessão — "Confirm email" ainda está LIGADO no painel`
      );
    }
    data = criada.data;
  }

  return { cliente, userId: data.user.id };
}

/** Cada conta precisa de um bebê: é o baby_id que a policy usa pra achar o dono. */
async function garantirBebe(cliente, userId, nome) {
  const existente = await cliente.from('babies').select('id').limit(1);
  if (existente.error) throw new Error(`falha ao listar bebês: ${existente.error.message}`);
  if (existente.data.length > 0) return existente.data[0].id;

  const criado = await cliente
    .from('babies')
    .insert({ user_id: userId, name: nome, birth_date: '2025-01-01' })
    .select('id')
    .single();
  if (criado.error) throw new Error(`falha ao criar bebê: ${criado.error.message}`);
  return criado.data.id;
}

// ------------------------------------------------------------------
// Um registro de cada tipo
// ------------------------------------------------------------------

const AGORA = new Date().toISOString();

const TIPOS = [
  {
    nome: 'amamentar',
    tabela: 'feeding_records',
    linha: (babyId) => ({
      baby_id: babyId,
      type: 'breast',
      side: 'left',
      duration_seconds: 600,
      started_at: AGORA,
    }),
  },
  {
    nome: 'mamadeira',
    tabela: 'feeding_records',
    linha: (babyId) => ({
      baby_id: babyId,
      type: 'bottle',
      amount_ml: 90,
      bottle_type: 'formula',
      started_at: AGORA,
    }),
  },
  {
    nome: 'sono',
    tabela: 'sleep_records',
    linha: (babyId) => ({ baby_id: babyId, started_at: AGORA, ended_at: null }),
  },
  {
    nome: 'fralda',
    tabela: 'diaper_records',
    linha: (babyId) => ({ baby_id: babyId, content: 'pee', recorded_at: AGORA }),
  },
  {
    nome: 'humor',
    tabela: 'mood_records',
    linha: (babyId) => ({ baby_id: babyId, mood: 'calm', recorded_at: AGORA }),
  },
  {
    nome: 'sintoma',
    tabela: 'symptom_records',
    linha: (babyId) => ({ baby_id: babyId, symptom: 'fever', intensity: 'mild', recorded_at: AGORA }),
  },
];

// ------------------------------------------------------------------
// Execução
// ------------------------------------------------------------------

const resultados = [];
const registra = (tipo, verificacao, passou, detalhe) => {
  resultados.push({ tipo, verificacao, passou, detalhe });
  const marca = passou ? '  ok  ' : ' FALHA';
  console.log(`[${marca}] ${tipo.padEnd(11)} ${verificacao}${detalhe ? ` — ${detalhe}` : ''}`);
};

async function main() {
  console.log(`Projeto: ${URL_SUPABASE}\n`);

  const a = await entrar('A', CONTAS.A);
  const b = await entrar('B', CONTAS.B);

  if (a.userId === b.userId) {
    throw new Error('as duas contas são a mesma — o teste não provaria nada');
  }

  const bebeB = await garantirBebe(b.cliente, b.userId, 'Bebê de B');
  await garantirBebe(a.cliente, a.userId, 'Bebê de A');

  console.log(`conta A: ${a.userId}`);
  console.log(`conta B: ${b.userId}  (bebê ${bebeB})\n`);

  for (const tipo of TIPOS) {
    // B cria o registro.
    const criado = await b.cliente.from(tipo.tabela).insert(tipo.linha(bebeB)).select('id').single();
    if (criado.error) {
      registra(tipo.nome, 'preparação', false, `B não conseguiu criar: ${criado.error.message}`);
      continue;
    }
    const id = criado.data.id;

    // 1. NEGATIVO — A tenta apagar o registro de B.
    //
    // O PostgREST NÃO devolve erro aqui: a RLS filtra a linha e o delete
    // simplesmente não casa nada. Por isso o teste olha as linhas afetadas
    // (via .select()), não a ausência de erro. É a mesma armadilha que
    // apagarRegistro() trata em src/lib/registros.ts.
    const tentativa = await a.cliente.from(tipo.tabela).delete().eq('id', id).select('id');
    const linhasApagadasPorA = (tentativa.data ?? []).length;
    registra(
      tipo.nome,
      'A não apaga registro de B',
      linhasApagadasPorA === 0,
      linhasApagadasPorA > 0 ? `A apagou ${linhasApagadasPorA} linha(s) de B` : ''
    );

    // 2. PERMANÊNCIA — a linha continua lá, conferida pelos olhos de B.
    const conferencia = await b.cliente.from(tipo.tabela).select('id').eq('id', id).maybeSingle();
    registra(
      tipo.nome,
      'registro de B continua no banco',
      !conferencia.error && conferencia.data !== null,
      conferencia.data === null ? 'a linha sumiu' : ''
    );

    // 3. POSITIVO — B apaga o próprio registro. Sem isso, uma policy que negasse
    // tudo passaria nas duas verificações acima.
    const proprio = await b.cliente.from(tipo.tabela).delete().eq('id', id).select('id');
    const linhasApagadasPorB = (proprio.data ?? []).length;
    registra(
      tipo.nome,
      'B apaga o próprio registro',
      linhasApagadasPorB === 1,
      linhasApagadasPorB !== 1 ? `apagou ${linhasApagadasPorB} linha(s)` : ''
    );
  }

  const falhas = resultados.filter((r) => !r.passou);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);

  if (falhas.length > 0) {
    console.log('\nFALHOU:');
    for (const f of falhas) console.log(`  ${f.tipo} — ${f.verificacao}${f.detalhe ? `: ${f.detalhe}` : ''}`);
    console.log('\nNão liberar o beta com RLS falhando.');
    process.exit(1);
  }

  console.log('RLS de DELETE está correta nos 6 tipos.');
  console.log(
    '\nAs contas de teste continuam no projeto. Para removê-las: painel do Supabase >' +
      ' Authentication > Users, apagar ninna-rls-a@ e ninna-rls-b@.' +
      '\nIsso só funciona depois de rodar supabase/migrations/002_cascade_exclusao.sql —' +
      ' sem a cascata, apagar a mãe falha com erro 23503 enquanto ela tiver bebê.'
  );
}

main().catch((erro) => {
  console.error(`\nErro: ${erro.message}`);
  process.exit(1);
});

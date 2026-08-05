// Teste de RLS de DELETE entre duas contas — roda contra o Supabase de verdade.
//
//   node scripts/teste-rls-delete.mjs
//
// Por que script e não checklist manual: são 6 tipos × 3 verificações × 2 contas.
// Feito à mão isso é executado uma vez, na correria, e nunca mais — e é justamente
// o teste que precisa ser repetido depois de qualquer mexida em policy.
//
// O que ele prova, por tipo de registro:
//   1. NEGATIVO    conta A não consegue apagar registro da conta B
//   2. PERMANÊNCIA depois da tentativa, a linha de B AINDA está no banco
//   3. POSITIVO    conta B consegue apagar o próprio registro
//
// O passo 3 não é decoração. Sem ele, uma policy que negasse absolutamente tudo
// passaria no teste com louvor — e o app inteiro estaria quebrado.
//
// ------------------------------------------------------------------
// SOBRE RODAR NO MESMO PROJETO DAS EMBAIXADORAS
// ------------------------------------------------------------------
// É deliberado, não descuido. Um projeto Supabase separado só provaria que as
// policies DAQUELE projeto estão certas — e policy é exatamente o tipo de coisa
// que diverge entre ambientes sem ninguém perceber. Testar RLS num banco que não
// é o de produção é testar a coisa errada com precisão.
//
// O que o script faz em troca:
//   * usa duas contas fixas, com credenciais no .env (fora do versionamento);
//   * nomeia tudo que cria com prefixo TESTE-RLS-, pra sobra ser varrível;
//   * apaga os dados que criou num `finally`, então falha no meio não deixa órfão.
//
// O que ele NÃO faz é apagar as duas contas de auth ao fim: remover linha de
// auth.users exige a Admin API com service_role, e service_role neste script
// invalidaria o teste inteiro (ver guarda abaixo). As duas contas ficam, sempre
// as mesmas, identificáveis pelo e-mail.

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

const env = { ...lerEnv(), ...process.env };

function exigir(chave, dica) {
  const valor = env[chave];
  if (!valor) {
    console.error(`Falta ${chave} no .env.\n${dica}`);
    process.exit(1);
  }
  return valor;
}

const URL_SUPABASE = exigir('EXPO_PUBLIC_SUPABASE_URL', 'Painel > Project Settings > API.');
const ANON = exigir('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'Painel > Project Settings > API.');

const CONTAS = {
  A: {
    email: exigir('TESTE_RLS_A_EMAIL', 'Ver .env.example — as duas contas de teste.'),
    senha: exigir('TESTE_RLS_A_SENHA', 'Ver .env.example — as duas contas de teste.'),
  },
  B: {
    email: exigir('TESTE_RLS_B_EMAIL', 'Ver .env.example — as duas contas de teste.'),
    senha: exigir('TESTE_RLS_B_SENHA', 'Ver .env.example — as duas contas de teste.'),
  },
};

// ------------------------------------------------------------------
// Guarda: só anon key
// ------------------------------------------------------------------

/**
 * Com service_role a RLS é ignorada por definição — todo o teste passaria verde
 * sem provar absolutamente nada, que é o pior desfecho possível pra um teste de
 * segurança. Melhor recusar a rodar do que dar um verde que mente.
 *
 * Cobre os dois formatos de chave do Supabase: a JWT legada (o papel vem na claim
 * `role`) e as novas `sb_secret_` / `sb_publishable_`.
 */
function exigirAnonKey(chave) {
  if (chave.startsWith('sb_secret_')) {
    console.error('A chave em EXPO_PUBLIC_SUPABASE_ANON_KEY é uma secret key. Abortando.');
    process.exit(1);
  }

  const partes = chave.split('.');
  if (partes.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
      if (payload.role && payload.role !== 'anon') {
        console.error(
          `A chave em EXPO_PUBLIC_SUPABASE_ANON_KEY tem role "${payload.role}", não "anon".\n` +
            'Com service_role a RLS é ignorada e o teste não provaria nada. Abortando.'
        );
        process.exit(1);
      }
    } catch {
      // Chave em formato não reconhecido: segue, mas sem afirmar que é anon.
      console.warn('Aviso: não consegui ler o papel da chave. Confirme que é a anon key.');
    }
  }
}

exigirAnonKey(ANON);

// ------------------------------------------------------------------
// Preflight: a configuração de auth do projeto
// ------------------------------------------------------------------

/**
 * Com "Confirm email" LIGADO, o signUp não devolve sessão e nada abaixo funciona.
 * Pior: ele tenta ENVIAR e-mail a cada tentativa, e o mailer embutido do Supabase
 * tem limite baixíssimo por hora — depois de algumas execuções o erro que aparece
 * é "email rate limit exceeded", que não tem nenhuma relação aparente com a causa
 * real e manda quem está depurando para o lado errado.
 *
 * Então perguntamos antes. `/auth/v1/settings` é público e só de leitura.
 */
async function exigirAutoconfirm() {
  try {
    const resposta = await fetch(`${URL_SUPABASE}/auth/v1/settings`, {
      headers: { apikey: ANON },
    });
    const config = await resposta.json();

    if (config.disable_signup) {
      throw new Error('cadastro está desabilitado no projeto — o script não consegue criar as contas');
    }
    if (config.mailer_autoconfirm !== true) {
      console.error(
        '\nATENÇÃO: "Confirm email" ainda está LIGADO neste projeto.\n\n' +
          'O script precisa dele desligado pra criar as duas contas de teste, e o beta\n' +
          'também (BETA.md §3.8 e §11.1).\n\n' +
          'Painel do Supabase > Authentication > Sign In / Providers > Email >\n' +
          'desmarcar "Confirm email" e SALVAR.\n\n' +
          'Pra conferir sem abrir o painel, esperando mailer_autoconfirm: true —\n' +
          `  curl -s "${URL_SUPABASE}/auth/v1/settings" -H "apikey: <anon key>"\n`
      );
      throw new Error('"Confirm email" ligado — ver instruções acima');
    }
  } catch (erro) {
    if (erro instanceof TypeError) {
      // Falha de rede ao ler as configurações não é motivo pra abortar o teste.
      console.warn(`Aviso: não consegui ler as configurações de auth (${erro.message}). Seguindo.`);
      return;
    }
    throw erro;
  }
}

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
      options: { data: { nome: `TESTE-RLS-${rotulo}` } },
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

  return { cliente, userId: data.user.id, email };
}

// ------------------------------------------------------------------
// Dados descartáveis, todos prefixados
// ------------------------------------------------------------------

const PREFIXO = 'TESTE-RLS';

async function criarBebeDescartavel(cliente, userId, rotulo) {
  const { data, error } = await cliente
    .from('babies')
    .insert({ user_id: userId, name: `${PREFIXO}-${rotulo}`, birth_date: '2025-01-01' })
    .select('id')
    .single();
  if (error) throw new Error(`falha ao criar bebê de ${rotulo}: ${error.message}`);
  return data.id;
}

const TABELAS_DE_REGISTRO = [
  'feeding_records',
  'sleep_records',
  'diaper_records',
  'mood_records',
  'symptom_records',
];

/**
 * Apaga registros e depois o bebê, nesta ordem — de propósito.
 *
 * O 002 põe `on delete cascade` e tornaria a primeira volta desnecessária, mas a
 * limpeza não pode depender de o 002 já ter sido rodado: se depender, a primeira
 * execução num banco sem a cascata falha justamente na hora de limpar, e deixa
 * para trás exatamente o lixo que ela existe para evitar.
 */
async function limpar(cliente, babyId, rotulo) {
  if (!babyId) return;
  try {
    for (const tabela of TABELAS_DE_REGISTRO) {
      await cliente.from(tabela).delete().eq('baby_id', babyId);
    }
    await cliente.from('baby_patterns').delete().eq('baby_id', babyId);
    const { error } = await cliente.from('babies').delete().eq('id', babyId);
    if (error) throw error;
  } catch (erro) {
    console.warn(
      `\nAviso: não consegui limpar o bebê ${rotulo} (${babyId}): ${erro.message}\n` +
        `Varra manualmente por nome começando com ${PREFIXO}-.`
    );
  }
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
      notes: `${PREFIXO} amamentar`,
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
      notes: `${PREFIXO} mamadeira`,
    }),
  },
  {
    nome: 'sono',
    tabela: 'sleep_records',
    // Sem coluna notes nesta tabela — o vínculo com o teste é o bebê prefixado.
    linha: (babyId) => ({ baby_id: babyId, started_at: AGORA, ended_at: null }),
  },
  {
    nome: 'fralda',
    tabela: 'diaper_records',
    linha: (babyId) => ({
      baby_id: babyId,
      content: 'pee',
      recorded_at: AGORA,
      notes: `${PREFIXO} fralda`,
    }),
  },
  {
    nome: 'humor',
    tabela: 'mood_records',
    linha: (babyId) => ({
      baby_id: babyId,
      mood: 'calm',
      recorded_at: AGORA,
      notes: `${PREFIXO} humor`,
    }),
  },
  {
    nome: 'sintoma',
    tabela: 'symptom_records',
    linha: (babyId) => ({
      baby_id: babyId,
      symptom: 'fever',
      intensity: 'mild',
      recorded_at: AGORA,
      notes: `${PREFIXO} sintoma`,
    }),
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

  await exigirAutoconfirm();

  const a = await entrar('A', CONTAS.A);
  const b = await entrar('B', CONTAS.B);

  if (a.userId === b.userId) {
    throw new Error('as duas contas são a mesma — o teste não provaria nada');
  }

  console.log(`conta A: ${a.email}  ${a.userId}`);
  console.log(`conta B: ${b.email}  ${b.userId}\n`);

  let bebeA = null;
  let bebeB = null;

  try {
    bebeA = await criarBebeDescartavel(a.cliente, a.userId, 'A');
    bebeB = await criarBebeDescartavel(b.cliente, b.userId, 'B');

    for (const tipo of TIPOS) {
      // B cria o registro.
      const criado = await b.cliente
        .from(tipo.tabela)
        .insert(tipo.linha(bebeB))
        .select('id')
        .single();
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
  } finally {
    // No `finally`: falha no meio do teste não pode deixar bebê e registro de
    // teste no mesmo banco que as embaixadoras vão usar.
    await limpar(b.cliente, bebeB, 'B');
    await limpar(a.cliente, bebeA, 'A');
  }

  const falhas = resultados.filter((r) => !r.passou);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);

  if (falhas.length > 0) {
    console.log('\nFALHOU:');
    for (const f of falhas) {
      console.log(`  ${f.tipo} — ${f.verificacao}${f.detalhe ? `: ${f.detalhe}` : ''}`);
    }
    console.log('\nNão liberar o beta com RLS falhando.');
    // `exitCode` em vez de `exit()`: sair no meio de um handle de rede ainda
    // fechando dispara assertion do libuv no Windows. Assim o Node encerra sozinho.
    process.exitCode = 1;
    return;
  }

  console.log(`RLS de DELETE está correta nos 6 tipos. Dados de teste removidos.`);
  console.log(
    `\nAs duas contas de auth continuam no projeto (apagá-las exigiria service_role,` +
      ` que este script se recusa a usar). São sempre as mesmas:\n` +
      `  ${a.email}\n  ${b.email}`
  );
}

main().catch((erro) => {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
});

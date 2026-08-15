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

import { readdirSync, readFileSync } from 'node:fs';
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

/**
 * As tabelas que guardam dado de bebê, LIDAS DAS MIGRATIONS.
 *
 * Antes era lista escrita à mão, e o problema disso não é manutenção — é que uma
 * lista manual erra junto com a migration que a esqueceu. Quem cria a tabela sem
 * RLS é a mesma pessoa que esquece de acrescentá-la aqui, no mesmo dia, com a
 * mesma pressa. O teste ficaria verde sobre uma tabela aberta.
 *
 * Derivando do repositório, tabela nova com `baby_id` entra sozinha na varredura,
 * e a cobertura vira uma asserção em vez de um hábito.
 */
function tabelasComBabyId() {
  const dir = 'supabase/migrations';
  const achadas = new Set();
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(`${dir}/${arquivo}`, 'utf8');
    const criacoes = /create table (?:if not exists )?(\w+)\s*\(([\s\S]*?)\n\);/g;
    let achado;
    while ((achado = criacoes.exec(sql)) !== null) {
      if (/\bbaby_id\b/.test(achado[2])) achadas.add(achado[1]);
    }
  }
  return [...achadas];
}

const TABELAS_DE_REGISTRO = tabelasComBabyId();

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
    edicao: { notes: `${PREFIXO} invadido` },
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
    edicao: { notes: `${PREFIXO} invadido` },
  },
  {
    nome: 'sono',
    tabela: 'sleep_records',
    // Sem coluna notes nesta tabela — o vínculo com o teste é o bebê prefixado.
    linha: (babyId) => ({ baby_id: babyId, started_at: AGORA, ended_at: null }),
    // Sem notes nesta tabela: a invasão possível aqui é encerrar o sono alheio.
    edicao: { ended_at: AGORA },
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
    edicao: { notes: `${PREFIXO} invadido` },
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
    edicao: { notes: `${PREFIXO} invadido` },
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
    edicao: { notes: `${PREFIXO} invadido` },
  },
  {
    // A tabela de eventos do bloco 3, e a única que o app usa desde a virada.
    //
    // A RLS dela foi provada com a tabela VAZIA, no passo 2, antes de qualquer
    // dado entrar — RLS provada com dado dentro é RLS provada tarde demais. O
    // caso continua rodando a cada rodada, agora com as 97 linhas migradas ao
    // lado, e é isso que ele passa a defender: que o furo não apareceu depois.
    //
    // E aqui a leitura pesa mais que nas outras. Com uma tabela por tipo, um furo
    // de select exporia um tipo de registro de outra mãe; com tabela única, expõe
    // o diário inteiro dela.
    nome: 'registros',
    tabela: 'registros',
    linha: (babyId) => ({
      baby_id: babyId,
      tipo: 'fralda',
      ocorrido_em: AGORA,
      dados: { content: 'pee' },
      notes: `${PREFIXO} registros`,
    }),
    edicao: { notes: `${PREFIXO} invadido` },
  },
  {
    // Cache do motor, não registro — mas guarda dado derivado do bebê, e a
    // varredura derivada das migrations o encontra. Ficar de fora exigiria uma
    // lista de exceções, que é a lista manual voltando pela porta dos fundos.
    nome: 'padroes',
    tabela: 'baby_patterns',
    // Chave primária é o próprio bebê: esta tabela não tem coluna `id`. Declarar
    // a chave no caso é melhor que abrir exceção no laço — o laço não deve
    // conhecer tabela nenhuma.
    chave: 'baby_id',
    linha: (babyId) => ({ baby_id: babyId, confidence_score: 1 }),
    edicao: { confidence_score: 99 },
  },
];

/**
 * O gatilho da `007`: medicação, vitamina e vacina não se editam.
 *
 * ⚠️ ISTO NÃO É RLS, e é por isso que mora aqui mesmo assim: é o único teste que
 * fala com o banco de verdade, e a regra só existe no banco. Uma flag no schema
 * esconde o botão de editar; o `atualizarRegistro` é genérico e um `PATCH` no
 * PostgREST não passa por tela nenhuma.
 *
 * As três asserções são irmãs e nenhuma serve sozinha:
 *
 *   1. o update de medicação é RECUSADO — a regra existe;
 *   2. a linha continua com o valor antigo — a recusa aconteceu antes da escrita,
 *      e não é um erro cosmético devolvido depois de gravar;
 *   3. o update de FRALDA passa — o gatilho é específico, e não um "recusa tudo"
 *      que passaria na 1 e quebraria o encerrar sono.
 *
 * A terceira é a que o pedido nomeou: gatilho genérico por "tipo imutável"
 * quebraria o encerrar, porque encerrar sono é um `update`.
 */
async function provarImutabilidadeDaSaude(cliente, babyId) {
  const criar = async (tipo, dados) => {
    const r = await cliente
      .from('registros')
      .insert({
        baby_id: babyId,
        tipo,
        ocorrido_em: AGORA,
        dados,
        notes: `${PREFIXO} ${tipo}`,
      })
      .select('id')
      .single();
    if (r.error) throw new Error(`não consegui criar ${tipo}: ${r.error.message}`);
    return r.data.id;
  };

  let idMedicacao = null;
  let idFralda = null;

  try {
    idMedicacao = await criar('medicacao', { medicine: 'TESTE', dose: 25, dose_unit: 'ml' });
    idFralda = await criar('fralda', { content: 'pee' });

    const edicao = await cliente
      .from('registros')
      .update({ notes: `${PREFIXO} EDITADO` })
      .eq('id', idMedicacao)
      .select('id');

    registra(
      'imutavel',
      'medicação recusa edição, no BANCO',
      Boolean(edicao.error),
      edicao.error ? '' : 'o update passou — o gatilho da 007 não está no ar'
    );

    const depois = await cliente
      .from('registros')
      .select('notes')
      .eq('id', idMedicacao)
      .maybeSingle();

    registra(
      'imutavel',
      'e a linha continua com o valor antigo',
      depois.data?.notes === `${PREFIXO} medicacao`,
      `notes = ${depois.data?.notes ?? '(sumiu)'}`
    );

    // O CONTROLE. Sem ele, um gatilho que recusasse todo update passaria nas
    // duas asserções acima — e a mãe não conseguiria encerrar um sono.
    const fralda = await cliente
      .from('registros')
      .update({ notes: `${PREFIXO} EDITADO` })
      .eq('id', idFralda)
      .select('id');

    registra(
      'imutavel',
      'e fralda continua editável — o gatilho é dos três, não de todos',
      !fralda.error && (fralda.data ?? []).length === 1,
      fralda.error ? fralda.error.message : ''
    );
  } finally {
    // Por id, e não por bebê: a limpeza geral roda depois, mas se ela falhar
    // estas duas linhas não podem sobrar.
    for (const id of [idMedicacao, idFralda]) {
      if (id) await cliente.from('registros').delete().eq('id', id);
    }
  }
}

// ------------------------------------------------------------------
// O fechamento do esquema de afiliadas
// ------------------------------------------------------------------
//
// ⚠️ O REQUISITO É "A AFILIADA NÃO VÊ QUEM INDICOU", E ELE MORA NA AUSÊNCIA DE
// UMA POLICY — QUE É A COISA MAIS FÁCIL DE ALGUÉM SOMAR SEM PERCEBER.
//
// `indicacoes` tem RLS ligada e zero policies desde a 008. Um `create policy`
// bem-intencionado ("deixa ela ver as próprias indicações") derruba o requisito
// do termo de uma vez, e nada no repositório reclamaria: o `tsc` não abre banco,
// as varreduras leem texto, e o `expo export` empacota.
//
// Este caso roda contra o banco de verdade — é o único lugar onde a falha mora.
//
// A conta usada aqui NÃO é afiliada, e isso é o que torna o teste honesto para o
// que ele afirma: ela não pode nem ler nem escrever, e a distinção entre "não há
// linha minha" e "a tabela é fechada" aparece no INSERT, que tem que ser
// RECUSADO em vez de devolver vazio.

async function provarFechamentoDasAfiliadas(cliente) {
  // Leitura: as três continuam sem devolver nada para quem não é afiliada.
  for (const tabela of ['indicacoes', 'afiliadas', 'comissoes', 'saques']) {
    const { data, error } = await cliente.from(tabela).select('*').limit(1);
    registra(
      'afiliadas',
      `${tabela}: leitura não vaza`,
      !error && (data ?? []).length === 0,
      error ? `${error.code} ${error.message}` : `veio ${(data ?? []).length} linha(s)`
    );
  }

  // ⚠️ A PARTE DISCRIMINANTE. Zero linhas é ambíguo — pode ser "a tabela é
  // fechada" ou "não há linha minha". O INSERT desfaz a ambiguidade: sem policy
  // de escrita, o Postgres recusa. Se algum dia passar, alguém somou uma policy.
  const insercoes = [
    ['indicacoes', { afiliada_user_id: SEM_DONO, indicada_user_id: SEM_DONO, codigo: 'x', percentual: 20 }],
    ['afiliadas', { user_id: SEM_DONO, codigo: 'teste-rls-invasor', nome: 'x' }],
    ['comissoes', { afiliada_user_id: SEM_DONO, indicacao_id: SEM_DONO, tipo: 'credito', valor_centavos: 1 }],
    // O saque é a primeira coisa que a afiliada origina, e mesmo assim ele NÃO
    // ganhou policy de insert: a escrita passa por `solicitar_saque()`. Se este
    // insert passar, a validação de saldo e de mínimo virou decoração.
    ['saques', { afiliada_user_id: SEM_DONO, valor_centavos: 1, chave_pix: 'invasor@teste' }],
  ];

  for (const [tabela, linha] of insercoes) {
    const { data, error } = await cliente.from(tabela).insert(linha).select();
    registra(
      'afiliadas',
      `${tabela}: escrita direta é recusada`,
      Boolean(error) && (data ?? []).length === 0,
      error ? '' : 'O INSERT PASSOU — existe policy de escrita onde não deveria'
    );
  }

  // E o caminho legítimo continua existindo: a RPC responde, e responde com as
  // seis colunas da 011. Sem isto, "tudo recusado" também passaria com o
  // esquema inteiro quebrado.
  const { data: painel, error: erroPainel } = await cliente.rpc('painel_da_afiliada');
  const linha = Array.isArray(painel) ? painel[0] : painel;
  registra(
    'afiliadas',
    'painel_da_afiliada responde',
    !erroPainel,
    erroPainel ? `${erroPainel.code} ${erroPainel.message}` : ''
  );
  if (linha) {
    registra(
      'afiliadas',
      'o painel devolve sacado_centavos (011)',
      'sacado_centavos' in linha,
      `colunas: ${Object.keys(linha).join(', ')}`
    );
  }
}

/** Um uuid que não é de ninguém. Serve só para o INSERT ter forma válida. */
const SEM_DONO = '00000000-0000-0000-0000-000000000000';

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
    // A varredura só vale se ela alcançar tudo. Tabela nova com `baby_id` que
    // ninguém acrescentou aos casos é exatamente a que estaria sem RLS.
    const cobertas = new Set(TIPOS.map((t) => t.tabela));
    const descobertas = TABELAS_DE_REGISTRO.filter((t) => !cobertas.has(t));
    registra(
      'cobertura',
      `as ${TABELAS_DE_REGISTRO.length} tabelas com baby_id têm caso de teste`,
      descobertas.length === 0,
      descobertas.length > 0 ? `sem caso: ${descobertas.join(', ')}` : ''
    );

    bebeA = await criarBebeDescartavel(a.cliente, a.userId, 'A');
    bebeB = await criarBebeDescartavel(b.cliente, b.userId, 'B');

    for (const tipo of TIPOS) {
      const chave = tipo.chave ?? 'id';
      // B cria o registro.
      const criado = await b.cliente
        .from(tipo.tabela)
        .insert(tipo.linha(bebeB))
        .select(chave)
        .single();
      if (criado.error) {
        registra(tipo.nome, 'preparação', false, `B não conseguiu criar: ${criado.error.message}`);
        continue;
      }
      const id = criado.data[chave];

      // 1. NEGATIVO — A tenta LER o registro de B.
      //
      // Primeiro da lista porque é o furo mais grave: apagar destrói uma linha,
      // ler expõe a rotina de um bebê para um estranho. Com tabela única, expõe
      // o diário inteiro.
      //
      // Sem erro aqui também: a RLS filtra, e a resposta é uma lista vazia com
      // sucesso. Quem responde é a contagem, não a ausência de erro.
      const leitura = await a.cliente.from(tipo.tabela).select(chave).eq(chave, id);
      const linhasLidasPorA = (leitura.data ?? []).length;
      registra(
        tipo.nome,
        'A não LÊ registro de B',
        linhasLidasPorA === 0,
        linhasLidasPorA > 0 ? `A leu ${linhasLidasPorA} linha(s) de B` : ''
      );

      // 2. NEGATIVO — A tenta EDITAR o registro de B.
      const edicao = await a.cliente
        .from(tipo.tabela)
        .update(tipo.edicao)
        .eq(chave, id)
        .select(chave);
      const linhasEditadasPorA = (edicao.data ?? []).length;
      registra(
        tipo.nome,
        'A não EDITA registro de B',
        linhasEditadasPorA === 0,
        linhasEditadasPorA > 0 ? `A editou ${linhasEditadasPorA} linha(s) de B` : ''
      );

      // 3. NEGATIVO — A tenta apagar o registro de B.
      //
      // O PostgREST NÃO devolve erro aqui: a RLS filtra a linha e o delete
      // simplesmente não casa nada. Por isso o teste olha as linhas afetadas
      // (via .select()), não a ausência de erro. É a mesma armadilha que
      // apagarRegistro() trata em src/lib/registros.ts.
      const tentativa = await a.cliente.from(tipo.tabela).delete().eq(chave, id).select(chave);
      const linhasApagadasPorA = (tentativa.data ?? []).length;
      registra(
        tipo.nome,
        'A não apaga registro de B',
        linhasApagadasPorA === 0,
        linhasApagadasPorA > 0 ? `A apagou ${linhasApagadasPorA} linha(s) de B` : ''
      );

      // 4. PERMANÊNCIA — a linha continua lá, intacta, conferida pelos olhos de B.
      const conferencia = await b.cliente.from(tipo.tabela).select(chave).eq(chave, id).maybeSingle();
      registra(
        tipo.nome,
        'registro de B continua no banco',
        !conferencia.error && conferencia.data !== null,
        conferencia.data === null ? 'a linha sumiu' : ''
      );

      // 5. POSITIVO — B lê, edita e apaga o próprio registro. Sem isto, uma policy
      // que negasse tudo a todos passaria em todas as verificações acima.
      const lidoPorB = await b.cliente.from(tipo.tabela).select(chave).eq(chave, id);
      registra(
        tipo.nome,
        'B lê o próprio registro',
        (lidoPorB.data ?? []).length === 1,
        (lidoPorB.data ?? []).length !== 1 ? 'B não enxerga o que criou' : ''
      );

      const editadoPorB = await b.cliente
        .from(tipo.tabela)
        .update(tipo.edicao)
        .eq(chave, id)
        .select(chave);
      registra(
        tipo.nome,
        'B edita o próprio registro',
        (editadoPorB.data ?? []).length === 1,
        editadoPorB.error ? editadoPorB.error.message : ''
      );

      const proprio = await b.cliente.from(tipo.tabela).delete().eq(chave, id).select(chave);
      const linhasApagadasPorB = (proprio.data ?? []).length;
      registra(
        tipo.nome,
        'B apaga o próprio registro',
        linhasApagadasPorB === 1,
        linhasApagadasPorB !== 1 ? `apagou ${linhasApagadasPorB} linha(s)` : ''
      );
    }

    await provarImutabilidadeDaSaude(b.cliente, bebeB);
    await provarFechamentoDasAfiliadas(b.cliente);
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

  console.log(
    `RLS correta em leitura, edição e exclusão — ${TIPOS.length} casos sobre ` +
      `${TABELAS_DE_REGISTRO.length} tabelas. Dados de teste removidos.`
  );
  // A imutabilidade não é RLS e não entra na contagem acima. Dizer só "N casos
  // sobre M tabelas" deixaria de fora a única coisa aqui que prova um gatilho —
  // e resumo que não conta tudo que rodou é resumo que engana quem confia nele.
  console.log(
    'E o gatilho da 007: medicação recusa edição no banco, fralda continua editável.'
  );
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

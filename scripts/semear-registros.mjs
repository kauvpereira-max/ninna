// Semeia 7 dias de rotina no bebê ativo de uma conta — massa de teste pro D6/D7
// (histórico) e pro D8/D9 (motor de personalização).
//
//   node scripts/semear-registros.mjs           semeia
//   node scripts/semear-registros.mjs --limpar  apaga só o que este script criou
//
// Credenciais em SEMEAR_EMAIL / SEMEAR_SENHA no .env — a SUA conta do app, pra
// massa aparecer na tela quando você abrir.
//
// POR QUE O PADRÃO É PLAUSÍVEL E NÃO ALEATÓRIO
//
// Esta massa não serve só pra encher a lista do D6. Ela é a primeira entrada do
// motor do D8, e um motor alimentado com ruído produz número sem sentido — e aí
// não dá pra saber se o erro é da matemática ou dos dados. Então aqui o bebê tem
// rotina de bebê:
//
//   * mama a cada ~3h, com variação de alguns minutos;
//   * tira 3 sonecas por dia, sempre em faixas parecidas, de 40 a 90 min;
//   * dorme uma vez à noite, por volta das 20h, por 8 a 10h;
//   * troca de fralda algumas vezes ao dia; humor e sintoma aparecem esparsos.
//
// Com isso, "intervalo médio entre mamadas" tem que dar perto de 3h, e o horário
// médio das sonecas tem que cair dentro das faixas — o que dá um gabarito pro D8
// ser conferido à mão, em vez de aceito no olho.
//
// ONDE A MASSA É SEMEADA, E POR QUE ISSO É QUESTÃO DE SEGURANÇA
//
// Num BEBÊ DEDICADO, criado pelo próprio script — nunca no bebê real da mãe.
//
// A razão é o `--limpar`. `sleep_records` não tem coluna `notes`, então não há
// como marcar procedência linha a linha: a única âncora confiável é o `baby_id`.
// Semeando no bebê real, limpar exigiria apagar sono por janela de tempo, e no
// D21 há três mães com sono de verdade no mesmo banco. Avisar na saída seria
// honesto e não impediria o estrago.
//
// Com bebê dedicado, `--limpar` apaga por `baby_id` e não alcança dado de mãe
// nenhuma. Testar em produção é a decisão certa (BETA.md §11.4), e ela obriga o
// script a ser seguro em produção.
//
// Pra semear num bebê existente — sabendo o que está fazendo — use
// SEMEAR_BABY_ID no .env. Nesse caso o script pede confirmação explícita.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
// O gerador mora em `massa-semeada.mjs` pra conferência do gabarito do D8 poder
// usar a MESMA rotina sem tocar no banco. Duplicá-lo faria o gabarito divergir
// da massa realmente semeada sem ninguém notar.
import { gerarMassa, NOME_BEBE_TESTE, DIAS } from './massa-semeada.mjs';

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
  if (!env[chave]) {
    console.error(`Falta ${chave} no .env.\n${dica}`);
    process.exitCode = 1;
    return null;
  }
  return env[chave];
}

const URL_SUPABASE = exigir('EXPO_PUBLIC_SUPABASE_URL', 'Painel > Project Settings > API.');
const ANON = exigir('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'Painel > Project Settings > API.');
const EMAIL = exigir('SEMEAR_EMAIL', 'A sua conta do app — ver .env.example.');
const SENHA = exigir('SEMEAR_SENHA', 'A sua conta do app — ver .env.example.');

if (!URL_SUPABASE || !ANON || !EMAIL || !SENHA) process.exit(1);

// ------------------------------------------------------------------
// Execução
// ------------------------------------------------------------------

const cliente = createClient(URL_SUPABASE, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABELAS = [
  { nome: 'feeding_records', temNotes: true },
  { nome: 'sleep_records', temNotes: false },
  { nome: 'diaper_records', temNotes: true },
  { nome: 'mood_records', temNotes: true },
  { nome: 'symptom_records', temNotes: true },
];

/**
 * Resolve em qual bebê semear.
 *
 * Sem SEMEAR_BABY_ID: acha ou cria o bebê dedicado. Com: usa o que foi pedido,
 * mas só depois de dizer em voz alta de quem é — semear no bebê errado é
 * recuperável, limpar no bebê errado não.
 */
async function resolverBebe(userId) {
  const escolhido = env.SEMEAR_BABY_ID;

  if (escolhido) {
    const { data, error } = await cliente
      .from('babies')
      .select('id, name')
      .eq('id', escolhido)
      .maybeSingle();
    if (error) throw new Error(`falha ao buscar o bebê ${escolhido}: ${error.message}`);
    if (!data) throw new Error(`SEMEAR_BABY_ID=${escolhido} não existe nesta conta`);

    if (data.name !== NOME_BEBE_TESTE && !process.argv.includes('--sim-tenho-certeza')) {
      throw new Error(
        `"${data.name}" não é o bebê de teste.\n` +
          `Semear e limpar aqui mexe em registro real. Se é mesmo isso que você quer,\n` +
          `repita o comando com --sim-tenho-certeza.`
      );
    }
    return { ...data, dedicado: data.name === NOME_BEBE_TESTE };
  }

  const { data: existente, error } = await cliente
    .from('babies')
    .select('id, name')
    .eq('name', NOME_BEBE_TESTE)
    .maybeSingle();
  if (error) throw new Error(`falha ao procurar o bebê de teste: ${error.message}`);
  if (existente) return { ...existente, dedicado: true };

  const { data: criado, error: erroCriar } = await cliente
    .from('babies')
    .insert({
      user_id: userId,
      name: NOME_BEBE_TESTE,
      // 6 meses: idade em que a rotina simulada (3 sonecas, mamada a cada ~3h)
      // é plausível de verdade.
      birth_date: new Date(Date.now() - 182 * 86_400_000).toISOString().slice(0, 10),
    })
    .select('id, name')
    .single();
  if (erroCriar) throw new Error(`falha ao criar o bebê de teste: ${erroCriar.message}`);

  console.log(`Bebê de teste criado. Troque pra ele no seletor do app pra ver a massa.\n`);
  return { ...criado, dedicado: true };
}

/**
 * Apaga os registros de UM bebê, conferindo o escopo antes.
 *
 * A conferência é redundante — a consulta já filtra por `baby_id`. É de
 * propósito: o custo é uma consulta, e o que ela protege é dado de sono de mãe
 * real, que não tem backup nem desfazer. Se um dia alguém afrouxar o filtro, é
 * aqui que para.
 */
async function limparTabela(tabela, babyId) {
  const alvo = await cliente.from(tabela.nome).select('id, baby_id').eq('baby_id', babyId);
  if (alvo.error) return `erro ao conferir escopo: ${alvo.error.message}`;
  if (alvo.data.length === 0) return '0 apagados';

  const bebes = new Set(alvo.data.map((r) => r.baby_id));
  if (bebes.size !== 1 || !bebes.has(babyId)) {
    throw new Error(
      `ABORTANDO: a limpeza de ${tabela.nome} alcançaria ${bebes.size} bebê(s) ` +
        `(${[...bebes].join(', ')}), e deveria alcançar só ${babyId}.`
    );
  }

  const { data, error } = await cliente
    .from(tabela.nome)
    .delete()
    .eq('baby_id', babyId)
    .select('id');
  return error ? `erro: ${error.message}` : `${data.length} apagados`;
}

async function main() {
  const { data: sessao, error: erroLogin } = await cliente.auth.signInWithPassword({
    email: EMAIL,
    password: SENHA,
  });
  if (erroLogin) throw new Error(`não consegui entrar como ${EMAIL}: ${erroLogin.message}`);

  console.log(`Conta: ${EMAIL}`);

  const bebe = await resolverBebe(sessao.user.id);
  console.log(`Bebê:  ${bebe.name} (${bebe.id})${bebe.dedicado ? '' : '  <- BEBÊ REAL'}\n`);

  if (process.argv.includes('--limpar')) {
    // Por `baby_id`, não por janela de tempo: é o `baby_id` que garante que a
    // limpeza não alcança sono de mãe nenhuma. Vale inclusive pra sleep_records,
    // que não tem `notes` pra marcar procedência.
    for (const tabela of TABELAS) {
      console.log(`${tabela.nome.padEnd(18)} ${await limparTabela(tabela, bebe.id)}`);
    }

    if (bebe.dedicado) {
      const { error } = await cliente.from('babies').delete().eq('id', bebe.id);
      console.log(
        `${'babies'.padEnd(18)} ${error ? `erro: ${error.message}` : '1 apagado (o bebê de teste)'}`
      );
    } else {
      console.log(`\n${'babies'.padEnd(18)} preservado — não é o bebê de teste`);
    }
    return;
  }

  const massa = gerarMassa(bebe.id);

  for (const [tabela, linhas] of [
    ['feeding_records', massa.alimentacao],
    ['sleep_records', massa.sono],
    ['diaper_records', massa.fralda],
    ['mood_records', massa.humor],
    ['symptom_records', massa.sintoma],
  ]) {
    if (!linhas.length) continue;
    const { data, error } = await cliente.from(tabela).insert(linhas).select('id');
    if (error) throw new Error(`falha ao inserir em ${tabela}: ${error.message}`);
    console.log(`${tabela.padEnd(18)} ${data.length} inseridos`);
  }

  const total =
    massa.alimentacao.length +
    massa.sono.length +
    massa.fralda.length +
    massa.humor.length +
    massa.sintoma.length;

  console.log(`\n${total} registros em ${DIAS} dias.`);
  console.log('Gabarito esperado pro motor do D8:');
  console.log('  intervalo médio entre mamadas ~3h');
  console.log('  sonecas por volta de 9h, 13h e 16h30, de 40 a 90 min');
  console.log('  sono da noite por volta das 20h, 8 a 10h — NÃO entra na média de soneca');
  console.log('\nPra desfazer: node scripts/semear-registros.mjs --limpar');
}

main().catch((erro) => {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
});

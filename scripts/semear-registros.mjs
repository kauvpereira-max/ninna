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
// Tudo que é criado leva a marca SEMEADO em `notes`, e o --limpar varre por ela.
// Sono não tem coluna `notes`: os sonos semeados são identificados por caírem
// dentro da janela de 7 dias, então o --limpar avisa antes de mexer neles.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const MARCA = 'SEMEADO';
const DIAS = 7;

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
// Aleatoriedade determinística
//
// Semente fixa: duas execuções produzem a mesma massa. Sem isso, "conferi o
// intervalo médio na calculadora" não significa nada na execução seguinte.
// ------------------------------------------------------------------

let semente = 20260805;
function aleatorio() {
  semente = (semente * 1103515245 + 12345) % 2147483648;
  return semente / 2147483648;
}
const entre = (min, max) => min + aleatorio() * (max - min);
const inteiro = (min, max) => Math.floor(entre(min, max + 1));
const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)];

// ------------------------------------------------------------------
// Geração
// ------------------------------------------------------------------

/** Meia-noite local de `diasAtras` dias atrás. Hora LOCAL de propósito: é assim
 *  que o motor lê "horário da soneca", e é assim que a mãe lê a tela. */
function meiaNoite(diasAtras) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(0, 0, 0, 0);
  return d;
}

const iso = (dia, horas) => new Date(meiaNoite(dia).getTime() + horas * 3_600_000).toISOString();

function gerar(babyId) {
  const alimentacao = [];
  const sono = [];
  const fralda = [];
  const humor = [];
  const sintoma = [];

  for (let dia = DIAS - 1; dia >= 0; dia--) {
    const hoje = dia === 0;
    const agoraHoras = new Date().getHours() + new Date().getMinutes() / 60;
    // No dia de hoje só semeia o que já aconteceu — registro no futuro apareceria
    // como "ontem" na lista (a máscara HH:MM lê hora futura como do dia anterior).
    const limite = hoje ? agoraHoras : 24;

    // Mamadas a cada ~3h, começando às 6h.
    for (let h = 6; h < limite; h += entre(2.7, 3.3)) {
      const peito = aleatorio() < 0.6;
      alimentacao.push(
        peito
          ? {
              baby_id: babyId,
              type: 'breast',
              side: escolher(['left', 'right', 'both']),
              duration_seconds: inteiro(8, 22) * 60,
              started_at: iso(dia, h),
              notes: MARCA,
            }
          : {
              baby_id: babyId,
              type: 'bottle',
              amount_ml: inteiro(6, 15) * 10,
              bottle_type: escolher(['breast_milk', 'formula']),
              started_at: iso(dia, h),
              notes: MARCA,
            }
      );
    }

    // Três sonecas em faixas estáveis + o sono da noite.
    for (const faixa of [
      [8.5, 9.5],
      [12.5, 13.5],
      [16.0, 17.0],
    ]) {
      const inicio = entre(faixa[0], faixa[1]);
      if (inicio >= limite) continue;
      const duracao = entre(0.7, 1.5);
      sono.push({
        baby_id: babyId,
        started_at: iso(dia, inicio),
        ended_at: iso(dia, inicio + duracao),
      });
    }

    const noite = entre(19.5, 20.5);
    if (noite < limite) {
      sono.push({
        baby_id: babyId,
        started_at: iso(dia, noite),
        ended_at: iso(dia, noite + entre(8, 10)),
      });
    }

    // Fraldas, humor e sintoma — esparsos.
    for (let n = 0; n < inteiro(3, 5); n++) {
      const h = entre(6, 22);
      if (h >= limite) continue;
      fralda.push({
        baby_id: babyId,
        content: escolher(['pee', 'pee', 'poop', 'both']),
        recorded_at: iso(dia, h),
        notes: MARCA,
      });
    }

    if (aleatorio() < 0.7) {
      const h = entre(7, 21);
      if (h < limite) {
        humor.push({
          baby_id: babyId,
          mood: escolher(['happy', 'calm', 'crying', 'sleepy', 'agitated', 'irritated']),
          probable_reason: escolher(['hunger', 'sleep', 'diaper', 'colic', 'holding', 'unknown']),
          recorded_at: iso(dia, h),
          notes: MARCA,
        });
      }
    }

    if (aleatorio() < 0.25) {
      const h = entre(8, 20);
      if (h < limite) {
        sintoma.push({
          baby_id: babyId,
          symptom: escolher(['fever', 'runny_nose', 'cough', 'colic']),
          intensity: escolher(['mild', 'moderate']),
          recorded_at: iso(dia, h),
          notes: MARCA,
        });
      }
    }
  }

  return { alimentacao, sono, fralda, humor, sintoma };
}

// ------------------------------------------------------------------
// Execução
// ------------------------------------------------------------------

const cliente = createClient(URL_SUPABASE, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: sessao, error: erroLogin } = await cliente.auth.signInWithPassword({
    email: EMAIL,
    password: SENHA,
  });
  if (erroLogin) throw new Error(`não consegui entrar como ${EMAIL}: ${erroLogin.message}`);

  const { data: bebes, error: erroBebes } = await cliente
    .from('babies')
    .select('id, name')
    .order('created_at', { ascending: true });
  if (erroBebes) throw new Error(`falha ao listar bebês: ${erroBebes.message}`);
  if (!bebes.length) throw new Error('essa conta não tem bebê cadastrado — cadastre um pelo app');

  const bebe = bebes[0];
  console.log(`Conta: ${EMAIL}`);
  console.log(`Bebê:  ${bebe.name} (${bebe.id})\n`);

  const limpando = process.argv.includes('--limpar');
  const desde = meiaNoite(DIAS - 1).toISOString();

  if (limpando) {
    for (const [tabela, coluna] of [
      ['feeding_records', 'started_at'],
      ['diaper_records', 'recorded_at'],
      ['mood_records', 'recorded_at'],
      ['symptom_records', 'recorded_at'],
    ]) {
      const { data, error } = await cliente
        .from(tabela)
        .delete()
        .eq('baby_id', bebe.id)
        .eq('notes', MARCA)
        .select('id');
      console.log(`${tabela.padEnd(18)} ${error ? `erro: ${error.message}` : `${data.length} apagados`}`);
    }
    // Sono não tem `notes`. Só apaga os que estão na janela semeada, e diz isso.
    const { data, error } = await cliente
      .from('sleep_records')
      .delete()
      .eq('baby_id', bebe.id)
      .gte('started_at', desde)
      .select('id');
    console.log(
      `${'sleep_records'.padEnd(18)} ${error ? `erro: ${error.message}` : `${data.length} apagados`}` +
        '  (sem coluna notes: apagou TODOS os sonos dos últimos 7 dias)'
    );
    return;
  }

  const massa = gerar(bebe.id);

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

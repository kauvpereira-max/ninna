// Aceite do P3: o motor rodando sobre registros LIDOS DO SUPABASE.
//
//   node scripts/teste-motor-banco.ts
//
// O P2 provou a matemática contra massa gerada em memória. O que nenhum teste
// puro alcança é a volta pelo banco: `timestamptz` serializado pelo PostgREST,
// `ended_at` nulo vindo como null de verdade, e a hora local sendo extraída de
// uma string com offset — que é exatamente onde o R4 se esconde.
//
// Três conferências independentes:
//   1. FIDELIDADE   o que está no banco é o que o gerador produziu?
//   2. MOTOR        `calcularPadroes` sobre as linhas do banco
//   3. GABARITO     a mesma conta feita à mão, aqui, sem usar o motor
//
// A (3) é escrita de propósito com aritmética solta em vez de chamar `padroes.ts`:
// gabarito calculado pelo próprio código que ele deveria conferir não confere
// nada. Se (2) e (3) baterem, a matemática do motor sobrevive ao dado real.
//
// Usa a anon key e a conta da mãe — o mesmo caminho do app, nunca service_role.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  calcularPadroes,
  mediaCircularMinutos,
  ehSonoNoturno,
  minutosDoDiaLocal,
  fusoDoDispositivo,
  JANELA_DIAS,
} from '../src/lib/padroes.ts';
import { gerarMassa, NOME_BEBE_TESTE } from './massa-semeada.mjs';
import { escolherInsight } from '../src/lib/copyInsight.ts';

function lerEnv() {
  // Caminho como string, não `new URL(...)`: o `URL` global aqui é o do DOM (os
  // tipos do app incluem lib.dom), e o `readFileSync` do Node só aceita o dele.
  const texto = readFileSync(join(import.meta.dirname, '..', '.env'), 'utf8');
  const env: Record<string, string> = {};
  for (const linha of texto.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = { ...lerEnv(), ...process.env } as Record<string, string>;
for (const chave of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SEMEAR_EMAIL', 'SEMEAR_SENHA']) {
  if (!env[chave]) {
    console.error(`Falta ${chave} no .env.`);
    process.exit(1);
  }
}

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

const fuso = fusoDoDispositivo();
const agora = new Date();
const hm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

const cliente = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: sessao, error: erroLogin } = await cliente.auth.signInWithPassword({
  email: env.SEMEAR_EMAIL,
  password: env.SEMEAR_SENHA,
});
if (erroLogin) {
  console.error(`Não consegui entrar como ${env.SEMEAR_EMAIL}: ${erroLogin.message}`);
  process.exit(1);
}

const { data: bebe, error: erroBebe } = await cliente
  .from('babies')
  .select('id, name')
  .eq('name', NOME_BEBE_TESTE)
  .maybeSingle();
if (erroBebe || !bebe) {
  console.error(`Bebê "${NOME_BEBE_TESTE}" não encontrado. Rode o semeador primeiro.`);
  process.exit(1);
}

console.log(`fuso:    ${fuso}`);
console.log(`conta:   ${env.SEMEAR_EMAIL}`);
console.log(`bebê:    ${bebe.name} (${bebe.id})\n`);

const desde = new Date(agora.getTime() - JANELA_DIAS * 24 * 60 * 60_000).toISOString();

const [{ data: mamadas, error: e1 }, { data: sonos, error: e2 }] = await Promise.all([
  cliente
    .from('feeding_records')
    .select('started_at')
    .eq('baby_id', bebe.id)
    .gte('started_at', desde)
    .order('started_at', { ascending: true }),
  cliente
    .from('sleep_records')
    .select('started_at, ended_at')
    .eq('baby_id', bebe.id)
    .gte('started_at', desde)
    .order('started_at', { ascending: true }),
]);

if (e1 || e2) {
  console.error(`Falha na leitura: ${e1?.message ?? ''} ${e2?.message ?? ''}`);
  process.exit(1);
}

console.log(`lidos do banco: ${mamadas!.length} mamadas, ${sonos!.length} sonos\n`);

// ------------------------------------------------------------------
// 1. Fidelidade — o banco devolve o que o gerador escreveu?
// ------------------------------------------------------------------
//
// Só os dias ANTERIORES a hoje entram na comparação: o gerador semeia o dia de
// hoje até a hora corrente, então a cauda de hoje depende do minuto da semeadura
// e não é reproduzível. Os seis dias anteriores são idênticos em qualquer
// execução — é o que torna esta conferência possível.

const chaveDia = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
const hojeLocal = chaveDia(agora.toISOString());

const massaGerada = gerarMassa(bebe.id, { agora });
const antesDeHoje = (iso: string) => chaveDia(iso) !== hojeLocal;

const mamadasBanco = mamadas!.map((m) => m.started_at).filter(antesDeHoje).sort();
const mamadasGerador = massaGerada.alimentacao
  .map((m: { started_at: string }) => m.started_at)
  .filter(antesDeHoje)
  .sort();

conferir(
  'as mamadas dos 6 dias fechados batem, instante a instante',
  mamadasBanco.length === mamadasGerador.length &&
    mamadasBanco.every((v, i) => new Date(v).getTime() === new Date(mamadasGerador[i]).getTime()),
  `${mamadasBanco.length} no banco, ${mamadasGerador.length} no gerador`
);

const sonosBanco = sonos!.filter((s) => antesDeHoje(s.started_at)).map((s) => s.started_at).sort();
const sonosGerador = massaGerada.sono
  .map((s: { started_at: string }) => s.started_at)
  .filter(antesDeHoje)
  .sort();

conferir(
  'os sonos dos 6 dias fechados batem, instante a instante',
  sonosBanco.length === sonosGerador.length &&
    sonosBanco.every((v, i) => new Date(v).getTime() === new Date(sonosGerador[i]).getTime()),
  `${sonosBanco.length} no banco, ${sonosGerador.length} no gerador`
);

conferir(
  'todo sono do banco veio com ended_at preenchido ou null explícito',
  sonos!.every((s) => s.ended_at === null || typeof s.ended_at === 'string'),
  `${sonos!.filter((s) => s.ended_at === null).length} em andamento`
);

// ------------------------------------------------------------------
// 2. Motor sobre as linhas do banco
// ------------------------------------------------------------------

const motor = calcularPadroes(
  { mamadas: mamadas!, sonos: sonos! },
  { agora, fusoHorario: fuso }
);

// ------------------------------------------------------------------
// 3. Gabarito à mão, a partir das MESMAS linhas, sem usar o motor
// ------------------------------------------------------------------

const instantes = mamadas!.map((m) => new Date(m.started_at).getTime()).sort((a, b) => a - b);
const intervalos: number[] = [];
for (let i = 1; i < instantes.length; i++) intervalos.push((instantes[i] - instantes[i - 1]) / 60_000);
const gabIntervalo = Math.round(intervalos.reduce((a, b) => a + b, 0) / intervalos.length);

const sonecas = sonos!
  .map((s) => ({
    inicio: minutosDoDiaLocal(s.started_at, fuso)!,
    duracao: s.ended_at
      ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000
      : null,
  }))
  .filter((s) => !ehSonoNoturno(s.inicio));

const duracoes = sonecas.map((s) => s.duracao).filter((d): d is number => d !== null);
const gabDuracao = Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length);
const gabHorario = mediaCircularMinutos(sonecas.map((s) => s.inicio));

const noites = sonos!
  .map((s) => ({
    inicio: minutosDoDiaLocal(s.started_at, fuso)!,
    duracao: s.ended_at
      ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60_000
      : null,
  }))
  .filter((s) => ehSonoNoturno(s.inicio));

// ------------------------------------------------------------------

console.log('\n' + '='.repeat(72));
console.log('MOTOR (lendo do banco)          x  GABARITO (à mão, mesmas linhas)');
console.log('='.repeat(72));

const linha = (nome: string, motorVal: number | null, gabVal: number | null, formatar: (n: number) => string) =>
  `${nome.padEnd(24)} ${(motorVal === null ? '—' : formatar(motorVal)).padEnd(18)} ${
    gabVal === null ? '—' : formatar(gabVal)
  }`;

const minutos = (n: number) => `${n} min`;
console.log(linha('intervalo mamadas', motor.intervaloMedioMamadas.valor, gabIntervalo, minutos));
console.log(linha('duração soneca', motor.duracaoMediaSoneca.valor, gabDuracao, minutos));
console.log(linha('horário soneca', motor.horarioMedioSoneca.valor, gabHorario, (n) => `${n} min = ${hm(n)}`));
console.log('='.repeat(72) + '\n');

conferir(
  'intervalo médio entre mamadas: motor == gabarito',
  motor.intervaloMedioMamadas.valor === gabIntervalo,
  `${motor.intervaloMedioMamadas.valor} vs ${gabIntervalo}`
);
conferir(
  'duração média da soneca: motor == gabarito',
  motor.duracaoMediaSoneca.valor === gabDuracao,
  `${motor.duracaoMediaSoneca.valor} vs ${gabDuracao}`
);
// O horário NÃO é comparado por igualdade: este bebê tira três sonecas por dia,
// então a média existe (o gabarito à mão a calcula) e o motor a retém de
// propósito. Conferir os dois lados separa "a conta está errada" de "a conta não
// descreve este bebê" — que são coisas diferentes e têm correções diferentes.
conferir(
  'horário médio da soneca: o motor retém o valor por dispersão alta',
  motor.horarioMedioSoneca.valor === null && motor.horarioMedioSoneca.confianca === 'nao_se_aplica',
  `à mão daria ${gabHorario} min = ${hm(gabHorario!)}, horário em que este bebê não dorme`
);

conferir(
  'as duas métricas publicáveis têm confiança suficiente com a massa semeada',
  motor.intervaloMedioMamadas.confianca === 'suficiente' &&
    motor.duracaoMediaSoneca.confianca === 'suficiente',
  `amostras: ${motor.intervaloMedioMamadas.amostras} mamadas, ${motor.duracaoMediaSoneca.amostras} sonecas`
);

conferir(
  'o sono noturno ficou FORA das métricas de soneca',
  noites.length > 0 && motor.duracaoMediaSoneca.amostras === duracoes.length,
  `${noites.length} noites separadas de ${sonecas.length} sonecas`
);

console.log(
  `\nnoites: ${noites.length}, início médio ${hm(mediaCircularMinutos(noites.map((n) => n.inicio))!)}, ` +
    `duração média ${Math.round(
      noites.filter((n) => n.duracao !== null).reduce((a, n) => a + n.duracao!, 0) /
        noites.filter((n) => n.duracao !== null).length
    )} min`
);

// ------------------------------------------------------------------
// 4. Sono em andamento, com linha real
//
// A massa semeada não tem `ended_at` nulo — o gerador só cria sono fechado. Como
// o tratamento do D8 (conta pro horário, não pra duração) foi decidido contra
// dado sintético, ele precisa ser exercitado contra uma linha que passou pelo
// Postgres de verdade: é lá que `null` pode voltar como string, ou não voltar.
//
// A linha é criada no bebê DEDICADO e apagada no `finally`.
// ------------------------------------------------------------------

console.log('\n--- sono em andamento (linha criada e apagada aqui) ---');

// Um instante no passado que caia em horário de SONECA em hora local — não
// adianta usar "agora - 30min" e torcer: se a hora local for noite, o sono seria
// classificado como noturno e o teste não provaria o que se propõe.
let candidato = agora.getTime() - 30 * 60_000;
for (let i = 0; i < 24 * 4; i++) {
  const minutosLocais = minutosDoDiaLocal(new Date(candidato).toISOString(), fuso)!;
  if (!ehSonoNoturno(minutosLocais)) break;
  candidato -= 15 * 60_000;
}
const inicioAberto = new Date(candidato).toISOString();

let idAberto: string | null = null;
try {
  const { data: criado, error: erroCriar } = await cliente
    .from('sleep_records')
    .insert({ baby_id: bebe.id, started_at: inicioAberto, ended_at: null })
    .select('id, started_at, ended_at')
    .single();

  if (erroCriar || !criado) {
    conferir('consegui criar um sono em andamento no bebê de teste', false, erroCriar?.message);
  } else {
    idAberto = criado.id;

    conferir(
      'o banco devolve ended_at como null de verdade, não string',
      criado.ended_at === null,
      `tipo: ${criado.ended_at === null ? 'null' : typeof criado.ended_at}`
    );

    const { data: sonosComAberto } = await cliente
      .from('sleep_records')
      .select('started_at, ended_at')
      .eq('baby_id', bebe.id)
      .gte('started_at', desde)
      .order('started_at', { ascending: true });

    const comAberto = calcularPadroes(
      { mamadas: mamadas!, sonos: sonosComAberto! },
      { agora, fusoHorario: fuso }
    );

    conferir(
      'a soneca em andamento entra na conta de HORÁRIO',
      comAberto.horarioMedioSoneca.amostras === motor.horarioMedioSoneca.amostras + 1,
      `${motor.horarioMedioSoneca.amostras} -> ${comAberto.horarioMedioSoneca.amostras}`
    );
    conferir(
      'e fica FORA da conta de DURAÇÃO, que ainda não existe',
      comAberto.duracaoMediaSoneca.amostras === motor.duracaoMediaSoneca.amostras &&
        comAberto.duracaoMediaSoneca.valor === motor.duracaoMediaSoneca.valor,
      `duração segue ${comAberto.duracaoMediaSoneca.valor} min em ${comAberto.duracaoMediaSoneca.amostras} sonecas`
    );
  }
} finally {
  if (idAberto) {
    const { error } = await cliente.from('sleep_records').delete().eq('id', idAberto);
    console.log(
      error ? `⚠️  NÃO consegui apagar o sono de teste ${idAberto}: ${error.message}` : 'linha de teste apagada.'
    );
  }
}

// ------------------------------------------------------------------
// 5. O que a mãe veria na Home, com este dado
// ------------------------------------------------------------------

console.log('\n--- a frase do card, nos próximos 7 dias ---');

for (let d = 0; d < 7; d++) {
  const dia = new Date(agora.getTime() + d * 24 * 60 * 60_000);
  const { texto } = escolherInsight(motor, bebe.name, { agora: dia, fusoHorario: fuso });
  console.log(`   ${chaveDia(dia.toISOString())}  ${texto}`);
}

const hoje = escolherInsight(motor, bebe.name, { agora, fusoHorario: fuso });
conferir(
  'com a massa semeada, o card mostra insight de verdade e não a frase de aprendizado',
  !hoje.aprendendo
);
conferir(
  'o horário médio não é publicado para este bebê (3 sonecas por dia)',
  motor.horarioMedioSoneca.confianca === 'nao_se_aplica',
  `dispersão acima do limiar — ${motor.horarioMedioSoneca.amostras} sonecas e nenhum horário típico`
);

console.log(
  `\n${falhas === 0 ? 'Motor confere contra o banco.' : `${falhas} verificação(ões) falharam.`}`
);
process.exit(falhas > 0 ? 1 : 0);

// Teste do motor de personalização — puro, sem banco e sem app.
//
//   node scripts/teste-padroes.ts
//
// (Node 24 executa TypeScript direto, removendo os tipos. Por isso `padroes.ts`
// não importa Supabase nem React Native — mesma razão do `paginacao.ts`.)
//
// O QUE ESTÁ SENDO TESTADO, E POR QUE NÃO SE VÊ NA TELA
//
// As três falhas do motor são silenciosas: o card mostra um número bonito e
// errado. "A soneca de Liz costuma ser ao meio-dia" para um bebê que dorme à
// meia-noite não parece bug — parece informação. É o R3, e é o que custa a
// embaixadora.
//
// FUSO É INJETADO, NUNCA HERDADO DA MÁQUINA
//
// O teste do D6 já passou verde sem provar nada porque se apoiava no fuso do
// ambiente (e no Windows a variável TZ é ignorada para nomes IANA). Aqui os
// instantes são construídos a partir de uma hora local declarada num fuso
// declarado, e o mesmo dado é medido em dois fusos diferentes.

import {
  calcularPadroes,
  mediaCircularMinutos,
  ehSonoNoturno,
  minutosDoDiaLocal,
  MINIMO_REGISTROS,
  DISPERSAO_MAXIMA_MINUTOS,
  dispersaoCircularMinutos,
  type EntradaPadroes,
} from '../src/lib/padroes.ts';
import { local } from './ajuda-tempo.ts';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

const SP = 'America/Sao_Paulo';
const TOQUIO = 'Asia/Tokyo';

const AGORA = new Date(local(SP, '2026-08-06', 12));

conferir(
  'a construção de instante local está correta',
  minutosDoDiaLocal(local(SP, '2026-08-03', 9, 30), SP) === 9 * 60 + 30,
  `09:30 em SP -> ${minutosDoDiaLocal(local(SP, '2026-08-03', 9, 30), SP)} min`
);

// ------------------------------------------------------------------
// 1. Média circular — o erro que produz "soneca ao meio-dia"
// ------------------------------------------------------------------

const circular23e1 = mediaCircularMinutos([23 * 60, 1 * 60]);
const ingenua23e1 = (23 * 60 + 1 * 60) / 2;

conferir(
  '23h e 1h dão meia-noite, não meio-dia',
  circular23e1 === 0,
  `circular = ${circular23e1} min, ingênua = ${ingenua23e1} min (12h)`
);
conferir('a média ingênua daria justamente o valor errado', ingenua23e1 === 720);

const cincoNaViradaDoDia = [23 * 60, 23 * 60 + 30, 0, 30, 60];
conferir(
  'cinco horários em volta da meia-noite dão meia-noite',
  mediaCircularMinutos(cincoNaViradaDoDia) === 0,
  `${mediaCircularMinutos(cincoNaViradaDoDia)} min`
);

conferir('horários idênticos devolvem o próprio horário', mediaCircularMinutos([555, 555, 555]) === 555);

conferir(
  'horários em lados opostos do dia não têm horário típico',
  mediaCircularMinutos([6 * 60, 18 * 60]) === null,
  'resultante nula — devolve null em vez de inventar um horário'
);

// ------------------------------------------------------------------
// 2. Soneca x noite
// ------------------------------------------------------------------

conferir('sono às 20h é noite', ehSonoNoturno(20 * 60));
conferir('sono às 3h é noite', ehSonoNoturno(3 * 60));
conferir('sono às 9h é soneca', !ehSonoNoturno(9 * 60));
conferir('sono às 18h59 ainda é soneca', !ehSonoNoturno(18 * 60 + 59));
conferir('sono às 19h já é noite', ehSonoNoturno(19 * 60));
conferir('sono às 6h já é soneca', !ehSonoNoturno(6 * 60));

const DIAS_TESTE = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'];

/** 3 sonecas de 60 min (9h, 13h, 16h30) + 1 noite de 9h, por dia. */
function rotinaEstavel(fuso: string): EntradaPadroes {
  const sonos = [];
  for (const dia of DIAS_TESTE) {
    for (const [h, m] of [
      [9, 0],
      [13, 0],
      [16, 30],
    ]) {
      const inicio = local(fuso, dia, h, m);
      sonos.push({
        started_at: inicio,
        ended_at: new Date(new Date(inicio).getTime() + 60 * 60_000).toISOString(),
      });
    }
    const noite = local(fuso, dia, 20);
    sonos.push({
      started_at: noite,
      ended_at: new Date(new Date(noite).getTime() + 9 * 60 * 60_000).toISOString(),
    });
  }
  return { mamadas: [], sonos };
}

const estavel = calcularPadroes(rotinaEstavel(SP), { agora: AGORA, fusoHorario: SP });

conferir(
  'a noite de 9h não entra na média de soneca',
  estavel.duracaoMediaSoneca.valor === 60,
  `${estavel.duracaoMediaSoneca.valor} min (misturando daria 180)`
);
conferir(
  'só as 15 sonecas contam como amostra',
  estavel.duracaoMediaSoneca.amostras === 15,
  `${estavel.duracaoMediaSoneca.amostras} de 20 registros de sono`
);

// A média em si continua certa — o que mudou é ela não ser PUBLICADA neste caso
// (ver 2-bis). Conferir aqui separa os dois: erro de matemática continuaria
// aparecendo mesmo depois de o limiar de dispersão entrar em cena.
const mediaCrua = mediaCircularMinutos(
  rotinaEstavel(SP)
    .sonos.map((s) => minutosDoDiaLocal(s.started_at, SP)!)
    .filter((m) => !ehSonoNoturno(m))
);
conferir(
  'a média circular das sonecas cai entre as faixas da tarde',
  mediaCrua !== null && mediaCrua > 12 * 60 + 45 && mediaCrua < 13 * 60,
  `${mediaCrua} min = ${String(Math.floor((mediaCrua ?? 0) / 60)).padStart(2, '0')}:${String((mediaCrua ?? 0) % 60).padStart(2, '0')} — correta, e ainda assim não publicável`
);

// ------------------------------------------------------------------
// 2-bis. Dispersão — a métrica que existe e não descreve nada
// ------------------------------------------------------------------

conferir(
  'horários agrupados têm dispersão pequena',
  (dispersaoCircularMinutos([540, 555, 530, 545, 560]) ?? 999) < 30,
  `${dispersaoCircularMinutos([540, 555, 530, 545, 560])} min`
);
conferir(
  'sonecas de 9h, 13h e 16h30 se espalham por mais de 1h30',
  (dispersaoCircularMinutos([540, 780, 990]) ?? 0) > DISPERSAO_MAXIMA_MINUTOS,
  `${dispersaoCircularMinutos([540, 780, 990])} min`
);

// Bebê de três sonecas: a média cai em meio-dia e meia, horário em que ele
// justamente NÃO dorme. Confiança de sobra e nada a dizer.
conferir(
  'com três sonecas por dia, o horário médio sai como "não se aplica"',
  estavel.horarioMedioSoneca.confianca === 'nao_se_aplica' &&
    estavel.horarioMedioSoneca.valor === null,
  `${estavel.horarioMedioSoneca.amostras} sonecas, e ainda assim sem horário publicável`
);
conferir(
  'e isso NÃO contamina as outras métricas',
  estavel.duracaoMediaSoneca.confianca === 'suficiente'
);

// Bebê mais velho, soneca única depois do almoço: mesma função, outro desfecho.
const sonecaUnica: EntradaPadroes = {
  mamadas: [],
  sonos: DIAS_TESTE.concat('2026-07-31', '2026-08-06').map((dia, i) => {
    const inicio = local(SP, dia, 13, (i % 3) * 15);
    return {
      started_at: inicio,
      ended_at: new Date(new Date(inicio).getTime() + 90 * 60_000).toISOString(),
    };
  }),
};
const umaSoneca = calcularPadroes(sonecaUnica, { agora: AGORA, fusoHorario: SP });
conferir(
  'com soneca única, o horário médio volta a ser publicável',
  umaSoneca.horarioMedioSoneca.confianca === 'suficiente' && umaSoneca.horarioMedioSoneca.valor !== null,
  `${umaSoneca.horarioMedioSoneca.valor} min = ${String(Math.floor((umaSoneca.horarioMedioSoneca.valor ?? 0) / 60)).padStart(2, '0')}:${String((umaSoneca.horarioMedioSoneca.valor ?? 0) % 60).padStart(2, '0')}`
);
conferir(
  '"não se aplica" é estado diferente de "insuficiente"',
  estavel.horarioMedioSoneca.confianca !== 'insuficiente' &&
    estavel.horarioMedioSoneca.amostras >= MINIMO_REGISTROS,
  'não é falta de dado — é conta que não descreve este bebê'
);

// ------------------------------------------------------------------
// 3. Fuso — o MESMO dado medido em dois fusos
// ------------------------------------------------------------------

const mesmoDadoEmToquio = calcularPadroes(rotinaEstavel(SP), {
  agora: AGORA,
  fusoHorario: TOQUIO,
});

// Lido em Tóquio (+12h em relação a SP) a classificação INVERTE por completo:
// as três sonecas viram 21h/1h/4h30, que é noite; e o sono noturno das 20h vira
// 8h da manhã, que é soneca. O motor passa a dizer "as sonecas dela duram 9
// horas" — absurdo visível, e exatamente o R4 acontecendo.
conferir(
  'lido em Tóquio, as 15 sonecas de São Paulo viram noite',
  mesmoDadoEmToquio.duracaoMediaSoneca.amostras === 5,
  `sobram ${mesmoDadoEmToquio.duracaoMediaSoneca.amostras} "sonecas" — que são os 5 sonos NOTURNOS de SP`
);
conferir(
  'e a duração média vira a da noite: 9 horas de "soneca"',
  mesmoDadoEmToquio.duracaoMediaSoneca.valor === 540,
  `${mesmoDadoEmToquio.duracaoMediaSoneca.valor} min — é assim que o R4 apareceria na tela`
);
conferir(
  'ou seja: o fuso do parâmetro está sendo usado de verdade',
  estavel.duracaoMediaSoneca.valor !== mesmoDadoEmToquio.duracaoMediaSoneca.valor
);

// Intervalo entre mamadas é distância entre instantes: não muda com o fuso.
const mamadasDoDia = [6, 9, 12, 15, 18].map((h) => ({ started_at: local(SP, '2026-08-05', h) }));
const intervaloSP = calcularPadroes({ mamadas: mamadasDoDia, sonos: [] }, {
  agora: AGORA,
  fusoHorario: SP,
}).intervaloMedioMamadas;
const intervaloToquio = calcularPadroes({ mamadas: mamadasDoDia, sonos: [] }, {
  agora: AGORA,
  fusoHorario: TOQUIO,
}).intervaloMedioMamadas;

conferir(
  'intervalo entre mamadas de 3 em 3 horas dá 180 min',
  intervaloSP.valor === 180,
  `${intervaloSP.valor} min`
);
conferir(
  'e não muda com o fuso — distância entre instantes é absoluta',
  intervaloSP.valor === intervaloToquio.valor
);

// ------------------------------------------------------------------
// 4. Limiar de confiança
// ------------------------------------------------------------------

const quatroMamadas = calcularPadroes(
  { mamadas: mamadasDoDia.slice(0, 4), sonos: [] },
  { agora: AGORA, fusoHorario: SP }
).intervaloMedioMamadas;

conferir(
  `com ${MINIMO_REGISTROS - 1} mamadas a confiança é insuficiente`,
  quatroMamadas.confianca === 'insuficiente'
);
conferir(
  'e o valor vem NULO — a tela não tem número pra mostrar por engano',
  quatroMamadas.valor === null
);
conferir(
  `com ${MINIMO_REGISTROS} mamadas a confiança passa`,
  intervaloSP.confianca === 'suficiente'
);

// ------------------------------------------------------------------
// 5. Bordas
// ------------------------------------------------------------------

const vazio = calcularPadroes({ mamadas: [], sonos: [] }, { agora: AGORA, fusoHorario: SP });
conferir(
  'sem registro nenhum, as três métricas ficam insuficientes e nulas',
  [vazio.intervaloMedioMamadas, vazio.duracaoMediaSoneca, vazio.horarioMedioSoneca].every(
    (m) => m.confianca === 'insuficiente' && m.valor === null
  )
);

const comSonoAberto = rotinaEstavel(SP);
comSonoAberto.sonos.push({ started_at: local(SP, '2026-08-06', 10), ended_at: null });
const abertos = calcularPadroes(comSonoAberto, { agora: AGORA, fusoHorario: SP });
conferir(
  'soneca em andamento conta pro horário, não pra duração',
  abertos.horarioMedioSoneca.amostras === 16 && abertos.duracaoMediaSoneca.amostras === 15,
  `horário: ${abertos.horarioMedioSoneca.amostras}, duração: ${abertos.duracaoMediaSoneca.amostras}`
);

const foraDaJanela: EntradaPadroes = {
  mamadas: [6, 9, 12, 15, 18].map((h) => ({ started_at: local(SP, '2026-07-20', h) })),
  sonos: [],
};
conferir(
  'registro de 17 dias atrás fica fora da janela de 7 dias',
  calcularPadroes(foraDaJanela, { agora: AGORA, fusoHorario: SP }).intervaloMedioMamadas.amostras === 0
);

// ------------------------------------------------------------------
// 6. Verificação por mutação
//
// Um teste que não falha quando o código quebra não é teste. Aqui as três
// implementações erradas — as três que o BETA.md §3.3 proíbe — são escritas de
// propósito, e o que se verifica é que cada uma delas REPROVA em alguma das
// conferências acima. Se alguma mutação passasse, a conferência correspondente
// seria decorativa.
// ------------------------------------------------------------------

console.log('\n--- mutação: as implementações erradas têm que quebrar ---');

// Mutação 1: média aritmética no lugar da circular.
const mutanteAritmetica = (m: number[]) => Math.round(m.reduce((a, b) => a + b, 0) / m.length);
conferir(
  'mutação "média aritmética" quebra o caso das 23h e 1h',
  mutanteAritmetica([23 * 60, 1 * 60]) !== circular23e1,
  `daria ${mutanteAritmetica([23 * 60, 1 * 60])} min (12h) em vez de 0`
);
conferir(
  'mutação "média aritmética" também quebra a virada do dia com 5 sonecas',
  mutanteAritmetica(cincoNaViradaDoDia) !== 0,
  `daria ${mutanteAritmetica(cincoNaViradaDoDia)} min`
);

// Mutação 2: não separar noite de soneca.
const todosOsSonos = rotinaEstavel(SP).sonos;
const duracoesTodas = todosOsSonos.map(
  (s) => (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60_000
);
const mutanteSemSeparar = Math.round(
  duracoesTodas.reduce((a, b) => a + b, 0) / duracoesTodas.length
);
conferir(
  'mutação "misturar noite e soneca" quebra a duração média',
  mutanteSemSeparar !== estavel.duracaoMediaSoneca.valor,
  `daria ${mutanteSemSeparar} min em vez de ${estavel.duracaoMediaSoneca.valor} — média que não descreve nenhum sono real`
);

// Mutação 3: classificar em UTC no lugar da hora local.
const inicioUtc = (iso: string) => new Date(iso).getUTCHours() * 60 + new Date(iso).getUTCMinutes();
const sonecasSegundoUtc = todosOsSonos.filter((s) => !ehSonoNoturno(inicioUtc(s.started_at)));
conferir(
  'mutação "classificar em UTC" muda quais sonos são soneca',
  sonecasSegundoUtc.length !== 15,
  `em UTC sobrariam ${sonecasSegundoUtc.length} sonecas em vez de 15 (a de 16h30 em SP é 19h30 em UTC)`
);

console.log(
  `\n${falhas === 0 ? 'Motor correto — as 3 métricas e as 3 mutações.' : `${falhas} verificação(ões) falharam.`}`
);
if (falhas > 0) process.exitCode = 1;

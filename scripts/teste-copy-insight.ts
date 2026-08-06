// Teste da copy do card de insight — puro, sem banco e sem app.
//
//   node scripts/teste-copy-insight.ts
//
// POR QUE COPY TEM TESTE
//
// O tom é o produto (BETA.md §7.4 P4). Um adjetivo avaliativo, um "ela", um
// "dados insuficientes" ou um número cru não quebram nada — passam, vão pro ar, e
// a mãe lê às 3h da manhã. Não há stack trace pra isso.
//
// Então o que está sendo verificado aqui não é "a frase existe": é que NENHUMA
// frase possível contém o que a regra proíbe. O teste percorre todas as
// combinações de métrica, faixa e variação.

import {
  escolherInsight,
  formatarHorario,
  formatarDuracao,
  formatarIntervalo,
  faixaDe,
} from '../src/lib/copyInsight.ts';
import type { Padroes } from '../src/lib/padroes.ts';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

const NOME = 'Liz';
const FUSO = 'America/Sao_Paulo';

const metrica = (valor: number | null, amostras: number, confianca: any = 'suficiente') => ({
  valor,
  confianca,
  amostras,
});

// ------------------------------------------------------------------
// 1. Número em palavra — nunca minuto cru
// ------------------------------------------------------------------

conferir('12:43 vira "meio-dia e meia"', formatarHorario(763) === 'meio-dia e meia', formatarHorario(763));
conferir('12:00 vira "meio-dia"', formatarHorario(720) === 'meio-dia');
conferir('00:00 vira "meia-noite"', formatarHorario(0) === 'meia-noite');
conferir('09:10 arredonda pra "9h"', formatarHorario(550) === '9h', formatarHorario(550));
conferir('16:40 arredonda pra "16h30"', formatarHorario(1000) === '16h30', formatarHorario(1000));
conferir('23:50 não vira "24h"', !formatarHorario(1430).startsWith('24'), formatarHorario(1430));

conferir('70 min vira "pouco mais de uma hora"', formatarDuracao(70) === 'pouco mais de uma hora', formatarDuracao(70));
conferir('90 min vira "uma hora e meia"', formatarDuracao(90) === 'uma hora e meia');
conferir('211 min vira "três horas e meia"', formatarIntervalo(211) === 'três horas e meia', formatarIntervalo(211));
conferir('180 min vira "três horas"', formatarIntervalo(180) === 'três horas');

conferir('faixa: 5 registros é "começando"', faixaDe(5) === 'comecando');
conferir('faixa: 10 registros é "firme"', faixaDe(10) === 'firme');
conferir('faixa: 42 registros é "bem marcado"', faixaDe(42) === 'bemMarcado');

// ------------------------------------------------------------------
// 2. Varredura de TODAS as frases possíveis
// ------------------------------------------------------------------

const PROIBIDO: { rotulo: string; re: RegExp }[] = [
  { rotulo: 'artigo de gênero antes do nome', re: /\b(a|o|da|do|na|no|pela|pelo)\s+Liz\b/i },
  { rotulo: 'pronome de gênero', re: /\b(ele|ela|dele|dela|nele|nela)\b/i },
  // "registro" NÃO entra aqui: é a palavra que a própria Home usa no botão
  // ("REGISTRAR") e o nome do que a mãe faz. O proibido é vocabulário de painel —
  // o que descreve a CONTA, não a ação dela.
  { rotulo: 'linguagem de painel', re: /\b(m[ée]dia|dados|m[ée]trica|percentual|%)\b/i },
  { rotulo: 'prescrição', re: /\b(ideal|recomend\w*|dever\w*|precis\w+ dormir|tente|procure)\b/i },
  // "pouco mais de uma hora" é unidade de tempo, não julgamento — daí o
  // lookahead. "pouco sono" continuaria reprovando, que é o que importa.
  {
    rotulo: 'julgamento do padrão',
    re: /\bpouco(?!\s+mais)\b|\bmuito\b|\b(irregular|constante|normal|anormal|adequad\w+|excessiv\w+)\b/i,
  },
  { rotulo: 'cobrança / gamificação', re: /\b(desbloque\w*|insuficient\w*|falta\w*|complete|meta)\b/i },
  { rotulo: 'alarme', re: /\b(aten[çc][ãa]o|alerta|cuidado|preocup\w*|risco)\b/i },
  { rotulo: 'número cru com unidade', re: /\d+\s*(min|minutos|h\b(?!\d)|horas)\b/i },
  { rotulo: 'decimal', re: /\d+[.,]\d/ },
];

// 3 métricas x 3 faixas x muitos dias — cobre toda combinação de frase.
const AMOSTRAS_POR_FAIXA = [5, 10, 42];
const todasAsFrases = new Set<string>();

for (const amostras of AMOSTRAS_POR_FAIXA) {
  const combinacoes: Padroes[] = [
    {
      intervaloMedioMamadas: metrica(211, amostras),
      duracaoMediaSoneca: metrica(null, 0, 'insuficiente'),
      horarioMedioSoneca: metrica(null, 0, 'insuficiente'),
    } as Padroes,
    {
      intervaloMedioMamadas: metrica(null, 0, 'insuficiente'),
      duracaoMediaSoneca: metrica(70, amostras),
      horarioMedioSoneca: metrica(null, 0, 'insuficiente'),
    } as Padroes,
    {
      intervaloMedioMamadas: metrica(null, 0, 'insuficiente'),
      duracaoMediaSoneca: metrica(null, 0, 'insuficiente'),
      horarioMedioSoneca: metrica(795, amostras),
    } as Padroes,
  ];

  for (const padroes of combinacoes) {
    // 60 dias: garante passar por todas as variações de cada faixa.
    for (let d = 1; d <= 60; d++) {
      const agora = new Date(Date.UTC(2026, 7, d, 15, 0));
      todasAsFrases.add(escolherInsight(padroes, NOME, { agora, fusoHorario: FUSO }).texto);
    }
  }
}

// A frase de aprendizado também entra na varredura.
for (let d = 1; d <= 60; d++) {
  const agora = new Date(Date.UTC(2026, 7, d, 15, 0));
  todasAsFrases.add(escolherInsight(null, NOME, { agora, fusoHorario: FUSO }).texto);
}

console.log(`\n${todasAsFrases.size} frases distintas geradas:\n`);
for (const f of [...todasAsFrases].sort()) console.log(`   ${f}`);
console.log('');

for (const { rotulo, re } of PROIBIDO) {
  const infratoras = [...todasAsFrases].filter((f) => re.test(f));
  conferir(
    `nenhuma frase contém ${rotulo}`,
    infratoras.length === 0,
    infratoras.length ? `ex.: "${infratoras[0]}"` : ''
  );
}

conferir(
  'toda frase cita o nome do bebê',
  [...todasAsFrases].every((f) => f.includes(NOME))
);
conferir(
  'toda frase termina em ponto final',
  [...todasAsFrases].every((f) => f.trim().endsWith('.'))
);

// ------------------------------------------------------------------
// 3. Estabilidade e variação
// ------------------------------------------------------------------

const padroesCompletos: Padroes = {
  intervaloMedioMamadas: metrica(211, 42),
  duracaoMediaSoneca: metrica(70, 19),
  horarioMedioSoneca: metrica(795, 19),
} as Padroes;

const manha = new Date(Date.UTC(2026, 7, 6, 11, 0));
const noite = new Date(Date.UTC(2026, 7, 6, 23, 0));
conferir(
  'a frase não muda ao longo do mesmo dia',
  escolherInsight(padroesCompletos, NOME, { agora: manha, fusoHorario: FUSO }).texto ===
    escolherInsight(padroesCompletos, NOME, { agora: noite, fusoHorario: FUSO }).texto
);

const aoLongoDosDias = new Set<string>();
for (let d = 1; d <= 14; d++) {
  aoLongoDosDias.add(
    escolherInsight(padroesCompletos, NOME, {
      agora: new Date(Date.UTC(2026, 7, d, 15, 0)),
      fusoHorario: FUSO,
    }).texto
  );
}
conferir(
  'em 14 dias o card não repete sempre a mesma frase',
  aoLongoDosDias.size >= 4,
  `${aoLongoDosDias.size} frases diferentes`
);

// ------------------------------------------------------------------
// 4. Os três estados do card
// ------------------------------------------------------------------

const semNada = escolherInsight(null, NOME, { fusoHorario: FUSO });
conferir('sem padrões, o card fica em modo aprendizado', semNada.aprendendo);
conferir('e a frase de aprendizado não cobra nem culpa', /Ainda estou|Por enquanto/.test(semNada.texto), semNada.texto);

const doisRegistros = escolherInsight(
  {
    intervaloMedioMamadas: metrica(null, 2, 'insuficiente'),
    duracaoMediaSoneca: metrica(null, 0, 'insuficiente'),
    horarioMedioSoneca: metrica(null, 0, 'insuficiente'),
  } as Padroes,
  NOME,
  { fusoHorario: FUSO }
);
conferir('conta nova com 2 registros vê a frase de aprendizado', doisRegistros.aprendendo);

// O caso que motivou o limiar de dispersão: horário não se aplica, mas as outras
// duas têm confiança. O card mostra uma delas — NÃO a frase de aprendizado.
const horarioSemSentido = escolherInsight(
  {
    intervaloMedioMamadas: metrica(211, 42),
    duracaoMediaSoneca: metrica(70, 19),
    horarioMedioSoneca: metrica(null, 19, 'nao_se_aplica'),
  } as Padroes,
  NOME,
  { fusoHorario: FUSO }
);
conferir(
  'métrica "não se aplica" sai de cena sem virar frase de aprendizado',
  !horarioSemSentido.aprendendo && !horarioSemSentido.texto.includes('por volta'),
  horarioSemSentido.texto
);

const soHorarioNaoSeAplica = new Set<string>();
for (let d = 1; d <= 30; d++) {
  soHorarioNaoSeAplica.add(
    escolherInsight(
      {
        intervaloMedioMamadas: metrica(211, 42),
        duracaoMediaSoneca: metrica(70, 19),
        horarioMedioSoneca: metrica(null, 19, 'nao_se_aplica'),
      } as Padroes,
      NOME,
      { agora: new Date(Date.UTC(2026, 7, d, 15, 0)), fusoHorario: FUSO }
    ).texto
  );
}
conferir(
  'e em 30 dias ela nunca aparece',
  ![...soHorarioNaoSeAplica].some((f) => f.includes('por volta')),
  `${soHorarioNaoSeAplica.size} frases, nenhuma de horário`
);

console.log(`\n${falhas === 0 ? 'Copy dentro das regras de tom.' : `${falhas} verificação(ões) falharam.`}`);
if (falhas > 0) process.exitCode = 1;

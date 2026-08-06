// Teste da superfície de consulta e do validador de ancoragem — puro, sem banco
// e sem modelo.
//
//   node scripts/teste-consultas.ts
//
// POR QUE A SUPERFÍCIE TEM TESTE
//
// Ela é a barreira. A segurança do assistente não vem de um prompt pedindo bom
// comportamento — vem de não existir consulta que avalie gravidade. Isso é uma
// afirmação sobre código, e afirmação sobre código se prova.
//
// E é também a tese (PRODUTO.md §0): só entram aqui os registros deste bebê,
// então nenhuma resposta pode ser sobre média. O teste cobre as duas coisas.
//
// A ORDEM IMPORTA
//
// Primeiro a prova de que o teste sabe reprovar, depois a varredura. Teste que
// só sabe passar não vale nada, e este projeto já teve um: a primeira versão do
// teste-copy-telas varreu 111 trechos achando que varria as telas, com a
// violação real dentro do que ela pulava.

import {
  ALVOS,
  gramaticaParaModelo,
  interpretar,
  NOMES_CONSULTA,
  responder,
  SUPERFICIE,
  type Consulta,
  type EventoBruto,
  type NumeroAncorado,
  RESPOSTA_SAUDE,
} from '../src/lib/consultas.ts';
import { formasAutorizadas, validarAncoragem } from '../src/lib/ancoragem.ts';
import { narrar } from '../src/lib/copyInsight.ts';
import { local } from './ajuda-tempo.ts';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

const SP = 'America/Sao_Paulo';
const ctx = (iso: string) => ({ agora: new Date(iso), fusoHorario: SP });

const mamada = (dia: string, h: number, m = 0): EventoBruto => ({
  tipo: 'amamentar',
  ocorridoEm: local(SP, dia, h, m),
});
const mamadeira = (dia: string, h: number, m = 0): EventoBruto => ({
  tipo: 'mamadeira',
  ocorridoEm: local(SP, dia, h, m),
});
const fralda = (dia: string, h: number, m = 0): EventoBruto => ({
  tipo: 'fralda',
  ocorridoEm: local(SP, dia, h, m),
});
const soneca = (dia: string, h: number, minutos: number | null): EventoBruto => ({
  tipo: 'sono',
  ocorridoEm: local(SP, dia, h),
  fimEm: minutos === null ? null : local(SP, dia, h, minutos),
});

// ==================================================================
// 1. Prova de que o teste sabe reprovar
// ==================================================================

const NUM = (valor: number, unidade: NumeroAncorado['unidade']): NumeroAncorado => ({
  valor,
  unidade,
});

console.log('--- prova: o validador de ancoragem reprova alucinação ---');

conferir(
  'frase com o número do motor passa',
  validarAncoragem('A última mamada foi às 14h20 — faz 2h40.', {
    faz: NUM(160, 'minutos'),
    horario: NUM(860, 'minutos_do_dia'),
  }).length === 0
);

conferir(
  'frase que INVENTA magnitude reprova',
  validarAncoragem('A última mamada foi às 14h20 — faz 3h20.', {
    faz: NUM(160, 'minutos'),
    horario: NUM(860, 'minutos_do_dia'),
  }).length > 0,
  'é o erro mais provável do Desenho A: frase plausível, tom certo, número errado'
);

conferir(
  'número por extenso do motor passa',
  validarAncoragem('Entre uma mamada e outra passa duas horas e meia.', {
    intervalo: NUM(150, 'minutos'),
  }).length === 0
);

conferir(
  'número por extenso INVENTADO reprova',
  validarAncoragem('Entre uma mamada e outra passa quatro horas.', {
    intervalo: NUM(150, 'minutos'),
  }).length > 0
);

conferir(
  'contagem certa passa e contagem inventada reprova',
  validarAncoragem('Hoje foram 6 trocas.', { quantos: NUM(6, 'contagem') }).length === 0 &&
    validarAncoragem('Hoje foram 9 trocas.', { quantos: NUM(6, 'contagem') }).length > 0
);

conferir(
  'artigo "uma" não vira falso positivo',
  validarAncoragem('Só tem uma mamada registrada até agora.', {}).length === 0,
  'falso positivo desliga validador; "uma mamada" é artigo, não quantidade'
);

conferir(
  '"quarenta e cinco" não é lido como "cinco" solto',
  validarAncoragem('As sonecas duram uns quarenta e cinco minutos.', {
    duracao: NUM(45, 'minutos'),
  }).length === 0,
  'remoção da forma mais longa primeiro'
);

console.log('\n--- prova: a barreira recusa o que não é consulta ---');

conferir(
  'pergunta de gravidade não vira consulta',
  'fora' in interpretar({ nome: 'avaliar_gravidade', sintoma: 'febre' }),
  'não existe a função — a recusa é estrutural, não é prompt'
);
conferir('lixo não vira consulta', 'fora' in interpretar('quanto ela dormiu?'));
conferir('null não vira consulta', 'fora' in interpretar(null));
conferir(
  'alvo inexistente não vira consulta',
  'fora' in interpretar({ nome: 'ultimo_registro', alvo: 'febre' })
);
conferir(
  'consulta válida vira consulta',
  !('fora' in interpretar({ nome: 'ultimo_registro', alvo: 'mamada' }))
);
const desvioSaude = interpretar({ fora: 'saude' });
conferir(
  'desvio de saúde chega rotulado como saúde',
  'fora' in desvioSaude && desvioSaude.fora === 'saude',
  'a resposta é diferente da de "não entendi": devolve a decisão pra mãe'
);

// ==================================================================
// 2. O manifesto cobre a união de tipos
// ==================================================================

console.log('\n--- manifesto ---');

conferir(
  'toda consulta declara o que responde, o que precisa e o que faz sem dado',
  NOMES_CONSULTA.every((n) => {
    const d = SUPERFICIE[n];
    return d && d.responde.length > 0 && d.exemplos.length > 0 && d.precisa.length > 0 && d.semDado.length > 0;
  })
);
conferir(
  'o manifesto não tem consulta a mais nem a menos',
  Object.keys(SUPERFICIE).length === NOMES_CONSULTA.length
);

// ==================================================================
// 3. A janela fria — o que responde com 1 registro
// ==================================================================

console.log('\n--- janela fria: memória antes de insight ---');

const AGORA = local(SP, '2026-08-06', 17, 0);

{
  // Uma mãe que registrou UMA mamada, há 2h40.
  const eventos = [mamada('2026-08-06', 14, 20)];
  const r = responder({ nome: 'ultimo_registro', alvo: 'mamada' }, eventos, ctx(AGORA));
  conferir(
    'com 1 registro, "quando foi a última mamada" já responde',
    r.estado === 'ok' && r.numeros.faz_minutos.valor === 160,
    r.estado === 'ok' ? `faz ${r.numeros.faz_minutos.valor} min` : r.estado
  );
  conferir(
    'e devolve o horário local, não o UTC',
    r.estado === 'ok' && r.numeros.horario.valor === 14 * 60 + 20
  );
}

{
  const r = responder({ nome: 'ultimo_registro', alvo: 'mamada' }, [], ctx(AGORA));
  conferir(
    'sem nenhum registro, não inventa: sem_dado',
    r.estado === 'sem_dado' && r.falta.motivo === 'nenhum_registro'
  );
}

{
  const eventos = [
    mamada('2026-08-06', 6),
    mamadeira('2026-08-06', 9, 30),
    mamada('2026-08-06', 13),
    fralda('2026-08-06', 7),
    fralda('2026-08-06', 11),
  ];
  const r = responder({ nome: 'contagem_do_dia', alvo: 'mamada', dia: 'hoje' }, eventos, ctx(AGORA));
  conferir(
    'contagem do dia soma amamentação e mamadeira no mesmo alvo',
    r.estado === 'ok' && r.numeros.quantos.valor === 3,
    'mamada é uma pergunta só pra quem pergunta'
  );

  const f = responder({ nome: 'contagem_do_dia', alvo: 'fralda', dia: 'hoje' }, eventos, ctx(AGORA));
  conferir('contagem de fralda conta só fralda', f.estado === 'ok' && f.numeros.quantos.valor === 2);
}

{
  // App instalado hoje: "quantas fraldas ontem" não é zero, é desconhecido.
  const eventos = [fralda('2026-08-06', 9)];
  const r = responder({ nome: 'contagem_do_dia', alvo: 'fralda', dia: 'ontem' }, eventos, ctx(AGORA));
  conferir(
    'app novo não diz "nenhuma troca ontem"',
    r.estado === 'sem_dado' && r.falta.motivo === 'periodo_incompleto',
    'não houve zero trocas: houve zero registro, e a diferença é a honestidade'
  );
}

{
  const eventos = [
    soneca('2026-08-05', 9, 50),
    soneca('2026-08-05', 13, 70),
    soneca('2026-08-06', 10, 40),
    soneca('2026-08-06', 15, null), // em andamento
  ];
  const ontem = responder({ nome: 'total_sono_do_dia', dia: 'ontem' }, eventos, ctx(AGORA));
  conferir(
    '"quanto de sono ontem" soma as durações do dia',
    ontem.estado === 'ok' && ontem.numeros.total_minutos.valor === 120
  );

  const hoje = responder({ nome: 'total_sono_do_dia', dia: 'hoje' }, eventos, ctx(AGORA));
  conferir(
    'sono em andamento não entra na soma',
    hoje.estado === 'ok' && hoje.numeros.total_minutos.valor === 40,
    'a duração dele ainda não aconteceu — mesma regra do motor'
  );
}

{
  const eventos = [mamada('2026-08-06', 11, 0), mamada('2026-08-06', 14, 20)];
  const r = responder({ nome: 'intervalo_entre_ultimos', alvo: 'mamada' }, eventos, ctx(AGORA));
  conferir(
    'com 2 registros dá o intervalo entre eles',
    r.estado === 'ok' && r.numeros.intervalo_minutos.valor === 200
  );

  const um = responder(
    { nome: 'intervalo_entre_ultimos', alvo: 'mamada' },
    [mamada('2026-08-06', 11)],
    ctx(AGORA)
  );
  conferir(
    'com 1 registro admite que não dá',
    um.estado === 'sem_dado' && um.falta.motivo === 'poucos_registros'
  );
}

// ==================================================================
// 4. Comparação dela com ela
// ==================================================================

console.log('\n--- comparação própria ---');

{
  // Ontem o dia INTEIRO teve 8 mamadas, mas até as 17h tinha 5.
  // Hoje, até as 17h, teve 5. A resposta honesta é "igual", não "menos".
  const eventos = [
    // Registro de anteontem: é o que prova que o app já estava gravando quando
    // a janela de ontem abriu. Fora das duas janelas, não muda contagem nenhuma.
    mamada('2026-08-04', 20),
    ...[6, 9, 12, 14, 16].map((h) => mamada('2026-08-05', h)),
    ...[18, 20, 22].map((h) => mamada('2026-08-05', h)),
    ...[6, 9, 12, 14, 16].map((h) => mamada('2026-08-06', h)),
  ];
  const r = responder({ nome: 'comparar_dias', metrica: 'mamadas' }, eventos, ctx(AGORA));
  conferir(
    'compara hoje até agora com ontem NA MESMA HORA',
    r.estado === 'ok' && r.numeros.hoje.valor === 5 && r.numeros.ontem.valor === 5,
    r.estado === 'ok' ? `hoje ${r.numeros.hoje.valor}, ontem ${r.numeros.ontem.valor}` : r.estado
  );
  conferir(
    'e não com o dia inteiro de ontem',
    r.estado === 'ok' && r.numeros.ontem.valor !== 8,
    'senão toda manhã a frase diria que hoje está pior'
  );
}

{
  const eventos = [mamada('2026-08-06', 9)];
  const r = responder({ nome: 'comparar_dias', metrica: 'mamadas' }, eventos, ctx(AGORA));
  conferir(
    'sem o dia de ontem, não compara',
    r.estado === 'sem_dado' && r.falta.motivo === 'periodo_incompleto'
  );
}

{
  // O caso que decide o quanto a trava é estrita: a mãe começou a registrar
  // ONTEM DE MANHÃ. Ontem tem quase um dia inteiro de cobertura — mas não tem a
  // madrugada, e é justamente lá que moram as mamadas que faltariam na conta.
  // "Hoje teve 5, ontem teve 3" seria plausível e errado.
  const eventos = [
    ...[9, 13, 17].map((h) => mamada('2026-08-05', h)),
    ...[2, 6, 9, 13, 16].map((h) => mamada('2026-08-06', h)),
  ];
  const r = responder({ nome: 'comparar_dias', metrica: 'mamadas' }, eventos, ctx(AGORA));
  conferir(
    'primeiro dia pela metade não vira comparação',
    r.estado === 'sem_dado' && r.falta.motivo === 'periodo_incompleto',
    'a janela de ontem precisa ter começado com o app já gravando'
  );
}

{
  // O exemplo do PRODUTO.md: dormiu mais essa semana que na passada.
  // Semana passada: 7 sonecas de 60 min. Esta semana: 7 sonecas de 100 min.
  const marcoAntigo: EventoBruto = {
    tipo: 'sono',
    // 15 dias atrás: prova que o app já gravava quando a semana passada começou.
    // Fora das duas janelas, não entra em soma nenhuma.
    ocorridoEm: new Date(new Date(AGORA).getTime() - 15 * 24 * 60 * 60_000).toISOString(),
    fimEm: new Date(
      new Date(AGORA).getTime() - 15 * 24 * 60 * 60_000 + 30 * 60_000
    ).toISOString(),
  };
  const semanaPassada: EventoBruto[] = [];
  const estaSemana: EventoBruto[] = [];
  for (let i = 0; i < 7; i++) {
    // `- 1h` afasta o último da fronteira exata entre as duas semanas. Com
    // janela meio-aberta o registro da borda pertence à semana atual — está
    // certo, mas deixaria o teste medindo a borda em vez das duas semanas.
    const diaAntigo = new Date(
      new Date(AGORA).getTime() - (13 - i) * 24 * 60 * 60_000 - 60 * 60_000
    );
    const diaNovo = new Date(new Date(AGORA).getTime() - (6 - i) * 24 * 60 * 60_000);
    semanaPassada.push({
      tipo: 'sono',
      ocorridoEm: diaAntigo.toISOString(),
      fimEm: new Date(diaAntigo.getTime() + 60 * 60_000).toISOString(),
    });
    estaSemana.push({
      tipo: 'sono',
      ocorridoEm: diaNovo.toISOString(),
      fimEm: new Date(diaNovo.getTime() + 100 * 60_000).toISOString(),
    });
  }

  const r = responder(
    { nome: 'comparar_semanas', metrica: 'sono_total' },
    [marcoAntigo, ...semanaPassada, ...estaSemana],
    ctx(AGORA)
  );
  conferir(
    'compara os últimos 7 dias com os 7 anteriores',
    r.estado === 'ok' && r.numeros.diferenca.valor === 280,
    r.estado === 'ok'
      ? `esta ${r.numeros.esta_semana.valor} min, passada ${r.numeros.semana_passada.valor} min`
      : r.estado
  );

  const curto = responder(
    { nome: 'comparar_semanas', metrica: 'sono_total' },
    estaSemana,
    ctx(AGORA)
  );
  conferir(
    'com menos de 14 dias de histórico, recusa comparar',
    curto.estado === 'sem_dado' && curto.falta.motivo === 'periodo_incompleto',
    'comparar 7 dias com uma semana que não existia diria "dormiu muito mais"'
  );
}

// ==================================================================
// 5. Padrão — delega ao motor, não recalcula
// ==================================================================

console.log('\n--- padrão ---');

{
  const eventos = [1, 2, 3, 4, 5].map((d) => soneca(`2026-08-0${d}`, 13, 60));
  const r = responder({ nome: 'padrao', metrica: 'horario_soneca' }, eventos, ctx(AGORA));
  conferir(
    'com 5 sonecas agrupadas, devolve o horário do motor',
    r.estado === 'ok' && r.numeros.valor.valor === 13 * 60,
    r.estado === 'ok' ? `${r.numeros.valor.valor} min do dia` : r.estado
  );
  conferir(
    'e marca a unidade como horário, não duração',
    r.estado === 'ok' && r.numeros.valor.unidade === 'minutos_do_dia',
    'é o que faz o validador aceitar "13h" e recusar "13 minutos"'
  );
}

{
  const eventos = [1, 2, 3].map((d) => soneca(`2026-08-0${d}`, 13, 60));
  const r = responder({ nome: 'padrao', metrica: 'horario_soneca' }, eventos, ctx(AGORA));
  conferir(
    'abaixo do limiar do motor, cai em sem_dado',
    r.estado === 'sem_dado' && r.falta.motivo === 'poucos_registros'
  );
}

{
  // Sonecas espalhadas: o motor devolve `nao_se_aplica`. Para quem PERGUNTOU, o
  // fim é o mesmo — a Ninna não tem esse número pra dar.
  const eventos = [
    soneca('2026-08-01', 9, 60),
    soneca('2026-08-02', 13, 60),
    soneca('2026-08-03', 16, 60),
    soneca('2026-08-04', 10, 60),
    soneca('2026-08-05', 17, 60),
  ];
  const r = responder({ nome: 'padrao', metrica: 'horario_soneca' }, eventos, ctx(AGORA));
  conferir(
    'métrica que não descreve nada não vira resposta',
    r.estado === 'sem_dado',
    'o silêncio honesto do motor atravessa a superfície'
  );
}

// ==================================================================
// 6. Ancoragem ponta a ponta: o que o motor devolveu é o que dá pra dizer
// ==================================================================

console.log('\n--- ancoragem sobre respostas reais ---');

{
  const eventos = [mamada('2026-08-06', 14, 20)];
  const r = responder({ nome: 'ultimo_registro', alvo: 'mamada' }, eventos, ctx(AGORA));
  if (r.estado !== 'ok') {
    conferir('resposta de recall veio ok', false, r.estado);
  } else {
    conferir(
      'a frase que a Ninna diria está ancorada',
      validarAncoragem('A última mamada foi às 14h20 — faz 2h40.', r.numeros).length === 0
    );
    conferir(
      'e qualquer outro número reprova contra a MESMA resposta',
      validarAncoragem('A última mamada foi às 15h — faz 1h.', r.numeros).length > 0
    );
  }
}

conferir(
  'toda unidade gera pelo menos uma forma escrita',
  (['minutos', 'minutos_do_dia', 'contagem'] as const).every(
    (u) => formasAutorizadas({ valor: 90, unidade: u }).length > 0
  )
);

// ==================================================================
// 7. Cobertura: nenhuma consulta ficou sem exercício
// ==================================================================

const EXERCITADAS: Consulta['nome'][] = [
  'ultimo_registro',
  'contagem_do_dia',
  'total_sono_do_dia',
  'intervalo_entre_ultimos',
  'comparar_dias',
  'comparar_semanas',
  'padrao',
];
conferir(
  'todas as consultas da superfície foram exercitadas',
  NOMES_CONSULTA.every((n) => EXERCITADAS.includes(n)),
  `${EXERCITADAS.length}/${NOMES_CONSULTA.length}`
);
conferir(
  'todo alvo é aceito pelo interpretador',
  ALVOS.every((a) => !('fora' in interpretar({ nome: 'ultimo_registro', alvo: a })))
);

// ==================================================================
// 8. Narração — o Desenho B: a frase sai do código, não do modelo
// ==================================================================
//
// Recall é a pergunta mais frequente de mãe de recém-nascido. Se o modelo
// narrasse, a resposta mais lida do app seria a menos verificada — e o tom é o
// produto. Então a frase é determinística, e é aqui que ela se prova.
//
// A EMENDA À REGRA "SEM DURAÇÃO EM NÚMERO"
//
// O card descreve um padrão e por isso fala em palavra ("cerca de uma hora"):
// prometer minuto sobre o sono de um bebê é falsa exatidão. Recall responde um
// fato que a mãe confere na lista, e "faz pouco mais de duas horas e meia" seria
// vagueza falsa — ela decide se amamenta agora com base nisso. O que continua
// proibido nos dois é a ABREVIAÇÃO de planilha: "45 min" não, "45 minutos" sim.

console.log('\n--- narração (Desenho B) ---');

const NOME = 'Liz';

const PROIBIDO_NA_NARRACAO: { rotulo: string; re: RegExp }[] = [
  { rotulo: 'artigo de gênero antes do nome', re: /\b(a|o|da|do|na|no|pela|pelo)\s+Liz\b/i },
  { rotulo: 'pronome de gênero', re: /\b(ele|ela|dele|dela|nele|nela)\b/i },
  { rotulo: 'linguagem de painel', re: /\b(m[ée]dia|dados|m[ée]trica|percentual|%)\b/i },
  { rotulo: 'abreviação de planilha', re: /\d+\s*min\b/i },
  { rotulo: 'prescrição', re: /\b(ideal|recomend\w*|dever\w*|tente|procure)\b/i },
  {
    rotulo: 'julgamento',
    re: /\bpouco(?!\s+mais)\b|\bmuito\b|\b(irregular|constante|normal|anormal|adequad\w+|excessiv\w+)\b/i,
  },
  { rotulo: 'cobrança / gamificação', re: /\b(desbloque\w*|insuficient\w*|complete|meta)\b/i },
  { rotulo: 'alarme', re: /\b(aten[çc][ãa]o|alerta|cuidado|preocup\w*|risco)\b/i },
  { rotulo: 'decimal', re: /\d+[.,]\d/ },
  { rotulo: 'linguagem de média', re: /\bbeb[êe]s\b|\bpara a idade\b|\bo esperado\b/i },
];

/** 17 dias de rotina: massa farta o bastante pra quase toda consulta responder. */
function massaFarta(): EventoBruto[] {
  const eventos: EventoBruto[] = [];
  const base = new Date(AGORA).getTime();
  const DIA = 24 * 60 * 60_000;
  for (let d = 16; d >= 0; d--) {
    const meiaNoite = base - d * DIA - 17 * 60 * 60_000;
    for (const h of [6, 9, 12, 15]) {
      eventos.push({ tipo: 'amamentar', ocorridoEm: new Date(meiaNoite + h * 60 * 60_000).toISOString() });
    }
    for (const h of [7, 13]) {
      eventos.push({ tipo: 'fralda', ocorridoEm: new Date(meiaNoite + h * 60 * 60_000).toISOString() });
    }
    const inicioSono = meiaNoite + 10 * 60 * 60_000;
    eventos.push({
      tipo: 'sono',
      ocorridoEm: new Date(inicioSono).toISOString(),
      // Sonecas mais longas na semana atual: dá conteúdo pra comparação.
      fimEm: new Date(inicioSono + (d < 7 ? 100 : 60) * 60_000).toISOString(),
    });
  }
  return eventos;
}

const TODAS_AS_CONSULTAS: Consulta[] = [
  ...ALVOS.map((alvo) => ({ nome: 'ultimo_registro' as const, alvo })),
  ...ALVOS.flatMap((alvo) =>
    (['hoje', 'ontem'] as const).map((dia) => ({ nome: 'contagem_do_dia' as const, alvo, dia }))
  ),
  ...(['hoje', 'ontem'] as const).map((dia) => ({ nome: 'total_sono_do_dia' as const, dia })),
  ...ALVOS.map((alvo) => ({ nome: 'intervalo_entre_ultimos' as const, alvo })),
  ...(['sono_total', 'mamadas', 'trocas'] as const).map((metrica) => ({
    nome: 'comparar_dias' as const,
    metrica,
  })),
  ...(['sono_total', 'mamadas', 'trocas'] as const).map((metrica) => ({
    nome: 'comparar_semanas' as const,
    metrica,
  })),
  ...(['intervalo_mamadas', 'duracao_soneca', 'horario_soneca'] as const).map((metrica) => ({
    nome: 'padrao' as const,
    metrica,
  })),
];

const frases = new Set<string>();
let semDadoVistos = 0;
let okVistos = 0;
let desancoradas = 0;

// Três massas: farta (quase tudo responde), vazia (quase tudo é recusa) e a
// janela fria de um registro só.
for (const eventos of [massaFarta(), [] as EventoBruto[], [mamada('2026-08-06', 14, 20)]]) {
  for (const consulta of TODAS_AS_CONSULTAS) {
    const r = responder(consulta, eventos, ctx(AGORA));
    const frase = narrar(r, NOME);
    frases.add(frase);

    if (r.estado === 'ok') {
      okVistos++;
      const problemas = validarAncoragem(frase, r.numeros);
      if (problemas.length > 0) {
        desancoradas++;
        console.log(
          `[ FALHA] frase não ancorada em ${consulta.nome}: "${frase}" — sobrou ${problemas
            .map((p) => p.trecho)
            .join(', ')}`
        );
      }
    } else if (r.estado === 'sem_dado') {
      semDadoVistos++;
    }
  }
}

// As duas recusas também são frase, e entram na varredura de tom.
frases.add(narrar({ estado: 'fora_de_escopo', razao: 'saude' }, NOME));
frases.add(narrar({ estado: 'fora_de_escopo', razao: 'desconhecida' }, NOME));

conferir(
  'toda resposta com dado virou frase ancorada',
  desancoradas === 0,
  `${okVistos} respostas ok`
);
conferir('as recusas por falta de dado também têm frase', semDadoVistos > 0, `${semDadoVistos} recusas`);
conferir(
  'nenhuma frase saiu vazia',
  [...frases].every((f) => f.trim().length > 10),
  `${frases.size} frases distintas`
);

/**
 * A copy de saúde travada é exceção declarada, não frase esquecida.
 *
 * A regra "alarme" existe para impedir que o app assuste. Esta frase faz o
 * contrário: "se você estiver preocupada" descreve o estado DA MÃE e devolve a
 * decisão pra ela, que é exatamente o que o CLAUDE.md manda. Ela é a mesma
 * promessa do texto da tela de sintoma, e não se reescreve por varredura —
 * mesma razão pela qual ela já é exceção declarada na varredura de gênero.
 */
const FRASES_TRAVADAS = new Set([RESPOSTA_SAUDE]);

let violacoesDeTom = 0;
let travadasVistas = 0;
for (const frase of frases) {
  if (FRASES_TRAVADAS.has(frase)) {
    travadasVistas++;
    continue;
  }
  for (const regra of PROIBIDO_NA_NARRACAO) {
    if (regra.re.test(frase)) {
      violacoesDeTom++;
      console.log(`[ FALHA] ${regra.rotulo}: "${frase}"`);
    }
  }
}
conferir(
  'a copy de saúde travada continua sendo produzida',
  travadasVistas === FRASES_TRAVADAS.size,
  'exceção que deixa de ser alcançada é permissão órfã'
);
conferir(
  'nenhuma frase possível quebra as regras de tom',
  violacoesDeTom === 0,
  `${frases.size} frases x ${PROIBIDO_NA_NARRACAO.length} proibições`
);

// A frase da tese, saindo do código.
{
  const base = new Date(AGORA).getTime();
  const DIA = 24 * 60 * 60_000;
  const semanaPassada: EventoBruto[] = [];
  const estaSemana: EventoBruto[] = [];
  for (let i = 0; i < 7; i++) {
    const antigo = base - (13 - i) * DIA - 60 * 60_000;
    const novo = base - (6 - i) * DIA;
    semanaPassada.push({
      tipo: 'sono',
      ocorridoEm: new Date(antigo).toISOString(),
      fimEm: new Date(antigo + 60 * 60_000).toISOString(),
    });
    // +40 min no total da semana, espalhados: é o exemplo do PRODUTO.md.
    estaSemana.push({
      tipo: 'sono',
      ocorridoEm: new Date(novo).toISOString(),
      fimEm: new Date(novo + (60 + (i === 0 ? 40 : 0)) * 60_000).toISOString(),
    });
  }
  const marco: EventoBruto = {
    tipo: 'sono',
    ocorridoEm: new Date(base - 15 * DIA).toISOString(),
    fimEm: new Date(base - 15 * DIA + 30 * 60_000).toISOString(),
  };

  const r = responder(
    { nome: 'comparar_semanas', metrica: 'sono_total' },
    [marco, ...semanaPassada, ...estaSemana],
    ctx(AGORA)
  );
  const frase = narrar(r, NOME);
  conferir(
    'a frase da tese sai do código, comparando Liz com Liz',
    frase.includes('40 minutos a mais') && frase.startsWith(NOME) && !/beb[êe]s/i.test(frase),
    frase
  );
  conferir(
    'e ela está ancorada no número que o motor calculou',
    r.estado === 'ok' && validarAncoragem(frase, r.numeros).length === 0
  );
}

// ==================================================================
// 9. A gramática do modelo — gerada da superfície, nunca escrita à mão
// ==================================================================

console.log('\n--- gramática do modelo ---');

{
  const { instrucoes, schema } = gramaticaParaModelo();

  conferir(
    'toda consulta da superfície aparece na gramática',
    NOMES_CONSULTA.every((n) => instrucoes.includes(n)),
    'consulta nova sem entrada na gramática seria capacidade que o modelo nunca escolhe'
  );

  const props = (schema.properties ?? {}) as Record<string, { enum?: string[] }>;
  conferir(
    'o schema oferece exatamente as consultas que existem',
    JSON.stringify(props.nome?.enum) === JSON.stringify(NOMES_CONSULTA)
  );
  conferir(
    'e exatamente os alvos que existem',
    JSON.stringify(props.alvo?.enum) === JSON.stringify(ALVOS)
  );
  conferir(
    'a gramática ensina o desvio de saúde',
    instrucoes.includes('"fora": "saude"') && (props.fora?.enum ?? []).includes('saude'),
    'sem isso o modelo tentaria encaixar febre em alguma consulta'
  );
  conferir(
    'e manda escolher "fora" na dúvida',
    /na d[úu]vida[^.]*fora/i.test(instrucoes),
    'o viés do modelo tem que apontar pra recusa, não pra resposta'
  );

  // A gramática é texto que vai pro modelo, não copy — mas se ela ensinasse o
  // modelo a falar de população, a tese cairia por dentro.
  conferir(
    'a gramática não contém linguagem de média',
    !/\bpara a idade\b|\bo esperado\b|\bpercentil\b/i.test(instrucoes)
  );
}

console.log(
  `\n${falhas === 0 ? 'Superfície de consulta, ancoragem, narração e gramática corretas.' : `${falhas} falha(s).`}`
);
process.exit(falhas === 0 ? 0 : 1);

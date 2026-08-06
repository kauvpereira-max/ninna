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
  interpretar,
  NOMES_CONSULTA,
  responder,
  SUPERFICIE,
  type Consulta,
  type EventoBruto,
  type NumeroAncorado,
} from '../src/lib/consultas.ts';
import { formasAutorizadas, validarAncoragem } from '../src/lib/ancoragem.ts';
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

console.log(
  `\n${falhas === 0 ? 'Superfície de consulta e ancoragem corretas.' : `${falhas} falha(s).`}`
);
process.exit(falhas === 0 ? 0 : 1);

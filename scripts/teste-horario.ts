// Teste do agrupamento por dia — o fuso é o que está sendo testado.
//
//   node scripts/teste-horario.ts
//
// POR QUE ESTE TESTE NÃO MEXE EM TZ
//
// A primeira versão se re-executava com TZ=America/Sao_Paulo. Era teatro: neste
// ambiente (Node no Windows) a variável TZ é ignorada para nomes IANA — só 'UTC'
// tem efeito. Conferido:
//
//   TZ=Asia/Tokyo      -> America/Sao_Paulo   (ignorado)
//   TZ=America/New_York-> America/Sao_Paulo   (ignorado)
//   TZ=UTC             -> UTC                 (aplicado)
//
// Ou seja, o teste rodava no fuso da máquina achando que rodava no fuso pedido.
// Passava porque a máquina já estava em São Paulo. Num runner em UTC, o mesmo
// teste daria verde para uma implementação errada — porque em offset zero a data
// local e a data UTC coincidem, e é justamente essa diferença que ele existe pra
// pegar.
//
// A versão atual usa o fuso ambiente, seja qual for, e PROVA EM TEMPO DE
// EXECUÇÃO que consegue distinguir uma implementação correta de uma errada. Se
// não conseguir, falha e diz por quê — em vez de dar verde.

import { chaveDoDia, rotularDia, formatarHora, inicioDoDiaLocal } from '../src/lib/horario.ts';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

/** O que uma implementação ERRADA devolveria: a data em UTC. */
const chaveIngenua = (iso: string) => iso.slice(0, 10);

const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
const offset = -new Date(2026, 7, 3).getTimezoneOffset() / 60;
console.log(`Fuso ambiente: ${fuso} (offset ${offset >= 0 ? '+' : ''}${offset}h)\n`);

// Duas pontas do dia. Em offset negativo (Américas) é a de 23h50 que denuncia o
// erro; em offset positivo (Ásia, Oceania) é a de 00h10. Uma das duas pega o bug
// em qualquer fuso que não seja zero.
const tardeDaNoite = new Date(2026, 7, 3, 23, 50, 0);
const madrugada = new Date(2026, 7, 4, 0, 10, 0);

// ------------------------------------------------------------------
// 0. O teste consegue provar alguma coisa AQUI?
//
// Em offset zero, data local e data UTC são a mesma, e a implementação errada
// passaria em tudo abaixo. Melhor falhar dizendo isso do que dar verde.
// ------------------------------------------------------------------

const discrimina =
  chaveIngenua(tardeDaNoite.toISOString()) !== '2026-08-03' ||
  chaveIngenua(madrugada.toISOString()) !== '2026-08-04';

conferir(
  'o fuso ambiente distingue implementação correta de errada',
  discrimina,
  discrimina
    ? ''
    : 'offset zero: data local == data UTC. Rode num fuso diferente de UTC — ' +
      'em offset zero este teste não prova nada.'
);

if (!discrimina) {
  console.log('\nInterrompido: rodar o resto daria verde sem significar nada.');
  process.exitCode = 1;
} else {
  // ------------------------------------------------------------------
  // 1. Cada instante pertence ao SEU dia local
  // ------------------------------------------------------------------

  conferir(
    '23h50 local pertence ao próprio dia',
    chaveDoDia(tardeDaNoite.toISOString()) === '2026-08-03',
    `deu ${chaveDoDia(tardeDaNoite.toISOString())}, UTC diria ${chaveIngenua(tardeDaNoite.toISOString())}`
  );
  conferir(
    '00h10 local pertence ao próprio dia',
    chaveDoDia(madrugada.toISOString()) === '2026-08-04',
    `deu ${chaveDoDia(madrugada.toISOString())}, UTC diria ${chaveIngenua(madrugada.toISOString())}`
  );
  conferir(
    'a mamada das 23h50 e a das 00h10 caem em dias diferentes',
    chaveDoDia(tardeDaNoite.toISOString()) !== chaveDoDia(madrugada.toISOString())
  );
  conferir('a hora exibida continua 23:50', formatarHora(tardeDaNoite.toISOString()) === '23:50');

  // ------------------------------------------------------------------
  // 2. Varredura das 24 horas: nenhum instante pode escapar do próprio dia
  // ------------------------------------------------------------------

  let horasErradas = 0;
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30, 59]) {
      const d = new Date(2026, 7, 3, h, m, 0);
      if (chaveDoDia(d.toISOString()) !== '2026-08-03') horasErradas++;
    }
  }
  conferir('as 72 marcas do dia inteiro caem no dia certo', horasErradas === 0, `${horasErradas} erradas`);

  // ------------------------------------------------------------------
  // 3. Rótulos
  // ------------------------------------------------------------------

  const agora = new Date(2026, 7, 5, 14, 0, 0);
  conferir(
    'hoje às 23h50 ainda é "Hoje"',
    rotularDia(new Date(2026, 7, 5, 23, 50, 0).toISOString(), agora) === 'Hoje'
  );
  conferir(
    'ontem é "Ontem"',
    rotularDia(new Date(2026, 7, 4, 8, 0, 0).toISOString(), agora) === 'Ontem'
  );
  conferir(
    'mais atrás vira "1 de agosto"',
    rotularDia(new Date(2026, 7, 1, 8, 0, 0).toISOString(), agora) === '1 de agosto'
  );
  conferir(
    'outro ano leva o ano junto',
    rotularDia(new Date(2025, 7, 1, 8, 0, 0).toISOString(), agora) === '1 de agosto de 2025'
  );

  // ------------------------------------------------------------------
  // 4. Virada de ano
  // ------------------------------------------------------------------

  conferir(
    '31/12 às 23h30 continua em 2025',
    chaveDoDia(new Date(2025, 11, 31, 23, 30, 0).toISOString()) === '2025-12-31'
  );

  // ------------------------------------------------------------------
  // O CORTE DE "HOJE" — o que os mini-stats contam
  // ------------------------------------------------------------------

  const noiteFechada = new Date(2026, 7, 13, 23, 45, 0);
  const corte = inicioDoDiaLocal(noiteFechada);

  conferir(
    'às 23h45, o corte de hoje é a meia-noite LOCAL do mesmo dia',
    corte.getFullYear() === 2026 &&
      corte.getMonth() === 7 &&
      corte.getDate() === 13 &&
      corte.getHours() === 0 &&
      corte.getMinutes() === 0
  );

  // O CONTROLE, e é ele que dá sentido ao caso acima: a implementação errada
  // óbvia é `toISOString().slice(0,10)`, que no Brasil já virou o dia 14 às
  // 21h. Este caso reprova essa versão sem depender do fuso da máquina — ele
  // compara o corte com a data LOCAL, que é a única que a mãe enxerga.
  conferir(
    'e o corte nunca cai no dia seguinte ao que a mãe está vivendo',
    chaveDoDia(corte.toISOString()) === chaveDoDia(noiteFechada.toISOString())
  );

  conferir(
    'um registro de 23h50 é de HOJE para a contagem',
    new Date(2026, 7, 13, 23, 50, 0).getTime() >= corte.getTime()
  );
  conferir(
    'e um de 23h50 de ontem não é',
    new Date(2026, 7, 12, 23, 50, 0).getTime() < corte.getTime()
  );

  console.log(
    `\n${falhas === 0 ? 'Agrupamento por dia correto.' : `${falhas} verificação(ões) falharam.`}`
  );
  if (falhas > 0) process.exitCode = 1;
}

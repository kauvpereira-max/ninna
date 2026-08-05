// Teste do agrupamento por dia — o fuso é o que está sendo testado.
//
//   node scripts/teste-horario.ts
//
// Este teste SE RE-EXECUTA com TZ=America/Sao_Paulo. Sem isso ele seria teatro:
// numa máquina em UTC, `toISOString().slice(0,10)` e a data local coincidem, e
// uma implementação errada passa verde. O bug só existe onde o fuso é diferente
// de zero — ou seja, exatamente onde as mães estão.

import { spawnSync } from 'node:child_process';

const FUSO = 'America/Sao_Paulo';
if (process.env.TZ !== FUSO) {
  const r = spawnSync(process.execPath, [import.meta.filename], {
    env: { ...process.env, TZ: FUSO },
    stdio: 'inherit',
  });
  process.exit(r.status ?? 1);
}

const { chaveDoDia, rotularDia, formatarHora } = await import('../src/lib/horario.ts');

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

console.log(`Fuso: ${FUSO} (offset ${-new Date().getTimezoneOffset() / 60}h)\n`);

// ------------------------------------------------------------------
// 1. O caso do enunciado: 23h50 não pode cair no dia seguinte
//
// Em UTC-3, 23h50 de 3 de agosto é 02h50 de 4 de agosto em UTC. Agrupando por
// UTC, a mãe procuraria em "Ontem" a mamada que ela acabou de registrar.
// ------------------------------------------------------------------

const tardeDaNoite = new Date(2026, 7, 3, 23, 50, 0); // 3 de agosto, 23:50 local
conferir(
  '23h50 local pertence ao próprio dia',
  chaveDoDia(tardeDaNoite.toISOString()) === '2026-08-03',
  `deu ${chaveDoDia(tardeDaNoite.toISOString())}`
);
conferir(
  'e o UTC dessa mesma hora é MESMO outro dia (senão o teste não prova nada)',
  tardeDaNoite.toISOString().slice(0, 10) === '2026-08-04',
  `UTC deu ${tardeDaNoite.toISOString().slice(0, 10)}`
);
conferir('a hora exibida continua 23:50', formatarHora(tardeDaNoite.toISOString()) === '23:50');

// ------------------------------------------------------------------
// 2. A outra ponta: 00h10 pertence ao dia que começou
// ------------------------------------------------------------------

const madrugada = new Date(2026, 7, 4, 0, 10, 0);
conferir(
  '00h10 local pertence ao próprio dia',
  chaveDoDia(madrugada.toISOString()) === '2026-08-04',
  `deu ${chaveDoDia(madrugada.toISOString())}`
);
conferir(
  'a mamada das 23h50 e a das 00h10 caem em dias DIFERENTES',
  chaveDoDia(tardeDaNoite.toISOString()) !== chaveDoDia(madrugada.toISOString())
);

// ------------------------------------------------------------------
// 3. Rótulos
// ------------------------------------------------------------------

const agora = new Date(2026, 7, 5, 14, 0, 0);
const hoje = new Date(2026, 7, 5, 23, 50, 0);
const ontem = new Date(2026, 7, 4, 8, 0, 0);
const antes = new Date(2026, 7, 1, 8, 0, 0);
const anoPassado = new Date(2025, 7, 1, 8, 0, 0);

conferir('hoje às 23h50 ainda é "Hoje"', rotularDia(hoje.toISOString(), agora) === 'Hoje');
conferir('ontem é "Ontem"', rotularDia(ontem.toISOString(), agora) === 'Ontem');
conferir(
  'mais atrás vira "1 de agosto"',
  rotularDia(antes.toISOString(), agora) === '1 de agosto',
  `deu "${rotularDia(antes.toISOString(), agora)}"`
);
conferir(
  'outro ano leva o ano junto',
  rotularDia(anoPassado.toISOString(), agora) === '1 de agosto de 2025',
  `deu "${rotularDia(anoPassado.toISOString(), agora)}"`
);

// ------------------------------------------------------------------
// 4. Virada de mês e de ano
// ------------------------------------------------------------------

const viradaAno = new Date(2025, 11, 31, 23, 30, 0);
conferir(
  '31/12 às 23h30 continua em 2025',
  chaveDoDia(viradaAno.toISOString()) === '2025-12-31',
  `deu ${chaveDoDia(viradaAno.toISOString())}`
);

console.log(`\n${falhas === 0 ? 'Agrupamento por dia correto.' : `${falhas} verificação(ões) falharam.`}`);
if (falhas > 0) process.exitCode = 1;

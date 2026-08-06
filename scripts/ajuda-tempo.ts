// Construção de instantes a partir de hora LOCAL declarada, para os testes.
//
// Mora separado porque `teste-padroes.ts` e `teste-copy-insight.ts` precisam da
// mesma coisa, e duplicar isto significaria dois construtores podendo divergir —
// num par de arquivos cujo assunto é justamente fuso horário.
//
// O ponto de tudo: NUNCA depender do fuso da máquina. O teste do D6 já passou
// verde sem provar nada por causa disso (no Windows a variável TZ é ignorada
// para nomes IANA), e o R4 vive exatamente aqui.

function offsetMinutos(fuso: string, d: Date): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (comoUtc - Math.floor(d.getTime() / 1000) * 1000) / 60_000;
}

/**
 * ISO do instante em que o relógio de `fuso` marca a hora pedida.
 *
 * Duas passadas porque o offset depende do próprio instante que se está
 * calculando: em fuso com horário de verão, o palpite inicial pode cair do lado
 * errado da virada.
 */
export function local(fuso: string, dia: string, hora: number, minuto = 0): string {
  const [ano, mes, d] = dia.split('-').map(Number);
  const palpite = Date.UTC(ano, mes - 1, d, hora, minuto);
  const ajustado = palpite - offsetMinutos(fuso, new Date(palpite)) * 60_000;
  return new Date(palpite - offsetMinutos(fuso, new Date(ajustado)) * 60_000).toISOString();
}

// Hora do dia — máscara, leitura e formatação.
// Mesma restrição da data de nascimento: nada de picker nativo
// (@react-native-community/datetimepicker quebraria o `expo export --platform web`),
// então o horário é campo de texto com máscara HH:MM.

/** Vai formatando HH:MM enquanto a mãe digita, sem exigir que ela digite os dois pontos. */
export function aplicarMascaraHora(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4);
  if (digitos.length <= 2) return digitos;
  return `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

/** 'HH:MM' de hoje. Serve de valor inicial dos formulários — registro quase sempre é "agora". */
export function horaAtual(agora: Date = new Date()): string {
  return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
}

/**
 * 'HH:MM' -> Date, ou null se a hora não existe (ex.: 25:70).
 *
 * Horário que ainda não chegou é lido como ontem: às 00:10 a mãe registra a mamada
 * das 23:50, e essa é a situação mais comum do app (mamada da madrugada anotada
 * depois da meia-noite). A lista da Home mostra "ontem 23:50", então o que foi
 * salvo fica visível.
 */
export function horaParaData(hhmm: string, agora: Date = new Date()): Date | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!partes) return null;

  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) return null;

  const data = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), horas, minutos, 0, 0);
  if (data.getTime() > agora.getTime()) data.setDate(data.getDate() - 1);
  return data;
}

/**
 * O mesmo "HH:MM", mas ancorado NUM DIA DADO — é o que a edição usa.
 *
 * `horaParaData` ancora em hoje, e isso está certo para registrar: a mãe anota
 * o que acabou de acontecer. Para EDITAR está errado e é destrutivo — abrir uma
 * mamada do dia 9, mexer nos minutos e salvar teleportaria o registro para hoje,
 * sem aviso e sem desfazer.
 *
 * Aqui o dia vem do próprio registro, e não há regra de "rolou para ontem":
 * quando o dia é conhecido, adivinhar seria o erro.
 *
 * Consequência assumida: esta função muda o horário DENTRO do dia do registro,
 * nunca o dia. Mover um registro de dia exigiria um campo de data no schema, e
 * isso é decisão de outro bloco.
 */
export function horaNoDia(hhmm: string, referencia: Date): Date | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!partes) return null;

  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) return null;

  return new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
    horas,
    minutos,
    0,
    0
  );
}

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** Só as horas: "14:20". */
export function formatarHora(iso: string): string {
  const data = new Date(iso);
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

/** "14:20" hoje, "ontem 23:50", "03/08 14:20" mais pra trás. */
export function formatarMomento(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso);
  const hora = formatarHora(iso);

  if (mesmoDia(data, agora)) return hora;

  const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
  if (mesmoDia(data, ontem)) return `ontem ${hora}`;

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes} ${hora}`;
}

/**
 * Chave do dia a que um instante pertence, em HORA LOCAL: 'AAAA-MM-DD'.
 *
 * Local, nunca UTC, e isso não é detalhe. No Brasil (UTC-3) a mamada das 23h50
 * de terça é 02h50 de quarta em UTC — agrupando por UTC ela apareceria sob o dia
 * seguinte, e a mãe procuraria em "Ontem" o registro que ela mesma acabou de
 * fazer. É o mesmo erro de fuso que morde o motor no D8 (BETA.md §8/R4), e sai
 * mais barato acertar aqui.
 *
 * Não usar `toISOString().slice(0, 10)` para isso: aquilo é UTC por definição.
 */
/**
 * A meia-noite LOCAL de hoje — o corte que separa "hoje" de "ontem".
 *
 * Mesma regra do `chaveDoDia`, e pela mesma razão: `toISOString()` é UTC por
 * definição, e no Brasil ele vira o dia seguinte a partir das 21h. Um contador
 * de "hoje" em UTC zeraria no meio da noite — bem na hora em que a mãe mais
 * registra, e bem quando ela menos tem paciência para desconfiar do app.
 */
export function inicioDoDiaLocal(agora: Date = new Date()): Date {
  const dia = new Date(agora);
  dia.setHours(0, 0, 0, 0);
  return dia;
}

export function chaveDoDia(iso: string): string {
  const data = new Date(iso);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Cabeçalho de grupo: "Hoje", "Ontem", "3 de agosto", "3 de agosto de 2025". */
export function rotularDia(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso);
  if (mesmoDia(data, agora)) return 'Hoje';

  const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
  if (mesmoDia(data, ontem)) return 'Ontem';

  const base = `${data.getDate()} de ${MESES[data.getMonth()]}`;
  // O ano só aparece quando não é o corrente — "3 de agosto de 2026" em agosto
  // de 2026 é ruído.
  return data.getFullYear() === agora.getFullYear() ? base : `${base} de ${data.getFullYear()}`;
}

/** "12 min", "1h", "1h 20min". Abaixo de 1 minuto vira "menos de 1 min". */
export function formatarDuracaoMin(minutos: number): string {
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`;
}

/** Minutos completos entre dois instantes ISO (ou entre um ISO e agora). */
export function minutosEntre(inicioIso: string, fim: Date | string = new Date()): number {
  const inicio = new Date(inicioIso).getTime();
  const termino = typeof fim === 'string' ? new Date(fim).getTime() : fim.getTime();
  return Math.max(0, Math.floor((termino - inicio) / 60_000));
}

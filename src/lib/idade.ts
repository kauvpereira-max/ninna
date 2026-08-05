// Cálculo e formatação de idade do bebê.
// Tom: acolhedor e nunca comparativo — a idade descreve ESTE bebê, nunca uma média.

import type { Baby } from '../types/database';

/**
 * Converte 'AAAA-MM-DD' num Date na meia-noite LOCAL.
 * `new Date('2026-01-05')` seria interpretado como UTC e podia render um dia a menos
 * dependendo do fuso — por isso montamos por componente.
 */
export function parseDataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Converte um Date pro formato 'AAAA-MM-DD' que a coluna `date` espera. */
export function paraDataISO(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function idadeEmDias(nascimento: string, hoje: Date = new Date()): number {
  const inicio = parseDataLocal(nascimento);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 86_400_000));
}

/** Meses completos vividos, contando pelo calendário (não por média de 30 dias). */
function mesesCompletos(nascimento: string, hoje: Date): number {
  const inicio = parseDataLocal(nascimento);
  let meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
  if (hoje.getDate() < inicio.getDate()) meses -= 1;
  return Math.max(0, meses);
}

function formatarDias(dias: number): string {
  if (dias <= 0) return 'recém-chegado';
  if (dias === 1) return '1 dia';
  if (dias < 14) return `${dias} dias`;

  const semanas = Math.floor(dias / 7);
  if (dias < 61) return semanas === 1 ? '1 semana' : `${semanas} semanas`;
  return '';
}

/** Ex.: "12 dias", "6 semanas", "3 meses", "1 ano e 2 meses". */
export function formatarIdade(nascimento: string, hoje: Date = new Date()): string {
  const dias = idadeEmDias(nascimento, hoje);
  const curta = formatarDias(dias);
  if (curta) return curta;

  const meses = mesesCompletos(nascimento, hoje);
  if (meses < 24) return meses === 1 ? '1 mês' : `${meses} meses`;

  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const parteAnos = anos === 1 ? '1 ano' : `${anos} anos`;
  if (resto === 0) return parteAnos;
  return `${parteAnos} e ${resto === 1 ? '1 mês' : `${resto} meses`}`;
}

/**
 * Idade corrigida — desconta as semanas de prematuridade da idade cronológica.
 * Retorna null quando não se aplica: bebê nascido no tempo, sem semanas informadas,
 * ou já passou dos 2 anos (ponto em que a correção deixa de fazer diferença prática).
 */
export function formatarIdadeCorrigida(bebe: Baby, hoje: Date = new Date()): string | null {
  if (!bebe.premature || !bebe.weeks_early) return null;

  const dias = idadeEmDias(bebe.birth_date, hoje);
  if (dias > 730) return null;

  const diasCorrigidos = Math.max(0, dias - bebe.weeks_early * 7);
  const dataEquivalente = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diasCorrigidos);
  return formatarIdade(paraDataISO(dataEquivalente), hoje);
}

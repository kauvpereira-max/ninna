// Teste da paginação por cursor — puro, sem banco e sem app.
//
//   node scripts/teste-paginacao.ts
//
// (Node 24 executa TypeScript direto, removendo os tipos. Por isso `paginacao.ts`
// não importa Supabase nem React Native: é o que permite rodar esta lógica fora
// do Expo.)
//
// O que está sendo testado é a classe de erro que NÃO aparece na tela: item que
// some entre a página 2 e a 3 quando dois registros caem no mesmo minuto. Olhar
// a lista no celular não encontra isso.

import { paginar, type CursorRegistro, type ItemOrdenavel, type Pagina } from '../src/lib/paginacao.ts';

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

/** Percorre todas as páginas e devolve a lista concatenada. */
function percorrerTudo(universo: ItemOrdenavel[], limite: number): ItemOrdenavel[] {
  const vistos: ItemOrdenavel[] = [];
  let cursor: CursorRegistro | null = null;
  let voltas = 0;

  while (true) {
    if (++voltas > 100) throw new Error('paginação não terminou — provável laço infinito');

    // Reproduz o que a camada de dados faz: cada "tabela" devolve limite+1 linhas
    // ainda atrás do cursor. Aqui, uma tabela só, o que basta pra ordem e cursor.
    const candidatos = universo
      .filter((r) => !cursor || new Date(r.ocorridoEm) <= new Date(cursor.ocorridoEm))
      .slice(0, (limite + 1) * 5);

    const pagina: Pagina<ItemOrdenavel> = paginar(candidatos, limite, cursor);
    vistos.push(...pagina.registros);

    if (!pagina.temMais) break;
    cursor = pagina.proximoCursor;
    if (!cursor) break;
  }
  return vistos;
}

// ------------------------------------------------------------------
// 1. Caminho comum: instantes distintos
// ------------------------------------------------------------------

const base = new Date('2026-08-01T12:00:00.000Z').getTime();
const distintos: ItemOrdenavel[] = Array.from({ length: 23 }, (_, i) => ({
  id: `id-${String(i).padStart(3, '0')}`,
  ocorridoEm: new Date(base - i * 3_600_000).toISOString(),
}));

const todos = percorrerTudo(distintos, 8);
conferir('percorre os 23 registros', todos.length === 23, `veio ${todos.length}`);
conferir('sem duplicata', new Set(todos.map((r) => r.id)).size === 23);
conferir(
  'ordem decrescente preservada entre páginas',
  todos.every((r, i) => i === 0 || new Date(todos[i - 1].ocorridoEm) >= new Date(r.ocorridoEm))
);

// ------------------------------------------------------------------
// 2. O caso que erra em silêncio: instante idêntico
//
// A máscara HH:MM zera os segundos, então fralda e humor salvos no mesmo minuto
// caem no MESMO timestamp. Sem desempate por id, o cursor não sabe qual dos dois
// já mostrou.
// ------------------------------------------------------------------

const mesmoInstante = new Date(base).toISOString();
const empatados: ItemOrdenavel[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: `empate-${String(i).padStart(2, '0')}`, ocorridoEm: mesmoInstante })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `depois-${i}`,
    ocorridoEm: new Date(base - (i + 1) * 60_000).toISOString(),
  })),
];

const comEmpate = percorrerTudo(empatados, 5);
conferir('percorre os 17 com 12 empatados no mesmo instante', comEmpate.length === 17, `veio ${comEmpate.length}`);
conferir('sem duplicata mesmo com empate', new Set(comEmpate.map((r) => r.id)).size === 17);
conferir(
  'nenhum registro empatado foi pulado',
  empatados.every((e) => comEmpate.some((v) => v.id === e.id))
);

// ------------------------------------------------------------------
// 3. Registro novo entrando no topo no meio da paginação
//
// É o motivo de o cursor ser por valor e não por offset. A mãe pagina o histórico
// enquanto amamenta e salva a mamada no meio.
// ------------------------------------------------------------------

const universoVivo = [...distintos];
let cursorVivo: CursorRegistro | null = null;
const vistosVivo: ItemOrdenavel[] = [];

for (let volta = 0; volta < 10; volta++) {
  const candidatos = universoVivo
    .filter((r) => !cursorVivo || new Date(r.ocorridoEm) <= new Date(cursorVivo.ocorridoEm))
    .slice(0, 45);
  const pagina: Pagina<ItemOrdenavel> = paginar(candidatos, 8, cursorVivo);
  vistosVivo.push(...pagina.registros);

  // Entre uma página e outra, chega registro novo — mais recente que todos.
  universoVivo.unshift({
    id: `novo-${volta}`,
    ocorridoEm: new Date(base + (volta + 1) * 60_000).toISOString(),
  });

  if (!pagina.temMais || !pagina.proximoCursor) break;
  cursorVivo = pagina.proximoCursor;
}

conferir(
  'registro novo no topo não duplica nem pula item',
  new Set(vistosVivo.map((r) => r.id)).size === vistosVivo.length,
  `${vistosVivo.length} itens, ${new Set(vistosVivo.map((r) => r.id)).size} únicos`
);
conferir(
  'os 23 originais continuam alcançáveis',
  distintos.every((d) => vistosVivo.some((v) => v.id === d.id))
);

// ------------------------------------------------------------------
// 4. Bordas
// ------------------------------------------------------------------

const vazio = paginar([], 8, null);
conferir('lista vazia não tem mais páginas', !vazio.temMais && vazio.proximoCursor === null);
conferir('lista vazia devolve array vazio', vazio.registros.length === 0);

const exato = paginar(distintos.slice(0, 8), 8, null);
conferir('exatamente `limite` candidatos não pede outra página', !exato.temMais);

const umAMais = paginar(distintos.slice(0, 9), 8, null);
conferir('um candidato além do limite pede outra página', umAMais.temMais);
conferir('cursor aponta pro último item devolvido', umAMais.proximoCursor?.id === umAMais.registros[7].id);

console.log(`\n${falhas === 0 ? 'Paginação correta.' : `${falhas} verificação(ões) falharam.`}`);
if (falhas > 0) process.exitCode = 1;

// Ordenação e paginação por cursor da lista unificada de registros.
//
// Mora separado de `registros.ts` de propósito: aqui não entra Supabase, nem
// React Native, nem nada de I/O. É aritmética sobre um array — o que a torna
// testável num `node scripts/teste-paginacao.ts`, sem banco e sem app.
//
// Essa separação não é estética. Cursor com desempate é a classe de lógica que
// erra em silêncio: a lista parece certa, e um item some entre a página 2 e a 3
// só quando dois registros caem no mesmo minuto. Não dá pra achar isso olhando
// a tela.

/** Mínimo que um item precisa ter pra entrar na ordenação. */
export type ItemOrdenavel = { id: string; ocorridoEm: string };

/**
 * Posição na lista unificada, para "carregar mais".
 *
 * É cursor por VALOR, não offset. Com offset, um registro novo entrando no topo
 * enquanto a mãe pagina empurra tudo uma casa pra baixo, e a página seguinte
 * repete o último item da anterior — ou pula um. Registro entrando no topo é o
 * caso normal deste app, não a exceção: ela pagina o histórico enquanto amamenta
 * e salva a mamada no meio.
 */
export type CursorRegistro = { ocorridoEm: string; id: string };

export type Pagina<T> = {
  registros: T[];
  /** Passar de volta em `cursor` pra pegar a página seguinte. Null quando acabou. */
  proximoCursor: CursorRegistro | null;
  temMais: boolean;
};

/**
 * Ordem total: mais recente primeiro, `id` desc como desempate.
 *
 * Precisa ser TOTAL — nunca devolver 0 para linhas diferentes. É sobre ela que o
 * cursor caminha, e empate sem desempate faz a paginação repetir ou pular item.
 *
 * O desempate não é preciosismo: dois registros colidem no mesmo instante com
 * frequência aqui, porque a mãe informa a hora numa máscara HH:MM e os segundos
 * saem sempre zerados. Fralda e humor salvos no mesmo minuto são o caso comum.
 */
export function compararRegistros(a: ItemOrdenavel, b: ItemOrdenavel): number {
  const ta = new Date(a.ocorridoEm).getTime();
  const tb = new Date(b.ocorridoEm).getTime();
  if (ta !== tb) return tb - ta;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

/** Está estritamente depois do cursor na ordem acima? */
export function depoisDoCursor(item: ItemOrdenavel, cursor: CursorRegistro): boolean {
  const ti = new Date(item.ocorridoEm).getTime();
  const tc = new Date(cursor.ocorridoEm).getTime();
  if (ti !== tc) return ti < tc;
  return item.id < cursor.id;
}

/**
 * A MESMA condição, escrita para o PostgREST.
 *
 * Ela mora aqui, colada na versão em JavaScript, porque o bug que importa não é
 * nenhuma das duas estar errada — é elas discordarem. Separadas em arquivos
 * diferentes, a correção que só uma recebesse produziria uma lista que repete ou
 * pula item entre a página 2 e a 3, e isso não se vê olhando a tela.
 *
 * Antes do bloco 3 esta função não existia: o banco filtrava por `lte` no
 * instante e o desempate por id acontecia no cliente, DEPOIS do corte por
 * `limite + 1`. Com cinco tabelas o volume escondia; com uma, os empatados no
 * instante do cursor ocupam o teto e a página encolhe — ou termina cedo, dizendo
 * que acabou. E empate no instante é o caso comum aqui: a máscara HH:MM zera os
 * segundos de todo registro.
 */
export function filtroDoCursor(cursor: CursorRegistro): string {
  return (
    `ocorrido_em.lt.${cursor.ocorridoEm},` +
    `and(ocorrido_em.eq.${cursor.ocorridoEm},id.lt.${cursor.id})`
  );
}

/**
 * Recorta uma página dos candidatos vindos das 5 tabelas.
 *
 * `candidatos` deve ter sido buscado com `limite + 1` linhas POR TABELA. A união
 * dessas fatias contém, com certeza, as `limite` linhas mais recentes da união
 * inteira — é o argumento do merge de k listas ordenadas: a i-ésima linha do
 * resultado global não pode estar além da i-ésima posição de nenhuma tabela.
 *
 * Esse `+1` também responde `temMais` sem consulta extra. Se sobrou candidato
 * além do limite, há mais. Se não sobrou, nenhuma tabela chegou a ser truncada
 * no teto — logo todas se esgotaram e a janela acabou.
 */
export function paginar<T extends ItemOrdenavel>(
  candidatos: T[],
  limite: number,
  cursor: CursorRegistro | null
): Pagina<T> {
  // A consulta usa `lte` no instante do cursor, então as linhas empatadas voltam
  // junto — inclusive a própria linha do cursor. O desempate por id é aqui.
  const elegiveis = cursor ? candidatos.filter((r) => depoisDoCursor(r, cursor)) : candidatos;

  elegiveis.sort(compararRegistros);

  const registros = elegiveis.slice(0, limite);
  const temMais = elegiveis.length > limite;
  const ultimo = registros[registros.length - 1];

  return {
    registros,
    proximoCursor: temMais && ultimo ? { ocorridoEm: ultimo.ocorridoEm, id: ultimo.id } : null,
    temMais,
  };
}

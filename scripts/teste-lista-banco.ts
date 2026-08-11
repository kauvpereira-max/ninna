// A lista paginada rodando contra o PostgREST, não contra um array em memória.
//
//   node scripts/teste-lista-banco.ts
//
// ------------------------------------------------------------------
// POR QUE ESTE TESTE EXISTE, E POR QUE ELE NÃO PODIA SER PURO
//
// O `teste-paginacao.ts` prova o `paginar()` — a aritmética do cursor sobre um
// array. Ele é rigoroso e falha quando o código quebra. Mas depois do bloco 3
// metade da paginação deixou de morar nele: o corte e o desempate desceram para
// o banco, como uma condição `or(...)` que o PostgREST interpreta.
//
// Node não tem PostgREST. Um teste puro do `paginar()` continua verde com a
// condição SQL escrita errada — é a regra 2b do CLAUDE.md, a mesma que deixou o
// preflight de CORS passar por baixo do `teste-assistente`.
//
// O que pode dar errado aqui e em nenhum outro lugar:
//
//   · o `+` do offset (`+00:00`) chegar cru na query string e virar espaço;
//   · o `and(...)` aninhado do PostgREST não fazer o que se espera;
//   · a ordem do banco (`ocorrido_em desc, id desc`) discordar do
//     `compararRegistros`, e aí a página 2 repetir ou pular item.
//
// ------------------------------------------------------------------
// O QUE ELE PROVA
//
// Paginando o bebê semeado do começo ao fim: nenhum registro repetido, nenhum
// perdido, e o conjunto igual ao que uma leitura sem cursor devolve. É a
// propriedade que a mãe percebe como "sumiu uma mamada do histórico" — e que
// não se vê olhando a tela, porque a lista continua parecendo certa.
//
// Usa a anon key e a conta da mãe, nunca service_role. As únicas linhas que ele
// escreve são as do empate, no bebê dedicado, apagadas no `finally`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { compararRegistros, filtroDoCursor, type CursorRegistro } from '../src/lib/paginacao.ts';
import { NOME_BEBE_TESTE } from './massa-semeada.mjs';

function lerEnv() {
  const texto = readFileSync(join(import.meta.dirname, '..', '.env'), 'utf8');
  const env: Record<string, string> = {};
  for (const linha of texto.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = { ...lerEnv(), ...process.env } as Record<string, string>;
for (const chave of [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SEMEAR_EMAIL',
  'SEMEAR_SENHA',
]) {
  if (!env[chave]) {
    console.error(`Falta ${chave} no .env.`);
    process.exit(1);
  }
}

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

const cliente = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: erroLogin } = await cliente.auth.signInWithPassword({
  email: env.SEMEAR_EMAIL,
  password: env.SEMEAR_SENHA,
});
if (erroLogin) {
  console.error(`Não consegui entrar como ${env.SEMEAR_EMAIL}: ${erroLogin.message}`);
  process.exit(1);
}

const { data: bebe, error: erroBebe } = await cliente
  .from('babies')
  .select('id, name')
  .eq('name', NOME_BEBE_TESTE)
  .maybeSingle();
if (erroBebe || !bebe) {
  console.error(`Bebê "${NOME_BEBE_TESTE}" não encontrado. Rode o semeador primeiro.`);
  process.exit(1);
}
const babyId = bebe.id as string;

console.log(`conta: ${env.SEMEAR_EMAIL}`);
console.log(`bebê:  ${bebe.name} (${babyId})\n`);

type Item = { id: string; ocorridoEm: string; tipo: string };

const ler = (linhas: Record<string, unknown>[]): Item[] =>
  linhas.map((l) => ({
    id: l.id as string,
    ocorridoEm: l.ocorrido_em as string,
    tipo: l.tipo as string,
  }));

// ------------------------------------------------------------------
// O EMPATE — criado aqui, porque a massa semeada não tem
// ------------------------------------------------------------------
//
// O gerador sorteia horas fracionárias, então cada registro semeado cai num
// instante distinto. E o empate é justamente a borda que a condição do cursor
// existe para tratar: sem estas linhas, tudo abaixo passaria também com a
// condição antiga, e o teste estaria defendendo o que não exercita.
//
// Na vida real o empate é o caso COMUM, não a exceção: a mãe informa a hora numa
// máscara HH:MM, os segundos saem zerados, e fralda e humor salvos no mesmo
// minuto colidem. Quatro linhas no mesmo instante reproduzem isso — o suficiente
// para que um limite de 1, 2 ou 3 caia DENTRO do empate.
//
// Criadas no bebê DEDICADO e apagadas no `finally`.

const INSTANTE_EMPATADO = new Date(Date.now() - 90 * 60_000).toISOString();
const QUANTOS_EMPATADOS = 4;
const MARCA_EMPATE = 'EMPATE-TESTE-LISTA';

const empatados = await cliente
  .from('registros')
  .insert(
    Array.from({ length: QUANTOS_EMPATADOS }, () => ({
      baby_id: babyId,
      tipo: 'fralda',
      ocorrido_em: INSTANTE_EMPATADO,
      dados: { content: 'pee' },
      notes: MARCA_EMPATE,
    }))
  )
  .select('id');

if (empatados.error) {
  console.error(`Não consegui criar as linhas empatadas: ${empatados.error.message}`);
  process.exit(1);
}

const idsEmpatados = empatados.data.map((l) => l.id as string);
console.log(`empate criado: ${idsEmpatados.length} registros no mesmo instante`);

/**
 * Uma página, com a MESMA consulta que o `listarRegistros` monta.
 *
 * O que precisa ser idêntico é o filtro do cursor e a ordenação — e o filtro vem
 * de `filtroDoCursor`, importado do mesmo lugar que o app importa. É isso que
 * impede este teste de provar uma condição que só ele usa.
 */
async function pagina(limite: number, cursor: CursorRegistro | null, tipos: string[] | null) {
  let q = cliente.from('registros').select('id, tipo, ocorrido_em').eq('baby_id', babyId);
  if (tipos) q = q.in('tipo', tipos);
  if (cursor) q = q.or(filtroDoCursor(cursor));

  const { data, error } = await q
    .order('ocorrido_em', { ascending: false })
    .order('id', { ascending: false })
    .limit(limite + 1);

  if (error) throw new Error(`falha ao paginar: ${error.message}`);

  const candidatos = ler(data ?? []);
  const registros = candidatos.slice(0, limite);
  const temMais = candidatos.length > limite;
  const ultimo = registros[registros.length - 1];

  return {
    registros,
    temMais,
    proximoCursor: temMais && ultimo ? { ocorridoEm: ultimo.ocorridoEm, id: ultimo.id } : null,
  };
}

let referencia: Item[] = [];

/** Percorre a lista inteira, página a página, como a mãe tocando "carregar mais". */
async function percorrer(limite: number, tipos: string[] | null = null) {
  const vistos: Item[] = [];
  let cursor: CursorRegistro | null = null;
  let paginas = 0;

  for (;;) {
    const p = await pagina(limite, cursor, tipos);
    vistos.push(...p.registros);
    paginas++;
    if (!p.temMais || !p.proximoCursor) break;
    cursor = p.proximoCursor;
    // Rede contra laço infinito: cursor que não anda repetiria para sempre, e o
    // teste travaria em vez de reprovar.
    if (paginas > Math.ceil(referencia.length / limite) + 5) {
      throw new Error('o cursor não está avançando — paginação em laço');
    }
  }
  return { vistos, paginas };
}

async function rodar() {
  const { data: tudo, error: erroTudo } = await cliente
    .from('registros')
    .select('id, tipo, ocorrido_em')
    .eq('baby_id', babyId)
    .order('ocorrido_em', { ascending: false })
    .order('id', { ascending: false });

  if (erroTudo || !tudo) throw new Error(`falha na leitura de referência: ${erroTudo?.message}`);

  referencia = ler(tudo);
  console.log(`registros do bebê: ${referencia.length}\n`);

  if (referencia.length < 20) {
    throw new Error(
      `massa pequena demais (${referencia.length}) para provar paginação — ` +
        `rode: node scripts/semear-registros.mjs`
    );
  }

  /**
   * A premissa das asserções de borda. Sem ela, os limites pequenos abaixo
   * paginariam uma lista sem empate nenhum e não provariam o desempate.
   *
   * A conta é por INSTANTE, não por string — e isso não é preciosismo, foi o que
   * esta asserção pegou na primeira execução. O `timestamptz` que sai daqui como
   * `...T20:30:00.000Z` volta do PostgREST como `...T20:30:00+00:00`: mesmo
   * instante, textos diferentes. Comparar a string dava zero empate num banco que
   * tinha quatro.
   */
  const instante = (iso: string) => new Date(iso).getTime();
  const porInstante = new Map<number, number>();
  for (const r of referencia) {
    const t = instante(r.ocorridoEm);
    porInstante.set(t, (porInstante.get(t) ?? 0) + 1);
  }
  const noEmpate = porInstante.get(instante(INSTANTE_EMPATADO)) ?? 0;

  conferir(
    'o empate chegou ao banco — a borda existe para ser exercitada',
    noEmpate === QUANTOS_EMPATADOS,
    `${noEmpate} no mesmo instante, maior empate da lista: ${Math.max(...porInstante.values())}`
  );

  console.log('\n— percorrendo a lista inteira, de 8 em 8 —\n');

  const { vistos, paginas } = await percorrer(8);

  conferir(
    'nenhum registro repetido entre as páginas',
    new Set(vistos.map((r) => r.id)).size === vistos.length,
    `${vistos.length} devolvidos, ${new Set(vistos.map((r) => r.id)).size} distintos`
  );

  conferir(
    'nenhum registro perdido — o total bate com a leitura sem cursor',
    vistos.length === referencia.length,
    `${vistos.length} paginando, ${referencia.length} de uma vez`
  );

  const faltando = referencia.filter((r) => !vistos.some((v) => v.id === r.id));
  conferir(
    'e são exatamente os mesmos registros, não só a mesma quantidade',
    faltando.length === 0,
    faltando.length > 0
      ? `sumiram ${faltando.length}: ${faltando
          .slice(0, 3)
          .map((f) => `${f.tipo} ${f.ocorridoEm}`)
          .join(', ')}`
      : `${paginas} páginas`
  );

  conferir(
    'a ordem que o banco devolve é a mesma do compararRegistros',
    vistos.every((r, i) => i === 0 || compararRegistros(vistos[i - 1], r) < 0),
    'se discordarem, o cursor caminha numa ordem e o cliente noutra'
  );

  console.log('\n— o caso que quebrava: a página termina no meio do empate —\n');

  // Limites 1, 2 e 3 são menores que o empate de 4, então a fronteira da página
  // cai DENTRO dele — que é exatamente onde o `lte` sem desempate repetia ou
  // pulava. Os maiores continuam ali como controle de que nada mais quebrou.
  for (const limite of [1, 2, 3, 5, 13]) {
    const r = await percorrer(limite);
    conferir(
      `de ${limite} em ${limite}: ${r.paginas} páginas, nada repetido nem perdido`,
      new Set(r.vistos.map((x) => x.id)).size === referencia.length &&
        r.vistos.length === referencia.length,
      `${r.vistos.length} de ${referencia.length}`
    );
  }

  console.log('\n— e o filtro por tipo pagina sozinho, sem vazar —\n');

  const soSono = await percorrer(3, ['sono']);
  const sonoNaReferencia = referencia.filter((r) => r.tipo === 'sono');

  conferir(
    'paginando só sono, vem todo o sono e nada além dele',
    soSono.vistos.length === sonoNaReferencia.length &&
      soSono.vistos.every((r) => r.tipo === 'sono'),
    `${soSono.vistos.length} de ${sonoNaReferencia.length} sonos, em ${soSono.paginas} páginas`
  );

  const mamadas = await percorrer(4, ['amamentar', 'mamadeira']);
  const mamadasNaReferencia = referencia.filter(
    (r) => r.tipo === 'amamentar' || r.tipo === 'mamadeira'
  );
  conferir(
    'e pedir dois tipos traz os dois, sem trazer um terceiro',
    mamadas.vistos.every((r) => r.tipo === 'amamentar' || r.tipo === 'mamadeira') &&
      mamadas.vistos.length === mamadasNaReferencia.length,
    `${mamadas.vistos.length} mamadas em ${mamadas.paginas} páginas`
  );

  console.log('\n— a prova de que este teste sabe reprovar —\n');

  /**
   * A condição ANTIGA, rodada de propósito: `lte` no instante, sem desempate por
   * id. Ela é o que estava no ar antes do bloco 3, e o que as asserções acima
   * afirmam ter sido corrigido.
   *
   * Sem este controle, todas elas passariam também num banco onde o cursor não
   * filtra nada — a primeira página se repetiria e o laço bateria na rede em vez
   * de na asserção.
   *
   * A página começa 2 antes do empate, então a fronteira cai dentro dele: o
   * `lte` devolve os empatados de novo, e não só a linha do cursor.
   */
  const ateOEmpate =
    referencia.findIndex((r) => new Date(r.ocorridoEm).getTime() === new Date(INSTANTE_EMPATADO).getTime()) + 2;
  const primeira = await pagina(ateOEmpate, null, null);
  const cursorDaPrimeira = primeira.proximoCursor!;

  const { data: comLte } = await cliente
    .from('registros')
    .select('id')
    .eq('baby_id', babyId)
    .lte('ocorrido_em', cursorDaPrimeira.ocorridoEm)
    .order('ocorrido_em', { ascending: false })
    .order('id', { ascending: false })
    .limit(ateOEmpate + 1);

  const repetidos = (comLte ?? []).filter((l) =>
    primeira.registros.some((r) => r.id === (l.id as string))
  );

  conferir(
    'a condição antiga (lte, sem desempate) devolveria registro já mostrado',
    repetidos.length > 1,
    `${repetidos.length} repetido(s) — mais que a própria linha do cursor, ` +
      `que é o que o desempate por id elimina`
  );
}

try {
  await rodar();
} catch (erro) {
  falhas++;
  console.error(`\nFALHA: ${erro instanceof Error ? erro.message : erro}`);
} finally {
  const { error } = await cliente.from('registros').delete().in('id', idsEmpatados);
  console.log(
    error
      ? `\n⚠️  NÃO consegui apagar as ${idsEmpatados.length} linhas de empate: ${error.message}\n` +
          `   Apague à mão: delete from registros where notes = '${MARCA_EMPATE}';`
      : '\nlinhas de empate apagadas.'
  );
}

console.log(
  falhas === 0
    ? '\nLista paginada correta contra o banco: nada repetido, nada perdido.\n'
    : `\n${falhas} falha(s).\n`
);
process.exit(falhas === 0 ? 0 : 1);

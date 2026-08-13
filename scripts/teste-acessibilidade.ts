// Varredura de acessibilidade: todo tocável declara o papel dele.
//
//   node scripts/teste-acessibilidade.ts
//
// ------------------------------------------------------------------
// POR QUE ISTO EXISTE
//
// Em 13/08/2026, ao conferir o modal de Sono no navegador, uma busca por
// `[role="button"]` não encontrou o botão "Começar sono". Não era o seletor: o
// `Button` compartilhado nunca declarou `accessibilityRole`.
//
// Ou seja, **o CTA de todo formulário do app era, para um leitor de tela, texto
// dentro de uma caixa** — o de salvar registro, o de entrar, o de criar conta.
// Nada acusava: nem o `tsc`, nem os testes, nem o `expo export`. Só um DOM
// aberto e uma busca que não achou o que devia.
//
// ------------------------------------------------------------------
// E POR QUE ELE SE PROVA ANTES DE VARRER — regra 2 do CLAUDE.md
//
// A primeira versão desta varredura usava `/<Pressable([\s\S]*?)>/` e acusou
// **25 faltas**. Eram 2. O `>` de `onPress={() => x}` fechava a captura antes
// dos atributos seguintes, e o `accessibilityRole` que vinha depois nunca era
// visto.
//
// Uma varredura que erra para MAIS é tão inútil quanto uma que erra para menos:
// eu teria editado 23 arquivos que já estavam certos, e o ruído esconderia os 2
// que importavam. Por isso ela roda dois casos conhecidos antes de olhar o
// repositório — um que TEM que achar o papel, outro que NÃO pode inventá-lo.

import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const TOCAVEIS = ['Pressable', 'TouchableOpacity', 'TouchableHighlight'];

/**
 * A tag de ABERTURA de cada tocável, respeitando chaves.
 *
 * Contar `{` e `}` é o que separa o `>` que fecha a tag do `>` que é metade de
 * uma seta. Sem isso, todo tocável com `onPress={() => …}` é lido pela metade.
 */
function tagsDeAbertura(fonte: string, nome: string): { attrs: string; linha: number }[] {
  const achados: { attrs: string; linha: number }[] = [];
  const alvo = '<' + nome;
  let i = -1;

  while ((i = fonte.indexOf(alvo, i + 1)) !== -1) {
    // `<PressableAlgo` não é `<Pressable`.
    if (/[A-Za-z0-9_]/.test(fonte[i + alvo.length] ?? '')) continue;

    let profundidade = 0;
    let j = i + alvo.length;
    for (; j < fonte.length; j++) {
      const c = fonte[j];
      if (c === '{') profundidade++;
      else if (c === '}') profundidade--;
      else if (c === '>' && profundidade === 0) break;
    }
    achados.push({
      attrs: fonte.slice(i + alvo.length, j),
      linha: fonte.slice(0, i).split('\n').length,
    });
  }
  return achados;
}

let falhas = 0;
function checar(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

console.log('\n— a prova do extrator, antes de varrer qualquer coisa —\n');

const DEVE_ACHAR = `<Pressable
  onPress={() => onChange(o.value)}
  accessibilityRole="button"
  style={estilos.pilula}
>`;
const DEVE_NAO_ACHAR = `<Pressable style={[styles.base]} disabled={bloqueado} {...rest}>`;

const achado = tagsDeAbertura(DEVE_ACHAR, 'Pressable')[0];
const naoAchado = tagsDeAbertura(DEVE_NAO_ACHAR, 'Pressable')[0];

checar(
  'acha o papel mesmo depois de uma arrow function',
  Boolean(achado && /accessibilityRole/.test(achado.attrs)),
  'é o caso que a primeira versão errava'
);
checar(
  'e não inventa papel onde não há',
  Boolean(naoAchado && !/accessibilityRole/.test(naoAchado.attrs)),
  'sem isto, uma varredura que aprova tudo passaria'
);

if (falhas > 0) {
  console.log('\nExtrator reprovado — varredura abortada, porque ela não valeria nada.\n');
  process.exit(1);
}

console.log('\n— todo tocável do app declara o papel dele —\n');

const arquivos: string[] = [];
(function anda(dir: string) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (!/node_modules|\.expo|dist|\.git/.test(p)) anda(p);
    } else if (entrada.name.endsWith('.tsx')) {
      arquivos.push(p);
    }
  }
})('.');

const semPapel: string[] = [];
let comPapel = 0;

for (const arquivo of arquivos) {
  const fonte = readFileSync(arquivo, 'utf8');
  for (const nome of TOCAVEIS) {
    for (const tag of tagsDeAbertura(fonte, nome)) {
      if (/accessibilityRole/.test(tag.attrs)) comPapel++;
      else semPapel.push(`${arquivo.split(sep).join('/')}:${tag.linha}`);
    }
  }
}

checar(
  `os ${comPapel + semPapel.length} tocáveis declaram papel`,
  semPapel.length === 0,
  semPapel.length ? `faltam em: ${semPapel.join(', ')}` : `${comPapel} conferidos`
);

// O CONTROLE: varredura que não acha nada passaria vazia — é a regra 2. Se um
// dia os tocáveis mudarem de nome (um `<Botao>` próprio, por exemplo), este caso
// fica vermelho e alguém vem atualizar a lista, em vez de o teste seguir verde
// varrendo o nada.
checar(
  'e a varredura encontrou tocáveis para conferir',
  comPapel + semPapel.length > 20,
  `achou ${comPapel + semPapel.length} — se cair muito, os tocáveis mudaram de nome`
);

console.log(
  falhas === 0
    ? '\nAcessibilidade: todo tocável se anuncia como tocável.\n'
    : `\n${falhas} falha(s).\n`
);
process.exit(falhas === 0 ? 0 : 1);

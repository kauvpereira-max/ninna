# Proposta — os 14 tipos restantes

> ## ✅ Executada em 11–12/08/2026 — 13 tipos, não 14
>
> Os quatro grupos estão em produção: eventos simples, alimentação, crescimento
> (só registrar) e saúde. **19 tipos no app.**
>
> **E o título deste documento está errado.** Ele diz 14 porque copiou a frase do
> `PRODUTO.md` §3.4 — que dizia 14 e listava 13 numa tabela de quatro grupos. O
> que faltava era **Habilidade**, e eu herdei a tabela sem conferir a soma.
>
> Nenhum teste pegaria isso: os treze estão certos, e "falta um" não é afirmação
> sobre código. Foi a pergunta *"onde o bloco 3 fecha?"* que achou.
>
> Habilidade não entrou por engano e ficou de fora por razão — ela é decisão de
> outra natureza, e está no fim do §3.4 do `PRODUTO.md`.

Escrita em 11/08/2026, depois do bloco 2 (schema) e da migração para `registros`.
Fonte de escopo: `PRODUTO.md` §3.4 e §7.

---

## A resposta curta: o schema pronto quase não mudou a ordem

A ordem sugerida no §3.4 — eventos simples, alimentação, crescimento, saúde por
último — **continua certa, e pelas mesmas razões.** Simples primeiro porque são
baratos e o barato é o que revela o que falta; saúde por último porque erro é
dano.

O que o schema pronto mudou não foi a ordem. Foi **o que existe dentro de cada
grupo** — e, olhando o código em vez do plano, apareceram cinco pré-requisitos
que o §3.4 não lista. Quatro deles não são de nenhum grupo: são do primeiro tipo
novo, qualquer que ele seja.

Uma mudança de escopo eu proponho, e é dentro do crescimento (§ "Crescimento",
abaixo): separar **registrar** de **desenhar a curva**. São dois trabalhos com
custos e riscos muito diferentes, e o §3.4 os trata como um.

---

## ✅ Os cinco pré-requisitos — feitos em 11/08/2026

As cinco decisões foram tomadas e os cinco itens estão no código. O que mudou em
relação ao que está escrito abaixo:

| # | O que ficou |
|---|---|
| 1 | O gerador emite `supabase/restricoes/registros.sql` — idempotente, `drop constraint if exists` + `add constraint`. A `005` está congelada como história, e o teste passou a defender as duas com naturezas opostas |
| 2 | `CATEGORIA_POR_TIPO` virou literal exaustivo. Tipo novo sem cor e sem ícone **não compila** |
| 3 | O gerador **falha alto** na colisão de coluna gerada, com os dois tipos nomeados na mensagem. Provado nos dois sentidos: reprova faixas diferentes, e não reprova compartilhamento legítimo |
| 4 | `decimais` no campo numérico, com máscara, leitura e escrita no schema. `paraAColuna` arredonda — **360 pesos entre 0,5 e 30 kg** erram na multiplicação crua |
| 5 | `ATALHOS_DA_HOME` separado de `TODOS_OS_TIPOS`. Seleção fixa, como decidido: mãe cansada precisa que o botão esteja onde estava ontem |

A tela "Mais tipos" ainda não existe — ela nasce quando houver tipo fora dos
atalhos, para não nascer vazia.

O texto abaixo é o diagnóstico original, mantido porque é ele que explica **por
que** cada item existe.

---

## Os cinco pré-requisitos, e por que eles vêm antes do tipo nº 1

Nenhum é grande. Todos são do tipo que, se ficarem para depois, aparecem no
sétimo tipo com sete correções em vez de uma.

### 1. ⚠️ A `005` não pode ser regerada, e é ela que declara os tipos válidos

Este é o bloqueador de verdade, e ele não está no plano.

`005_registros.sql` é **gerada** do `registroSchema.ts` e **já foi aplicada**.
Somar um tipo muda o `check (tipo in (…))` e acrescenta os `check` de vocabulário
dele. Só que:

- o `teste-registros-sql.ts` compara o arquivo com o gerador, então o teste
  reprova assim que o `SCHEMAS` ganhar uma entrada;
- e regerar o arquivo não ajuda: ele é um `create table` de uma tabela que já
  existe. Não há caminho do arquivo novo até o banco.

**O gerador precisa passar a emitir alteração, não só criação.** A forma que eu
recomendo, porque mantém a propriedade que o bloco 3 comprou:

> Um arquivo gerado e **idempotente** com todas as restrições — cada uma como
> `alter table registros drop constraint if exists X;` seguido de
> `alter table registros add constraint X check (…);`.

Roda quantas vezes for preciso, sempre leva o banco ao estado que o `SCHEMAS`
descreve, e o teste continua comparando arquivo com gerador. A `005` fica
congelada como história: ela criou a tabela, e isso não muda mais.

O custo é aceitar que `migrations/` deixa de contar a história inteira das
restrições — quem quiser saber o vocabulário de hoje lê o arquivo gerado, não a
sequência. Em troca, somar um tipo volta a ser **uma** edição.

**Meio dia. É o primeiro item, e nada começa antes dele.**

### 2. `CATEGORIA_POR_TIPO` parece uma trava e não é

```ts
export const CATEGORIA_POR_TIPO = Object.fromEntries(
  CATEGORIAS.map((c) => [c.key, c])
) as Record<TipoRegistro, Categoria>;
```

O `as` é um cast. Somar `'banho'` ao `TipoRegistro` sem somar a entrada em
`CATEGORIAS` **compila**, e quebra na tela de detalhe: `visual.label` sobre
`undefined`. Tela vermelha, e no caminho em que a mãe abre um registro.

É exatamente o modo de falha que o bloco 2 existiu para eliminar — "faltar uma
não quebrava o build, quebrava a tela, mais tarde, para a mãe". Com 14 tipos
entrando, ele vai ser exercitado 14 vezes.

Trocar o cast por uma construção exaustiva (um `Record` literal, ou uma
verificação de cobertura no teste do schema). **Uma hora.**

### 3. O gerador resolve colisão de coluna gerada em silêncio

`amount_ml` e `duration_seconds` são colunas **geradas e compartilhadas**: dois
tipos que declararem a mesma chave usam a mesma coluna. O gerador guarda isso
num `Map` cuja chave é a DDL da coluna — e a DDL não contém a faixa. Dois tipos
com a mesma chave e faixas diferentes: **o último a ser iterado vence, sem
aviso.**

Hoje não morde, porque só a mamadeira declara `amount_ml`. Morde no grupo de
alimentação, onde Hidratação e Extração querem ml com faixas diferentes da
mamadeira.

O conserto é o gerador **falhar alto** quando duas faixas discordam para a mesma
coluna, e a decisão de produto que vem junto: ou a faixa é a união das duas
(perde-se rigor), ou as chaves são distintas (`amount_ml` e `volume_ml`), ou a
faixa vira por tipo (`check (tipo <> 'hidratacao' or …)`), que é mais SQL e mais
correto. **Meio dia, no começo do grupo de alimentação.**

### 4. Não existe campo decimal, e o crescimento precisa de um

O campo numérico da tela faz `texto.replace(/\D/g, '')` — **todo caractere não
dígito é descartado**, inclusive a vírgula. Hoje isso está certo: minutos e ml
são inteiros.

Peso é 4,350 kg. Altura é 52,5 cm. Perímetro cefálico é 38,2 cm.

Há duas saídas e elas não empatam:

| Saída | Custo |
|---|---|
| Perguntar em grama e milímetro | Zero de código. "Altura em milímetros: 525" é copy que nenhuma mãe escreve |
| `entrada: 'decimal'`, com casas declaradas no schema | ~1 dia, e o `escala` que já existe faz a conversão para inteiro no banco |

A segunda. O `escala` do schema foi desenhado para isto (minutos → segundos), e
`52,5` com `escala: 10` chega ao banco como `525` — inteiro, checável, somável.
O que falta é a máscara aceitar um separador e a validação entender casas.

**É o único campo de tipo novo em todo o bloco.** Nenhum dos outros 11 tipos
precisa dele.

### 5. A Home e a Rotina iteram `CATEGORIAS` — as duas escalam para 20

A Home desenha um atalho por categoria; a Rotina desenha um chip de filtro por
categoria, mais o "Tudo". Com 20 tipos isso vira um grid de 20 e uma fila de 21
chips.

Não é bloqueador do primeiro tipo, mas é bloqueador do décimo, e a decisão é de
produto, não de código: **quais tipos merecem atalho na Home?** Registrar é ação
de segundos, e uma Home com 20 atalhos deixa de ser rápida para todos eles.

O que eu sugiro decidir junto com o grupo de eventos simples: a Home mostra os 6
mais usados **daquele bebê** (o dado já existe) ou uma seleção fixa, e o resto
entra por uma tela "Mais tipos". O filtro da Rotina vira lista rolável ou
agrupada por categoria.

---

## A ordem, e o que cada grupo pede

### 1º · Eventos simples — Banho, Passeio, Leitura, Atividade

**Além de uma entrada no `SCHEMAS`: nada de novo na tela, e nada no motor.**

Os quatro cabem inteiros nos campos que já existem: hora, escolha, número,
texto. É por isso que eles vêm primeiro — são o carregador mais barato dos
pré-requisitos 1, 2 e 5. Se algum deles der trabalho, o problema é do
pré-requisito, não do tipo.

**Uma decisão de desenho que eles forçam, e que ainda não foi tomada:**

> Duração é `dados.duration_seconds` ou é `terminou_em`?

O comentário da `005` promete `terminou_em` — *"não é o sono puxando a colcha:
Extração, Atividade, Passeio e Leitura também têm começo e fim"*. Mas
`linhaParaBanco` **nunca escreve `terminou_em`**; só o `iniciarSono` escreve. Os
dois caminhos existem e fazem coisas diferentes:

- `duration_seconds` no `dados` é o que a amamentação já faz: a mãe informa
  quanto durou, de uma vez. Um formulário, um salvamento;
- `terminou_em` é o que o sono faz: começa aberto e a mãe encerra depois. Dois
  toques, separados no tempo, e a Home precisa mostrar "em andamento".

**Banho e Leitura são do primeiro tipo** — ninguém abre um cronômetro para dar
banho. **Passeio e Atividade podem ser dos dois**, e aí a pergunta é se vale ter
um segundo tipo em andamento na Home ao lado do sono.

Recomendo começar os quatro como duração informada (`duration_seconds`), que é
zero código novo, e só promover Passeio/Atividade para "em andamento" se a mãe
pedir. O caminho contrário — nascer em andamento e simplificar depois — deixa
registro aberto órfão no banco.

**Estimativa: 1 dia cada depois dos pré-requisitos, ~1 semana com eles.**

### 2º · Alimentação — Comida, Hidratação, Extração

**Além do `SCHEMAS`: o pré-requisito 3 (colisão de coluna), e a única armadilha
de motor do bloco inteiro.**

Nada de novo na tela: vocabulário fechado é `escolha`, quantidade é `numero`.

⚠️ **Extração não é uma mamada do bebê.** Ela é leite que saiu da mãe, e pode
nunca ter sido oferecido — ou ter sido oferecido horas depois, e aí o registro
que conta é a mamadeira. Se ela entrar na conta de "intervalo entre mamadas", o
motor passa a descrever uma rotina que não existe, com a cara de certeza de
sempre. É o risco R3, por uma porta nova.

A defesa hoje é estrutural e já funciona: `listarParaPadroes` filtra
`in ('amamentar','mamadeira','sono')`, então um tipo novo fica de fora por
padrão. **O lugar onde o erro entraria é o assistente**, no `TIPOS_DO_ALVO`: pôr
`extracao` dentro do alvo `mamada` é uma linha, e ninguém notaria. Vale uma
asserção no `teste-consultas.ts` dizendo que o alvo `mamada` são exatamente
`amamentar` e `mamadeira`.

Comida e Hidratação **podem** entrar no motor um dia (intervalo entre refeições),
e isso é bloco próprio — o motor tem três métricas testadas com mutações, e somar
a quarta é trabalho de motor, não de tipo.

**Estimativa: ~1 semana, incluindo o pré-requisito 3.**

### 3º · Crescimento — Peso, Altura, Circunferência

**Além do `SCHEMAS`: o pré-requisito 4 (campo decimal). E aqui eu proponho
partir o escopo em dois.**

O §3.4 trata "crescimento" como um item. São dois, com custo e risco muito
diferentes:

| | O que é | Custo | Risco |
|---|---|---|---|
| **3a · Registrar** | Três tipos, campo decimal, e a frase de sempre — *"ganhou 340 g desde a última pesagem"* | ~3 dias | Baixo. É comparação dela com ela, tese pura |
| **3b · A curva** | Tela de Evolução, gráfico, referência da OMS tracejada | 1–2 semanas | **É o §0 virando código** |

Separar tem um custo honesto: **registrar sem gráfico não dá payoff.** A mãe já
tem a curva na caderneta; anotar o peso na Ninna sem ver nada em troca é tarefa
sem recompensa, e ela não repete. Uma série que ninguém alimenta não fica pronta
para o 3b.

É por isso que o 3a **não é só o formulário**: ele inclui a frase de comparação
com a própria pesagem anterior. Isso é barato (o `copyInsight.ts` já sabe fazer
frase a partir de número), é a tese no seu formato mais limpo, e dá à mãe uma
razão para anotar antes de existir gráfico. Com isso a série começa a encher no
dia 1, e o 3b nasce com meses de dado em vez de dois pontos.

O 3b fica onde o §3.4 já diz que ele é perigoso, e com a regra que já está
escrita: a curva é **desenhada, nunca narrada**; sem *abaixo*, *acima*,
*esperado*, *adequado* ou percentil em texto. O `teste-linguagem-media.ts` já
varre isso e vai varrer a tela nova de graça.

**Estimativa: 3a ~3 dias (com o campo decimal), 3b 1–2 semanas em bloco próprio.**

### 4º · Saúde — Medicação, Vitamina, e Vacina por último

**Além do `SCHEMAS`: duas regras que hoje não existem em lugar nenhum.**

Campo novo na tela, nenhum — dose é `numero` e unidade é `escolha`. O que falta
não é campo, é comportamento:

**a) Confirmação em duas etapas.** O §3.4 pede, e a tela de registro não tem esse
conceito. A tela de detalhe já tem o padrão certo (o "Apagar" confirma inline,
sem `Alert`, porque o `react-native-web` não implementa `Alert` com dois botões).
É o mesmo mecanismo, no salvar, para os tipos que marcarem `confirmaAntesDeSalvar`
no schema.

**b) ⚠️ "Histórico não editável" contradiz o bloco 2.** Editar registro passou a
existir, e `atualizarRegistro` funciona para qualquer tipo. Fazer medicação
imutável é uma regra nova, e ela precisa de um lugar: uma flag no schema
(`imutavel: true`) que a tela de detalhe lê para não oferecer "Editar", **e** uma
recusa do lado do banco — senão é regra de tela, e regra de tela se contorna pela
URL.

Do lado do banco isso não é policy, é `check` ou trigger: RLS decide quem, não o
quê. Um trigger `before update` que rejeita quando `tipo in ('medicacao', …)` é o
caminho, e ele **muda o banco de um jeito que o `teste-rls-delete.mjs` não
cobre** — vale um caso próprio: a conta B não consegue editar a própria medicação.

**Vacina fica por último dentro do próprio grupo**, e não só por risco de dose. O
vocabulário dela é a tabela do PNI, que é dado de referência de terceiro — e o
§3.4 já avisa: no instante em que o app disser *"a próxima é a de 4 meses"*, ele
virou orientação de saúde. Registrar vacina tomada é registro. Dizer qual vem a
seguir é outra coisa, e é decisão consciente com fonte citada.

**Estimativa: ~1,5 semana, Vacina incluída se ela ficar só em registro.**

---

## O total, e onde ele difere do §7

| | §7 | Esta proposta |
|---|---:|---:|
| Pré-requisitos | não listados | ~2 dias |
| Eventos simples | — | ~1 semana |
| Alimentação | — | ~1 semana |
| Crescimento (registrar) | — | ~3 dias |
| Saúde | — | ~1,5 semana |
| **Bloco 3** | **3–4 semanas** | **~4 semanas** |
| Curva de crescimento | dentro do bloco 3 | **bloco próprio, 1–2 semanas** |

A estimativa do §7 se sustenta **se a curva sair do bloco**. Com ela dentro, 3–4
semanas é otimista — o gráfico com referência clínica é o item de maior risco de
todo o produto, e ele não deve competir por espaço com treze formulários.

---

## O que eu preciso decidir com você antes de escrever a primeira linha

1. **O gerador passa a emitir restrições idempotentes?** (pré-requisito 1) É a
   única coisa que bloqueia tudo.
2. **Duração informada ou registro em andamento**, para Passeio e Atividade?
3. **A Home com 20 atalhos** — seleção fixa, mais usados do bebê, ou tela à
   parte?
4. **A curva de crescimento sai do bloco 3?**
5. **Medicação imutável** — vale o trigger no banco, ou a flag na tela basta por
   ora?

As três primeiras têm resposta recomendada acima. A quarta e a quinta são suas.

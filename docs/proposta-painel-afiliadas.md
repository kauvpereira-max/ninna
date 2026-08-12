# Proposta — painel de afiliadas (bloco 1b)

Escrita em 12/08/2026, com a cobrança em modo teste no ar e a conta Stripe em
análise. Fonte de escopo: `PRODUTO.md` §3.5.

---

## A conta que decide tudo, e ela não é R$24,90

**A margem por assinante é R$5,61/mês, não R$24,90.** É o número do §5, do plano
anual — que é o caso base, porque o anual custa metade do mensal e é a escolha
racional para quase qualquer mãe que fique mais de dois meses.

Qualquer percentual de comissão pensado contra o preço de etiqueta erra por uma
ordem de grandeza. Contra a margem real:

| Desenho | Custo | Sobra da margem anual (R$5,61/mês) |
|---|---:|---:|
| 20% **recorrente** | R$2,50/mês | **R$3,11** — a margem cai de 45% para 25% |
| 10% **recorrente** | R$1,25/mês | R$4,36 |
| 20% **única**, na primeira fatura | R$29,98 uma vez | Paga-se em **~5,3 meses** de margem |
| 30% **única** | R$44,97 uma vez | Paga-se em ~8 meses |

**E há uma assimetria que é fácil não ver:** no plano mensal, 20% custa R$4,98
contra uma margem de R$17,12 — confortável. No anual, os mesmos 20% comem quase
metade. **A comissão dói exatamente no plano que a maioria vai escolher.**

Comissão é **custo de aquisição**, não desconto. Ela se compara com quanto custa
trazer a mesma mãe por anúncio, e se paga em meses de permanência — não em
percentual de uma receita que o app não fica.

---

## As decisões que eu preciso de você

### 1. Comissão única ou recorrente?

**Recomendo única, na primeira fatura paga.** Recorrente sobre o anual leva a
margem para 25% e amarra custo variável a uma receita que já é fina. Única
transforma a afiliada em canal de aquisição, que é o que ela é.

### 2. Qual percentual?

**Recomendo 20% da primeira fatura**, com o número escrito no banco por indicação
— e não numa constante. Percentual em constante muda para todo mundo, inclusive
para o que já foi acumulado; gravado na linha, a mudança vale só para o que vier
depois. É a mesma disciplina do `valida_ate`: o passado não se reescreve.

### 3. A comissão nasce na assinatura ou no pagamento?

**No pagamento.** São 7 dias grátis: creditar na assinatura criada gera saldo
sobre gente que pode cancelar antes de pagar qualquer coisa — e aí ou a Ninna
paga por nada, ou estorna saldo que a afiliada já viu, que é pior.

⚠️ **Isto exige um evento que o webhook não escuta hoje.** Ele trata 5 eventos,
todos `customer.subscription.*`, e o comentário do arquivo diz que
`checkout.session.completed` ficou de fora de propósito. Nenhum deles é "a fatura
foi paga".

Dá para inferir de um `subscription.updated` que muda `trialing → active`, e essa
é a saída sem tocar na lista. Mas é inferência: depende de a Stripe manter essa
transição, e o dia em que ela mudar não dá erro — só para de creditar. **Prefiro
`invoice.paid` como sexto evento**, explícito e com o valor da fatura dentro, que
é justamente o número de que a comissão precisa.

### 4. O que acontece em estorno e chargeback?

Não está no §3.5, e vai acontecer. **Recomendo:** a comissão vira negativa no
extrato da afiliada em vez de sumir — saldo que muda sozinho e sem linha é o que
destrói confiança de quem depende dele. E saque só libera saldo com mais de N
dias, para o estorno chegar antes do dinheiro sair.

### 5. As varreduras de copy valem no painel?

O §3.5 deixou isso em aberto de propósito. **Recomendo: não valem — e a exclusão
precisa ser explícita e testada.**

Elas existem para a copy que a mãe lê. "Média de comissão por indicação" é frase
legítima num painel de afiliada e seria reprovada pela varredura de linguagem de
média; "ela indicou" é pronome legítimo sobre uma adulta identificada.

⚠️ **Mas excluir arquivo de varredura é exatamente como varredura começa a
mentir** — é a regra 2, e este projeto já pagou por ela duas vezes. Então a
exclusão não pode ser um `if` no extrator: tem que ser uma **lista nomeada de
rotas**, com uma asserção de que todo arquivo fora dela continua sendo varrido, e
outra de que nenhum arquivo do app da mãe entrou na lista por engano.

---

## As três armadilhas do §3.5, e o que eu faria com cada uma

### A atribuição se perde no iOS — e é o R1 de novo

A influenciadora posta, a mãe toca, não instala, volta cinco dias depois. O
Safari limpou o storage, e a comissão sumiu. A afiliada reclama, e tem razão.

**O que eu faria:** `?ref=CODE` grava do lado do **servidor** no primeiro toque —
uma linha em `toques` com o código, um identificador de dispositivo grosseiro e o
instante. O `localStorage` continua sendo o caminho feliz; o servidor é a rede.

Isso não fecha o buraco, e é honesto dizer: sem cookie de terceiro e sem app
instalado, atribuição é sempre aproximação. O que dá para prometer à afiliada é
**um critério escrito e estável**, não precisão — e escrever o critério no termo
dela vale mais que fingir exatidão.

### A afiliada não pode ver quem indicou

Só contagem e valor. **Isso é requisito, não tela.** Nome de mãe ou qualquer
coisa do bebê num painel de terceiro é vazamento de dado sensível de criança, e o
termo promete o contrário.

**Onde isso mora:** na RLS, não na consulta. Uma policy que devolva linha de
`indicacoes` sem expor `user_id` — ou uma view agregada, que é mais simples de
provar. E um caso no `teste-rls-delete.mjs`: **a afiliada A não lê a indicação da
afiliada B, e nenhuma das duas alcança `babies` ou `registros`.**

### Comissão é evento fiscal

Pagamento manual adia, não resolve. Não é decisão de engenharia e eu não vou
propor solução — fica registrado que existe, com um efeito concreto de produto:
**o painel não deve prometer prazo de pagamento** enquanto o processo for manual.
"Solicitado" e "pago em DD/MM" descrevem o que aconteceu; "você recebe em 7 dias"
é promessa que alguém vai ter que cumprir à mão.

---

## O que eu construiria, em ordem

Cada etapa é usável sozinha, e a primeira que revela problema é a mais barata.

| # | O que | Por que primeiro |
|---|---|---|
| 1 | **Migration**: `afiliadas`, `indicacoes`, `saques` — com RLS e o caso no teste de RLS | A regra de "não vê quem indicou" é do banco. Nasce junto com a tabela ou não nasce |
| 2 | **Atribuição**: `?ref=` no servidor + no cliente, colada na conta no `signUp` | É o que não dá para reconstruir depois. Toque perdido é comissão perdida para sempre |
| 3 | **`invoice.paid` no webhook** + crédito da comissão | Depende do 1 e do 2 existirem |
| 4 | **Painel**: rota que só abre para quem tem linha em `afiliadas`, com contagem, saldo e extrato | Só faz sentido com dado dentro |
| 5 | **Saque**: solicitação, estado, e o extrato negativo do estorno | O último porque é o único que pode esperar |

**A 2 é a que tem pressa de verdade**, e vale dizer por quê: se a atribuição
entrar depois de a primeira afiliada começar a divulgar, os toques daquele
período não existem em lugar nenhum. Todo o resto é reconstituível a partir da
Stripe; a atribuição, não.

---

## O que eu preciso antes de escrever a migration

As decisões **1, 2 e 3** — única/recorrente, percentual, e se entra o
`invoice.paid`. Elas mudam as colunas da tabela, e coluna que nasce errada custa
migration nova.

A **4** e a **5** dá para decidir enquanto eu construo as duas primeiras.

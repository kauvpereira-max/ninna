# Teste ponta a ponta do programa de afiliadas

Escrito em 12/08/2026, com as etapas 1 a 4 do bloco 1b no ar e a cobrança no
**sandbox** `acct_1U3FllPcpMk0DJ4d` (ver o passo 5 — não é o modo teste da
conta).

Prova a cadeia inteira: link → cadastro → assinatura → fatura paga → comissão
creditada → painel. Nenhum teste automatizado alcança isso, porque metade dela
mora na Stripe.

---

## ✅ RODADO E APROVADO EM 12/08/2026

Cadeia inteira verde. O que ficou registrado:

| Elo | Resultado |
|---|---|
| Atribuição (passo 3) | 1 indicação, código `teste`, 20% |
| Assinatura (passo 4) | `trialing`, `cus_V3lSUkiOWX3rgY` |
| Trial encerrado (passo 5) | `active`, período 12/08 → 12/09 |
| `invoice.paid` entregue | 18:04:02 UTC, `evt_1U3gVOPcpMk0DJ4ds4IeyhAq`, **200 OK** |
| Comissão (passo 5) | **498 centavos**, fatura `in_1U3gSAPcpMk0DJ4dRoEDCgwe` |
| Painel (passo 6) | Disponível **R$ 0,00** · Esperando R$ 4,98 · Total R$ 4,98 · 1 cadastro · 1 assinatura · extrato com 1 linha |

**Duas coisas quebraram no caminho, e as duas viraram seção neste arquivo:** o
ambiente errado (passo 5, sandbox × conta) e o endpoint com 5 eventos em vez de 6
(passo 5, o aviso em destaque). Nenhuma das duas era código.

### O que este teste NÃO exercitou, mesmo passando

A **carência** e o **estorno** só foram vistos por SQL manual (fim do passo 6),
não por evento real da Stripe. E o ramo `23505 → 200` do webhook — o que impede a
Stripe de reentregar para sempre — não rodou: só houve **uma** entrega de
`invoice.paid`, porque a primeira fatura nasceu quando o endpoint ainda ouvia 5
eventos e nunca foi entregue.

O índice da `009` foi provado à parte, com um insert numa transação revertida:

```
ERROR: 23505: duplicate key value violates unique constraint "idx_comissoes_uma_por_indicacao"
DETAIL:  Key (indicacao_id)=(ae934397-…) already exists.
```

Isso prova o **banco**, não o **handler**. Para fechar o handler, reenviar pela
tela de Eventos o `invoice.paid` da primeira fatura (`evt_1U3f7zPcpMk0DJ4d6vm5tyCM`,
16:35:42 UTC): tem que voltar **200**, e `comissoes` tem que continuar com uma
linha só.

---

## ⚠️ Leia isto antes: os 7 dias de teste atravessam o caminho

O checkout cria a assinatura com `trial_period_days: 7`. Durante o teste grátis a
Stripe **não emite fatura paga** — e a comissão nasce de `invoice.paid`, por
decisão (ver `009` e o webhook).

Ou seja: assinar e esperar não credita nada hoje. Credita daqui a uma semana.

**A saída não é mexer no código.** Baixar `DIAS_DE_TESTE` para zero testaria um
caminho que não é o que a mãe percorre, e ainda exigiria lembrar de reverter. O
que se faz é **encerrar o teste grátis pelo painel da Stripe**, que dispara a
cobrança na hora e emite o `invoice.paid` de verdade.

O caminho testado continua sendo o real: checkout de verdade, trial de verdade,
fatura de verdade. Só o relógio é empurrado.

---

## Passo 1 · Criar a primeira afiliada

Não há tela para isto, e é decisão — ver `PRODUTO.md` §3.5.

A afiliada será a sua própria conta (`kauu2804@gmail.com`), para você conseguir
abrir o painel com ela. A mãe indicada precisa ser **outra conta**: indicar a si
mesma é bloqueado no banco de propósito, e é a fraude mais comum em programa de
afiliado.

```sql
insert into afiliadas (user_id, codigo, nome, percentual_padrao)
select id, 'teste', 'Parceira de Teste', 20
from auth.users where email = 'kauu2804@gmail.com';
```

**Conferir:**

```sql
select codigo, nome, percentual_padrao, ativa from afiliadas;
```

---

## Passo 2 · Abrir o link, numa janela anônima

```
https://ninna-sigma.vercel.app/?ref=teste
```

**Anônima importa por dois motivos**, e os dois são o teste:

1. o `?ref=` é guardado no armazenamento **daquele navegador** — numa janela onde
   você já está logada, ele seria capturado na sessão errada;
2. você precisa estar deslogada para criar a conta da mãe.

---

## Passo 3 · Criar a conta da mãe e um bebê

Use um endereço com `+`, que o Gmail entrega na mesma caixa:
`kauu2804+mae@gmail.com`. Nenhum e-mail é enviado — "Confirm email" está
desligado (`mailer_autoconfirm: true`).

Cadastre um bebê qualquer; o app exige um antes de chegar na Home.

**Conferir que a atribuição pegou** — este é o passo que não é reconstituível, e
o único que precisa acontecer no instante certo:

```sql
select i.codigo, i.percentual, i.criada_em, u.email
from indicacoes i join auth.users u on u.id = i.indicada_user_id;
```

Esperado: **uma linha**, código `teste`, percentual `20`, e o e-mail da mãe.

> Se vier vazio, pare aqui. O resto da cadeia depende disto, e seguir só produz
> um "não creditou" que não diz onde quebrou.

---

## Passo 4 · Assinar, ainda como a mãe

Aba Mais → assinar. Plano **mensal** deixa a conta mais fácil de conferir de
cabeça: R$24,90, comissão de 20% = **R$4,98** (498 centavos).

Cartão de teste da Stripe: `4242 4242 4242 4242`, validade futura, CVC qualquer.

**Conferir:**

```sql
select status, valida_ate from assinaturas
where user_id = (select id from auth.users where email = 'kauu2804+mae@gmail.com');
```

Esperado: `trialing`. **Ainda não há comissão** — e isso está certo.

---

## Passo 5 · Encerrar o teste grátis na Stripe

É o passo que empurra o relógio.

### ⚠️ Duas armadilhas, e as duas custaram tempo em 12/08/2026

**1. Não é o modo teste da conta — é o SANDBOX.** A `STRIPE_API_KEY` aponta para
o sandbox "Área restrita de ninna", `acct_1U3FllPcpMk0DJ4d`. O modo teste da
conta `ninna` (`acct_1U3FlcB5ktEdfFnD`) está vazio e vai dizer *"Adicione seu
primeiro cliente de teste"*, como se o checkout nunca tivesse rodado. Os ids
diferem numa letra depois de `1U3Fl`. Ver `PRODUTO.md` §7.

Ir direto, sem depender do seletor:

```
https://dashboard.stripe.com/acct_1U3FllPcpMk0DJ4d/test/customers/<cus_…>
```

**2. "End trial" não está mais no menu `…`.** O menu da assinatura só oferece
pausar e cancelar — e cancelar é o que você NÃO quer. O caminho atual é
**Atualizar assinatura** → rolar até **Dias de avaliação gratuita** → trocar `7`
por `0` → **Atualizar assinatura** → **Imediatamente**.

Antes de confirmar, a Prévia à direita tem que dizer **"Fatura imediatamente"** e
`R$ 24,90`, e a linha "Teste gratuito" tem que ter sumido. Se ainda disser
"7 dias restantes", o campo não pegou.

A Stripe cobra na hora e emite `invoice.paid`. O webhook recebe, acha a
indicação, calcula 20% e credita.

**Conferir:**

```sql
select c.tipo, c.valor_centavos, c.stripe_invoice_id, c.criada_em
from comissoes c order by c.criada_em desc;
```

Esperado: **uma linha**, `credito`, `498`.

> Não apareceu? Stripe → Workbench → **Webhooks** → o endpoint
> `ninna-assinaturas`. A coluna **"Ouvindo"** tem que dizer **6 eventos**. Se
> disser 5, o `invoice.paid` não foi salvo, e nada mais adianta olhar.
>
> Depois disso, Workbench → **Eventos** → o `invoice.paid` da hora certa → as
> tentativas de entrega. Um `500` ali é o webhook pedindo reentrega porque a
> linha de `assinaturas` ainda não existia — legítimo, e resolve sozinho na
> tentativa seguinte.

### ⚠️ Foi isto que aconteceu em 12/08/2026, e o modo de falha é traiçoeiro

O endpoint estava com **5 eventos**, não 6 — a marcação do `invoice.paid` não
foi salva, embora a tela tivesse mostrado 6. Sintoma: a Stripe emitiu o
`invoice.paid` normalmente (evento existe, valor certo), a assinatura virou
`active`, **e a comissão simplesmente não nasceu**. Nenhum erro, em lugar
nenhum — porque um evento não assinado não é uma entrega que falha, é uma
entrega que não existe.

O log da Edge Function é o que separa os dois casos em um olhar: se o
`invoice.paid` tivesse sido entregue e falhado, haveria invocação. Não havia —
só a do `customer.subscription.updated`.

É a **regra nº 1** do `CLAUDE.md` na Stripe: configuração de painel se confere
pelo servidor (aqui, a coluna "Ouvindo"), nunca pela tela em que você clicou.

**E é o mesmo defeito que o `PRODUTO.md` §7 avisa para o endpoint live** —
"endpoint que nascer sem ele credita zero comissão sem dar erro nenhum". O aviso
estava certo; ele só aconteceu no sandbox primeiro, que é onde sair barato.

**Consertar sem refazer o teste:** marcar `invoice.paid`, salvar, conferir que a
coluna diz 6, e então **reenviar o evento** pela tela de Eventos. A `009` tem
índice único por indicação, então reenviar não credita duas vezes.

---

## Passo 6 · Abrir o painel, agora como a afiliada

Volte à janela normal, logada como `kauu2804@gmail.com`:

```
https://ninna-sigma.vercel.app/afiliada
```

### ⚠️ O resultado esperado tem um zero, e ele NÃO é falha

| Campo | Esperado |
|---|---:|
| **Disponível para saque** | **R$ 0,00** |
| Ainda esperando | R$ 4,98 |
| Total acumulado | R$ 4,98 |
| Cadastros pelo seu link | 1 |
| Viraram assinatura | 1 |
| Extrato | uma linha, "Comissão", R$ 4,98 |

A comissão nasceu agora, e a carência é de **30 dias**. "Disponível" zerado com
"ainda esperando" preenchido é exatamente o desenho funcionando — é a distinção
que a decisão nº 4 comprou.

Se "Disponível" viesse com R$ 4,98, **aí sim** seria o defeito: o painel estaria
prometendo dinheiro que ainda pode voltar num estorno.

### Para ver o outro lado da carência

Envelheça o crédito e recarregue o painel:

```sql
update comissoes set criada_em = now() - interval '40 days'
where stripe_invoice_id is not null;
```

Esperado agora: **Disponível R$ 4,98**, Ainda esperando R$ 0,00.

E para ver o estorno como linha negativa:

```sql
insert into comissoes (afiliada_user_id, indicacao_id, tipo, valor_centavos, stripe_invoice_id)
select afiliada_user_id, indicacao_id, 'estorno', -498, stripe_invoice_id
from comissoes where tipo = 'credito' limit 1;
```

Esperado: extrato com duas linhas — "Comissão R$ 4,98" e "Compra devolvida
−R$ 4,98" —, total e disponível em R$ 0,00. **O crédito continua visível**, que
é o ponto do ledger.

---

## Passo 7 · Limpar

A conta da mãe de teste e as linhas ficam no banco de produção, como as outras
contas de teste. Se quiser desfazer:

```sql
delete from comissoes;
delete from indicacoes;
delete from afiliadas;
delete from assinaturas
  where user_id = (select id from auth.users where email = 'kauu2804+mae@gmail.com');
```

A conta de auth em si exige `service_role` e pode ficar — como as do
`teste-rls`. E a assinatura de teste na Stripe pode ser cancelada pelo painel,
ou deixada: em modo teste ela não cobra ninguém.

---

## O que este teste NÃO cobre

- **A atribuição que sobrevive dias.** Ela é aproximação por decisão — funciona
  no mesmo navegador. O caso "tocou no link, voltou cinco dias depois com o
  storage limpo" é buraco conhecido e declarado em `src/lib/indicacao.ts`.
- **O saque.** A etapa 5 do bloco não existe: não há tabela de solicitação nem
  estado. O rodapé do painel diz para chamar no WhatsApp, e é honesto sobre isso.
- **O modo live.** Tudo acima é modo teste. O endpoint live precisa nascer com os
  **seis** eventos — `PRODUTO.md` §7, bloco 1c.

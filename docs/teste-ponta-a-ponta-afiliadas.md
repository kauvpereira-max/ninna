# Teste ponta a ponta do programa de afiliadas

Escrito em 12/08/2026, com as etapas 1 a 4 do bloco 1b no ar e a cobrança em
**modo teste**.

Prova a cadeia inteira: link → cadastro → assinatura → fatura paga → comissão
creditada → painel. Nenhum teste automatizado alcança isso, porque metade dela
mora na Stripe.

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

Dashboard da Stripe (**modo teste**) → Customers → a cliente recém-criada →
a assinatura → **Actions** → **End trial**.

A Stripe cobra na hora e emite `invoice.paid`. O webhook recebe, acha a
indicação, calcula 20% e credita.

**Conferir:**

```sql
select c.tipo, c.valor_centavos, c.stripe_invoice_id, c.criada_em
from comissoes c order by c.criada_em desc;
```

Esperado: **uma linha**, `credito`, `498`.

> Não apareceu? Stripe → Developers → Webhooks → o endpoint `ninna-assinaturas`
> → aba de tentativas. Ele diz se `invoice.paid` foi entregue e com qual
> resposta. Um `500` ali é o webhook pedindo reentrega porque a linha de
> `assinaturas` ainda não existia — legítimo, e resolve sozinho na tentativa
> seguinte.

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

# Roteiro da virada para live — bloco 1c

Escrito em 12/08/2026, com a conta `ninna` já aprovada e a cobrança inteira
rodando num sandbox.

Este arquivo descreve uma **transição**, então ele vence — regra 4 do
`CLAUDE.md`. Prazo abaixo, no fim.

---

## ⚠️ Leia isto primeiro: a ordem que você propôs tem um passo a mais

Você listou quatro passos: montar o teste da conta → ensaiar → montar o live →
trocar os secrets. **A troca de secrets acontece duas vezes, não uma**, e o
motivo é estrutural:

> As funções leem **um** `STRIPE_API_KEY` e **um** `STRIPE_WEBHOOK_SECRET`.
> Um par de secrets = um ambiente ativo. Não existe "teste e live ao mesmo
> tempo".

Ou seja: para ensaiar no modo teste da conta, o Supabase já precisa estar
apontando para lá. O ensaio **não é** um passo separado da troca — ele exige a
troca antes.

A ordem real, então, é de seis passos:

| # | O quê | De quem |
|---|---|---|
| 0 | Rolar a chave de teste que vazou no chat | 🧑 você |
| 1 | Montar o **modo teste** da conta: produto, 2 preços, endpoint | 🧑 você · 🤖 eu confiro |
| 2 | Trocar os 4 secrets para os **de teste da conta** | 🧑 você escreve · 🤖 eu confiro |
| 3 | **Ensaiar** — o teste ponta a ponta inteiro, na conta | 🧑 você clica · 🤖 eu leio banco e logs |
| 4 | Montar o **modo live**: produto, 2 preços, endpoint | 🧑 você · 🤖 eu confiro |
| 5 | Trocar os 4 secrets para os **de live** | 🧑 você escreve · 🤖 eu confiro |
| 6 | A primeira fatura em BRL, de verdade | 🧑 você · 🤖 eu leio o banco |

**Nada disso é commit.** Os `price_id` e as chaves saíram do código de propósito;
nenhum arquivo muda. Por isso não há `tsc`, teste ou `expo export` neste bloco —
a regra 3 não se aplica a um bloco sem código. O que substitui os três é a
conferência pelo servidor de cada passo.

**A janela é segura agora e não vai ser depois.** Durante o passo 3 a produção
inteira aponta para um modo teste. Isso é inofensivo **porque ninguém paga
ainda** — não há uma única assinatura live. Depois do lançamento essa ordem
deixa de existir, e o ensaio teria que acontecer em outro lugar. É mais um
motivo para fazer agora.

---

## O cartão de identidade — cole isto onde você consiga ver

Antes de criar **qualquer coisa**, olhe a URL. Ela é o único lugar confiável.

```
acct_1U3Flc B5ktEdfFnD   ← a CONTA ninna        (é aqui que tudo vai)
acct_1U3Fll PcpMk0DJ4d   ← o SANDBOX            (não crie nada aqui)
           ↑
      c de CONTA
```

Os dois começam com `acct_1U3Fl`. O caractere seguinte é a diferença inteira:
**`c` de conta**, `l` de mais-um-`l`.

E dentro da conta certa ainda há dois ambientes, também separados pela URL:

| Onde você está | URL |
|---|---|
| Conta, **modo teste** | `dashboard.stripe.com/acct_1U3FlcB5ktEdfFnD/**test**/…` |
| Conta, **modo live** | `dashboard.stripe.com/acct_1U3FlcB5ktEdfFnD/…` (sem `/test/`) |
| Sandbox | `dashboard.stripe.com/acct_1U3Fl**l**PcpMk0DJ4d/test/…` |

> **Por que não confiar na tela:** o sandbox mostra a faixa "Sandbox / Área
> restrita" e o modo teste mostra "Você está testando…". São parecidas, na mesma
> posição, e o nome do sandbox é *"Área restrita de ninna"* — a palavra `ninna`
> aparece nos dois. Em 12/08/2026 essa semelhança custou uma hora, e depois
> custou um registro errado no `PRODUTO.md` (uma pendência do sandbox lida como
> pendência da conta).

---

## A caixa de ferramentas — as quatro conferências pelo servidor

Todas rodam no seu terminal. **Nenhuma delas precisa que você me mande uma
chave.** As três primeiras devolvem JSON sem segredo dentro; pode colar aqui
inteiro.

### A. Em que conta esta chave está?

```
curl.exe -s https://api.stripe.com/v1/account -u "<chave>:"
```

Confira `"id"` e `settings.dashboard.display_name`. É a conferência que resolve
a confusão de ambiente em um passo, e ela vale mais que qualquer URL: a chave
não erra.

### B. Os preços existem e estão certos?

```
curl.exe -s "https://api.stripe.com/v1/prices?limit=10&expand[]=data.product" -u "<chave>:"
```

Confira, em cada um: `unit_amount`, `currency`, `recurring.interval`, `active` e
o `id` (que é o que vai virar secret).

### C. O endpoint ouve os seis eventos?

```
curl.exe -s https://api.stripe.com/v1/webhook_endpoints -u "<chave>:"
```

**Esta é a conferência mais importante do roteiro.** Confira `enabled_events` —
precisa ter **exatamente estes seis**:

```
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
invoice.paid
```

A coluna **"Ouvindo: 6 eventos"** no painel serve como conferência rápida, mas o
`enabled_events` do JSON é a autoridade: ele lista *quais*, não só quantos. Em
12/08 o painel foi marcado com os 6, mostrou 6 na hora, e o servidor guardou 5 —
a comissão não nasceu, e **nada deu erro em lugar nenhum**.

> Um evento não assinado não é uma entrega que falha. É uma entrega que não
> existe. Não há log, não há tentativa, não há vermelho: só uma coisa que não
> aconteceu.

### D. O secret que está no Supabase é o que eu colei?

```
npx supabase secrets list --project-ref hzjcimgutccsfrxuuhrl
```

A coluna de valor é um **digest**, não o segredo. Para comparar sem expor nada:

```
printf '%s' 'VALOR-QUE-VOCE-COLOU' | sha256sum
```

Sem `\n` no fim — por isso `printf '%s'` e não `echo`. Se os dois batem, o
Supabase tem exatamente o que você colou.

#### ⚠️ Calibre a régua antes de usá-la

Esse método assume que o digest é SHA-256 do valor cru. **A suposição não está
provada**, e uma régua não calibrada que "não bate" não distingue *segredo
errado* de *método errado*.

Calibre uma vez, de graça, com um valor que **não é segredo**: `price_id` é
público (ele vai no bundle do checkout). Depois do passo 2, me mande o
`price_...` do mensal em texto puro. Eu calculo o SHA-256 aqui, comparo com o
digest do `secrets list`, e a partir daí a régua está provada — e as duas chaves
de verdade podem ser conferidas só pelo hash.

Se não bater, o método morre e a alternativa é conferir por comportamento:
chamar o checkout e ver se responde.

---

## Passo 0 · Rolar a chave que vazou (🧑 você)

A `sk_test_51U3Flc…` foi colada no chat hoje. Ela é **exatamente** a chave que
vira `STRIPE_API_KEY` no passo 2 — ou seja, uma chave de produção com histórico
público. Rolar antes de usar, não depois.

Conta `ninna` → modo teste → Developers → API keys → **Roll key**.

Custo zero: o modo teste dessa conta está vazio e nada aponta para ele. Rolar
depois de montar tudo custaria refazer o passo 2.

**Guarde a nova em algum lugar seguro que não seja este chat.**

---

## Passo 1 · Montar o modo teste da conta (🧑 você, 🤖 eu confiro)

URL: `dashboard.stripe.com/acct_1U3FlcB5ktEdfFnD/test/…` — **`Flc`**, com
`/test/`.

### 1.1 · O produto e os dois preços

Um produto (`ninna`) com dois preços recorrentes:

| Plano | Valor | Centavos | Intervalo |
|---|---|---:|---|
| Mensal | R$ 24,90 | `2490` | `month` |
| Anual | R$ 149,90 | `14990` | `year` |

Moeda **BRL** nos dois.

> Os números saem de `app/assinatura.tsx` (`PLANOS`), que é o que a mãe lê na
> tela. **Se um dia divergirem, é a tela que está certa e a Stripe que está
> errada** — a mãe decidiu com base no que leu, e cobrar diferente disso é
> contestação ganha por ela.

### 1.2 · O endpoint

- **URL:** `https://hzjcimgutccsfrxuuhrl.supabase.co/functions/v1/stripe-webhook`
  (a mesma dos dois ambientes — é a mesma função)
- **Nome:** algo que diga o ambiente. `ninna-teste-conta` serve. Não repita
  `ninna-assinaturas`, que é o nome do endpoint do sandbox: dois endpoints com o
  mesmo nome em ambientes diferentes é a próxima hora perdida.
- **Eventos:** os **seis** da lista da ferramenta C.

**Conferir:** ferramentas **B** e **C**. Cole o JSON aqui.

### 1.3 · Auditar o que sobrou — o entulho nasce no mesmo dia

Não confira só que os dois preços certos existem. Confira que **não existe mais
nada**.

Em 12/08/2026, montar este passo deixou para trás **três produtos e quatro
preços ativos**, todos chamados "Ninna": os dois primeiros produtos foram
criados um por plano, e vinte minutos depois refeitos como um produto com dois
preços. Os primeiros ficaram, `active: true`, indistinguíveis do certo em
qualquer lista.

> O nome do produto é o que aparece **na fatura da mãe**. Três produtos com o
> mesmo nome não se distinguem nem no seletor de preço do painel, nem no recibo.
> E preço na Stripe é imutável: o conserto é arquivar e recriar, nunca editar.

Isto não é vício do sandbox. **É o que acontece em qualquer ambiente montado à
mão**, inclusive no live do passo 4 — onde o entulho cobra dinheiro de verdade.

Arquivar os órfãos, **preços antes dos produtos** (a Stripe recusa arquivar
produto com preço ativo):

```
curl.exe -s https://api.stripe.com/v1/prices/<price_orfao>   -u "<chave>:" -d active=false
curl.exe -s https://api.stripe.com/v1/products/<prod_orfao>  -u "<chave>:" -d active=false
```

Depois repita a ferramenta **B**: têm que sobrar **exatamente dois** preços
ativos, e a ferramenta de produtos tem que mostrar **um** produto ativo.

---

## Passo 2 · Trocar os quatro secrets para os de teste da conta (🧑 você escreve, 🤖 eu confiro)

Os quatro, e só estes quatro:

| Secret | De onde vem |
|---|---|
| `STRIPE_API_KEY` | a chave nova do passo 0 |
| `STRIPE_PRICE_MENSAL` | `price_…` do 1.1 mensal |
| `STRIPE_PRICE_ANUAL` | `price_…` do 1.1 anual |
| `STRIPE_WEBHOOK_SECRET` | o `whsec_…` do endpoint do 1.2 |

**Pelo CLI, não pelo painel** — regra 1, e aqui ela é literal: o painel de
secrets do Supabase é justamente um painel.

```
npx supabase secrets set STRIPE_API_KEY=sk_test_... --project-ref hzjcimgutccsfrxuuhrl
```

> Isso deixa a chave no histórico do shell. Se incomodar, use
> `--env-file caminho.env` e apague o arquivo depois.

### ⚠️ Depois de trocar secret, redeploy

Instância quente pode continuar com o ambiente antigo. Trocar secret e testar em
seguida é como perguntar ao servidor e ler a resposta anterior.

```
npx supabase functions deploy stripe-webhook assinatura --project-ref hzjcimgutccsfrxuuhrl
```

**Isto eu posso rodar** — não precisa de segredo nenhum.

**Conferir:** ferramenta **D**, com a calibração do `price_id` primeiro.

---

## Passo 3 · Ensaiar (🧑 você clica, 🤖 eu leio)

O roteiro é o `docs/teste-ponta-a-ponta-afiliadas.md`, inteiro, do passo 2 ao 6 —
**com a conta de mãe nova**, porque a `kauu2804+mae@gmail.com` já tem indicação
consumida e comissão creditada, e a `009` não deixa creditar duas vezes.

Use `kauu2804+mae2@gmail.com`. E crie a indicação com o mesmo código `teste`.

O que muda em relação a hoje: o "End trial" agora é
**Atualizar assinatura → Dias de avaliação gratuita → 0 → Imediatamente**, e o
painel da Stripe é o `/acct_1U3FlcB5ktEdfFnD/test/`.

**Passar significa:** `assinaturas` com `active`, uma linha nova em `comissoes`
de **498** centavos, e o painel da afiliada somando **R$ 9,96** no total (a de
hoje mais esta) com **R$ 0,00** disponível.

> Repare que o total acumulado passa a somar duas indicações. Isso é o esperado:
> a comissão de hoje continua válida, e o ledger não se reescreve.

**Eu leio:** `comissoes`, `assinaturas` e o log da Edge Function, e digo qual
ramo rodou — não só que voltou 200.

---

## Passo 4 · Montar o modo live (🧑 você, 🤖 eu confiro)

Igual ao passo 1, **sem `/test/` na URL**. Mesmo produto, mesmos dois preços,
mesmos valores, mesmos seis eventos. Nome do endpoint: `ninna-live`.

**Conferir:** ferramentas **B** e **C**, agora com a chave `sk_live_…` — **e a
auditoria do 1.3**, que aqui é a que mais importa: produto órfão em live é nome
errado na fatura de uma mãe pagante, e preço órfão é valor errado cobrado de
verdade.

⚠️ A partir daqui as chaves são de verdade. **Não cole `sk_live_` neste chat**,
nem para eu conferir — as ferramentas B e C rodam no seu terminal e o JSON que
elas devolvem não tem segredo dentro.

---

## Passo 5 · Trocar os quatro secrets para os de live (🧑 você escreve, 🤖 eu confiro)

Os mesmos quatro nomes, os quatro valores novos. Redeploy de novo.

**No instante em que este passo termina, o sandbox e o modo teste param de
funcionar** — as entregas deles vão falhar na verificação de assinatura, porque
o `STRIPE_WEBHOOK_SECRET` agora é outro. Isso é desejado, e é a razão de o
ensaio vir antes.

**Conferir:** ferramenta **D**, com a régua já calibrada.

---

## Passo 6 · A primeira fatura em BRL, de verdade (🧑 você)

Assinar com **cartão real seu**, plano mensal, e cancelar depois.

O que olhar na fatura, que nenhum passo anterior mostra:

- **moeda BRL** e valor R$ 24,90;
- o **descritivo na fatura do cartão** — sai como `NINNA BR`
  (`statement_descriptor` da conta). Descritivo que a mãe não reconhece vira
  contestação, e contestação de R$ 24,90 custa mais que R$ 24,90;
- **imposto**, se aparecer algum.

**Eu leio o banco** e confirmo `status`, `valida_ate` e a comissão.

---

## O que fazer com o sandbox depois

**Apagar**, e não renomear — mesma lógica da regra 4: `sandbox-antigo-nao-usar`
continua sendo um sandbox para quem está com pressa. Não há nada lá dentro que
valha guardar: são dados de teste, e o histórico útil já está escrito nos `docs`.

Onde: seletor de contas → **Gerenciar áreas restritas**.

Faça isso **depois do passo 3**, nunca antes — até o ensaio passar, o sandbox é
a única integração que funciona.

### ⚠️ E há um motivo mais forte que arrumação

O endpoint do sandbox aponta para a **função de produção**. Enquanto ele existir,
qualquer clique lá dentro escreve no **banco de produção** — foi assim que as
linhas de teste de hoje entraram em `assinaturas` e `comissoes`. Depois do
lançamento, uma assinatura de brincadeira no sandbox poderia mexer no `status` de
uma mãe pagante.

O passo 5 neutraliza isso sozinho (a assinatura não vai mais verificar), mas
"neutralizado por efeito colateral" é diferente de "não existe". Se por algum
motivo você quiser manter o sandbox, **apague o endpoint `ninna-assinaturas` de
dentro dele** — isso é obrigatório, não opcional.

E sobra a limpeza do banco: as contas de teste (`kauu2804+mae@`, `+mae2@`), a
afiliada `teste` e as linhas de `comissoes`/`indicacoes`. A query está no passo 7
do `docs/teste-ponta-a-ponta-afiliadas.md`.

---

## Copiar do sandbox, ou recriar à mão?

**Recriar à mão.** Eu mencionei um botão de copiar; a versão honesta é que **não
confirmei que ele existe no caminho sandbox → conta** — o "copiar" que a Stripe
oferece com destaque é o inverso, ao criar um sandbox. E a certeza não vale ser
perseguida, porque o trabalho manual é de cinco minutos: **um produto e dois
preços.**

Os motivos de preferir a mão, mesmo se o botão existir:

1. **Preço na Stripe é imutável.** `unit_amount` e `interval` não se editam — só
   se arquiva e recria. Um preço copiado errado não se conserta, e você descobre
   isso na primeira cobrança;
2. **O catálogo do sandbox tem entulho.** Ele nasceu de exploração, não de
   desenho. Copiar leva junto o que foi criado para testar e nunca apagado;
3. **Copiar não pula o passo que importa.** Você precisa *ler* cada `price_id`
   de qualquer jeito, porque ele vira secret. O botão economiza a digitação do
   valor, não a conferência;
4. **Copiar entre ambientes é exatamente a operação que erra de ambiente em
   silêncio** — que é o defeito que este roteiro inteiro existe para não repetir.

---

## ⏰ Vencimento deste arquivo

**Vence em 30/09/2026**, ou **no dia em que o passo 6 for concluído** — o que
vier primeiro.

Gatilho, porque a data é generosa demais: no instante em que a primeira fatura
real for conferida, este roteiro passa a descrever um estado que não existe mais
e a informar decisões erradas ("monte o modo teste da conta" já foi feito).

No dia, **apagar, não renomear.** O que sobrevive dele — os dois `acct_`, a
conferência do `enabled_events`, o corolário do sandbox — já está no
`PRODUTO.md` §7 e no `CLAUDE.md`, que são permanentes. O histórico do git basta
para o resto.

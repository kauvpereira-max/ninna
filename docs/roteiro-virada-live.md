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

#### ✅ A régua foi calibrada em 12/08/2026 — o digest é SHA-256 do valor cru

Não é mais suposição. Os dois `price_id` são **públicos** (vão no bundle do
checkout), então podiam ser calculados dos dois lados; os hashes bateram
exatamente com o que o `secrets list` devolve. A régua foi provada num valor
conhecido antes de ser usada num desconhecido.

**Use o script, que faz isso sozinho e não deixa o valor sair do terminal:**

```
./scripts/conferir-secret.sh STRIPE_WEBHOOK_SECRET
```

Ele pede o valor sem ecoar, calcula o SHA-256, lê o digest do servidor e
compara. A saída não tem segredo dentro: pode colar no chat inteira.

> **Por que existe um script para três linhas de shell:** em 12/08/2026 três
> chaves da Stripe foram coladas num chat em sequência, cada uma depois de a
> anterior ter sido rolada por causa da exposição. O conselho estava certo e não
> adiantou — o caminho seguro era mais trabalhoso que o inseguro. Um script não
> é lembrete: é o caminho seguro passando a ser o mais curto.

#### São DOIS scripts, e os dois existem de propósito

| Arquivo | Shell | Onde é usado |
|---|---|---|
| `scripts/conferir-secret.sh` | Git Bash | é o shell que roda os testes deste projeto |
| `scripts/conferir-secret.ps1` | PowerShell | é o terminal de trabalho |

Não é redundância por descuido. Em 12/08/2026 o `.sh` foi escrito, provado, e
mesmo assim **não foi usado quatro vezes seguidas** — a linha voltava sem saída
nenhuma, e a causa era que PowerShell não executa `.sh`.

> O script certo, no shell errado, é um script que não existe.

É o raciocínio do próprio `.sh` um nível abaixo: não adianta o caminho seguro ser
o mais curto se ele não abre.

**O preço disso é a deriva**, e ele é real: duas cópias divergem na primeira
correção que só uma receber — a mesma razão pela qual `scripts/varredura.ts` é
extrator único. Aqui a duplicação se aceita porque os dois shells são usados de
verdade, e o antídoto é a calibração: os dois se conferem contra um `price_id`,
que é público e tem digest conhecido dos dois lados. Mexeu num, calibre os dois.

#### O que foi provado de cada um, e o que não foi

- **`.sh` — ponta a ponta.** Rodado inteiro contra `STRIPE_PRICE_MENSAL` com o
  `price_1U3ixx…` alimentado por pipe: `BATE`. Hash, leitura do digest do
  servidor e comparação, tudo exercitado.
- **`.ps1` — as duas metades, separadas.** O hash local e a leitura do servidor
  foram rodados com as mesmas expressões do arquivo e deram o mesmo digest do
  `.sh`. **A exceção é o `Read-Host -AsSecureString`**, que ignora pipe e espera
  console de verdade — travou até ser morto. Ele exige um humano, e por isso é a
  única linha do arquivo que nenhuma automação prova.

Isso importa porque ferramenta de conferência que quebra em vez de conferir não
diz "NAO BATE": ela estoura, e o susto chega no lugar errado.

#### ⚠️ E o defeito de digitação que responde "Finished"

```
...VALOR --project-ref hzjci...     ← certo
...VALOR--project-ref hzjci...      ← o valor gravado leva "--project-ref" colado
```

Sem o espaço, o `secrets set` **ainda responde `Finished supabase secrets set.`**
— ele grava um valor corrompido e considera sucesso. Aconteceu no passo 2 e só
apareceu porque o `updated_at` do `secrets list` continuava sendo do dia
anterior. É mais uma razão para conferir por digest e não pela mensagem de
saída.

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

#### A ordem tem três passos, e o do meio é o que ninguém adivinha

```
1. curl.exe -s https://api.stripe.com/v1/products/<prod_orfao> -u "<chave>:" -d "default_price="
2. curl.exe -s https://api.stripe.com/v1/prices/<price_orfao>  -u "<chave>:" -d active=false
3. curl.exe -s https://api.stripe.com/v1/products/<prod_orfao> -u "<chave>:" -d active=false
```

Sem o passo 1, o passo 2 é recusado:

```
This price cannot be archived because it is the default price of its product.
```

E isso **não é caso de exceção**: um produto com um preço só tem, sempre, esse
preço como `default_price`. Todo órfão criado "um produto por plano" cai aqui.

> ⚠️ A primeira versão deste arquivo mandava o contrário — *"preços antes dos
> produtos, porque a Stripe recusa arquivar produto com preço ativo"*. As duas
> metades estavam erradas: a recusa é na direção oposta, e arquivar o produto
> com preço ativo funciona sem reclamar. Eu tinha escrito um mecanismo plausível
> sem tê-lo executado. Ficou registrado porque o erro é instrutivo: **arquivar o
> produto "dá certo" e deixa o preço ativo para trás** — some da lista de
> produtos, continua na de preços, e a contagem do B é o que pega.

Depois repita a ferramenta **B** com `&active=true`: têm que sobrar
**exatamente dois** preços ativos, os dois do mesmo produto, e **um** produto
ativo. Confira também que o produto certo manteve seu `default_price` — o passo
1 só pode ter tocado nos órfãos.

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
elas devolvem não tem segredo dentro, e o `conferir-secret.sh` fecha o resto.

### 4.1 · ⚠️ Os meios de pagamento em live, que ninguém configurou ainda

`payment_method_types` ficou **de fora** do checkout de propósito — a Stripe
decide a partir do painel. Isso foi desenhado para Pix entrar sem tocar em
código, mas tem o outro lado: **o painel live decide sozinho, e ele não é o
painel de teste.**

A conta tem `boleto_payments: active`. Se o boleto estiver ligado no checkout
live, a mãe pode escolher boleto **para uma assinatura** — e aí:

- a assinatura nasce `incomplete` e só vira `active` quando o boleto for pago,
  dias depois;
- o acesso dela fica esperando um pagamento que pode nunca acontecer;
- e a comissão da afiliada só nasce no `invoice.paid`, ou seja, também dias
  depois — ou nunca.

Nada disso é defeito: é o boleto funcionando como boleto. Mas é uma decisão de
produto que **não pode ser tomada por omissão**.

**Decidido em 12/08/2026: só cartão.** Em live, abra Configurações → Pagamentos →
Métodos de pagamento e **desligue o boleto** — explicitamente, não por ele não
ter aparecido.

A decisão e os três lugares onde o boleto quebra o desenho estão no `PRODUTO.md`
§6, "em live, só cartão". O resumo operacional: oferecer boleto depois é
**mudança de fluxo, não uma caixinha** — precisa de estado "aguardando
pagamento" na tela da mãe, copy para ele, e uma decisão sobre o que a afiliada vê
enquanto isso.

**Conferir pelo servidor**, porque isto é configuração de painel:

```
curl.exe -s "https://api.stripe.com/v1/payment_method_configurations" -u "<chave live>:"
```

Confira que `boleto` está com `available: false` ou ausente, e `card` ativo.

---

## Passo 5 · Trocar os quatro secrets para os de live (🧑 você escreve, 🤖 eu confiro)

Os mesmos quatro nomes, os quatro valores novos. Redeploy de novo.

**No instante em que este passo termina, o sandbox e o modo teste param de
funcionar** — as entregas deles vão falhar na verificação de assinatura, porque
o `STRIPE_WEBHOOK_SECRET` agora é outro. Isso é desejado, e é a razão de o
ensaio vir antes.

**Conferir:** ferramenta **D**, com a régua já calibrada.

### ✅ Feito em 12/08/2026 — e o que foi conferido de qual jeito

Os quatro secrets gravados às `21:17:32–44Z`, redeploy às `21:25:19Z`
(`assinatura` v16, `stripe-webhook` v17). A ordem importa e está certa: o deploy
é 8 minutos depois do último `secrets set`, então as instâncias no ar nasceram
com o ambiente live.

| O quê | Como foi provado |
|---|---|
| Os quatro `updated_at` | `secrets list`, todos de minutos antes |
| Os dois `price_id` | digest SHA-256, e cruzados com a ferramenta B |
| `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` | **não conferidos por digest** — ver abaixo |
| Os quatro presentes na instância nova | prova de runtime nº 4 (400, não 500) |

**A conferência por digest dos dois secretos foi deliberadamente pulada**, e a
troca é defensável: o *Send test event* do painel live prova o
`STRIPE_WEBHOOK_SECRET` **melhor** que o digest, porque prova numa entrega real
assinada pela Stripe — e de quebra prova o `constructEventAsync`, que nenhuma
assinatura forjada distingue do `constructEvent`.

Escolha o tipo de evento **fora dos seis** (`payment_intent.succeeded` serve). A
verificação de assinatura roda **antes** do `EVENTOS.has`, então:

- **200 `ignorado`** = segredo certo, entrega real verificada, e **nada escrito
  no banco**;
- **400** = segredo errado, descoberto agora e não na primeira mãe pagante.

O que continua sem prova é o `STRIPE_API_KEY`, e ela é o passo 6: nenhuma
requisição daqui chega a tocar a Stripe.

### As provas de runtime, e por que são sete e não cinco

Rodadas contra o que está no ar, depois do redeploy. As três que carregam a prova:

- **`OPTIONS` de origem desconhecida → 204 SEM `Allow-Origin`.** Sem este
  controle, `*` passaria no caso de origem conhecida e a lista de origens não
  estaria provada.
- **`POST` com a anon key → `{"erro":"sem sessão"}`.** Sem `Authorization` o 401
  vem do gateway (`verify_jwt`), antes de a função existir — não prova nada sobre
  o código. Com a anon key o gateway libera e o corpo responde com o texto
  **dele**. É o `respondeuDeVerdade` aplicado a uma função.
- **Webhook sem `stripe-signature` → 400, não 500.** A checagem de ambiente vem
  antes da de assinatura, então 500 seria secret faltando ou vazio.

---

## Passo 6 · A primeira fatura em BRL, de verdade (🧑 você)

### ⏸️ PENDENTE POR DECISÃO — 12/08/2026. Não é esquecimento.

**Decidido: não assinar com cartão próprio para ensaiar.** O passo 6 fecha na
**primeira assinante real**.

O raciocínio, para quem ler isto sem o contexto do dia:

- o ciclo completo já foi provado **duas vezes hoje** — no sandbox e no modo
  teste da conta — e o **código é o mesmo**. Nada nas funções distingue live de
  teste: a diferença inteira mora nos quatro secrets;
- o que sobra sem prova é **uma** coisa: se o `whsec_` gravado é o do endpoint
  `ninna-live`, e não o de outro lugar;
- e essa falha tem **sintoma visível e conserto de um comando**, o que a torna
  aceitável de descobrir em produção.

Não foi possível provar antes porque **o envio de evento de teste não existe no
painel live** — procurado em quatro lugares (página do destino, menu de três
pontos, "Entregas de eventos" e a aba "Eventos" do Workbench). O menu de três
pontos oferece só *Desativar*, *Substituir segredo* e *Excluir*. Há a hipótese
de a Stripe não permitir evento fabricado em live por princípio, mas ela **não
foi confirmada** e não deve ser citada como se fosse.

### 🚨 O que fazer se a primeira entrega der 400

**Onde olhar, e quando:** a aba *Entregas de eventos* do `ninna-live`
(`/acct_1U3FlcB5ktEdfFnD/workbench/webhooks/we_1U3j5JB5ktEdfFnDeRhGDR0H/events`),
**nos minutos seguintes** à primeira assinatura. Hoje ela está em zero entregas,
então a primeira linha que aparecer é a que importa.

| O que aparece | O que significa |
|---|---|
| `customer.subscription.created` **200** | está tudo certo, e o passo 6 fechou |
| `customer.subscription.created` **400** | `whsec_` errado — corrigir agora |
| **nenhuma entrega** | não é o segredo: é o endpoint não assinado ou o Checkout não concluído |

O conserto, e ele é o de sempre:

```
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref hzjcimgutccsfrxuuhrl
npx supabase functions deploy stripe-webhook assinatura --project-ref hzjcimgutccsfrxuuhrl
```

Atenção ao **espaço antes de `--project-ref`** — sem ele o valor grava
corrompido e o comando ainda responde `Finished`. Confira por digest depois
(`.\scripts\conferir-secret.ps1 STRIPE_WEBHOOK_SECRET`).

**Depois de corrigir, reentregar:** a Stripe reentrega sozinha por até 3 dias,
mas não se espera por isso com uma mãe pagando. Na linha da entrega falhada há
*Reenviar*. Reentrega com o segredo certo grava a assinatura como se tivesse
chegado na hora — o `stripe-webhook` é idempotente por `ultimo_evento_em`.

### ⚠️ E o custo honesto dessa decisão, que é de produto e não técnico

Se o `whsec_` estiver errado, **uma mãe paga e não recebe acesso** até alguém
notar. A tela dela não trava — depois de 30 segundos ela lê:

> "A confirmação ainda não chegou. Se o pagamento saiu, a assinatura entra
> sozinha — pode fechar e voltar daqui a pouco."

E aqui está a parte que precisa estar escrita: **essa frase é uma promessa que
um `whsec_` errado transforma em mentira.** "Entra sozinha" pressupõe que a
reentrega da Stripe vai funcionar — e ela não vai, porque toda reentrega falha
na mesma verificação de assinatura. A copy que torna a falha suportável é a
mesma que a torna invisível: a mãe vai embora tranquila, e ninguém é avisado.

Por isso o "olhar nos minutos seguintes" acima não é zelo — é a única detecção
que existe. Não há alerta, não há e-mail, e o gráfico de "Malsucedidos" do
painel é semanal.

### O que olhar na fatura quando ela vier

O que nenhum passo anterior mostra:

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

**Desde 12/08/2026 o gatilho tem dono definido:** o passo 6 fecha na primeira
assinante real, não num ensaio com cartão próprio. Ou seja, este arquivo morre
quando a primeira entrega de `customer.subscription.created` voltar 200.

⚠️ **Uma parte dele precisa sobreviver, e não é onde está hoje.** O runbook do
400 no passo 6 vale *depois* de o roteiro morrer — ele descreve o que fazer
numa falha que só pode acontecer em produção, com uma mãe pagando. No dia de
apagar, **mova o runbook para o `PRODUTO.md` §7 antes**, e só então apague.

> Vencimento não é permissão para perder o que ainda serve. A regra 4 manda
> apagar o que descreve uma transição concluída — não o que descreve como
> consertar o estado que sobrou dela.

No dia, **apagar, não renomear.** O que sobrevive dele — os dois `acct_`, a
conferência do `enabled_events`, o corolário do sandbox — já está no
`PRODUTO.md` §7 e no `CLAUDE.md`, que são permanentes. O histórico do git basta
para o resto.

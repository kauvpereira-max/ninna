# Pacote da embaixadora — P7 / D18

Os três documentos que se entrega a uma embaixadora. É o **portão da E1**: nenhuma
mãe entra antes de o pacote existir (BETA.md §7.3-bis).

| Arquivo | O que é | Como chega até ela |
|---|---|---|
| `termo-participacao.md` | Termo de participação e consentimento | PDF, por WhatsApp, antes de qualquer cadastro |
| `roteiro-instalacao.md` | Uma página ensinando a instalar | PDF, junto com o link do app |
| `canal-feedback.md` | Convite do grupo + destino do botão | O convite vai como mensagem; o resto é interno |

## Antes de enviar — os dois bloqueios de banco

✅ **`002_cascade_exclusao.sql` aplicado e verificado em 06/08/2026** (§11.3): as 7
chaves em `CASCADE`, conferidas no catálogo. Era o que impedia o envio — o termo
promete exclusão total em até 2 dias, e sem a cascata o banco recusaria apagar
uma mãe que tenha bebê (erro 23503). Prometer uma via de saída que o banco recusa
é pior que não prometer nada: ela confia, pede, e a promessa falha exatamente no
momento em que importa. **O termo está liberado para envio.**

⛔ **O aceite do P7 segue incompleto até o `teste-rls-delete.mjs` passar (§11.4).**
Ele prova que a mãe A não apaga registro da mãe B. O termo promete que cada conta
enxerga só os próprios dados; esse teste é o que sustenta a frase. Segue
bloqueado pelo autoconfirm — o preflight exige "Confirm email" desligado em
`Authentication`.

Ordem prática: ~~roda o `002`~~ → **envia o termo → E1 entra**. O §11.4 não impede
a entrega, mas impede declarar o P7 fechado.

## A embaixadora não paga — e a cortesia é pela Stripe

O assistente é recurso pago (PRODUTO.md §5). A embaixadora precisa usá-lo
justamente para avaliá-lo, então ela entra com **assinatura cortesia**.

**Pela Stripe, nunca por exceção no código.** Um `if` que libera certas contas
cria um segundo caminho que ninguém testa — e o que ela usaria deixaria de ser o
que uma assinante usa, que é exatamente o que o piloto precisa observar.

Como fazer, no painel da Stripe:

1. **Products → Coupons → New**: 100% de desconto, duração *Forever*, nome
   `embaixadora`.
2. Peça a ela para assinar normalmente pelo app, escolhendo o plano.
3. No Checkout ela aplica o cupom — ou, mais simples, você cria a assinatura por
   ela em **Customers → (ela) → Create subscription**, com o cupom aplicado.

O caminho dela no app fica idêntico ao de uma assinante pagante: mesmo portão,
mesmo teto diário, mesmo Portal do Cliente para cancelar.

⚠️ **Ao encerrar a participação**, a cortesia é cancelada na Stripe — e isso vem
ANTES de apagar a conta, pela mesma razão do procedimento de exclusão
(`004_assinaturas.sql`): apagada a usuária, some o `stripe_customer_id` e fica
mais difícil achar o que cancelar.

## Campos a preencher

Estão marcados em `[MAIÚSCULAS ENTRE COLCHETES]` dentro dos arquivos:

- `[REGIÃO DO PROJETO]` — Supabase > Project Settings > General > Region
- `[SEU NOME]`, `[E-MAIL]`, `[WHATSAPP]`, `[SEU NÚMERO]`
- o link do app, no roteiro de instalação
- o número em `src/lib/contato.ts`, que é o destino do botão "Relatar problema"

Os blocos marcados como "apagar antes de gerar o PDF" são instruções para você, e
não podem chegar até ela.

## Registro do aceite — e por que ele não mora aqui

1. O termo vai como PDF **com versão e data no topo**. Não como mensagem solta,
   que se perde na rolagem.
2. Ela responde a frase fixa: *"Li o termo versão 1 e aceito participar do beta
   da Ninna."*
3. Você exporta a conversa (WhatsApp > conversa > Exportar conversa > Sem mídia)
   e guarda junto com uma cópia do PDF exato que ela recebeu. Print sozinho é
   frágil; o export traz data e hora.
4. Uma linha num arquivo de controle: nome, data do envio, data do aceite, versão
   aceita, onde está o export.

**O arquivo de controle e os exports ficam FORA deste repositório.** É nome de
pessoa e dado de terceiro, e commit feito não se desfaz — remover depois limpa a
árvore de trabalho e não o histórico, e agora existe remote. Mesma regra que
mantém o `.env` fora (§3.10). Aqui mora só o modelo; o aceite mora numa pasta
local com backup.

Mudou uma vírgula do termo depois de enviado? Vira **versão 2**, e o aceite é
recolhido de novo. É o que dá sentido à frase fixa.

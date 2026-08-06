# Pacote da embaixadora — P7 / D18

Os três documentos que se entrega a uma embaixadora. É o **portão da E1**: nenhuma
mãe entra antes de o pacote existir (BETA.md §7.3-bis).

| Arquivo | O que é | Como chega até ela |
|---|---|---|
| `termo-participacao.md` | Termo de participação e consentimento | PDF, por WhatsApp, antes de qualquer cadastro |
| `roteiro-instalacao.md` | Uma página ensinando a instalar | PDF, junto com o link do app |
| `canal-feedback.md` | Convite do grupo + destino do botão | O convite vai como mensagem; o resto é interno |

## Antes de enviar — dois bloqueios de banco

**O termo não pode ser enviado enquanto o `002_cascade_exclusao.sql` não tiver
rodado (§11.3).** Ele promete exclusão total em até 2 dias, e sem a cascata o
banco recusa apagar uma mãe que tenha bebê — erro 23503. Prometer uma via de
saída que o banco recusa é pior que não prometer nada: no primeiro caso ela
confia, pede, e a promessa falha exatamente no momento em que importa.

**O aceite do P7 fica incompleto até o `teste-rls-delete.mjs` passar (§11.4).**
Ele prova que a mãe A não apaga registro da mãe B. O termo promete que cada conta
enxerga só os próprios dados; esse teste é o que sustenta a frase. Segue
bloqueado pelo autoconfirm — o preflight exige "Confirm email" desligado em
`Authentication`.

Ordem prática: roda o `002` → envia o termo → E1 entra. O `11.4` não impede a
entrega, mas impede declarar o P7 fechado.

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

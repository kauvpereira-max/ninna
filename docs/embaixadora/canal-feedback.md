# Canal de feedback

Observabilidade aqui é humana, não ferramenta (BETA.md §3.7): uma conversa de
WhatsApp e um link na aba Mais acham mais bug que Sentry, e custam 1h em vez de
1 dia. É a mitigação do R6 — "bug de mãe real nunca chega até mim".

## ✅ Decidido em 13/08/2026: começa com UMA usuária

Não é a primeira de três a chegar — é uma, por escolha. O `PRODUTO.md` §8 já
apontava para isso: a E1 deixou de validar demanda e passou a ser **a única
fonte de histórico real**, que é o que destrava o backtesting da previsão e o que
testa o assistente ancorado contra perguntas que ninguém inventa de cabeça. Para
isso, uma basta — e uma que use todo dia vale mais que três que somem.

**O grupo volta quando houver três.** Esse é o gatilho, e ele é de número, não de
data: com duas ainda não há conversa, há duas conversas paralelas. O texto de
convite do grupo existia neste arquivo e foi apagado hoje — **está no histórico
do git**, que basta. Convite guardado "para quando der" é convite que alguém
manda antes da hora.

## Botão na aba Mais

Rótulo: **Relatar problema**. Destino:

```
https://wa.me/5511913309213?text=Oi!%20Encontrei%20um%20problema%20na%20Ninna%3A%20
```

O número mora em `src/lib/contato.ts`, num lugar só, e foi preenchido em
13/08/2026 — então o item **aparece** na aba Mais. Enquanto estava vazio ele
ficava escondido de propósito: link de WhatsApp quebrado na mão de uma mãe é pior
que item ausente, porque ela tenta, falha e conclui que não há canal.

## Por que o canal é privado — e por que isso ficou mais forte, não menos

O argumento original era de privacidade entre participantes: relato de bug vem
grudado no contexto ("registrei o sono da Liz às 3h e sumiu"), e mandar isso num
grupo publicaria a rotina do bebê dela para as outras mães.

Com uma usuária só, **não existe grupo para onde vazar** — e o desenho continua
valendo, por uma razão que estava embaixo da primeira o tempo todo:

> O privado é sobre o bebê dela. Sempre foi.

O grupo nunca foi o lugar certo para relato de bug; ele era o lugar certo para
conversa sobre o app. Quando os três voltarem a existir, essa separação volta
como está escrita aqui — o botão continua apontando para o privado, e o grupo
nasce ao lado dele, não no lugar dele.

## O que isso exige de você, que um grupo diluía

Com uma pessoa, **você é o canal inteiro**. Não há outra mãe para responder no
seu lugar às 23h, e não há volume que faça uma pergunta parecer menos importante.
A contrapartida está no roteiro de instalação, e vale repetir aqui: *"não tem
pergunta boba aqui — se ficou confuso pra você, está confuso mesmo"*. Isso só é
verdade se a resposta vier.

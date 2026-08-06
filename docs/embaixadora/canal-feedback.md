# Canal de feedback

Observabilidade aqui é humana, não ferramenta (BETA.md §3.7): com três mães, um
grupo de WhatsApp e um link na aba Mais acham mais bug que Sentry, e custam 1h em
vez de 1 dia. É a mitigação do R6 — "bug de mãe real nunca chega até mim".

## Botão na aba Mais

Rótulo: **Relatar problema**. Destino:

```
https://wa.me/55[SEUNUMERO]?text=Oi!%20Encontrei%20um%20problema%20na%20Ninna%3A%20
```

O número mora em `src/lib/contato.ts`, num lugar só. Enquanto ele estiver vazio o
item não aparece na tela — link de WhatsApp quebrado na mão de uma mãe é pior que
item ausente, porque ela tenta, falha e conclui que não há canal.

### Por que ele aponta pro privado, e não pro grupo

Relato de bug vem grudado no contexto: "registrei o sono da Liz às 3h e sumiu".
Mandar isso pro grupo publica a rotina do bebê dela para as outras duas mães. O
grupo é sobre o app; o privado é sobre o bebê dela.

## Texto do convite para o grupo

> **Grupo da Ninna** 💛
>
> Aqui é onde a gente conversa sobre o app enquanto ele está sendo feito: o que
> travou, o que ficou confuso, o que faltou, o que te irritou. Pode mandar print,
> áudio, reclamação e ideia solta — tudo serve, inclusive "achei feio".
>
> Duas combinações:
>
> Se for alguma coisa sobre o seu bebê que você prefira não dividir com as outras
> mães, me manda no privado. O grupo é sobre o app, não sobre a rotina de
> ninguém.
>
> E não existe hora certa. Se eu demorar pra responder, insiste sem dó.

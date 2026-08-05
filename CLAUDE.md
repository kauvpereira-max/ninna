@AGENTS.md

# Ninna — contexto do projeto

App de acompanhamento de rotina de bebê pra mães de primeira viagem, com motor de
personalização (calcula padrão de sono/mamada por bebê específico, não médias
genéricas). Concorrente de referência: Blumy.

## ⚠️ O projeto está em beta fechado de 21 dias — leia `BETA.md` primeiro

`BETA.md` tem **precedência sobre este arquivo** enquanto o beta durar. Ele trava
o escopo, e o escopo travado é a principal defesa do prazo.

Em particular, o que está listado abaixo em "Próximos passos sugeridos" **não é
mais a fila de trabalho** — os 14 tipos de registro restantes estão explicitamente
fora do beta. Ideia nova vai pra seção "Depois do beta" do `BETA.md`, não pro
código.

## Onde está a fonte da verdade

- Design system completo: `src/theme/tokens.ts` (cores, tipografia, espaçamento —
  já traduzido do documento de design em Markdown)
- Fontes da marca: Fredoka (títulos) e Nunito Sans (corpo), já em `assets/fonts/`
  como instâncias estáticas (Regular/Medium/SemiBold/Bold)

## Decisões já tomadas — não reabrir sem necessidade

- 20 tipos de registro (não 18 — contagem corrigida): Amamentação, Mamadeira,
  Fralda, Sono, Banho, Comida, Hidratação, Extração, Medicação, Vitamina,
  Sintoma, Humor, Peso, Altura, Circunferência, Atividade, Passeio, Leitura,
  Vacina, Habilidade
- Paleta de vigilância (coral/superfície escura) é EXCLUSIVA do card de
  monitoramento e alertas — nunca usar em botão comum ou onboarding
- Ícone da Ninna na tab bar é do MESMO tamanho que os outros itens — nunca
  botão flutuante elevado com position absolute (bug já corrigido antes)
- Stripe puro não serve pra assinatura dentro do app iOS — usar RevenueCat
- Tom de voz: acolhedor, nunca clínico, nunca compara bebês, nunca usa culpa

## Status atual

Setup + navegação prontos. Autenticação por e-mail/senha completa e testada.

Schema SQL em `supabase/migrations/001_schema_inicial.sql`: 5 tabelas de
registro (feeding_records — cobre amamentação E mamadeira via coluna `type` —,
sleep_records, diaper_records, mood_records, symptom_records) + babies +
baby_patterns (ainda vazio; motor de personalização é fase futura). RLS em
todas as tabelas — acesso restrito ao dono via join com babies.

**Cadastro do bebê pronto.** O app já escreve na tabela `babies`:

- `app/(onboarding)/cadastro-bebe.tsx` — nome, nascimento, sexo (opcional),
  prematuridade + semanas, peso/altura ao nascer (opcionais)
- `src/contexts/BabyContext.tsx` — bebê ativo, carga por sessão, cadastro;
  fica DENTRO do AuthProvider e limpa o estado no logout
- `src/lib/babies.ts`, `src/lib/idade.ts`, `src/types/database.ts`,
  `src/components/ChipGroup.tsx`
- `app/(tabs)/index.tsx` lê o bebê real (nome, idade, idade corrigida)

Roteamento em 3 vias no `app/_layout.tsx`: sem sessão → `(auth)`; com sessão e
sem bebê → `(onboarding)`; com os dois → `(tabs)`.

Verificado: `tsc --noEmit` e `npx expo export --platform web` passam. O insert
com RLS manda `user_id` explícito, que a policy `with check` de `babies` exige.

**6 registros centrais prontos** (Amamentar, Mamadeira, Fralda, Sono, Humor,
Sintoma):

- `app/registro/[tipo].tsx` — rota única com os 4 formulários, apresentada como
  modal (`presentation: 'modal'` no Stack raiz). Registrar é ação de segundos:
  entra por cima da Home e sai no gesto de arrastar pra baixo
- `src/lib/registros.ts` — escrita nas 5 tabelas + `listarRegistrosRecentes`,
  que normaliza feeding/sleep/diaper/mood/symptom numa lista só. Sem `user_id`
  no insert: nessas tabelas a RLS é `for all using (...)` via join com `babies`.
  Também guarda o vocabulário fechado (`HUMORES`, `MOTIVOS_HUMOR`, `SINTOMAS`,
  `INTENSIDADES`): a mãe toca rótulo PT-BR, o banco recebe slug
- `src/lib/horario.ts` — máscara `HH:MM` e formatação de duração/momento
- `src/hooks/useRegistrosRecentes.ts` — `useFocusEffect` recarrega a lista
  quando o modal fecha (é o que faz o registro aparecer na Home)
- `src/hooks/useAgoraTick.ts` — relógio local de 30s, criado só quando há sono
  aberto; é o que faz "Dormindo há 40 min" andar sem recarregar a lista
- Sono grava em andamento (`ended_at` null) e a Home oferece "Encerrar";
  `iniciarSono` recusa abrir um segundo sono com outro ainda correndo
- Home limitada a 480px de largura, centralizada, com os 6 atalhos em grid de
  3 por linha (`flexWrap`) — sem isso a web esticava tudo de ponta a ponta

**Seletor de bebê pronto**, com o bebê ativo persistido:

- `app/bebes/index.tsx` — lista da conta (avatar, nome, idade), ativo marcado,
  e "Cadastrar outro bebê" no fim. Rota modal, mesmo padrão do registro
- `app/bebes/novo.tsx` — reusa `(onboarding)/cadastro-bebe` via prop
  `contexto="adicional"`. Precisa estar FORA do grupo `(onboarding)`: o
  RootNavigator devolve pras tabs quem entra lá já tendo bebê ativo
- O header da Home só vira tocável a partir de 2 bebês — com um só não há
  chevron nem alvo de toque
- `src/lib/preferencias.ts` — AsyncStorage do bebê ativo (`ninna.bebeAtivo`).
  Nenhuma função joga exceção: preferência é conforto, não derruba tela
- `BabyContext` resolve lista e preferência no mesmo `Promise.all` e só larga
  `loading` depois das duas — a mãe não pode ver o nome de um filho piscar e
  trocar pelo do outro. Id salvo que não existe mais cai no `data[0]` e a
  chave é limpa, sem erro na tela. `signOut` limpa a chave

## Convenções que nasceram nessa fase

- Data de nascimento é campo com máscara `DD/MM/AAAA`, não date picker nativo —
  `@react-native-community/datetimepicker` quebraria o `expo export --platform
  web`, que é como o projeto valida build
- `sex` é nullable: nunca usar artigo de gênero em texto sobre o bebê
  ("a rotina de Liz", nunca "d{a/o} Liz")
- `src/types/database.ts` é escrito à mão (CLI do Supabase não configurado) —
  ao mexer numa migration, atualizar o tipo junto
- Horário também é máscara (`HH:MM`), mesma razão da data. Hora que ainda não
  chegou é lida como ontem — a mãe registra a mamada das 23:50 às 00:10
- **Rótulo de estado do bebê é SUBSTANTIVO, nunca adjetivo flexionado**:
  "Agitação", nunca "agitado(a)"; "Incômodo", nunca "irritada". Mesma raiz da
  regra do `sex` nullable — o app não sabe o gênero e não deve escolher um.
  Vale pra humor e pra qualquer estado futuro (fome, dor, disposição)
- **Coluna sem check não é convite a texto livre**: `symptom` aceita qualquer
  string no banco, mas o app só grava slug da lista `SINTOMAS`. Descrição da
  mãe vai em `notes`, com `symptom = 'other'`. Dado agregável é requisito do
  motor de personalização — sem isso não dá pra cruzar sintoma com padrão
- Slug aposentado da lista de chips continua com rótulo em
  `SINTOMAS_APOSENTADOS` (caso de `irritability`, que virou humor): o banco não
  é reescrito, então registro antigo tem que seguir legível

## Copy de saúde — regras travadas

Ao salvar QUALQUER sintoma, o app mostra uma linha e devolve a decisão pra mãe.
Texto atual em `app/registro/[tipo].tsx` (tela de confirmação):

> Anotado. Se você estiver preocupada com isso, confie no seu instinto e fale
> com o pediatra — o Ninna acompanha, mas quem examina é ele.

O que essa copy **nunca** faz — vale pra qualquer texto de saúde que venha depois:

- Nunca avalia gravidade e nunca sugere urgência ("procure agora", "corra")
- Nunca lista sinal de alarme, nunca cita temperatura, número ou faixa
- Nunca diz "provavelmente não é nada" nem "isso é normal"
- Não diagnostica, não tranquiliza e não alarma: registra, e quem decide é a mãe

## Próximos passos sugeridos

1. Motor de personalização (Edge Function calculando baby_patterns) — é o que
   troca o texto placeholder do card "A ROTINA DE {NOME}" por padrão de verdade
2. Os 14 tipos de registro restantes — a partir daí `registro/[tipo].tsx`
   pede quebra por tipo, a cadeia condicional não escala até 20
3. Editar e apagar registro (hoje só dá pra criar, e encerrar sono)

## Dívidas conhecidas

- `typography.caption` em `tokens.ts` pede Medium (500), mas
  `NunitoSans-Medium.ttf` não está em `assets/fonts/` — está em Regular como
  paliativo. Corrigir de verdade = adicionar o arquivo da fonte.
- `tokens.ts` cita `src/theme/fonts.ts`, que não existe (fontes carregam no
  `app/_layout.tsx`)
- ~~Escritas nunca exercitadas contra o Supabase real~~ — **resolvido**.
  Amamentação, mamadeira, fralda e sono foram salvos e voltaram na lista, e o
  botão Encerrar fechou um sono aberto. Isso cobre os três caminhos de RLS:
  `insert` e `select` pelas policies `for all using (...)` via join com
  `babies`, e `update` (que reaproveita o mesmo `using` como `with check`).
  Humor e sintoma usam a policy idêntica, então herdam a confirmação —
  mas ainda não foram salvos de verdade nenhuma vez

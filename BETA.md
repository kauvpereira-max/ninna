# Ninna — Beta das Embaixadoras Fundadoras

**Prazo: 21 dias. Escopo travado no D1. Este documento tem precedência sobre
qualquer ideia que apareça no meio do caminho.**

Objetivo único do beta: uma mãe abre a Ninna, cria conta, cadastra o bebê,
registra a rotina por alguns dias e **recebe um insight verdadeiro sobre o
próprio bebê**. Nada além disso é requisito.

Não é objetivo: publicar em loja, cobrir os 20 tipos de registro, ter app
nativo, ter push, ter assinatura.

---

## 1. Escopo — o que ENTRA

| # | Item | Estado no D1 |
|---|---|---|
| 1 | Autenticação e-mail/senha | pronto |
| 2 | Cadastro da mãe (nome) | a fazer — D2 |
| 3 | Cadastro do bebê | pronto |
| 4 | Home | pronta, falta o card de insight real |
| 5 | Registro de amamentação | pronto |
| 6 | Registro de mamadeira | pronto |
| 7 | Registro de sono (+ em andamento) | pronto |
| 8 | Registro de fralda | pronto |
| 9 | Histórico dos registros | a fazer — D5–D7 |
| 10 | Motor de personalização (3 métricas) | a fazer — D8–D9 |
| 11 | Card de insight na Home | a fazer — D10 |
| 12 | Supabase configurado | pronto (5 tabelas + RLS) |
| 13 | Interface próxima ao protótipo | parcial — D11–D13 |
| 14 | Recuperar senha | a fazer — D3 |
| 15 | Apagar registro | a fazer — D4 |
| 16 | PWA instalável de verdade | a fazer — D16–D17 |
| 17 | Termo LGPD com via de saída | a fazer — D18 |

Os itens 14 a 17 não estavam no pedido original e foram incluídos por decisão
técnica. A justificativa de cada um está em §3.

**Bônus já construído, mantido sem custo:** registro de humor, registro de
sintoma, múltiplos bebês com seletor, idade corrigida para prematuros.
Remover daria trabalho; manter é grátis.

## 2. Escopo — o que NÃO entra

Assinaturas · RevenueCat · Stripe · publicação em lojas · notificações push ·
vacina · habilidade · medicação · vitamina · introdução alimentar · extração ·
banho · peso/altura/perímetro · atividade · passeio · leitura · hidratação ·
relatórios e gráficos · compartilhamento entre cuidadores · animações
complexas · edição de registro · modo offline · chat da Ninna.

**Regra de congelamento:** toda ideia nova vai para §9 ("Depois do beta").
Nenhuma entra no escopo dos 21 dias. Sem exceção, sem discussão de mérito.

---

## 3. Decisões de arquitetura (travadas)

### 3.1 Distribuição: PWA instalada, canal único
Build web estático → Vercel → a mãe instala pela tela de início.

Sem loja, sem Apple Developer Program, sem EAS. O alvo web já é como este
projeto valida build desde a fase 1, então é o caminho com menos risco novo.

**"Instalada" é requisito funcional, não recomendação.** No iOS, site aberto no
Safari sem "Adicionar à Tela de Início" tem o storage limpo pelo sistema em
torno de 7 dias de inatividade. A mãe é deslogada, perde o acesso e conclui que
o app quebrou — no exato momento em que o motor finalmente teria dados para dar
um insight. PWA instalada não sofre essa limpeza.

Consequência prática: o app precisa **conduzir** a instalação, não torcer por
ela (banner no primeiro acesso via Safari, D16), e o fluxo de instalação
precisa ser testado em iPhone real, não só o carregamento da página (D17).

### 3.2 Motor no cliente, não em Edge Function
`src/lib/padroes.ts` é função pura: recebe registros, devolve três números.

Edge Function traria Deno, deploy separado, secrets e um segundo ambiente para
depurar às 2h da manhã. O ganho seria performance sobre milhares de registros —
o volume real é ~40 registros por bebê por semana.

A tabela `baby_patterns` fica no banco **sem uso** no beta. Quando o volume
justificar, o motor migra para lá sem reescrever a matemática.

### 3.3 As três métricas
Janela móvel de 7 dias, sempre em **hora local do dispositivo** (nunca UTC —
"horário médio da soneca" é conceito de hora local).

1. **Intervalo médio entre mamadas** — diferenças entre `started_at`
   consecutivos de `feeding_records`.
2. **Duração média da soneca** — só sonecas.
3. **Horário médio da soneca** — **média circular**, não aritmética.

**Média circular é obrigatória.** Hora do dia é um círculo: sonecas às 23h e à
1h têm média 0h, não 12h. A média ingênua diria "a soneca de Liz costuma ser ao
meio-dia" para um bebê que dorme à meia-noite — erro que destrói a confiança na
primeira semana.

**Soneca e noite são separadas.** Sono iniciado entre 19h e 6h = noite; o resto
= soneca. Misturar uma noite de 9h com sonecas de 40min produz "média de 3h20",
que não descreve nenhum sono que aquele bebê teve. As três métricas usam
apenas sonecas.

**Limiar de confiança: mínimo de 5 registros da métrica na janela.** Abaixo
disso o card mostra a frase de aprendizado e **nenhum número**. Silêncio honesto
é infinitamente melhor que número errado — mesmo princípio da copy de saúde.

### 3.4 Cadastro da mãe sem tabela nova
Campo "Como você quer ser chamada?" no signup → `user_metadata` do Supabase
Auth. Zero migration, zero rota nova, zero ramo novo no `RootNavigator`.

Uma tabela `profiles` exigiria trigger de criação, RLS própria e uma quarta via
de roteamento (sem sessão → sem perfil → sem bebê → tabs). Dois dias e um ponto
de falha, para guardar um campo de texto. Migra quando o perfil tiver mais de
três campos.

### 3.5 Zero dependências novas de produção
Este projeto já teve `@react-native-community/datetimepicker` quebrar o
`expo export --platform web`. Cada pacote novo é risco de matar o único canal
de distribuição do beta.

Nada de `date-fns` (`horario.ts` e `idade.ts` já resolvem), nada de biblioteca
de gráfico (o beta não tem gráfico — insight é frase), nada de Sentry
(substituído por canal humano, §3.7).

### 3.6 Apagar registro e recuperar senha entram
- **Apagar** (~4h): sem isso, a mãe que digitou 350ml em vez de 35ml convive
  com o erro para sempre — e o motor calcula em cima do lixo. É proteção do
  produto principal, não conveniência.
- **Recuperar senha** (~3h): embaixadora que esquece a senha no dia 3 está fora
  do piloto permanentemente. É o bug mais caro e mais barato de evitar.

### 3.7 Observabilidade é humana, não ferramenta
Com 3 embaixadoras, um grupo de WhatsApp + link "Relatar problema" na aba Mais
detecta mais bugs que Sentry, e custa 1h em vez de 1 dia.

### 3.8 Confirmação de e-mail DESLIGADA no beta
Chave no painel do Supabase Auth, não no código.

As três embaixadoras são conhecidas pessoalmente do fundador — não há identidade
a verificar. O que existe é um passo extra entre "quero conhecer" e "estou
usando", e esse passo é ponto de abandono no primeiro contato, justamente com
quem já topou ajudar.

**Isto não dispensa o Resend.** O reset de senha continua dependendo de entrega
de e-mail, então o SMTP próprio segue como pré-requisito do D3 — só deixou de
ser pré-requisito do D2, que é o que permite os dois correrem em paralelo
enquanto o DNS propaga.

**Rever antes de qualquer abertura pública.** Cadastro aberto sem confirmação
aceita e-mail de terceiro e e-mail inexistente — a segunda mãe não é conhecida
pessoalmente. O código não assume a chave desligada: `signUp` devolve
`precisaConfirmarEmail` a partir de ter vindo sessão ou não, e a tela se adapta.
Religar a confirmação no painel não exige mudar código.

### 3.9 Exceção consciente ao escopo do D1: `loadFonts`
Corrigido no D2, fora da fila, com justificativa registrada.

O `loadFonts` do `app/_layout.tsx` não tinha `try/catch`: uma fonte que falhasse
no download deixava `setFontsLoaded(true)` sem rodar, a splash sem sair, e a mãe
numa **tela branca permanente**. Estava agendado para o D14 como acabamento.

A reclassificação está certa e a regra que ela cria vale para o resto do beta:
**falha silenciosa que a usuária não consegue relatar não é acabamento, é
prioridade.** Ela não abre chamado dizendo "a splash não saiu" — ela desinstala,
e o beta perde uma das três embaixadoras sem nunca saber por quê.

Agora o carregamento tem `try/catch/finally`, e o `finally` garante que a splash
sai sempre. Fonte que falha degrada para a fonte de sistema: o app fica menos
bonito e continua inteiro, porque tamanho, peso e espaçamento vêm dos tokens,
não da família da fonte.

---

## 4. Arquitetura

```
APP  Expo SDK 54 · expo-router · React Native Web
  telas       app/
  estado      AuthContext → BabyContext (aninhado)
  dados       src/lib/*.ts — funções que nunca lançam, devolvem { data, error }
  motor       src/lib/padroes.ts — único módulo novo de lógica

SUPABASE  plano free
  Auth: e-mail/senha + user_metadata.nome
  Postgres: 7 tabelas, RLS em todas

DISTRIBUIÇÃO  expo export --platform web → Vercel → PWA instalada
```

Fluxo do motor:

```
Home monta
  → carrega 7 dias de feeding + sleep do bebê ativo
  → calcularPadroes(registros)          função pura, síncrona, testável isolada
      ├─ intervaloMedioMamadas()
      ├─ duracaoMediaSoneca()           só sonecas
      └─ horarioMedioSoneca()           média circular
  → { valor, confianca } por métrica
  → confiança < 5 registros?  card mostra "ainda estou conhecendo"
  → confiança ok?             card mostra o insight
```

## 5. Telas (12 rotas)

| Rota | Estado |
|---|---|
| `(auth)/login` | pronta |
| `(auth)/signup` | + campo nome (D2) |
| `(auth)/recuperar-senha` | **nova** (D3) |
| `(onboarding)/cadastro-bebe` | pronta |
| `(tabs)/index` — Home | + card de insight (D10) |
| `(tabs)/rotina` — Histórico | **reescrever** (D6–D7) |
| `(tabs)/mais` | + nome, sobre, feedback, sair (D2/D18) |
| `registro/[tipo]` modal, 6 tipos | + apagar (D4) |
| `bebes/index` modal | pronta |
| `bebes/novo` modal | pronta |

Removidas no D1: `(tabs)/ninna`, `(tabs)/insights`, `(tabs)/evolucao`.

## 6. Banco — uma migration, descoberta no D4

O planejamento dizia "nenhuma migration nova". **Estava errado**, e o D4 mostrou
por quê: nenhuma das 7 chaves estrangeiras do `001` declarou `on delete`, então
todas ficaram em `no action`.

Consequência: apagar uma mãe em `Authentication > Users` **falha com erro 23503**
enquanto ela tiver bebê, e apagar um bebê falha enquanto tiver registro. A via de
saída que o termo LGPD promete simplesmente não funcionava — e o item 13 da
checklist (§8) não teria como passar.

`002_cascade_exclusao.sql` põe `on delete cascade` nas 7. Seguro rodar agora: só
troca a regra de integridade, não toca em nenhuma linha, e ainda não há mãe real
no banco. **Precisa ser rodado no SQL Editor** — ver §11.3.

Fora isso, `001` cobre o resto do beta.

```
babies            usar
feeding_records   usar    breast + bottle via coluna type
sleep_records     usar    ended_at null = em andamento
diaper_records    usar
mood_records      usar
symptom_records   usar
baby_patterns     existe, NÃO usar no beta (motor é client-side)
auth.users        user_metadata.nome ← cadastro da mãe
```

Os índices `(baby_id, started_at desc)` já existem e são exatamente os que o
motor e o histórico precisam. A regra segue valendo para o resto do beta:
migration em produção com mães reais dentro é a operação mais arriscada do
projeto, e a hora de fazer a do `002` é agora, antes do piloto.

---

## 7. Cronograma

### D1 — Poda e escopo travado ✅ FEITO
Repositório git criado (não havia — 21 dias sem undo era risco inaceitável
antes de apagar arquivos). Tab bar 6→3. Telas placeholder removidas. Quatro
dependências mortas removidas. `.env` fora do versionamento. Este documento.
**Ao final:** nenhuma tela diz "não implementada"; `tsc` e export web passam.

### D2 — Cadastro da mãe ✅ FEITO
Campo "Como você quer ser chamada?" no signup → `user_metadata.nome`, exposto
pelo contexto como `nomeMae`. Home cumprimenta pelo nome; aba Mais virou cartão
de conta com nome e e-mail. Signup não mostra mais a tela intermediária quando
a confirmação está desligada (§3.8) — a mãe vai direto para o cadastro do bebê.
Fora da fila: `loadFonts` corrigido (§3.9).
**Ao final:** conta nova nasce com nome e a Home diz "Oi, Marina". ✅

Conta criada antes do D2 não tem a chave em `user_metadata`. O código trata isso
em vez de assumir: `nomeMae` é nullable, a saudação **some** em vez de virar
"Oi," pendurado, e o cartão da aba Mais cai para o e-mail como identidade.

### D3 — Recuperar senha + erros em português
Fluxo de reset com redirect. Traduzir mensagens do Supabase (hoje voltam em
inglês: *"Invalid login credentials"*).
**Ao final:** reset testado ponta a ponta **num Gmail que não é o meu**, com
confirmação de que chegou na caixa de entrada e não em spam.
**Este dia não fecha sem o remetente resolvido (§8/R2).**

### D4 — Apagar registro + fechar dívida de humor/sintoma ✅ CÓDIGO FEITO
Caminho principal é **tocar no registro → tela de detalhe → botão "Apagar"
visível**, não long-press. O canal é PWA web: no Safari do iPhone o toque longo
dispara o callout do sistema e a seleção de texto antes de qualquer handler, e no
desktop o gesto não existe. Long-press ficou como atalho secundário para o mesmo
destino, com `user-select` e `-webkit-touch-callout` desligados no item.

Confirmação é inline, em duas etapas na própria tela — não `Alert.alert` (o
react-native-web não implementa com dois botões) e não `window.confirm` (trava a
página inteira).

Hard delete, sem `deleted_at`: soft delete complicaria a promessa de exclusão do
termo LGPD sem dar nada em troca no beta.

**Pendente de execução sua:** rodar o `002` (§11.3), rodar o script de RLS
(§11.4) e salvar humor e sintoma pelo app contra o banco real.

### D5 — Camada de leitura do histórico ✅ CÓDIGO FEITO
`listarRegistros(babyId, { desde, limite, cursor, tipos })` devolve uma página da
lista unificada. `listarRegistrosRecentes` **manteve a assinatura** e virou um
wrapper de duas linhas em cima dela — a Home não mudou de código nem de
comportamento.

**Paginação por cursor `(ocorridoEm, id)`, nunca offset.** Com offset, um
registro novo entrando no topo enquanto a mãe pagina empurra tudo uma casa e a
página seguinte repete ou pula item — e registro entrando no topo é o caso normal
aqui, ela pagina o histórico enquanto amamenta e salva a mamada no meio.

O `id` desempata porque colisão de instante é **comum, não teórica**: a máscara
HH:MM zera os segundos, então fralda e humor salvos no mesmo minuto caem no mesmo
timestamp.

**Uma janela, cinco tabelas.** Cada tabela devolve `limite + 1` linhas atrás do
cursor; a união contém com certeza as `limite` mais recentes do todo (merge de k
listas ordenadas). Cinco cursores independentes andariam em velocidades
diferentes e "carregar mais" traria janelas desalinhadas por tipo — sono de terça
ao lado de mamada de domingo. O `+1` também responde `temMais` sem consulta
extra.

A lógica pura saiu para `src/lib/paginacao.ts`, sem Supabase e sem React Native,
para poder rodar fora do Expo — ver §12.

**Pendente de execução sua:** preencher `SEMEAR_*` no `.env` e semear a massa.

### D6 — Tela Rotina v1
Lista agrupada por dia, cabeçalho "Hoje" / "Ontem" / "3 de agosto", item com
ícone, rótulo, hora e duração.
**Ao final:** a aba Rotina mostra os registros reais agrupados por dia.

### D7 — Tela Rotina v2
Filtros por tipo, "carregar mais", pull-to-refresh, estados vazio/erro/carregando.
**Ao final:** filtrar por "Sono" mostra só sono; histórico navegável ponta a ponta.

### D8 — Motor: matemática pura, sem UI ⚠️ dia pesado
`padroes.ts` com as 3 métricas, separação soneca/noite, média circular e
limiares. Validado contra dados sintéticos.
**Ao final:** dado um array de registros, saem 3 números **conferidos à mão na
calculadora**.

### D9 — Motor ligado ao app ⚠️ dia pesado
`usePadroes` lê 7 dias e calcula. Testar com o relógio do celular em outro fuso.
**Ao final:** os padrões reais do bebê de teste aparecem corretos na tela.

### D10 — Card de insight na Home ⚠️ dia pesado
`copyInsight.ts`: número → frase acolhedora. Variações por métrica e faixa de
confiança + estado "ainda aprendendo". Revisão de tom.
**Ao final:** conta com 8 registros vê insight verdadeiro; conta com 2 vê a
frase de aprendizado. **Este é o dia que define se o beta tem valor.**

### D11–D13 — Interface conforme protótipo
D11 Home · D12 modais de registro · D13 histórico, auth e onboarding.
**Ao final do D13:** nenhuma tela parece de desenvolvedor.

### D14 — Bordas e robustez
Estados vazios, erro de rede com "tentar de novo" **preservando o formulário**,
alvos de toque ≥44px, `accessibilityLabel`, tela de 360px.
(O `try/catch` das fontes saiu daqui — foi antecipado para o D2, ver §3.9.)

### D15 — Bateria manual roteirizada ⚠️ dia pesado
Roteiro de ~30 passos: conta nova → mãe → bebê → 7 dias de registros → insight →
apagar → sair → entrar. Duas contas, dois bebês. Corrigir o que quebrar.
**Ao final:** o roteiro passa inteiro sem intervenção.

### D16 — PWA de verdade + deploy
`public/manifest.json` (`display: standalone`, ícones 180/192/512, theme e
background color, `start_url`), `app/+html.tsx` para injetar `<link
rel="manifest">`, `apple-touch-icon`, `apple-mobile-web-app-capable` e
`viewport-fit=cover`. Banner in-app no primeiro acesso via Safari orientando a
instalação. `vercel.json` com rewrite para SPA. Deploy.
**Ao final:** URL pública que instala como app no seu iPhone.

### D17 — Dispositivo real
iPhone/Safari e Android/Chrome, em aparelho que não é o de desenvolvimento.
Testar o **fluxo de instalação**, não só o carregamento: instalar pela tela de
início, abrir pelo ícone, confirmar que abre sem a barra do Safari.
Safe area, teclado cobrindo campo, scroll, rotação.

### D18 — Pacote da embaixadora (LGPD)
Termo curto e honesto, contendo obrigatoriamente:
- quais dados são coletados e onde ficam (Supabase, região do projeto);
- como pedir exclusão total — canal e prazo de resposta — mesmo que a execução
  seja manual no painel;
- o que acontece ao fim do piloto: **dados apagados por padrão**, salvo opção
  explícita dela por continuar.

Mais: canal de feedback (grupo WhatsApp + link na aba Mais) e roteiro de 1
página de instalação.

### D19–D20 — Reserva
Não são dias livres. São os dias que algo do D1–D18 vai consumir.

### D21 — Piloto com 3 embaixadoras, não 20
Três mães acompanhadas de perto no primeiro cadastro. Se as três chegarem ao
insight, abre para o resto.

---

## 8. Critério de saída — checklist binária

**O beta está pronto quando os 14 itens abaixo passam, na URL de produção, num
celular que não é o de desenvolvimento.** Não é avaliação, é checklist.

### Fluxo completo
1. Crio conta com e-mail real, informo meu nome, e caio **direto** no cadastro do
   bebê — sem passo intermediário de confirmação (§3.8).
2. Esqueço a senha, recupero por e-mail e entro de novo — **e o e-mail chegou na
   caixa de entrada de um Gmail que não é o meu, não em spam.**
3. Cadastro um bebê e chego na Home com nome e idade corretos.
4. Registro amamentação, mamadeira, sono e fralda — os quatro aparecem na Home
   em segundos.
5. Inicio um sono, saio do app, volto, e "Dormindo há X min" está certo; encerro
   e vira duração.
6. Abro Rotina e vejo tudo agrupado por dia, com filtro por tipo funcionando.
7. Apago um registro; ele some da lista e do banco.

### O motor — o que justifica o beta existir
8. Com **menos** de 5 mamadas registradas, a Home mostra a frase de aprendizado
   e **nenhum número**.
9. Com 7 dias de registros, o card mostra ao menos um insight cujo número eu
   **conferi manualmente** contra os dados brutos.
10. O horário médio de soneca é plausível — uma soneca às 23h e outra à 1h dão
    ~0h, não ~12h — e o sono noturno **não** entra na média de soneca.

### Distribuição e permanência
11. Instalei pela tela de início do iPhone, o app abre pelo ícone **sem a barra
    do Safari**, e ao voltar dias depois **continuo logada**.

### Segurança e dados
12. Entro com a conta B e **não** vejo nenhum dado da conta A — RLS testada com
    duas contas reais, não com uma.
13. Executei uma exclusão completa de uma conta de teste, ponta a ponta, e
    **confirmei no banco que não sobrou nenhum registro**.
14. Fecho o app, volto no dia seguinte, continuo logada, e tudo que registrei
    está lá.

> **Se o item 9, 11, 12 ou 13 falhar, o beta não sai** — mesmo que os outros 10
> passem. O 9 erra o produto, o 11 mata o acesso em uma semana, e o 12 e o 13
> erram a privacidade de dados de saúde de bebês.

---

## 9. Riscos

| # | Risco | Mitigação | Dia |
|---|---|---|---|
| R1 | Mãe não instala a PWA e é deslogada pelo iOS em ~7 dias | Banner in-app conduzindo a instalação + item 11 da checklist | D16–D17 |
| R2 | **E-mail transacional cai em spam** — derruba o reset de senha | Resend com domínio próprio da Ninna, decidido no D1. Confirmação de signup desligada (§3.8), então só o reset depende de entrega. D3 não fecha sem o SMTP configurado | D1/D3 |
| R3 | Insight sair errado — perde a embaixadora e a credibilidade | Média circular, soneca≠noite, limiar de 5 registros | D8–D10 |
| R4 | Fuso horário desanda o horário médio | Hora local sempre, nunca UTC; testar com relógio em outro fuso | D9 |
| R5 | LGPD sem via de saída para dado sensível de bebê | Termo com canal e prazo de exclusão + item 13 | D18 |
| R6 | Bug de mãe real nunca chega até mim | Grupo WhatsApp + link "Relatar problema" | D18 |
| R7 | ~~Tela branca permanente se uma fonte falhar ao carregar~~ | **Resolvido no D2** — `try/catch/finally` no `loadFonts` (§3.9) | ✅ D2 |
| R8 | Sem modo offline: registro perdido no quarto com Wi-Fi fraco | Formulário preservado no erro + "tentar de novo". Limitação declarada | D14 |
| R9 | Regressão no build web mata o canal único | `expo export --platform web` ao fim de **todo** dia | diário |
| R10 | Supabase free pausa por inatividade e limita e-mail | Verificar no D1; com uso diário não pausa | D1 |
| R11 | Escopo se expandindo (o mais provável de todos) | Este documento; toda ideia nova vai para §10 | diário |
| R12 | Bundle de 1,86 MB pesado em 4G | Medir tempo de carga no D17; só otimizar se doer | D17 |

## 9-bis. Scripts (`scripts/`)

Não são código do app: rodam no Node, fora do Expo, e não entram no bundle.

| Script | Para quê |
|---|---|
| `node scripts/teste-rls-delete.mjs` | RLS de DELETE entre duas contas (§11.4). Pré-requisito de qualquer mexida em policy |
| `node scripts/teste-paginacao.ts` | Cursor, desempate e bordas da paginação. Puro, sem banco |
| `node scripts/semear-registros.mjs` | 7 dias de rotina plausível na sua conta. `--limpar` desfaz |

**Por que `paginacao.ts` mora separado de `registros.ts`:** para não importar
Supabase nem React Native, e assim poder rodar no Node. Cursor com desempate é a
classe de lógica que erra em silêncio — a lista parece certa e um item some entre
a página 2 e a 3 só quando dois registros caem no mesmo minuto. Isso não se acha
olhando a tela.

O teste foi conferido por mutação: removendo o desempate por `id`, **7 dos 17
registros do cenário empatado desaparecem** e três verificações quebram. Um teste
que não falha quando o código quebra não é teste.

**A massa semeada é gabarito, não enchimento.** Ela alimenta o motor do D8, e
motor com ruído produz número sem sentido — aí não dá pra saber se o erro é da
matemática ou dos dados. Por isso o bebê semeado tem rotina de bebê (mama a cada
~3h, três sonecas em faixas estáveis, noite por volta das 20h) e a semente do
gerador é fixa: duas execuções produzem a mesma massa, então "conferi o intervalo
médio na calculadora" continua valendo na execução seguinte.

## 10. Depois do beta

Fila de tudo que foi cortado, para não voltar a ser discutido durante os 21 dias:

Os 14 tipos de registro restantes · editar registro · gráficos e evolução · aba
Ninna · relatórios · compartilhamento entre cuidadores · modo offline real ·
push · assinatura via RevenueCat · app nativo em loja · tabela `profiles` ·
motor em Edge Function gravando `baby_patterns` · `NunitoSans-Medium.ttf`
faltando (`typography.caption` roda em Regular) · `src/theme/fonts.ts` citado em
`tokens.ts` e inexistente.

---

## 11. Ações no painel do Supabase (fora do código)

Estas duas não têm como ser feitas por commit. Sem elas o D3 não fecha.

### 11.1 Desligar confirmação de e-mail — ⚠️ AINDA NÃO ESTÁ APLICADA
`Authentication > Sign In / Providers > Email` → desmarcar **Confirm email** →
**Salvar**.

Verificado em 05/08/2026 contra o projeto: `mailer_autoconfirm` continua `false`,
ou seja, a confirmação segue ligada. Conferir sem abrir o painel:

```
curl -s "$EXPO_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: <anon key>"
```
Esperado: `"mailer_autoconfirm": true`.

Decisão em §3.8. O código já lida com os dois estados, então ligar ou desligar
não exige alterar nada — mas com a confirmação ligada o signup mostra a tela
"Quase lá" em vez de levar direto ao cadastro do bebê, e o script de RLS (§11.4)
não roda.

**Efeito colateral que importa:** com a confirmação ligada, cada cadastro tenta
enviar e-mail pelo mailer embutido do Supabase, que tem limite de poucos envios
por hora. Estourado o limite, o erro que aparece é `email rate limit exceeded` —
que não se parece em nada com a causa real. É o risco R2 se manifestando antes
mesmo do piloto.

### 11.2 SMTP próprio via Resend — aguardando propagação de DNS
Domínio próprio da Ninna, **não** `@interdemo.com.br`: e-mail de reset chegando
com o domínio de outro produto é exatamente o que o Gmail e a mãe leem como
suspeito.

Ordem: verificar o domínio no Resend (SPF + DKIM) → gerar API key → `Project
Settings > Authentication > SMTP Settings` no Supabase → remetente
`ninna@<domínio>` com nome de exibição "Ninna".

**Critério de aceite (item 2 da checklist §8):** disparar um reset para um Gmail
que não é o do fundador e confirmar que chegou **na caixa de entrada, não em
spam**. Testar só no próprio e-mail não vale — o remetente conhecido do próprio
domínio é justamente o caso que não reproduz o problema.

### 11.3 Rodar `002_cascade_exclusao.sql` — bloqueia o item 13 da checklist
`SQL Editor > New query`, colar o arquivo inteiro, rodar. Depois rodar a consulta
de conferência comentada no fim: esperar **7 linhas, todas com
`delete_rule = CASCADE`**.

Sem isso não existe exclusão de conta, e o termo LGPD do D18 estaria prometendo
algo que o banco recusa (§6).

### 11.4 Rodar o teste de RLS de DELETE — bloqueia o item 12 da checklist
```
node scripts/teste-rls-delete.mjs
```
Prova, nos 6 tipos, que A não apaga registro de B, que a linha de B sobrevive à
tentativa, e que B apaga o próprio (controle positivo — sem ele, uma policy que
negasse tudo passaria no teste). Precisa do "Confirm email" desligado (§11.1); se
não estiver, o script para no preflight e diz exatamente isso.

Usa só a anon key, a mesma do app: o que está sendo testado é exatamente o que o
navegador da mãe consegue fazer. O script **se recusa a rodar** com service_role
— com ela a RLS é ignorada por definição e o verde não significaria nada.

Roda contra o mesmo projeto das embaixadoras, de propósito: um projeto separado
só provaria que as policies **daquele** projeto estão certas, e policy é
exatamente o que diverge entre ambientes sem ninguém perceber. Em troca, cria
tudo prefixado com `TESTE-RLS-` e apaga os dados num `finally`. As duas contas de
auth ficam (removê-las exigiria service_role).

**É pré-requisito, não teste avulso.** Rodar e ver verde é obrigatório:

1. **Antes de aceitar qualquer alteração em policy**, sem exceção.
2. **Como parte do aceite do D18.** A exclusão de conta prometida no termo LGPD é
   implementada sobre cascata de deleção (`002`), e mexer em cascata é
   precisamente a mudança capaz de afrouxar uma policy sem dar nenhum aviso —
   nada quebra, nada avisa, e o dado de uma mãe passa a ser alcançável por outra.

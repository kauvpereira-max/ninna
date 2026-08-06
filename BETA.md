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

*Coluna atualizada em 05/08/2026, depois do D7. Posições `P*` em §7.3.*

| # | Item | Estado |
|---|---|---|
| 1 | Autenticação e-mail/senha | ✅ pronto |
| 2 | Cadastro da mãe (nome) | ✅ pronto (D2) |
| 3 | Cadastro do bebê | ✅ pronto |
| 4 | Home | pronta; falta o card de insight real — **P4** |
| 5 | Registro de amamentação | ✅ pronto |
| 6 | Registro de mamadeira | ✅ pronto |
| 7 | Registro de sono (+ em andamento) | ✅ pronto |
| 8 | Registro de fralda | ✅ pronto |
| 9 | Histórico dos registros | ✅ pronto (D5–D7) |
| 10 | Motor de personalização (3 métricas) | P2 ✅ (matemática, contra massa em memória); ligar e conferir contra o banco — **P3** |
| 11 | Card de insight na Home | a fazer — **P4** |
| 12 | Supabase configurado | pronto (5 tabelas + RLS); falta `002` e §11.1 — **P0** |
| 13 | Interface próxima ao protótipo | parcial — **P8** |
| 14 | Recuperar senha | código ✅ (P1); aceite de entrega em **D3b** |
| 15 | Apagar registro | ✅ código pronto (D4); humor/sintoma reais em **P0** |
| 16 | PWA instalável de verdade | a fazer — **P5/P6**, fecha em **P11** |
| 17 | Termo LGPD com via de saída | a fazer — **P7** (portão da E1) |

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
ela (banner no primeiro acesso via Safari, **P5**), e o fluxo de instalação
precisa ser testado em iPhone real, não só o carregamento da página (**P6**).
A permanência em si só é verificável ≥7 dias depois da instalação — é o **P11**,
e é por causa dessa espera que os dois primeiros foram antecipados (§7.2).

**A limpeza exige inatividade, não tempo.** Mãe que abre o app todo dia nunca
dispara o gatilho — então o piloto, por mais longo que fique, não testa isto. O
cenário do risco é a mãe que instala, some uma semana com recém-nascido e volta.
Só o P11 reproduz esse silêncio. Ver a nota do R1 em §9.

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

   ⚠️ **Decisão em aberto, descoberta no P2 e que cai no P4.** Assim escrito, o
   salto da noite entra na conta: a massa semeada dá **3h31**, não os ~3h que o
   próprio semeador prevê, porque cada dia tem ~6 intervalos de ~3h e um de até
   8h36 entre a última mamada e a primeira do dia seguinte. Sem os saltos
   noturnos daria **2h57**. Nenhum dos dois é errado — são frases diferentes
   ("ela mama a cada 3h30" descreve o dia inteiro; "a cada 3h" descreve o dia
   acordado). O motor implementa a regra como está escrita aqui; **qual das duas
   a mãe lê é decisão da copy do P4**, e precisa ser tomada lá, não deduzida.
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
de e-mail, então o SMTP próprio segue como pré-requisito do D3.

*Atualizado no replanejamento:* o par "corre em paralelo enquanto o DNS propaga"
era com o D2, que já acabou. O par agora é o **P0-bis** (§7.4) — iniciar o
domínio no Resend imediatamente, enquanto o P1 escreve o código do reset. O
aceite (D3b) fecha quando a propagação deixar.

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

### 3.10 Credencial mora só no `.env` — `.env.example` nunca recebe valor real

`.env` é ignorado pelo git desde o D1. `.env.example` é **versionado**, e por isso
carrega placeholder, nunca valor — nem para testar, nem temporariamente, nem
"só até o script rodar".

A regra é absoluta de propósito, e não é sobre a sensibilidade do valor da vez:
é sobre o arquivo. "Esta credencial é descartável, então pode ficar" é uma
avaliação que se faz por linha, e que uma hora vai ser feita errada — o arquivo
tem lugar para a `service_role` key, que ignora a RLS por definição e é a única
coisa neste projeto capaz de expor dado de saúde de bebê de todas as contas de
uma vez. Se a decisão for caso a caso, ela erra nesse caso.

**Valor em arquivo versionado não é apagável.** Commit já feito guarda a linha
para sempre; remover depois limpa a árvore de trabalho e não o histórico, e o
custo real aparece no `push` — que neste projeto ainda não existe (não há remote),
mas o P5 é deploy, e deploy costuma vir de repositório conectado.

Consequência prática, e é a única que importa no dia a dia: script que precisa de
credencial **falha pedindo a chave no `.env`** (é o que o semeador e o
`teste-rls-delete` já fazem no preflight). Preencher o `.example` para destravar
um script é exatamente o atalho que esta regra proíbe.

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
| `(auth)/recuperar-senha` | ✅ feita no P1 |
| `(auth)/nova-senha` | ✅ feita no P1 — destino do link do e-mail |
| `(onboarding)/cadastro-bebe` | pronta |
| `(tabs)/index` — Home | + card de insight (**P4**) |
| `(tabs)/rotina` — Histórico | ✅ reescrita (D6–D7) |
| `(tabs)/mais` | nome ✅; + sobre, feedback, sair (**P7**) |
| `registro/[tipo]` modal, 6 tipos | ✅ + apagar (D4) |
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

*Reordenado em 05/08/2026, depois do D7 e da descoberta de que o D3 tinha sido
pulado. **A fila que vale é a §7.3** — a ordem original D8→D21 não existe mais.*

### 7.0 Âncora de calendário — o que estava faltando

**D1 foi em 05/08/2026 (quarta). Os 21 dias terminam em 25/08/2026 (terça).**

Isso não estava escrito em lugar nenhum deste documento, e é exatamente por isso
que o D3 pôde ser pulado sem que nada acusasse: **não havia dia ao qual ele
deixasse de acontecer.** Um cronograma sem âncora não atrasa — ele só descobre,
lá na frente, que encolheu. A âncora acima é a correção, e a fila de §7.3 tem
data alvo por bloco pela mesma razão.

**Bloco ≠ dia.** Os blocos D1 a D7 foram commitados entre 18h29 e 19h45 de
05/08/2026 — **76 minutos**, não sete dias. Então os rótulos `D1`..`D21` são
**nomes de bloco de trabalho, não datas**, e continuam sendo usados como nomes
(§9 e §11 referenciam por eles). A ordem de execução e o calendário estão em
§7.3, separados de propósito.

Consequência direta: o saldo real do beta **não** é "restam D8–D21 em menos dias
de calendário". Restam 20 dias de calendário (06/08 a 25/08) para 14 blocos.
Sobra dia. O que falta é outra coisa — §7.1.

### 7.1 O que é escasso de verdade

Não é dia de trabalho. O que resta se divide em três classes, e só uma delas
comprime:

1. **Código puro** (D8, D10, D11–D14, D3a) — comprime, e há evidência: 6 blocos
   em 76 minutos. **Ressalva honesta:** D8, D9 e D10 estão marcados "dia pesado"
   e pedem número conferido à mão na calculadora. Verificação manual não comprime
   como digitação, então não trate os 76 minutos como taxa de câmbio.
2. **Execução sua, fora do código** (§11.1–§11.4, semear, aparelho real, as 3
   mães) — não comprime por eu trabalhar mais rápido. É o bloco P0 abaixo.
3. **Relógio de parede** — não comprime de jeito nenhum. Em ordem de duração:

   | Relógio | Duração | Começa em |
   |---|---|---|
   | **Uma mãe registrando até cruzar o limiar de confiança** | **~7 dias** | E1, 11/08 |
   | Janela de ~7 dias de inatividade do iOS (§3.1) | ≥7 dias | P6, 11/08 |
   | Propagação de DNS do Resend | horas a dias | P0-bis, hoje |
   | "Volte no dia seguinte" do item 14 | 1 dia | dentro do P11 |

**A regra que sai daí e organiza a fila:** todo relógio de parede começa o mais
cedo possível, mesmo que o trabalho que depende dele venha muito depois. Latência
se paga em paralelo; esforço, não.

**O relógio mais longo do projeto é o primeiro da tabela, e ele estava agendado
por último.** É o mesmo erro do D3, com outra roupa: tratar espera como bloco de
trabalho. Um bebê não mama mais rápido porque o cronograma apertou. Por isso o
piloto deixou de ser bloco final e virou **trilha paralela** — §7.3-bis e R14.

### 7.2 A descoberta que reordena tudo: o item 11 era inverificável

O item 11 da checklist (§8) é um dos quatro que, falhando, o beta não sai:

> Instalei pela tela de início do iPhone, o app abre pelo ícone sem a barra do
> Safari, e **ao voltar dias depois continuo logada**.

Provar a segunda metade exige deixar o iPhone sem abrir o app por **≥7 dias** —
é a janela de limpeza de storage do §3.1. Não é teste, é espera.

Com a âncora de §7.0, o cronograma original faz esta conta:

```
D16 (PWA + deploy)     = 20/08
D17 (instalar no real) = 21/08
        + 7 dias de espera
                       = 28/08
D21 (piloto)           = 25/08     ← três dias ANTES
```

**O item 11 não fechava.** No dia do piloto, o que existiria é "instalei e
abriu" — que é a primeira metade, e não é a que importa: a que mata o beta é a
mãe deslogada no dia 7, no exato momento em que o motor teria o primeiro
insight (R1). O cronograma original passaria por esse item sem nunca poder
respondê-lo.

Correção: **o PWA e a instalação sobem para P5/P6** (alvo 10–11/08), e a
reabertura vira um bloco próprio (P11, ≥18/08). O relógio corre sozinho enquanto
a interface e o D15 acontecem. O PWA não depende de UI pronta — manifest,
ícones, `vercel.json` e banner de instalação são independentes de o histórico
estar bonito.

---

### O que já aconteceu — D1 a D7

Histórico, na ordem em que ocorreu. Fica aqui como registro: o D3 no meio, com o
❌, é o que impede a mesma omissão de passar batida outra vez.

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

### D3 — ❌ NÃO FEITO, pulado sem data

Não existe commit de D3, e `app/(auth)/` tem só `_layout.tsx`, `login.tsx` e
`signup.tsx` — a rota `recuperar-senha` do §5 nunca foi criada. A fila saltou de
D2 para D4.

Isto é o item 2 da checklist (§8) e o risco R2. **Reagendado com prioridade,
partido em dois** — P1 e D3b em §7.4, pela razão explicada lá: o código não
depende de nada, mas o aceite depende de DNS, e amarrar os dois num bloco só
travaria a fila inteira esperando propagação.

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

### D6 — Tela Rotina v1 ✅ FEITO
Lista agrupada por dia com cabeçalho "Hoje" / "Ontem" / "3 de agosto", contagem
do dia, e item com ícone, rótulo, resumo e hora. "Carregar mais" já ligado ao
cursor do D5; os filtros por tipo ficam pro D7.

**Vazio e erro são telas distintas**, com ação distinta, e o erro tem
precedência sobre o vazio. Quem está sem rede não tem o que registrar de novo, e
quem nunca registrou não tem o que tentar de novo — mostrar "nenhum registro
ainda" pra quem tem 200 registros e caiu a conexão é dizer a ela que o app perdeu
tudo. Com falha de rede, lista vazia não significa "não há nada", significa "não
sei".

**Agrupamento em hora local, nunca UTC** (`chaveDoDia` em `horario.ts`). Em UTC-3
a mamada das 23h50 de terça é 02h50 de quarta em UTC: agrupando por UTC, a mãe
procuraria em "Ontem" o registro que acabou de fazer.

Coberto por `scripts/teste-horario.ts` — e o teste passou por uma correção que
vale registrar. A primeira versão se re-executava com `TZ=America/Sao_Paulo`.
**Era teatro:** neste ambiente (Node no Windows) a variável `TZ` é ignorada para
nomes IANA — só `UTC` tem efeito. Conferido: `TZ=Asia/Tokyo` e
`TZ=America/New_York` devolvem `America/Sao_Paulo`. O teste rodava no fuso da
máquina achando que rodava no fuso pedido, e passava só porque a máquina já
estava em São Paulo. Num runner em UTC daria verde para a implementação errada,
porque em offset zero data local e data UTC coincidem.

A versão atual não mexe em `TZ`. Usa o fuso ambiente e **prova em tempo de
execução que consegue distinguir** a implementação certa da errada — se não
conseguir (offset zero), falha dizendo isso em vez de dar verde.

O item da lista virou `src/components/ItemRegistro.tsx`, compartilhado com a
Home: duas listas de registro com aparências diferentes seria a mãe achando que
são duas coisas.

### D7 — Tela Rotina v2 ✅ FEITO
Chips de filtro (Tudo + os 6 tipos), "carregar mais", atualizar, e os estados.

**O filtro desce para a consulta**, não recorta a página já carregada — e trocar
de filtro reinicia o cursor. Filtrando em memória, "Amamentação" mostraria 2
itens porque os outros estão na página 3, e a mãe concluiria que quase não
amamentou na semana. O parâmetro `tipos` de `listarRegistros` já existia do D5,
então não foi preciso carregar a janela inteira em memória.

**Vazio tem duas variantes.** Sem filtro, ela nunca registrou nada e o que falta
é o primeiro registro. Com filtro, ela pode ter 200 registros e nenhum daquele
tipo — mandá-la "registrar o primeiro" diria que o histórico dela sumiu. Ali a
ação é *Mostrar tudo*.

**Atualizar é botão, não gesto.** `RefreshControl` está no lugar para o nativo,
mas no `react-native-web` ele é no-op, e no Safari do iPhone o gesto de puxar
competiria com o reload do próprio navegador. No canal do beta, o botão é o
mecanismo principal — não a alternativa. Confirmar o gesto no D17.

O spinner de tela cheia só aparece na primeira carga: sumir com a lista durante
um "atualizar" faz parecer que os registros se perderam.

---

### 7.3 A fila real

Ordem de execução, não de numeração. Os nomes `D8`, `D16`… são os mesmos de
antes — só a posição mudou.

| Pos | Bloco | Alvo | Trava |
|---|---|---|---|
| **P0** | **Destrave** — §11.1, §11.3, §11.4, semear, humor/sintoma reais | 05–06/08 | você |
| **P0-bis** | **Domínio no Resend** (SPF + DKIM) — só *iniciar* | **05–06/08** | latência de DNS |
| **P0-ter** | **Recrutar a E1** — mãe **confirmada**, não convidada | **08/08** | latência humana |
| **P1** | **D3a** — código do reset + erros em PT-BR | 06/08 | nada |
| **P2** | D8 — motor, matemática pura ✅ | 06/08 | — |
| **P3** | D9 — motor ligado ao app ⚠️ | 08/08 | P2 |
| **P4** | D10 — card de insight ⚠️ | 09/08 | P3 |
| **P5** | D16 — PWA + deploy ⬆️ *antecipado de 20/08* | 10/08 | P4 |
| **P6** | D17a — instalar no iPhone real ⏱️ *começa a janela de 7 dias* | 11/08 | aparelho ≠ o de dev |
| **·** | **D3b** — aceite do reset em Gmail de terceiro | *quando o DNS verificar* | P0-bis |
| **P7** | D18 — pacote da embaixadora (LGPD) ⬆️ *era 16/08* | **11/08** | **portão da E1** |
| **P8** | D11–D13 — interface conforme protótipo | 12–14/08 | — |
| **P9** | D14 — bordas e robustez | 15/08 | — |
| **P10** | D15 — bateria manual roteirizada ⚠️ | 16–17/08 | P8 · **portão de E2/E3** |
| **P11** | D17b — reabrir o iPhone ⏱️ *fecha os itens 11 e 14* | **≥18/08** | P6 + 7 dias |
| **P12** | D19–D20 — reserva | 19–22/08 | — |
| **P13** | D21 — **leitura** do piloto, não a execução dele | 23–25/08 | trilha E (§7.3-bis) |

P0 a P13 são 14 posições em 20 dias de calendário (06/08 a 25/08), com 4 dias de
reserva dentro. **Cabe.** P0-bis, P0-ter e D3b não têm posição própria porque não
consomem dia: são espera correndo por baixo dos outros blocos.

A folga toda mora em P12, de propósito — reserva espalhada é reserva que some
sem ninguém notar.

Os dois ⏱️ são os únicos itens que trabalhar mais rápido não adianta. O ⬆️ e o
**P0-bis** existem só para pagá-los em paralelo. **O relógio mais longo de todos
não está nesta tabela** — é o da trilha E, abaixo.

⚠️ **O D18 subiu de 16/08 para 11/08 e virou P7 — isto é obrigatório, não
otimização.** Antecipar a E1 põe uma mãe real registrando dado de saúde de bebê a
partir de 11/08; o termo LGPD, o canal de feedback e o roteiro de instalação
estavam agendados para 16/08. Seriam cinco dias coletando dado sensível de uma
criança sem o termo existir, sem canal para ela relatar problema, e sem o papel
que ensina a instalar o app que ela precisa instalar. **O pacote da embaixadora é
literalmente o que se entrega a uma embaixadora** — não há como ela entrar antes
dele. Por isso P7 é o portão da E1, e não uma posição qualquer da fila.

### 7.3-bis A trilha paralela: o piloto

O piloto **não é o último bloco**. É uma trilha que corre por baixo da fila
inteira, porque o que ela contém não é trabalho, é espera: uma mãe precisa de
~7 dias registrando para cruzar o limiar de confiança do §3.3, e nenhum esforço
encurta isso (§7.1, R14).

| Trilha | Quem | Entra | Tem, na leitura |
|---|---|---|---|
| **E1** | 1ª embaixadora, acompanhada de perto no 1º cadastro | **11/08** — depois do PWA no ar (P5) **e do pacote (P7)**; pessoa confirmada no **P0-ter**, até 08/08 | ~14 dias de registro |
| **E2 + E3** | as outras duas, com o app já polido | **18/08** — depois do P10 | ~7 dias de registro |
| **P13** | leitura: as 3 chegaram ao insight? o insight estava certo? | 23–25/08 | — |

```
         FILA PRINCIPAL                       TRILHA DO PILOTO
06/08    P1  D3a
07/08    P2  D8   ┐
08/08    P3  D9   │ motor
09/08    P4  D10  ┘
10/08    P5  D16   PWA no ar
11/08    P6  D17a  instalar ⏱️
         P7  D18   pacote da embaixadora ──▶  E1 entra ▶──┐
12/08   ┐                                                 │
13/08   ├ P8  D11–D13  interface                          │ E1
14/08   ┘        (E1 já está usando o app cru)            │ registra
15/08    P9  D14   bordas                                 │
16/08   ┐ P10 D15  bateria manual                         │
17/08   ┘        (portão de E2/E3) ───────────────────┐   │
18/08    P11 D17b  reabrir ⏱️           E2+E3 entram ▶┤   │
19/08   ┐                                             │   │
  …     ├ P12 reserva                                 │   │
22/08   ┘                                        ~7d  │   │ ~14d
23/08   ┐                                             ▼   ▼
24/08   ├ P13  LEITURA do piloto ◀────────────────────┴───┘
25/08   ┘        as 3 chegaram ao insight? ele estava certo?
```

**Por que E1 entra antes da interface pronta.** Interface crua não impede uma mãe
acompanhada de perto de registrar — impede **escala**, não impede o teste da
hipótese. E1 não é usuária de produto acabado, é a primeira leitura do único
objetivo do beta. As outras duas entram depois do P10 justamente porque elas *não*
serão acompanhadas passo a passo, e aí o app precisa se defender sozinho.

**O que essa antecipação compra, além de caber:** com E1 desde 11/08, o R3 (insight
sair errado) passa a ter ~14 dias de dado real de bebê para ser detectado e
corrigido, em vez de 3. Massa semeada é gabarito de matemática (§9-bis); rotina de
bebê real é a única coisa que testa se a matemática **descreve um bebê**.

⚠️ **Margem desigual, de propósito.** E1 tem folga larga; E2 e E3 entram em 18/08 e
chegam à leitura com exatamente os ~7 dias da janela — **sem margem**. Se elas
atrasarem a entrada, chegam ao P13 abaixo do limiar e o card mostra a frase de
aprendizado, o que não é falha do motor mas parece uma. O aceite do P13 tem que
ler as três separadamente: **E1 responde se a hipótese vale; E2 e E3 respondem se
o onboarding funciona sem a mão do fundador.** São perguntas diferentes.

### 7.4 Os blocos, em ordem

### P0 — Destrave ⏳ EM EXECUÇÃO (seu lado)
§11.1 (Confirm email), §11.3 (`002_cascade_exclusao.sql`), §11.4 (`teste-rls-delete`),
`SEMEAR_*` + semeadura, e salvar humor/sintoma pelo app contra o banco real.
**Fecha os itens 12 e 13 da checklist — dois dos quatro que barram o beta** — e
libera o P2, que sem a massa não tem gabarito para conferir na calculadora.

### P0-bis — Iniciar o relógio do DNS 🕐 EM PARALELO, HOJE
**Não é o D3. É só a parte do D3 que espera.** Verificar o domínio próprio da
Ninna no Resend (SPF + DKIM) e gerar a API key — §11.2.

Sobe para cá sozinho porque é latência pura e nada mais depende dela para
avançar. Se o domínio ainda não estiver comprado, a corrente é *registrar →
nameserver → SPF/DKIM → propagar*, e aí são horas ou dias que não encurtam:
começar hoje custa 20 minutos, começar no P1 custa a data do P1.

**Primeira coisa a fazer é descobrir em que pé está.** O §11.2 diz "aguardando
propagação", mas isso foi escrito no D1 e ninguém confirmou desde então — pode
já estar verificado, pode nem ter domínio comprado. Se estiver verificado, este
bloco custa zero e o D3b pode disparar junto do P1.

⚠️ O §3.8 pareava isto com o D2 ("permite os dois correrem em paralelo enquanto
o DNS propaga"). O D2 acabou; o par agora é este bloco.

### P0-ter — Recrutar a E1 👤 EM PARALELO, alvo 08/08
**Item do P0, com data própria porque é o único do bloco cuja demora não depende
de você.** Nada no plano tratava de *quem* é a E1 — a trilha do §7.3-bis marcava
a data de entrada e presumia a pessoa.

Alvo: **mãe confirmada até 08/08 — confirmada, não convidada.** Convite mandado
não é relógio começado.

Critério de quem serve:
- **bebê de até ~8 meses** — rotina ainda em formação é onde o insight tem valor;
  bebê com rotina já assentada não testa o motor, confirma o óbvio;
- **disposta a registrar diariamente** — o limiar do §3.3 é de registro, não de
  tempo. Mãe entusiasmada que registra três vezes na semana chega ao P13 na frase
  de aprendizado;
- **alcançável por WhatsApp** — é o canal humano do §3.7, e é por onde o bug dela
  chega até você (R6).

Sobe para o P0 pela mesma regra do §7.1: **latência humana é relógio de parede.**
Convidar mãe de recém-nascido tem espera que não comprime — ela pode levar dias
para responder, pode aceitar e desistir, pode ter a semana virada pelo próprio
bebê. Sem pessoa confirmada até 11/08 o relógio mais longo do projeto não começa,
e nenhum degrau da §7.5 recupera isso: os degraus cortam trabalho, e o que
faltaria é dia de bebê registrado.

Os dois dias entre o alvo (08/08) e a entrada (11/08) são a margem para um "não"
— dá tempo de convidar outra sem mover a data da E1.

### P1 — D3a: código do reset + erros em português ✅ FEITO
Fluxo de reset com redirect e tradução das mensagens do Supabase (voltavam em
inglês: *"Invalid login credentials"*). Rotas `(auth)/recuperar-senha` e
`(auth)/nova-senha` do §5.

**A tela de pedir o link nunca diz se a conta existe.** A confirmação é "se
existir uma conta com esse e-mail, o link está a caminho" — dizer "não achamos
essa conta" entrega, uma consulta por vez, quais e-mails têm conta no Ninna. A
mesma regra vale no login: `invalid_credentials` e `user_not_found` devolvem a
**mesma frase**, por construção do `mensagens-auth.ts`.

**Erro no envio, porém, aparece.** O Supabase responde sucesso para e-mail sem
conta, então o que sobra em `error` é falha de verdade — rede, formato,
limite de envio. Esconder isso atrás do "enviamos" faria a mãe esperar para
sempre por um e-mail que nunca saiu. A proteção contra enumeração mora no
caminho de sucesso, que é idêntico exista ou não a conta.

**O `emRecuperacao` no RootNavigator não é detalhe.** O link do e-mail *cria
sessão* — sem esse desvio, a regra "tem sessão → tabs" mandaria a mãe para a
Home logada, com a senha antiga ainda valendo e sem nunca ver o formulário.

**Ao final:** o código existe, `tsc` e `expo export --platform web` passam, e o
único pendente é o **D3b** — o e-mail chegando na caixa de entrada de um Gmail
de terceiro, que depende do P0-bis (DNS do Resend).

**Por que partido em dois:** o D3 original só fechava com o e-mail chegando na
caixa de entrada de um Gmail de terceiro — critério certo, mas que depende de
DNS, não de código. Um bloco só significaria a fila inteira parada esperando
propagação. Partido, o código anda hoje e o aceite fecha quando o DNS deixar.

### D3b — Aceite do reset (dispara quando o P0-bis verificar)
Disparar um reset para **um Gmail que não é o do fundador** e confirmar que
chegou **na caixa de entrada, não em spam**. Testar no próprio e-mail não vale
(§11.2).
**É o item 2 da checklist e o risco R2. O D3 não está fechado sem isto** — P1
sozinho não conta.

### P2 — D8: Motor, matemática pura, sem UI ✅ FEITO
`src/lib/padroes.ts` com as 3 métricas, separação soneca/noite, média circular e
o limiar de 5. Função pura e síncrona, sem Supabase e sem React Native — roda no
Node, mesma razão do `paginacao.ts`. O "agora" e o fuso entram por parâmetro:
sem isso não há como testar fuso nenhum.

**O fuso é injetado, nunca herdado da máquina.** `Intl` com `timeZone` explícito
em vez de `getHours()`, porque `getHours()` lê o fuso do ambiente e no Windows a
variável `TZ` é ignorada para nomes IANA — foi assim que o teste do D6 passou
verde sem provar nada. O teste mede **a mesma massa em dois fusos**: as 15
sonecas de São Paulo viram noite em Tóquio, e o que sobra como "soneca" são os
sonos noturnos, de 9 horas. É o R4 visível.

**Verificado por mutação**, como o D5: as três implementações que o §3.3 proíbe
(média aritmética, misturar noite e soneca, classificar em UTC) são escritas de
propósito no teste, e o que se confere é que **cada uma reprova** em alguma das
conferências. Mutação que passasse significaria conferência decorativa.

**Ao final:** `node scripts/teste-padroes.ts` verde nas 3 métricas e nas 3
mutações, e o gabarito da massa conferido à mão (§9-bis).

⚠️ **O gabarito é do GERADOR, não do banco.** O semeador não chegou a rodar — o
`.env` seguia sem `SEMEAR_EMAIL`/`SEMEAR_SENHA` —, então os números foram
calculados importando `massa-semeada.mjs` direto, sem tocar no Supabase. Isso
prova a matemática e **não prova** que as linhas entraram no banco, que a leitura
as traz de volta, nem que os tipos do Postgres voltam como o motor espera.

Vale porque o gerador é determinístico: semente fixa, e o dia de hoje é o último
do laço, então os seis dias anteriores são idênticos em qualquer execução. Só a
cauda de hoje cresce ao longo do dia.

**A fronteira, explícita:** o P2 fecha **na matemática**. Conferir o motor contra
dado real vindo do Supabase é aceite do **P3**, não deste bloco — e continua
dependendo do semeador rodar (P0).

### P3 — D9: Motor ligado ao app ⚠️ dia pesado
`usePadroes` lê 7 dias e calcula. Testar com o relógio do celular em outro fuso.

**Herda um aceite do P2, de propósito.** O P2 provou a matemática contra a massa
gerada em memória; o que ninguém provou ainda é a volta pelo banco. Então este
bloco só fecha depois de rodar o motor sobre registros **lidos do Supabase** e
bater os três números contra o gabarito do §9-bis. Se divergirem, o erro não está
na matemática — está na leitura, no tipo de coluna ou no fuso da serialização, e
é justamente essa a classe de erro que a massa em memória não alcança.

Depende do semeador ter rodado (P0), que continua aberto.

**Ao final:** os padrões reais do bebê de teste aparecem corretos na tela, e os
números batem com o gabarito.

### P4 — D10: Card de insight na Home ⚠️ dia pesado
`copyInsight.ts`: número → frase acolhedora. Variações por métrica e faixa de
confiança + estado "ainda aprendendo". Revisão de tom.
**Ao final:** conta com 8 registros vê insight verdadeiro; conta com 2 vê a
frase de aprendizado. **Este é o dia que define se o beta tem valor.**

### P5 — D16: PWA de verdade + deploy ⬆️ antecipado
`public/manifest.json` (`display: standalone`, ícones 180/192/512, theme e
background color, `start_url`), `app/+html.tsx` para injetar `<link
rel="manifest">`, `apple-touch-icon`, `apple-mobile-web-app-capable` e
`viewport-fit=cover`. Banner in-app no primeiro acesso via Safari orientando a
instalação. `vercel.json` com rewrite para SPA. Deploy.
**Ao final:** URL pública que instala como app no seu iPhone.

Subiu de 20/08 para cá por causa de §7.2. A URL vai ao ar com a interface ainda
crua, e tudo bem: o canal é fechado e o manifest não depende de o histórico estar
bonito. **A E1 recebe o link já em 11/08** — E2 e E3 só depois do P10.

### P6 — D17a: dispositivo real, instalação ⏱️ começa a janela
iPhone/Safari e Android/Chrome, em aparelho que **não** é o de desenvolvimento.
Testar o **fluxo de instalação**, não só o carregamento: instalar pela tela de
início, abrir pelo ícone, confirmar que abre sem a barra do Safari.
Safe area, teclado cobrindo campo, scroll, rotação. Também é aqui que o R12
(bundle de 1,88 MB em 4G) é medido.

**Depois disto, não abrir o app nesse iPhone até o P11.** A espera *é* o teste —
abrir no meio zera o relógio e o item 11 volta a ser inverificável.

### P7 — D18: Pacote da embaixadora (LGPD) ⬆️ antecipado — PORTÃO DA E1
Termo curto e honesto, contendo obrigatoriamente:
- quais dados são coletados e onde ficam (Supabase, região do projeto);
- como pedir exclusão total — canal e prazo de resposta — mesmo que a execução
  seja manual no painel;
- o que acontece ao fim do piloto: **dados apagados por padrão**, salvo opção
  explícita dela por continuar.

Mais: canal de feedback (grupo WhatsApp + link na aba Mais) e roteiro de 1
página de instalação. Reexecutar §11.4 como parte do aceite.

**Subiu de 16/08 para 11/08 porque a E1 subiu.** Os três itens deste bloco são
exatamente o que uma embaixadora precisa ter em mãos para *ser* embaixadora: o
termo que a informa, o canal por onde ela relata, e o papel que ensina a
instalar. Com a E1 entrando em 11/08, deixar isto em 16/08 significaria cinco
dias coletando dado de saúde de um bebê real sem termo e sem canal de retorno.
Não é atraso de cronograma, é coleta sem base — e o §7.5 já dizia que este
bloco não se negocia por prazo.

### E1 — Primeira embaixadora entra 🕐 TRILHA PARALELA, a partir de 11/08
Uma mãe só, acompanhada de perto por você no primeiro cadastro: conta, bebê,
primeiros registros. Depois disso ela usa sozinha e você acompanha pelo canal
humano (§3.7).

Não é bloco de trabalho — é o **início do relógio mais longo do projeto**. A
partir daqui o dado dela se acumula sozinho enquanto P8, P9 e P10 acontecem.

Ela entra com a interface ainda crua, e isso é decisão, não concessão: o que se
está testando é se o motor diz algo verdadeiro sobre o bebê dela, e isso não
depende de a tela estar bonita. Ver §7.3-bis.

**Não entra sem o P7 fechado.** É a única precedência rígida da trilha — e a
pessoa já tem que estar confirmada desde o P0-ter (08/08), senão não há quem
entre em 11/08.

### P8 — D11–D13: Interface conforme protótipo
D11 Home · D12 modais de registro · D13 histórico, auth e onboarding.
**Ao final:** nenhuma tela parece de desenvolvedor.
*Serve E2 e E3, não a E1 — que já está usando o app cru. Terceiro degrau do
corte, §7.5.*

### P9 — D14: Bordas e robustez
Estados vazios, erro de rede com "tentar de novo" **preservando o formulário**,
alvos de toque ≥44px, `accessibilityLabel`, tela de 360px.
(O `try/catch` das fontes saiu daqui — foi antecipado para o D2, ver §3.9.)
O gesto de puxar-para-atualizar da Rotina, pendência do D7, é confirmado no
**P6** — precisa de Safari real, não adianta olhar aqui.

### P10 — D15: Bateria manual roteirizada ⚠️ dia pesado
Roteiro de ~30 passos: conta nova → mãe → bebê → 7 dias de registros → insight →
apagar → sair → entrar. Duas contas, dois bebês. Corrigir o que quebrar.
**Ao final:** o roteiro passa inteiro sem intervenção.

**Este é o portão de E2 e E3.** Elas não serão acompanhadas passo a passo como a
E1 — então o app precisa passar no roteiro sozinho antes de as duas receberem o
link.

### E2 + E3 — As outras duas entram 🕐 TRILHA PARALELA, a partir de 18/08
App já polido (P8) e já testado ponta a ponta (P10). Convite pelo canal humano,
sem acompanhamento passo a passo — é isso que as torna teste de outra coisa: a
E1 responde se a hipótese vale, elas respondem se o onboarding se sustenta sem a
mão do fundador.

⚠️ **Elas têm exatamente a janela, sem margem.** 18/08 até a leitura em 23–25/08
são ~7 dias — o mínimo do §3.3. Cada dia de atraso na entrada delas é um dia a
menos de dado, e abaixo do limiar o card mostra a frase de aprendizado: não é
falha do motor, mas **se parece com uma** na hora de ler o resultado.

### P11 — D17b: reabrir o iPhone ⏱️ ≥7 dias depois do P6
Abrir pelo ícone o app instalado no P6, sem ter tocado nele desde então.
**Fecha o item 11** (continuo logada) **e o item 14** (tudo que registrei está
lá). §3.1 diz "em torno de 7 dias", então quanto mais folga além dos 7, mais o
teste vale — o alvo de 11/08 no P6 dá margem até 18/08 com reserva pela frente.

Se falhar, o P12 inteiro existe para consertar antes do piloto. Era exatamente
essa margem que o cronograma original não tinha.

### P12 — D19–D20: Reserva
Não são dias livres. São os dias que algo do P0–P11 vai consumir.

### P13 — D21: Leitura do piloto (o piloto já está correndo há 12 dias)
**Deixou de ser "rodar o piloto" e virou "ler o piloto".** Quando este bloco
chega, E1 tem ~14 dias de rotina registrada e E2/E3 têm ~7. Não há nada a
iniciar aqui — há duas perguntas a responder:

1. **As três chegaram ao insight?** Ou alguma ficou na frase de aprendizado, e
   por quê — limiar não cruzado, registro esparso, ou bug.
2. **O insight estava certo?** Conferido contra os registros brutos dela, do
   mesmo jeito que o item 9 da §8 exige. Insight que sai e está errado é pior
   que insight que não sai (R3, e o mesmo princípio da copy de saúde).

Se as três chegarem e os números baterem, abre para o resto. Se só a E1 chegar,
a hipótese vale e o onboarding não — são conclusões diferentes, com correções
diferentes, e é por isso que §7.3-bis manda ler as três separadamente.

### 7.5 O que sai se não couber

Em ordem de sacrifício. Cortar de cima para baixo, e **nunca** fora de ordem —
a ordem é por distância do objetivo único do beta (§ topo: uma mãe recebe um
insight verdadeiro sobre o próprio bebê).

**Dois degraus desta escada foram absorvidos pelo cronograma e não existem mais.**
Eram "cortar o polimento da interface" e "começar com 1 embaixadora em vez de 3".
Os dois viraram **o plano**, não a emergência: E1 entra em 11/08 com o app cru, de
propósito (§7.3-bis). Um corte que já é o desenho não é mais alavanca — o que
resta abaixo é o que ainda dá para sacrificar de verdade.

**Degrau 1 — humor, sintoma e múltiplos bebês saem do polimento e do roteiro do
P10. Recupera ~meio dia.**
O **código fica** — removê-lo custaria mais que mantê-lo (§1, "bônus mantido sem
custo"). O que sai é o custo deles: passo no roteiro de 30 passos e rodada de
design. Nenhum dos três aparece em qualquer item da §8.

**Degrau 2 — P9 (D14) encolhe ao que a checklist toca. Recupera ~meio dia.**
Fica: erro de rede preservando o formulário (é o R8) e alvos de 44px. Sai:
varredura de `accessibilityLabel` e a tela de 360px, que viram acabamento
pós-beta e vão para a §10.

**Degrau 3 — P8 (D11–D13) comprime de três blocos para um. Recupera 2 dias.**
Só a Home e o card de insight recebem o tratamento do protótipo.
*Mudou de natureza, e ficou mais caro do que era.* Antes o polimento não servia a
ninguém em particular e cortá-lo era aposta. Agora ele tem destinatário: **E2 e
E3, que entram sem acompanhamento**. Cortar aqui não arrisca a hipótese — a E1 já
respondeu isso com o app cru — mas degrada exatamente aquilo que E2 e E3 existem
para testar, que é o app se defender sozinho. Por isso desceu para o terceiro
degrau em vez do primeiro.

**Degrau 4 — E2 e E3 não entram; a leitura do P13 é só da E1.**
Última linha. A hipótese do beta continua respondida: E1 chega ao P13 com ~14
dias de rotina real, que é mais dado do que as três teriam no plano antigo
inteiro. O que se perde é a resposta sobre onboarding sem acompanhamento — que é
pergunta de escala, não de hipótese, e pode esperar a semana seguinte com um app
honestamente pronto.

⚠️ **O custo escondido deste degrau — não é "menos informação".** Cortar E2 e E3
deixa a leitura do P13 inteira pendurada em **uma pessoa**. Se a E1 abandonar no
dia 4 — e mãe de recém-nascido abandona sem avisar, isso não é hipótese remota —
o beta não termina com uma resposta mais estreita sobre a hipótese: termina **sem
resposta nenhuma**. Com as três, a desistência de uma ainda deixa duas leituras.
É o único degrau da escada cujo pior caso é ficar com zero, e ele não tem aviso
prévio: você só descobre no P13, quando não há mais dia para convidar outra.
Continua sendo o último degrau — os outros três custam mais cedo e com mais
certeza — mas quem descer até aqui tem que descer sabendo que trocou "app menos
polido" por "beta possivelmente sem conclusão".

*Degraus 3 e 4 são acoplados:* se o aperto chegou a esse ponto, fazer o 4 sozinho
é melhor que fazer o 3 sozinho. Convidar E2 e E3 para um app que você acabou de
decidir não polir gasta duas embaixadoras para medir um app que você já sabe que
não está pronto.

**O que não sai em degrau nenhum:**

| Não cortável | Porque |
|---|---|
| P2, P3, P4 (o motor) | É a razão de o beta existir. Item 9 da §8 |
| P5, P6, P11 (PWA + janela de 7 dias) | Item 11. Sem isso a mãe é deslogada no dia 7 (R1) |
| D3b (aceite do reset) | Item 2. Embaixadora sem senha está fora do piloto para sempre (§3.6) |
| P0 §11.3 e §11.4 | Itens 12 e 13. Privacidade de dado de saúde de bebê |
| **P7 (pacote da embaixadora)** | Não é escopo, é obrigação legal. Não se negocia por prazo — e agora é **portão da E1**: sem ele nenhuma mãe real entra |
| **P0-ter (E1 confirmada até 08/08)** | Sem pessoa, a data de 11/08 é só uma linha no diagrama. Latência humana não comprime, e o convite não tem degrau de corte que o substitua |
| **E1 em 11/08** | É o relógio mais longo do projeto (R14). Atrasar a E1 atrasa o beta inteiro, e não há como recuperar depois |

Cortar qualquer linha dessa tabela não atrasa o beta — **cancela** ele. Se a
conta não fechar nem depois do degrau 4, o certo é mover a data de 25/08, não
raspar daqui.

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
| R1 | Mãe não instala a PWA e é deslogada pelo iOS em ~7 dias | Banner in-app conduzindo a instalação + item 11. **Antecipado**: no cronograma original a janela de 7 dias não cabia antes do piloto (§7.2). **O piloto NÃO testa este risco** — ver nota abaixo | P5–P6, fecha em **P11** |
| R2 | **E-mail transacional cai em spam** — derruba o reset de senha | Resend com domínio próprio da Ninna, decidido no D1. Confirmação de signup desligada (§3.8), então só o reset depende de entrega. D3 não fecha sem o SMTP configurado | P0-bis / P1 / D3b |
| R3 | Insight sair errado — perde a embaixadora e a credibilidade | Média circular, soneca≠noite, limiar de 5 registros | P2–P4 |
| R4 | Fuso horário desanda o horário médio | Hora local sempre, nunca UTC; testar com relógio em outro fuso | P3 |
| R5 | LGPD sem via de saída para dado sensível de bebê | Termo com canal e prazo de exclusão + item 13 | **P7** |
| R6 | Bug de mãe real nunca chega até mim | Grupo WhatsApp + link "Relatar problema" | **P7** |
| R7 | ~~Tela branca permanente se uma fonte falhar ao carregar~~ | **Resolvido no D2** — `try/catch/finally` no `loadFonts` (§3.9) | ✅ D2 |
| R8 | Sem modo offline: registro perdido no quarto com Wi-Fi fraco | Formulário preservado no erro + "tentar de novo". Limitação declarada | P9 |
| R9 | Regressão no build web mata o canal único | `expo export --platform web` ao fim de **todo** dia | diário |
| R10 | Supabase free pausa por inatividade e limita e-mail | Verificar no D1; com uso diário não pausa | D1 |
| R11 | Escopo se expandindo (o mais provável de todos) | Este documento; toda ideia nova vai para §10 | diário |
| R12 | Bundle de 1,88 MB pesado em 4G | Medir tempo de carga no dispositivo real; só otimizar se doer | P6 |
| R13 | **Bloco pulado sem ninguém notar** — aconteceu com o D3, descoberto 6 blocos depois | Âncora de calendário e data alvo por bloco (§7.0/§7.3). Cronograma sem data não atrasa: encolhe em silêncio | diário |
| R14 | **O piloto não cabia nos 21 dias** — o relógio mais longo do projeto estava agendado por último | Piloto vira trilha paralela: E1 em 11/08, E2/E3 em 18/08, e o P13 lê em vez de rodar (§7.3-bis) | P7 → P13 |

A coluna "Dia" usa as posições de §7.3, não os nomes de bloco — foi justamente a
confusão entre as duas coisas que deixou o D3 escapar (§7.0).

### Nota do R1 — o piloto não substitui o P11

A limpeza de storage do iOS (§3.1) exige **inatividade**. Uma embaixadora usando
o app todo dia — que é exatamente o comportamento que o piloto quer produzir —
**nunca dispara o gatilho**. Ela poderia registrar por 14 dias seguidos e isso não
diria nada sobre o R1.

O cenário real do risco é outro: a mãe instala, **some uma semana** com um
recém-nascido em casa, e volta. É esse silêncio que apaga o storage e a desloga.
Só se prova reproduzindo o silêncio, e é isso que o P11 faz no seu iPhone — sete
dias sem abrir, de propósito.

Portanto: **o piloto e o P11 testam coisas diferentes e nenhum cobre o outro.**
O piloto responde "o insight é verdadeiro?"; o P11 responde "ela ainda vai estar
logada quando voltar?". Antecipar a trilha do piloto não dispensa o P11, e um
piloto correndo bem não é evidência sobre o R1.

### Nota do R14 — por que o piloto por último era o mesmo erro do D3

O objetivo único do beta exige uma mãe registrando **por dias** até cruzar o
limiar de 5 registros da métrica (§3.3): ~1 dia para o intervalo entre mamadas,
~2 dias para as duas métricas de soneca, e mais que isso para o padrão ser
estável em vez de acidental.

No cronograma original o piloto começava em 23/08 e o beta acabava em 25/08. O
insight sairia no último dia, com zero margem para reagir se saísse errado — que
é literalmente o R3. Pior: com registro esparso, que é o comportamento realista
de uma mãe de primeira viagem, o limiar não seria cruzado e as três veriam a
frase de aprendizado durante o piloto inteiro.

A causa é a mesma do D3: **espera tratada como bloco de trabalho.** Um bebê não
mama mais rápido porque o cronograma apertou. A correção é a mesma regra do
§7.1 — relógio longo começa primeiro — e o resultado é que a E1 chega ao P13 com
~14 dias de rotina real, mais dado do que as três teriam no plano antigo inteiro.

## 9-bis. Scripts (`scripts/`)

Não são código do app: rodam no Node, fora do Expo, e não entram no bundle.

| Script | Para quê |
|---|---|
| `node scripts/teste-rls-delete.mjs` | RLS de DELETE entre duas contas (§11.4). Pré-requisito de qualquer mexida em policy |
| `node scripts/teste-paginacao.ts` | Cursor, desempate e bordas da paginação. Puro, sem banco |
| `node scripts/teste-horario.ts` | Agrupamento por dia em hora local. Recusa rodar em offset zero, onde não provaria nada |
| `node scripts/teste-padroes.ts` | As 3 métricas do motor, com fuso injetado e verificação por mutação. Puro, sem banco |
| `node scripts/semear-registros.mjs` | 7 dias de rotina plausível num bebê dedicado. `--limpar` desfaz |
| `scripts/massa-semeada.mjs` | Não é teste: é o gerador da massa, importado pelo semeador **e** pela conferência do gabarito. Não toca em rede |

**Por que `paginacao.ts` mora separado de `registros.ts`:** para não importar
Supabase nem React Native, e assim poder rodar no Node. Cursor com desempate é a
classe de lógica que erra em silêncio — a lista parece certa e um item some entre
a página 2 e a 3 só quando dois registros caem no mesmo minuto. Isso não se acha
olhando a tela.

O teste foi conferido por mutação: removendo o desempate por `id`, **7 dos 17
registros do cenário empatado desaparecem** e três verificações quebram. Um teste
que não falha quando o código quebra não é teste.

**A massa é semeada num bebê dedicado**, criado pelo próprio script
(`SEMEADO-Teste`), nunca no bebê real da mãe. A razão é o `--limpar`:
`sleep_records` não tem coluna `notes`, então não há como marcar procedência
linha a linha e a única âncora confiável é o `baby_id`. Semeando no bebê real,
limpar exigiria apagar sono por janela de tempo — e no D21 há três mães com sono
de verdade no mesmo banco. Testar em produção é a decisão certa, e é ela que
obriga o script a ser seguro em produção. A limpeza ainda confere o escopo antes
de apagar e aborta se fosse alcançar mais de um `baby_id`.

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

Nenhuma destas tem como ser feita por commit. Sem a §11.1, a §11.2 e a §11.5 o
D3 não fecha; a §11.3 e a §11.4 barram os itens 12 e 13 da checklist.

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

### 11.2 SMTP próprio via Resend — ⚠️ estado não confirmado desde o D1

**Bloco P0-bis: a primeira ação é descobrir em que pé isto está.** "Aguardando
propagação" foi escrito no D1 e nunca reconfirmado — pode estar verificado, pode
não ter domínio comprado ainda. É a única latência longa que resta, e ela não
encurta com esforço: por isso sobe para o início da fila (§7.4), muito antes do
código que depende dela.

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

### 11.5 Allow-list do redirect de recuperação — nasce no P1, só fecha no P5

`Authentication > URL Configuration > Redirect URLs`. O destino do link de reset
precisa estar nessa lista. Se não estiver, o GoTrue **ignora o `redirectTo` e
devolve a mãe para o Site URL padrão** — o link "funciona" indo para o lugar
errado, que é o modo de falha mais difícil de diagnosticar, porque nada dá erro
e a API responde `200` igual.

O app monta esse endereço num lugar só (`src/lib/urls.ts`, `urlRetornoResetSenha`),
para essa troca custar uma variável e não uma caça a string espalhada:

- **hoje:** `http://localhost:8081/nova-senha` — a origem de onde o app é servido;
- **a partir do P5:** o domínio da Vercel, via `EXPO_PUBLIC_APP_URL`.

As duas entradas precisam existir na allow-list, e **o P5 não fecha enquanto a de
produção não entrar**. Não dá para verificar de fora: só abrindo o link de um
e-mail real e vendo onde ele cai — o que amarra esta conferência ao D3b.

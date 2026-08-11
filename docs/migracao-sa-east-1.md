# Migração do Supabase para `sa-east-1` (São Paulo)

*Decidido em 06/08/2026.*

## Por que, e por que agora

O projeto foi criado em `ca-central-1` — Canadá. Rotina de saúde de bebê é dado
sensível de criança, e guardá-lo fora do país é **transferência internacional sob
a LGPD**: legal, mas exige base e transparência no termo. Explicar isso a uma mãe
cansada é atrito que dá para simplesmente não ter.

**Região de projeto Supabase é definida na criação e não muda depois.** Trocar
significa projeto novo. Isso custa ~2 horas **hoje**, porque não há nenhuma mãe
real dentro; depois da E1, custa migração de dado mais termo em versão nova, com
aceite recolhido de novo.

A janela fecha quando a E1 entrar.

## O que NÃO é afetado

Levantado antes de escrever este roteiro:

- **Nenhum ref do projeto está escrito no código.** Nada de `vzgwyakjopdmudhdefgy`
  em `.ts`, `.tsx`, `.json` ou `.md`.
- **Nenhum uso de Storage.** Não há bucket, avatar nem arquivo para migrar.
- **O domínio da Vercel não muda**, então `EXPO_PUBLIC_APP_URL` continua igual.
- **As migrations não mudam.** Os três arquivos rodam como estão.

A superfície inteira é: duas variáveis de ambiente, três configurações de painel,
e um secret da Edge Function.

## O que se perde, e está tudo bem

Os bebês e registros de teste do projeto atual. Não há dado de mãe real, e a
massa semeada se refaz com `scripts/semear-registros.mjs`. A conta de auth do
fundador precisa ser criada de novo pelo app; as duas contas de teste de RLS o
próprio script recria (ele tenta `signInWithPassword` e cai em `signUp`).

---

## Antes de começar: o limite do plano

O plano gratuito permite **2 projetos ativos por organização**, e hoje existem
dois: `interdemo` e o da Ninna. Mas — confirmado na documentação em 06/08/2026 —
**projeto pausado não ocupa vaga**:

> "You are entitled to two active free projects. Paused projects do not count
> towards your quota." — [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)

Então o desbloqueio é simples e reversível: **pause o `interdemo`** antes do
passo 1. Isso libera a vaga para criar o projeto da Ninna em `sa-east-1`, e os
dois da Ninna coexistem durante a migração — que é exatamente o que ela precisa,
já que o antigo só se apaga no passo 8.

Duas ressalvas:

- **A cota é somada entre todos os membros Owner/Admin da organização.** Numa
  organização de uma pessoa só, é o que se espera. Se houver outro Owner ou Admin
  que já tenha gastado a cota dele, o limite morde mesmo com projetos pausados —
  a saída aí é criar o projeto novo em **outra organização**, que tem cota
  própria.
- **Pausar é reversível**, mas se o `interdemo` tiver algo que você queira
  preservar, confirme as condições de restauração antes — ou tire um backup.

---

## O roteiro

### 1. Criar o projeto novo

Com o `interdemo` pausado (ver acima), painel do Supabase → **New project**.

- **Region: South America (São Paulo) — `sa-east-1`.** É o item inteiro da
  migração; conferir duas vezes.
- Nome: algo que se reconheça — `ninna`, e não o e-mail (o projeto atual chama
  `kauvpereira@gmail.com`, que é o default e não diz nada).
- **Guarde a senha do banco.** Ela é pedida no `link` do CLI e não dá para
  recuperar depois, só trocar.

Anote o **ref** do projeto novo — aparece na URL do painel e em Project Settings.

### 2. Rodar as três migrations, na ordem

SQL Editor → New query → colar o arquivo inteiro → Run. Uma de cada vez:

1. `supabase/migrations/001_schema_inicial.sql`
2. `supabase/migrations/002_cascade_exclusao.sql`
3. `supabase/migrations/003_assistente_uso.sql`

A ordem importa: a `002` altera as chaves que a `001` cria, e a `003` referencia
`auth.users`.

**Conferência da 002** — esperado: **8 linhas**, todas `CASCADE`, se a `003` já
tiver rodado. Sete vêm da `002`; a oitava é `assistant_usage.user_id →
auth.users`, que a `003` cria já em cascata. Rodando a conferência entre a `002`
e a `003`, são 7.

```sql
select t.relname as tabela, c.conname as constraint_name, ref.relname as referencia, case c.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' end as delete_rule from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace join pg_class ref on ref.oid = c.confrelid where c.contype = 'f' and n.nspname = 'public' order by t.relname;
```

**Conferência da 003** — esperado: `rls_ligada = true`, `policies = 1`.

```sql
select (select relrowsecurity from pg_class where relname = 'assistant_usage') as rls_ligada, (select count(*) from pg_policy where polrelid = 'assistant_usage'::regclass) as policies;
```

✅ Feito em 11/08/2026: 7 tabelas com RLS, 8 chaves em `CASCADE`,
`assistant_usage` com 1 policy. O `BETA.md` §11.3 foi atualizado — a verificação
de 06/08 valia para o projeto antigo e deixou de descrever o banco que está na
frente no instante da migração.

### 3. As três configurações de painel

Nenhuma delas migra sozinha. Todas moram no projeto, não no código.

**3a. Desligar a confirmação de e-mail** — `Authentication > Sign In / Providers
> Email` → desmarcar **Confirm email** → Salvar.

Este é o §11.1, que **nunca chegou a ser aplicado no projeto antigo** — é por
isso que o `teste-rls-delete.mjs` está bloqueado desde sempre. Fazer agora, no
projeto novo, é herdar a decisão certa em vez do impedimento.

⚠️ **Confira pelo servidor, nunca pela tela.** Na primeira tentativa aqui, com as
duas caixinhas marcadas no painel, o servidor devolveu `external.email: false` e
`mailer_autoconfirm: false` — nada tinha sido salvo. Sair da página sem clicar em
**Save** descarta tudo sem avisar.

Esperado nos DOIS campos: `"mailer_autoconfirm": true` e
`"external": {"email": true}`. O segundo é o que mais dói sozinho: sem ele
ninguém cria conta nem entra, e o sintoma é erro genérico de login.

```
curl -s "https://<NOVO_REF>.supabase.co/auth/v1/settings" -H "apikey: <NOVA_ANON_KEY>"
```

**3b. SMTP próprio via Resend** — `Project Settings > Authentication > SMTP
Settings`. Remetente `ninna@<domínio>`, nome de exibição "Ninna".

O domínio e os registros de SPF/DKIM ficam no Resend e **não** precisam ser
refeitos — eles são do domínio, não do projeto Supabase. O que se refaz é apontar
o Supabase novo para o Resend.

Se isso nunca foi configurado (o §11.2 diz "estado não confirmado desde o D1"),
esta é a hora, e continua sendo o pré-requisito do D3b.

**3c. Allow-list de redirect** — `Authentication > URL Configuration` (o §11.5).

- **Site URL:** `https://ninna-sigma.vercel.app`
- **Redirect URLs**, as duas:
  - `http://localhost:8081/nova-senha`
  - `https://ninna-sigma.vercel.app/nova-senha`

### 4. Trocar as variáveis locais

`Project Settings > API` do projeto novo → copiar **Project URL** e **anon
public**.

No `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<NOVO_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<nova anon key>
```

`EXPO_PUBLIC_APP_URL` **não muda** — o domínio da Vercel é o mesmo.

Teste local antes de tocar na Vercel: `npx expo start --web`, criar conta, criar
bebê, registrar uma mamada. Se isso funciona, a troca está certa.

### 5. Trocar na Vercel e redeployar

Settings → Environment Variables → editar as duas, nos três ambientes.

**Depois, Deployments → Redeploy.** Variável de ambiente só entra no bundle em
build novo — sem o redeploy, o site continua falando com o projeto antigo, e o
sintoma é o pior possível: parece que funcionou.

### 6. Religar o CLI e a Edge Function

```
npx supabase unlink
npx supabase link --project-ref <NOVO_REF>
```

O secret da chave da Anthropic é **por projeto** — configure no projeto novo,
pela interface: Edge Functions → Secrets → `ANTHROPIC_API_KEY`.

Depois:

```
npx supabase functions deploy assistente --use-api
```

### 7. Refazer os testes que dependem do banco

- `node scripts/teste-rls-delete.mjs` — o §11.4, que agora **destrava**, porque
  a confirmação de e-mail está desligada desde o passo 3a. É ele que sustenta a
  frase do termo sobre cada conta enxergar só os próprios dados.
- `node scripts/semear-registros.mjs` — refaz a massa de teste.
- Salvar humor e sintoma pelo app, que é a pendência antiga do `CLAUDE.md`.

### 8. Apagar o projeto antigo — ✅ FEITO EM 11/08/2026

**Não deixe para depois.** O projeto antigo continua com uma cópia dos dados de
teste em outro país, e a promessa de exclusão do termo é sobre "todos os
registros" — ter uma segunda base viva contradiz isso no espírito, mesmo que o
dado seja só seu.

Painel do projeto antigo → Settings → General → Delete project.

Feito em 11/08/2026 via `npx supabase projects delete vzgwyakjopdmudhdefgy`,
depois de o passo 7 passar. A tela de SMTP dele estava vazia — foi conferida
antes, porque era a última chance de descobrir se o Resend chegara a ser
configurado algum dia. Estava: nunca foi.

Restam dois projetos: `Ninnabr` (sa-east-1) e `interdemo` (pausado).

### 9. Ajustar os documentos

- **`docs/embaixadora/termo-participacao.md`**: `[REGIÃO DO PROJETO]` vira
  `Brasil (São Paulo)`. Como o termo ainda não foi enviado a ninguém, continua
  sendo **versão 1** — não há aceite a recolher de novo.
- **`BETA.md` §11.1**: passa de "ainda não aplicada" para aplicada, com data.
- **`BETA.md` §11.3**: a data de verificação passa a ser a do projeto novo.
- **`BETA.md` §11.5**: a allow-list passa a ser a do projeto novo.

---

## Checklist de aceite

A migração está feita quando **todas** forem verdade:

1. Projeto novo em `sa-east-1`, e o antigo apagado.
2. As três migrations rodadas, com as três conferências verdes (7 tabelas com
   RLS, 8 chaves em CASCADE, `assistant_usage` com 1 policy).
3. `mailer_autoconfirm: true` no `/auth/v1/settings` do projeto novo.
4. Reset de senha chega na caixa de entrada de um Gmail que não é o seu (D3b).
5. App na Vercel, com o build novo, cria conta e registra mamada.
6. `teste-rls-delete.mjs` verde.
7. Edge Function respondendo, incluindo a resposta travada de saúde.
8. Termo com `Brasil (São Paulo)` escrito.

## O que é irreversível

- **Apagar o projeto antigo** (passo 8). Só depois do passo 7.
- **A região do projeto novo.** Errar aqui é repetir tudo — confira no passo 1.

Todo o resto é reversível: variável se troca de volta, `link` se desfaz, deploy
se refaz.

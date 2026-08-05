# Ninna

App de acompanhamento de rotina de bebê com motor de personalização.

> **Nota:** esta versão usa Expo SDK 54 (corrigido em relação à primeira entrega,
> que usava SDK 57 — versão nova demais, incompatível com o Expo Go disponível
> nas lojas de aplicativo). Se antes deu erro de "Project is incompatible",
> baixe esta versão nova.

## Status

Fase 1 (setup) e parte da Fase 2 (autenticação) prontas. Autenticação por
e-mail/senha funcionando de ponta a ponta — cria conta, confirma e-mail, entra,
sai. Registros ainda não persistem (próxima etapa).

## Configurar o Supabase (obrigatório antes de testar)

1. Crie um projeto em supabase.com/dashboard (se ainda não tiver)
2. Vá em **SQL Editor** no menu lateral → **New query**
3. Abra o arquivo `supabase/migrations/001_schema_inicial.sql` deste projeto,
   copie todo o conteúdo, cole no editor SQL e clique em **Run**
4. Vá em **Project Settings → API**, copie **Project URL** e **anon public key**
5. Cole no arquivo `.env` (copiado de `.env.example`)

## Como rodar

1. Instale as dependências:
   ```
   npm install --legacy-peer-deps
   ```
   (o `--legacy-peer-deps` é necessário por um conflito de dependência do
   expo-router com um pacote transitivo de UI web — não é erro do projeto)

2. Copie o arquivo de ambiente e preencha com as credenciais do seu Supabase:
   ```
   cp .env.example .env
   ```

3. Rode o projeto:
   ```
   npx expo start
   ```

4. Escaneie o QR code com o app **Expo Go** no seu celular (Android ou iOS)
   pra ver rodando de verdade.

## Se der erro na primeira vez

É esperado — projeto novo de Expo quase sempre pede um ajuste na primeira
rodada. Rode:
```
npx expo install --fix
```
Isso corrige automaticamente qualquer pacote com versão incompatível com o
SDK do Expo instalado. Se ainda assim der erro, cola a mensagem completa de
volta na conversa com o Claude.

## Estrutura

```
app/(tabs)/     — as 6 telas de navegação (Hoje, Rotina, Ninna, Insights, Evolução, Mais)
src/theme/      — tokens do design system (cores, tipografia, espaçamento)
src/lib/        — cliente Supabase
assets/fonts/   — Fredoka e Nunito Sans (pesos estáticos já gerados)
```

Contexto completo do projeto pra IA em `CLAUDE.md`.

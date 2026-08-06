-- Ninna — teto diário de mensagens do assistente
-- Rodar inteiro no SQL Editor do painel do Supabase.
--
-- POR QUE ESTA TABELA EXISTE
--
-- O assistente é a primeira funcionalidade da Ninna com CUSTO MARGINAL POR
-- USUÁRIA (PRODUTO.md §3.1). Até aqui, uma mãe a mais custava ~zero; a partir
-- dele, cada mãe tem uma conta mensal atrelada, e ela sobe com o engajamento —
-- que é justamente o que o produto tenta aumentar.
--
-- Sem teto, uma usuária pesada custa mais que a assinatura inteira: 30
-- mensagens/dia passam de R$50/mês, contra R$24,90 de receita. O teto não é
-- economia, é o que faz o preço fechar (§5).
--
-- Com teto generoso quase ninguém encosta nele, e o pior caso deixa de ser
-- ilimitado. Isso é o ponto: a conta passa a ter um máximo conhecido.
--
-- POR QUE UMA LINHA POR DIA, E NÃO UM CONTADOR
--
-- Uma linha por (usuária, dia) dá o histórico de uso de graça — quantas
-- perguntas por dia, quantos dias ativos — que é o dado que vai calibrar o
-- preço. Um contador que zera perde exatamente isso.

create table if not exists assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Dia local do MERCADO (America/Sao_Paulo), resolvido no servidor.
  --
  -- Não vem do cliente de propósito: qualquer valor que o cliente escolhe, o
  -- cliente pode girar — mandar um dia diferente a cada pergunta zeraria o teto
  -- sem esforço nenhum. E não é UTC porque a meia-noite de Londres são 21h aqui,
  -- e cortar a cota no começo da noite é cortá-la exatamente quando a mãe mais
  -- pergunta. Revisar se um dia houver usuária fora do fuso do Brasil.
  dia date not null,
  perguntas integer not null default 0,
  primary key (user_id, dia)
);

alter table assistant_usage enable row level security;

-- Mesma forma das outras policies do projeto: o vínculo com o dono é o que
-- autoriza. Aqui é direto, sem join — a tabela é da usuária, não do bebê.
create policy "usuária lê o próprio uso"
  on assistant_usage for select
  using (auth.uid() = user_id);

-- A escrita é da Edge Function, que roda com a service_role e ignora RLS. Não
-- existe policy de insert/update de propósito: se o cliente pudesse escrever
-- aqui, ele poderia zerar o próprio contador, e o teto viraria decoração.

comment on table assistant_usage is
  'Teto diário do assistente. Escrita só pela Edge Function (service_role).';

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- Esperado: 1 linha, rowsecurity = true, e 1 policy (só de select).
--
-- select relname, relrowsecurity
--   from pg_class
--  where relname = 'assistant_usage';
--
-- select polname, polcmd
--   from pg_policy
--  where polrelid = 'assistant_usage'::regclass;

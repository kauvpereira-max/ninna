-- Ninna — assinaturas (cobrança por Stripe na PWA)
-- Rodar inteiro no SQL Editor do painel do Supabase.
--
-- POR QUE ESTA TABELA EXISTE
--
-- A PWA cobra por Stripe direto, sem taxa de loja e sem revisão (PRODUTO.md §6).
-- A Stripe é a fonte da verdade sobre pagamento; esta tabela é a CÓPIA LOCAL do
-- que ela decidiu, para o app não precisar perguntar a ela a cada tela.
--
-- Ou seja: nada aqui é decidido pelo app. Tudo é escrito pelo webhook, a partir
-- de eventos assinados pela Stripe.
--
-- POR QUE UMA LINHA POR USUÁRIA, E NÃO POR ASSINATURA
--
-- Uma mãe tem no máximo uma assinatura ativa da Ninna. Guardar histórico de
-- assinaturas seria reimplementar o que a Stripe já guarda melhor — e o que o
-- app precisa saber é uma pergunta só: "esta conta pode usar o assistente
-- agora?".

create table if not exists assinaturas (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Identidade da mãe do lado da Stripe. Sobrevive ao cancelamento: se ela
  -- voltar, volta pro mesmo cliente, com o histórico de cobrança junto.
  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  -- Espelha o status da Stripe. 'nenhuma' é nosso, para quem nunca assinou.
  -- A leitura fica em src/lib/acesso.ts, que é onde mora a fronteira.
  status text not null default 'nenhuma',
  price_id text,

  -- Fim do período já pago. É o que dá crédito a quem cancelou ou a quem está
  -- com pagamento atrasado — ver o raciocínio em acesso.ts.
  valida_ate timestamptz,

  -- Instante do evento da Stripe que escreveu esta linha pela última vez.
  --
  -- Webhook não chega em ordem: um `customer.subscription.updated` de 3s atrás
  -- pode chegar DEPOIS de um `deleted` de 1s atrás, e aí a assinatura cancelada
  -- volta a valer sozinha. O webhook compara este campo e ignora o que for mais
  -- velho do que já está gravado.
  ultimo_evento_em timestamptz,

  atualizado_em timestamptz not null default now()
);

alter table assinaturas enable row level security;

-- A mãe lê a própria assinatura — é o que a tela usa pra saber se libera o
-- assistente e pra mostrar "sua assinatura renova em X".
create policy "usuária lê a própria assinatura"
  on assinaturas for select
  using (auth.uid() = user_id);

-- Não existe policy de insert nem de update, de propósito: quem escreve é o
-- webhook, com service_role. Se o cliente pudesse escrever aqui, ele se daria
-- acesso pago editando uma linha — a cobrança viria a ser decorativa.

create index if not exists idx_assinaturas_customer on assinaturas (stripe_customer_id);

comment on table assinaturas is
  'Cópia local do estado da Stripe. Escrita só pelo webhook (service_role).';

-- ============================================================
-- ⚠️ EXCLUSÃO DE CONTA E COBRANÇA — ler antes de apagar uma mãe
-- ============================================================
--
-- O `on delete cascade` apaga esta linha junto com a conta, como o termo LGPD
-- promete. Mas a assinatura na STRIPE não é apagada por isso — ela continua
-- renovando e cobrando o cartão de alguém que já saiu.
--
-- Excluir conta passa a ter DOIS passos, e o segundo é manual enquanto não
-- houver automação:
--   1. cancelar a assinatura no painel da Stripe;
--   2. apagar a usuária em Authentication > Users.
--
-- Nessa ordem. Invertida, some o `stripe_customer_id` e fica mais difícil achar
-- quem cancelar.

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- Esperado: rls_ligada = true, policies = 1 (só a de select).
--
-- select
--   (select relrowsecurity from pg_class where relname = 'assinaturas') as rls_ligada,
--   (select count(*) from pg_policy where polrelid = 'assinaturas'::regclass) as policies;

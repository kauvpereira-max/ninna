-- Ninna — migration 008: afiliadas, indicações e comissões
--
-- Rodar inteiro no SQL Editor. Não toca em nenhuma tabela existente.
--
-- ------------------------------------------------------------------
-- AS DECISÕES QUE ESTE ARQUIVO CONGELA (12/08/2026)
--
-- 1. Comissão ÚNICA, na primeira fatura paga — não recorrente. Recorrente a 20%
--    derruba a margem do plano anual de 45% para 25%, e o anual é o caso base
--    (PRODUTO.md §5: a margem que importa é R$5,61/mês, não R$24,90).
-- 2. 20% da primeira fatura, GRAVADO NA LINHA da indicação. Percentual em
--    constante reescreve o passado: mudar o programa mudaria comissão já
--    apurada. Aqui a mudança vale só para o que vier depois.
-- 3. O crédito nasce de `invoice.paid`, não da assinatura criada. São 7 dias
--    grátis: creditar na criação gera saldo sobre quem pode cancelar antes de
--    pagar.
--
-- ------------------------------------------------------------------
-- ⚠️ O REQUISITO QUE ORGANIZA O DESENHO INTEIRO
--
-- **A afiliada não pode ver QUEM indicou. Só contagem e valor.**
--
-- Nome ou e-mail de mãe num painel de terceiro é dado de criança vazando por
-- tabela, e o termo de participação promete o contrário.
--
-- Isso não é escolha de tela: é o motivo de `indicacoes` **não ter policy de
-- select para ninguém**. Não existe consulta que leve a afiliada até a identidade
-- da mãe, porque não existe caminho — e o que não existe não pode ser exposto
-- por um `select *` distraído numa tela futura.
--
-- O painel lê de `painel_da_afiliada()`, que devolve números e nada mais.

-- ============================================================
-- QUEM É AFILIADA
-- ============================================================
--
-- A afiliada é uma usuária do Supabase como qualquer outra — não há segunda base
-- de auth. Ter linha aqui é o que a torna afiliada, e é o que abre a rota do
-- painel. Um segundo sistema de login seria o dobro do trabalho e metade da
-- segurança (PRODUTO.md §3.5).

create table if not exists afiliadas (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- O que vai no `?ref=`. Curto, porque vai num story do Instagram.
  codigo text not null unique check (codigo ~ '^[a-z0-9-]{3,32}$'),

  -- Como ela é chamada no painel. Não é o nome da mãe indicada — é o dela.
  nome text not null,

  -- O percentual que as PRÓXIMAS indicações dela vão carregar. As antigas já
  -- gravaram o seu, e não olham para cá nunca mais.
  percentual_padrao int not null default 20 check (percentual_padrao between 0 and 100),

  ativa boolean not null default true,
  criada_em timestamptz not null default now()
);

alter table afiliadas enable row level security;

-- Ela lê a própria linha — é o que a tela usa para saber o código e o nome.
-- Não há policy de insert nem de update: quem cria afiliada é quem administra o
-- programa, com service_role. Se a afiliada pudesse escrever aqui, ela editaria
-- o próprio percentual.
create policy "afiliada lê a própria linha"
  on afiliadas for select
  using (auth.uid() = user_id);

-- ============================================================
-- A ATRIBUIÇÃO
-- ============================================================
--
-- Uma linha por mãe indicada, para sempre. `indicada_user_id` é UNIQUE: a
-- primeira atribuição vale, e a segunda não sobrescreve. Sem isso, um link
-- tocado depois roubaria a indicação de quem trouxe a mãe de verdade.

create table if not exists indicacoes (
  id uuid primary key default gen_random_uuid(),

  afiliada_user_id uuid not null references afiliadas (user_id) on delete cascade,

  -- ⚠️ ESTA COLUNA É O MOTIVO DE A TABELA SER FECHADA. Ela identifica a mãe.
  indicada_user_id uuid not null unique references auth.users (id) on delete cascade,

  -- Cópias do momento da atribuição. O código porque a afiliada pode trocar o
  -- dela; o percentual porque comissão apurada não muda de valor quando o
  -- programa muda.
  codigo text not null,
  percentual int not null check (percentual between 0 and 100),

  criada_em timestamptz not null default now()
);

create index if not exists idx_indicacoes_afiliada on indicacoes (afiliada_user_id);

alter table indicacoes enable row level security;

-- ⚠️ NENHUMA POLICY. De propósito, e é o requisito escrito em SQL.
--
-- Com RLS ligada e zero policies, a tabela é ilegível e inescrevível para
-- qualquer sessão autenticada. Só `service_role` — que ignora RLS — a alcança, e
-- quem usa service_role é o webhook e o script de administração.
--
-- A tentação futura será somar uma policy de select "só para a afiliada ver as
-- próprias indicações". É exatamente isso que não pode acontecer: as linhas dela
-- contêm `indicada_user_id`, e ler a linha é ler quem é a mãe.

-- ============================================================
-- O DINHEIRO
-- ============================================================
--
-- Razão (ledger), e não um saldo numa coluna. Uma linha por MOVIMENTO: o crédito
-- quando a fatura é paga, e o estorno como linha negativa quando ela é
-- devolvida.
--
-- Saldo que muda sozinho e sem linha é o que destrói a confiança de quem depende
-- dele. Aqui a afiliada vê o extrato, e a soma dele é o saldo.
--
-- Esta tabela é legível pela afiliada porque **não carrega identidade de mãe** —
-- só valor, tipo e data. É a diferença entre "quanto" e "de quem".

create table if not exists comissoes (
  id uuid primary key default gen_random_uuid(),

  afiliada_user_id uuid not null references afiliadas (user_id) on delete cascade,

  -- Referencia a indicação para o crédito não ser lançado duas vezes, mas NÃO
  -- expõe a mãe: quem só pode ler esta tabela não consegue abrir `indicacoes`.
  indicacao_id uuid not null references indicacoes (id) on delete cascade,

  -- 'credito' na fatura paga, 'estorno' quando ela é devolvida. Negativo é o
  -- valor, não o tipo — assim a soma é sempre soma.
  tipo text not null check (tipo in ('credito', 'estorno')),
  valor_centavos int not null,

  -- De qual fatura da Stripe veio. Único no crédito: é o que torna o webhook
  -- idempotente sem depender de a Stripe não reentregar — e ela reentrega.
  stripe_invoice_id text,

  criada_em timestamptz not null default now(),

  -- Crédito é positivo, estorno é negativo. O check impede a inversão de sinal
  -- que faria um estorno aumentar o saldo.
  constraint sinal_bate_com_tipo check (
    (tipo = 'credito' and valor_centavos > 0) or
    (tipo = 'estorno' and valor_centavos < 0)
  )
);

-- Um crédito por fatura. Reentrega da Stripe bate aqui e não credita de novo.
create unique index if not exists idx_comissoes_credito_unico
  on comissoes (stripe_invoice_id)
  where tipo = 'credito' and stripe_invoice_id is not null;

create index if not exists idx_comissoes_afiliada on comissoes (afiliada_user_id, criada_em desc);

alter table comissoes enable row level security;

-- O extrato. Só as dela, e sem identidade de ninguém.
create policy "afiliada lê as próprias comissões"
  on comissoes for select
  using (auth.uid() = afiliada_user_id);

-- ============================================================
-- O QUE O PAINEL LÊ
-- ============================================================
--
-- Função, e não view, de propósito. View de agregação precisa rodar com a
-- permissão do dono para atravessar a RLS de `indicacoes`, e view que atravessa
-- RLS é uma armadilha esperando um `select *` distraído. A função declara a
-- intenção no nome e devolve colunas fixas.
--
-- `security definer` para poder contar `indicacoes`, que ninguém lê. O
-- `search_path` fixo é obrigatório aqui: sem ele, uma tabela plantada num schema
-- do usuário poderia se passar por `indicacoes`.

create or replace function painel_da_afiliada()
returns table (
  indicacoes_total bigint,
  indicacoes_pagas bigint,
  creditado_centavos bigint,
  estornado_centavos bigint,
  saldo_centavos bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    (select count(*) from indicacoes i where i.afiliada_user_id = auth.uid()),
    (select count(distinct c.indicacao_id) from comissoes c
       where c.afiliada_user_id = auth.uid() and c.tipo = 'credito'),
    coalesce((select sum(c.valor_centavos) from comissoes c
       where c.afiliada_user_id = auth.uid() and c.tipo = 'credito'), 0),
    coalesce((select sum(c.valor_centavos) from comissoes c
       where c.afiliada_user_id = auth.uid() and c.tipo = 'estorno'), 0),
    coalesce((select sum(c.valor_centavos) from comissoes c
       where c.afiliada_user_id = auth.uid()), 0);
$$;

comment on function painel_da_afiliada is
  'Números do painel da afiliada. Nunca devolve identidade de mãe — ver 008.';

-- Sem `auth.uid()` não há o que somar, e a função é o único caminho até
-- `indicacoes`. Anon não entra.
revoke all on function painel_da_afiliada() from public, anon;
grant execute on function painel_da_afiliada() to authenticated;

-- ============================================================
-- COMO A ATRIBUIÇÃO ENTRA
-- ============================================================
--
-- `indicacoes` não tem policy de insert — de propósito, junto com o resto. Então
-- o app não escreve nela: ele CHAMA esta função, que é o único caminho.
--
-- Um caminho estreito e declarado vale mais que uma policy de insert: a policy
-- deixaria o cliente escolher `afiliada_user_id`, `percentual` e
-- `indicada_user_id`, e cada um desses é um jeito de fraudar. Aqui ele escolhe
-- uma coisa só — o código — e o resto o banco decide.
--
-- O que ela impede, e cada item é um vetor real:
--
--   · atribuir a conta de OUTRA pessoa — usa `auth.uid()`, não um parâmetro;
--   · escolher o próprio percentual — copia do cadastro da afiliada;
--   · roubar indicação já feita — `on conflict do nothing`, o primeiro vence;
--   · indicar a si mesma — o `and a.user_id <> auth.uid()`, que é a fraude mais
--     óbvia e a que mais aparece em programa de afiliado;
--   · usar código de afiliada desativada — o `and a.ativa`.
--
-- Devolve `void` e não erro quando o código não existe: código inválido veio de
-- uma URL montada à mão ou de um link velho, e não é problema da mãe que está
-- criando a conta. Ela não pode ver o cadastro travar por causa disso.

create or replace function registrar_indicacao(codigo_ref text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a afiliadas%rowtype;
begin
  if auth.uid() is null then
    return;
  end if;

  select * into a
  from afiliadas
  where afiliadas.codigo = lower(trim(codigo_ref))
    and afiliadas.ativa
    and afiliadas.user_id <> auth.uid();

  if not found then
    return;
  end if;

  insert into indicacoes (afiliada_user_id, indicada_user_id, codigo, percentual)
  values (a.user_id, auth.uid(), a.codigo, a.percentual_padrao)
  on conflict (indicada_user_id) do nothing;
end;
$$;

comment on function registrar_indicacao is
  'Único caminho de escrita em indicacoes. O cliente escolhe só o código — ver 008.';

revoke all on function registrar_indicacao(text) from public, anon;
grant execute on function registrar_indicacao(text) to authenticated;

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- 1 · As três tabelas com RLS ligada?
--     Esperado: 3 linhas, todas com rls = true.
--
-- select relname, relrowsecurity as rls from pg_class
-- where relname in ('afiliadas', 'indicacoes', 'comissoes');
--
-- 2 · `indicacoes` tem ZERO policies, e as outras duas têm uma cada?
--     Esperado: afiliadas 1, comissoes 1, indicacoes 0.
--     ⚠️ Se `indicacoes` tiver qualquer policy, o requisito caiu.
--
-- select c.relname, count(p.polname) as policies
-- from pg_class c left join pg_policy p on p.polrelid = c.oid
-- where c.relname in ('afiliadas', 'indicacoes', 'comissoes')
-- group by c.relname order by c.relname;
--
-- 3 · A função existe e é security definer com search_path fixo?
--     Esperado: uma linha, prosecdef = true, e `search_path` na config.
--
-- select proname, prosecdef, proconfig from pg_proc
-- where proname = 'painel_da_afiliada';

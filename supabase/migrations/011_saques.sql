-- Ninna — migration 011: o saque (etapa 5 do painel de afiliadas)
--
-- Rodar no SQL Editor. Cria uma tabela, uma função, e substitui `painel_da_afiliada`.
--
-- ------------------------------------------------------------------
-- ⚠️ O QUE ESTA MIGRATION **NÃO** FAZ, E É O REQUISITO MAIS IMPORTANTE DELA
--
-- O painel que serviu de referência mostra uma tabela com NOME e TELEFONE de
-- cada indicado. Isso não é construível aqui, e a razão não é a tela: é que
-- `indicacoes` tem RLS ligada e ZERO policies desde a 008, e nada abaixo abre
-- esse caminho.
--
-- Os cinco caminhos por onde vazaria, e o que cada um encontra:
--
-- | Caminho | O que este arquivo faz |
-- |---|---|
-- | policy de select em `indicacoes`     | nada aqui precisa dela. Continua zero |
-- | a função de saque ler `indicacoes`   | ela lê `comissoes` agregada e `saques` |
-- | `painel_da_afiliada` devolver lista  | devolve 6 escalares, nunca linhas |
-- | `saques` referenciar a indicação     | não há coluna. Saque é contra SALDO |
-- | histórico exibir identidade          | mostra a chave Pix DELA, de mais ninguém |
--
-- O único dado pessoal novo no sistema é a chave Pix da própria afiliada.
--
-- ------------------------------------------------------------------
-- A PRIMEIRA ESCRITA DO CLIENTE EM TODO O ESQUEMA DE AFILIADAS
--
-- `afiliadas`, `indicacoes` e `comissoes` não têm policy de insert, update nem
-- delete: tudo que escreve nelas é `service_role` (o webhook) ou função
-- `security definer`. O saque quebra essa simetria — é a primeira coisa que a
-- afiliada origina.
--
-- E por isso ele NÃO ganha policy de insert. A escrita passa por
-- `solicitar_saque()`, pelo mesmo motivo do `registrar_indicacao`: a regra é
-- "não pode pedir mais do que tem, nem menos que o mínimo, nem duas vezes", e
-- isso é uma agregação sobre duas tabelas. Numa policy ficaria ilegível; numa
-- função fica escrito.
--
-- O que ela pode fazer sozinha é LER os próprios saques. Só isso.
--
-- ------------------------------------------------------------------
-- O ESTADO NÃO É DELA
--
-- `estado` nasce 'pendente' e **não existe policy de update**. Sem isso, a
-- afiliada marcaria o próprio saque como 'pago'. Quem move o estado é quem
-- administra o programa, com service_role.

begin;

-- ------------------------------------------------------------------
-- A tabela
-- ------------------------------------------------------------------

create table if not exists saques (
  id uuid primary key default gen_random_uuid(),

  afiliada_user_id uuid not null references afiliadas (user_id) on delete cascade,

  -- Em centavos, como as comissões. Dinheiro em float é como se perde um.
  valor_centavos int not null check (valor_centavos > 0),

  -- ⚠️ Guardada NA SOLICITAÇÃO, não no perfil da afiliada. Uma chave por pedido,
  -- sem cadastro permanente de um dado que ela pode trocar — e sem manter chave
  -- viva de quem parou de indicar. Custa digitar de novo a cada saque.
  --
  -- O check é de sanidade, não de formato: chave Pix pode ser CPF, e-mail,
  -- telefone ou aleatória, e validar formato aqui só criaria um jeito de a
  -- solicitação ser recusada por uma regra que o Banco Central mudou.
  chave_pix text not null check (length(btrim(chave_pix)) between 4 and 140),

  estado text not null default 'pendente'
    check (estado in ('pendente', 'aprovado', 'pago', 'recusado')),

  -- Só faz sentido em 'recusado'. Fica livre de propósito: o motivo é escrito
  -- para uma pessoa ler, não para o app interpretar.
  motivo text,

  solicitado_em timestamptz not null default now(),
  decidido_em timestamptz,
  pago_em timestamptz
);

-- ⚠️ UMA SOLICITAÇÃO ABERTA POR VEZ.
--
-- Sem isto, dois toques no botão viram dois saques do mesmo saldo. O índice
-- resolve na camada certa: a função confere antes, mas conferir-e-inserir não é
-- atômico, e duas requisições simultâneas passariam as duas pela conferência.
--
-- 'recusado' e 'pago' ficam de fora porque são estados finais — depois deles ela
-- pode pedir de novo.
create unique index if not exists idx_saque_aberto_unico
  on saques (afiliada_user_id)
  where estado in ('pendente', 'aprovado');

create index if not exists idx_saques_afiliada
  on saques (afiliada_user_id, solicitado_em desc);

alter table saques enable row level security;

-- Ela lê os próprios. Nenhuma policy de insert, update ou delete — ver o topo.
create policy "afiliada lê os próprios saques"
  on saques for select
  using (auth.uid() = afiliada_user_id);

comment on table saques is
  'Solicitação de saque. Escrita só por solicitar_saque(); estado só por service_role. Ver 011.';

-- ------------------------------------------------------------------
-- O painel, agora descontando o que já foi sacado
-- ------------------------------------------------------------------
--
-- ⚠️ SEM ISTO, ELA SACA DUAS VEZES O MESMO DINHEIRO.
--
-- `disponivel_centavos` era "o que passou de 30 dias". Passa a ser "o que passou
-- de 30 dias, MENOS o que já foi pedido" — porque um saque pendente já
-- comprometeu aquele valor, mesmo antes de o Pix sair.
--
-- 'recusado' não desconta: pedido recusado devolve o saldo.
--
-- `total_centavos` continua sendo a comissão da vida toda, sem desconto de
-- saque. São perguntas diferentes: "quanto eu ganhei" e "quanto eu posso pedir".
--
-- `drop` antes do `create`, dentro de transação, pelo mesmo motivo da 010: as
-- colunas de saída fazem parte do tipo de retorno, e `create or replace` recusa
-- (42P13). A transação fecha a janela em que a função não existe, e o `grant`
-- precisa vir junto porque o `drop` leva os GRANTs embora.

drop function if exists painel_da_afiliada();

create function painel_da_afiliada()
returns table (
  indicacoes_total bigint,
  indicacoes_pagas bigint,
  total_centavos bigint,
  disponivel_centavos bigint,
  em_carencia_centavos bigint,
  sacado_centavos bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with por_indicacao as (
    select
      c.indicacao_id,
      sum(c.valor_centavos) as liquido,
      min(c.criada_em) filter (where c.tipo = 'credito') as creditada_em
    from comissoes c
    where c.afiliada_user_id = auth.uid()
    group by c.indicacao_id
  ),
  comprometido as (
    select coalesce(sum(s.valor_centavos), 0) as centavos
    from saques s
    where s.afiliada_user_id = auth.uid()
      and s.estado <> 'recusado'
  ),
  maduro as (
    select coalesce(sum(liquido), 0) as centavos
    from por_indicacao
    where creditada_em is not null
      and creditada_em <= now() - interval '30 days'
  )
  select
    (select count(*) from indicacoes i where i.afiliada_user_id = auth.uid()),
    (select count(*) from por_indicacao where creditada_em is not null),
    coalesce((select sum(liquido) from por_indicacao), 0),
    greatest((select centavos from maduro) - (select centavos from comprometido), 0),
    greatest(
      coalesce((
        select sum(liquido) from por_indicacao
        where creditada_em is not null
          and creditada_em > now() - interval '30 days'
      ), 0),
      0
    ),
    (select centavos from comprometido);
$$;

revoke all on function painel_da_afiliada() from public, anon;
grant execute on function painel_da_afiliada() to authenticated;

-- ------------------------------------------------------------------
-- A solicitação
-- ------------------------------------------------------------------
--
-- Devolve TEXTO, não `void`, e não levanta exceção nos casos previstos.
--
-- O motivo é a convenção do `src/lib`: função nunca joga exceção, erro vira
-- frase pronta para a mãe. Uma exceção aqui chegaria ao cliente como erro do
-- PostgREST, e o app teria que adivinhar a causa pela mensagem — que muda de
-- idioma e de texto entre versões do Postgres.
--
-- Os códigos são estáveis e a tela os traduz. 'ok' é o único desfecho feliz.

create or replace function solicitar_saque(valor_centavos int, chave_pix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- ⚠️ O MÍNIMO MORA AQUI, no servidor, e não na tela.
  --
  -- R$20. O Pix é gratuito, então o que o mínimo protege não é taxa: é o
  -- trabalho manual e o evento fiscal por transferência. Contra as comissões
  -- reais (R$29,98 no anual, R$4,98 no mensal), R$20 é menos de uma indicação
  -- anual — perto o bastante para não parecer que o dinheiro está preso.
  --
  -- Mudar aqui vale para o que vier depois. Saque já solicitado não se revisa.
  minimo constant int := 2000;

  a afiliadas%rowtype;
  disponivel bigint;
  chave text := btrim(chave_pix);
begin
  if auth.uid() is null then
    return 'sem_sessao';
  end if;

  select * into a from afiliadas where afiliadas.user_id = auth.uid();
  if not found then
    return 'sem_cadastro';
  end if;

  -- Link pausado não gera indicação nova, mas o saldo já apurado continua dela.
  -- Ainda assim o saque fica bloqueado: pausar é o momento em que alguém está
  -- revendo a relação, e é quando pagamento automático menos deve acontecer.
  if not a.ativa then
    return 'pausada';
  end if;

  if valor_centavos is null or valor_centavos < minimo then
    return 'minimo';
  end if;

  if length(chave) < 4 or length(chave) > 140 then
    return 'chave';
  end if;

  -- O mesmo cálculo do painel, e de propósito: se as duas contas divergirem, o
  -- número que ela vê não é o número que ela pode pedir.
  select p.disponivel_centavos into disponivel from painel_da_afiliada() p;

  if valor_centavos > coalesce(disponivel, 0) then
    return 'saldo';
  end if;

  insert into saques (afiliada_user_id, valor_centavos, chave_pix)
  values (auth.uid(), valor_centavos, chave);

  return 'ok';
exception
  -- O índice parcial pegou uma corrida: outra requisição abriu um saque entre a
  -- conferência acima e este insert. Não é erro do sistema, é a resposta certa.
  when unique_violation then
    return 'aberto';
end;
$$;

comment on function solicitar_saque is
  'Único caminho de escrita em saques pelo cliente. Devolve código, não exceção. Ver 011.';

revoke all on function solicitar_saque(int, text) from public, anon;
grant execute on function solicitar_saque(int, text) to authenticated;

commit;

-- ------------------------------------------------------------------
-- CONFERÊNCIA, depois de rodar
-- ------------------------------------------------------------------
--
-- 1 · `saques` tem UMA policy, e é de select?
--     Esperado: 1 linha, cmd = 'r'.
--
-- select polname, polcmd from pg_policy
-- where polrelid = 'saques'::regclass;
--
-- 2 · `indicacoes` continua com ZERO policies?
--     ⚠️ Esta é a conferência que importa. Esperado: afiliadas 1, comissoes 1,
--     indicacoes 0, saques 1.
--
-- select c.relname, count(p.polname) as policies
-- from pg_class c left join pg_policy p on p.polrelid = c.oid
-- where c.relname in ('afiliadas', 'indicacoes', 'comissoes', 'saques')
-- group by c.relname order by c.relname;
--
-- 3 · O painel devolve as SEIS colunas?
--
-- select * from painel_da_afiliada();

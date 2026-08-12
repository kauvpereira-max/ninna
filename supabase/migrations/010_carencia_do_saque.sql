-- Ninna — migration 010: a carência de 30 dias, e os dois números do painel
--
-- Rodar no SQL Editor. Substitui uma função; não toca em dado.
--
-- ------------------------------------------------------------------
-- SÃO DOIS NÚMEROS, E ELES NÃO SÃO O MESMO
--
-- | Total acumulado | tudo que foi creditado, menos estornos |
-- | Disponível para saque | o que já passou de 30 dias desde o crédito |
--
-- A distinção é de produto, não de contabilidade: **a palavra "disponível" só
-- pode aparecer no segundo.** É a mesma disciplina do card de insight — não
-- dizer antes de saber. Um número chamado "disponível" que depois não pode ser
-- sacado é pior que não mostrar número nenhum.
--
-- Por isso os dois vêm do banco, e não de uma subtração na tela: cálculo de
-- dinheiro que mora no cliente é cálculo que diverge do que o servidor pagaria.
--
-- ------------------------------------------------------------------
-- POR QUE 30 DIAS
--
-- Cobre o prazo em que uma fatura ainda pode ser estornada, e é curto o
-- bastante para não parecer que a Ninna está segurando o dinheiro dela.
--
-- Se um dia mudar, muda AQUI e vale para o que ainda não venceu — o extrato não
-- se reescreve, porque as linhas dele já aconteceram.
--
-- ------------------------------------------------------------------
-- E O ESTORNO É LINHA NEGATIVA, NÃO SUMIÇO
--
-- Decidido em 12/08/2026. Ledger que apaga o passado não é ledger, e a afiliada
-- precisa conseguir entender POR QUE o número mudou. "Sumiu" é o que gera
-- desconfiança — e mensagem no WhatsApp às 23h.

-- ------------------------------------------------------------------
-- ⚠️ `DROP` ANTES, E DENTRO DE UMA TRANSAÇÃO
--
-- A primeira versão deste arquivo usava `create or replace` e foi recusada:
--
--     42P13: cannot change return type of existing function
--
-- `create or replace function` substitui o CORPO, não a assinatura. As colunas
-- de saída fazem parte do tipo de retorno, e a 008 devolvia outras cinco
-- (`creditado_centavos`, `estornado_centavos`, `saldo_centavos`). Trocar isso
-- exige derrubar e recriar.
--
-- **E derrubar e recriar tem uma janela.** Entre o `drop` e o `create` a função
-- não existe, e um painel aberto nesse instante receberia erro. São
-- milissegundos e uma afiliada — mas DDL no Postgres é transacional, então a
-- janela custa `begin`/`commit` para deixar de existir. Custo zero, e a
-- alternativa é confiar que ninguém abriu a tela naquele milissegundo.
--
-- O `drop` também apaga os GRANTs. Por isso o `revoke`/`grant` do fim precisa
-- rodar junto, dentro da mesma transação — sem eles a função volta sem permissão
-- e o painel quebra de um jeito diferente.

begin;

drop function if exists painel_da_afiliada();

create function painel_da_afiliada()
returns table (
  indicacoes_total bigint,
  indicacoes_pagas bigint,
  total_centavos bigint,
  disponivel_centavos bigint,
  em_carencia_centavos bigint
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with por_indicacao as (
    -- Uma linha por indicação, com o líquido dela e a data do crédito.
    --
    -- Agrupar por indicação, e não somar movimentos soltos, é o que faz o
    -- estorno anular o crédito certo: sem isso, um estorno de uma comissão
    -- ainda em carência derrubaria o disponível de OUTRA comissão já liberada.
    select
      c.indicacao_id,
      sum(c.valor_centavos) as liquido,
      min(c.criada_em) filter (where c.tipo = 'credito') as creditada_em
    from comissoes c
    where c.afiliada_user_id = auth.uid()
    group by c.indicacao_id
  )
  select
    (select count(*) from indicacoes i where i.afiliada_user_id = auth.uid()),
    (select count(*) from por_indicacao where creditada_em is not null),

    -- Total: o que ela ganhou, com os estornos já descontados. Pode ser menor
    -- que o creditado, e é isso que o extrato explica linha a linha.
    coalesce((select sum(liquido) from por_indicacao), 0),

    -- Disponível: só o que passou da carência. O `greatest(…, 0)` existe porque
    -- "disponível para saque" negativo não quer dizer nada para quem lê — a
    -- dívida, se houver, continua visível no total e no extrato.
    greatest(
      coalesce((
        select sum(liquido) from por_indicacao
        where creditada_em is not null
          and creditada_em <= now() - interval '30 days'
      ), 0),
      0
    ),

    -- O que ainda está esperando. Existe para a tela poder dizer "faltam X" em
    -- vez de deixar a afiliada subtraindo dois números de cabeça e concluindo
    -- que sumiu dinheiro.
    greatest(
      coalesce((
        select sum(liquido) from por_indicacao
        where creditada_em is not null
          and creditada_em > now() - interval '30 days'
      ), 0),
      0
    );
$$;

comment on function painel_da_afiliada is
  'Números do painel: total, disponível após 30 dias de carência, e o que ainda '
  'espera. Nunca devolve identidade de mãe — ver 008 e 010.';

-- Dentro da transação de propósito: o `drop` acima levou os GRANTs junto, e uma
-- função sem permissão quebra o painel do mesmo jeito que uma função ausente.
revoke all on function painel_da_afiliada() from public, anon;
grant execute on function painel_da_afiliada() to authenticated;

commit;

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- 1 · A função devolve as CINCO colunas novas?
--     Esperado: uma linha, com `disponivel_centavos` e `em_carencia_centavos`.
--     Rodada por você no SQL Editor ela devolve zeros — o `auth.uid()` é nulo
--     fora de uma sessão. Isso é o esperado, e é o mesmo motivo de a função não
--     ser executável por `anon`.
--
-- select * from painel_da_afiliada();
--
-- 2 · A carência separa mesmo? (com uma indicação de teste no banco)
--     Esperado: o crédito antigo entra em `disponivel`, o de hoje entra em
--     `em_carencia`, e o total soma os dois.
--
-- begin;
--   insert into comissoes (afiliada_user_id, indicacao_id, tipo, valor_centavos, stripe_invoice_id, criada_em)
--   select afiliada_user_id, id, 'credito', 3000, 'in_carencia_velho', now() - interval '40 days'
--   from indicacoes limit 1;
--
--   select total_centavos, disponivel_centavos, em_carencia_centavos
--   from painel_da_afiliada();
-- rollback;

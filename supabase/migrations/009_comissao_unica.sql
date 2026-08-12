-- Ninna — migration 009: uma comissão por indicação, garantida pelo banco
--
-- Rodar no SQL Editor. Cria um índice; não toca em dado.
--
-- ------------------------------------------------------------------
-- POR QUE ISTO NÃO ESTAVA NA 008, E DEVERIA
--
-- A decisão nº 1 do bloco 1b é **comissão única, não recorrente** — e ela está
-- escrita no cabeçalho da 008, em prosa, com o argumento de margem inteiro.
-- Prosa não recusa insert.
--
-- A 008 garante uma coisa parecida e insuficiente: `idx_comissoes_credito_unico`
-- impede creditar **a mesma fatura** duas vezes, que é a reentrega da Stripe. Ela
-- não impede creditar a fatura do mês 2, do mês 3, do mês 12 — cada uma com id
-- diferente, cada uma passando no índice, e a comissão única virando recorrente
-- sem ninguém escrever uma linha para isso acontecer.
--
-- O modo de falha é o pior possível: não dá erro, e o efeito só aparece na
-- margem, meses depois, quando alguém for entender por que a conta não fecha.
--
-- ------------------------------------------------------------------
-- POR QUE ÍNDICE, E NÃO UM `if` NO WEBHOOK
--
-- O webhook vai conferir também — é ele que decide não creditar. Mas o `if` está
-- no código que a Stripe chama em paralelo: duas entregas simultâneas do mesmo
-- evento leem "não existe crédito" ao mesmo tempo e as duas inserem.
--
-- Índice único é a única coisa que resolve corrida. O `if` é para não gastar
-- viagem; o índice é para estar certo.

create unique index if not exists idx_comissoes_uma_por_indicacao
  on comissoes (indicacao_id)
  where tipo = 'credito';

comment on index idx_comissoes_uma_por_indicacao is
  'Comissão é ÚNICA: um crédito por indicação, para sempre. Ver 009.';

-- ============================================================
-- CONFERÊNCIA — rodar depois
-- ============================================================
--
-- 1 · O índice existe e é único e parcial?
--     Esperado: uma linha, com `unique` e o `WHERE (tipo = 'credito')` visíveis.
--
-- select indexname, indexdef from pg_indexes
-- where tablename = 'comissoes' and indexname = 'idx_comissoes_uma_por_indicacao';
--
-- 2 · Ele RECUSA o segundo crédito na mesma indicação?
--     Esperado: erro de chave duplicada na segunda linha.
--     Rode dentro de uma transação que você mesma desfaz — e note que o segundo
--     insert usa uma fatura DIFERENTE, que é justamente o caso que a 008 deixava
--     passar.
--
-- begin;
--   insert into comissoes (afiliada_user_id, indicacao_id, tipo, valor_centavos, stripe_invoice_id)
--   select afiliada_user_id, id, 'credito', 100, 'in_teste_1' from indicacoes limit 1;
--
--   insert into comissoes (afiliada_user_id, indicacao_id, tipo, valor_centavos, stripe_invoice_id)
--   select afiliada_user_id, id, 'credito', 100, 'in_teste_2' from indicacoes limit 1;
-- rollback;
--
-- 3 · E DEIXA passar o estorno?
--     Esperado: sucesso. Sem isto, um índice sobre todos os tipos impediria a
--     linha negativa — e o estorno é justamente o que precisa acontecer depois
--     do crédito.
--
-- begin;
--   insert into comissoes (afiliada_user_id, indicacao_id, tipo, valor_centavos, stripe_invoice_id)
--   select afiliada_user_id, id, 'credito', 100, 'in_teste_3' from indicacoes limit 1;
--
--   insert into comissoes (afiliada_user_id, indicacao_id, tipo, valor_centavos, stripe_invoice_id)
--   select afiliada_user_id, id, 'estorno', -100, 'in_teste_3' from indicacoes limit 1;
-- rollback;

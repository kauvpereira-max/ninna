-- Ninna — exclusão em cascata (D4 do beta)
-- Rodar inteiro no SQL Editor do painel do Supabase.
--
-- POR QUE ESTA MIGRATION EXISTE
--
-- Nenhuma das 7 chaves estrangeiras do 001 declarou `on delete`, então todas
-- ficaram em `no action`. Consequência prática:
--
--   * apagar uma mãe em Authentication > Users FALHA com erro 23503 enquanto
--     ela tiver bebê cadastrado;
--   * apagar um bebê FALHA enquanto ele tiver qualquer registro.
--
-- Ou seja: a via de saída que o termo LGPD promete não funcionava. Excluir uma
-- conta exigiria 7 DELETEs na ordem certa, feitos à mão no painel — operação que
-- um fundador cansado executa parcialmente uma hora, deixando registro de saúde
-- de bebê órfão no banco depois de ter prometido exclusão total.
--
-- Com cascata, excluir a mãe em Authentication > Users apaga bebês e registros
-- junto, numa transação só. É isso que torna o item 13 da checklist do BETA.md
-- ("executei uma exclusão completa e confirmei no banco que não sobrou registro")
-- verificável em vez de aspiracional.
--
-- Seguro rodar agora: o beta ainda não tem mãe real dentro, e a operação só troca
-- a regra de integridade — não toca em nenhuma linha existente.

-- ============================================================
-- babies → auth.users
-- ============================================================
alter table babies drop constraint if exists babies_user_id_fkey;
alter table babies
  add constraint babies_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- ============================================================
-- registros → babies
-- ============================================================
alter table feeding_records drop constraint if exists feeding_records_baby_id_fkey;
alter table feeding_records
  add constraint feeding_records_baby_id_fkey
  foreign key (baby_id) references babies (id) on delete cascade;

alter table sleep_records drop constraint if exists sleep_records_baby_id_fkey;
alter table sleep_records
  add constraint sleep_records_baby_id_fkey
  foreign key (baby_id) references babies (id) on delete cascade;

alter table diaper_records drop constraint if exists diaper_records_baby_id_fkey;
alter table diaper_records
  add constraint diaper_records_baby_id_fkey
  foreign key (baby_id) references babies (id) on delete cascade;

alter table mood_records drop constraint if exists mood_records_baby_id_fkey;
alter table mood_records
  add constraint mood_records_baby_id_fkey
  foreign key (baby_id) references babies (id) on delete cascade;

alter table symptom_records drop constraint if exists symptom_records_baby_id_fkey;
alter table symptom_records
  add constraint symptom_records_baby_id_fkey
  foreign key (baby_id) references babies (id) on delete cascade;

-- baby_patterns ainda está vazia (o motor do beta calcula no cliente), mas entra
-- junto: tabela esquecida é exatamente o que sobra depois de uma exclusão.
alter table baby_patterns drop constraint if exists baby_patterns_baby_id_fkey;
alter table baby_patterns
  add constraint baby_patterns_baby_id_fkey
  foreign key (baby_id) references babies (id) on delete cascade;

-- ============================================================
-- CONFERÊNCIA — rodar depois e esperar 7 linhas, todas com delete_rule = CASCADE
-- ============================================================
--
-- POR QUE ESTA CONSULTA LÊ O CATÁLOGO, E NÃO O information_schema
--
-- A versão anterior consultava information_schema.table_constraints juntando com
-- referential_constraints. Em 06/08/2026 ela devolveu "Success. No rows returned"
-- num banco onde as 7 cascatas existiam e estavam corretas — conferido em seguida
-- pelo catálogo, na mesma sessão, como `postgres`.
--
-- Gabarito que reprova banco certo é pior que gabarito nenhum: este arquivo é a
-- prova de um item de checklist (§11.3 do BETA.md, que libera o termo LGPD), e o
-- zero levou a investigar perda de integridade referencial que nunca houve. O
-- passo seguinte teria sido reescrever uma migration sadia.
--
-- ⚠️ O modo de falha exato daquela consulta NÃO foi reproduzido, e não está
-- escrito aqui como se fosse conhecido. O que se sabe, e já basta para não voltar
-- a depender daquelas views numa prova:
--
--   * elas filtram por privilégio da sessão (pg_has_role sobre o dono da tabela).
--     A mesma consulta responde coisas diferentes conforme o papel de quem roda —
--     e resposta que depende do papel não serve de gabarito;
--   * o join era por nome de constraint, e nome de constraint só é único DENTRO
--     de uma tabela. Duas tabelas com FK de mesmo nome no mesmo schema cruzariam
--     linhas. Hoje não acontece porque os 7 nomes diferem, mas é defeito latente
--     numa consulta cuja única função é provar.
--
-- pg_constraint não tem filtro de privilégio e traz a tabela na própria linha.
--
-- select t.relname   as tabela,
--        c.conname   as constraint_name,
--        ref.relname as referencia,
--        case c.confdeltype
--          when 'a' then 'NO ACTION'
--          when 'r' then 'RESTRICT'
--          when 'c' then 'CASCADE'
--          when 'n' then 'SET NULL'
--          when 'd' then 'SET DEFAULT'
--        end as delete_rule
--   from pg_constraint c
--   join pg_class t     on t.oid = c.conrelid
--   join pg_namespace n on n.oid = t.relnamespace
--   join pg_class ref   on ref.oid = c.confrelid
--  where c.contype = 'f'
--    and n.nspname = 'public'
--  order by t.relname;
--
-- Resultado esperado, e o que foi obtido em 06/08/2026:
--
--   babies           babies_user_id_fkey           users   CASCADE
--   baby_patterns    baby_patterns_baby_id_fkey    babies  CASCADE
--   diaper_records   diaper_records_baby_id_fkey   babies  CASCADE
--   feeding_records  feeding_records_baby_id_fkey  babies  CASCADE
--   mood_records     mood_records_baby_id_fkey     babies  CASCADE
--   sleep_records    sleep_records_baby_id_fkey    babies  CASCADE
--   symptom_records  symptom_records_baby_id_fkey  babies  CASCADE

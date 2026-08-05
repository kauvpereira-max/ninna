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
-- select tc.table_name, tc.constraint_name, rc.delete_rule
--   from information_schema.table_constraints tc
--   join information_schema.referential_constraints rc
--     on rc.constraint_name = tc.constraint_name
--    and rc.constraint_schema = tc.table_schema
--  where tc.constraint_type = 'FOREIGN KEY'
--    and tc.table_schema = 'public'
--  order by tc.table_name;

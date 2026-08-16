-- Ninna — migration 012: inscrições de push
--
-- Rodar no SQL Editor. Cria uma tabela e duas funções; não toca em dado existente.
--
-- ------------------------------------------------------------------
-- O QUE ESTE BLOCO NÃO É — decidido em 16/08/2026
--
-- Não é retenção. As duas notificações desta versão são o sono em aberto (fato
-- sobre o estado do app) e a métrica que passou a ter dado suficiente (a promessa
-- do produto se cumprindo). Nenhuma das duas traz a mãe de volta todo dia, e não
-- foram escolhidas para isso. PRODUTO.md §3.2.
--
-- O que está PROIBIDO nascer aqui, e vale escrever no banco porque a tentação
-- chega meses depois: "você não registrou hoje" (culpa) e "está na hora da
-- mamada" (previsão sobre um motor que descreve o passado).
--
-- ------------------------------------------------------------------
-- UMA LINHA POR APARELHO, NÃO POR MÃE
--
-- A mesma mãe tem o telefone e o tablet, e o navegador dá um `endpoint`
-- diferente para cada instalação. A chave é o endpoint.

begin;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- A URL do serviço de push (FCM, Mozilla, Apple). Identifica o aparelho.
  endpoint text not null unique,

  -- As duas chaves da criptografia ponta a ponta do Web Push. Sem elas o
  -- servidor não consegue cifrar o payload, e o push não sai.
  p256dh text not null,
  auth text not null,

  -- Quando ela ligou. Serve para saber há quanto tempo uma inscrição morta está
  -- ocupando espaço, se a limpeza falhar.
  criada_em timestamptz not null default now(),

  -- Último envio bem-sucedido. `null` quer dizer "nunca enviei nada".
  ultimo_envio timestamptz
);

create index if not exists idx_push_user on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Ela lê e apaga as próprias — apagar é o que faz "desligar notificação" no
-- aparelho funcionar sem depender do servidor.
create policy "usuária lê as próprias inscrições"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "usuária apaga as próprias inscrições"
  on push_subscriptions for delete
  using (auth.uid() = user_id);

-- ⚠️ SEM policy de INSERT. A escrita passa por `registrar_push()`, pelo mesmo
-- motivo do `solicitar_saque()`: o `user_id` não pode vir do cliente, e um
-- insert direto permitiria inscrever o aparelho dela na conta de outra pessoa —
-- que é como se recebe a notificação de um bebê alheio.

create or replace function registrar_push(endpoint text, p256dh text, auth_key text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return 'sem_sessao';
  end if;
  if length(btrim(endpoint)) < 20 or length(btrim(p256dh)) < 20 or length(btrim(auth_key)) < 10 then
    return 'invalida';
  end if;

  -- O mesmo aparelho reinscrito troca de dono: ela saiu da conta, entrou noutra,
  -- e o endpoint é o mesmo. Sem o `do update`, a notificação continuaria indo
  -- para a conta antiga — e é dado de bebê chegando em telefone de outra pessoa.
  insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), btrim(endpoint), btrim(p256dh), btrim(auth_key))
  on conflict (endpoint) do update
    set user_id = auth.uid(),
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        criada_em = now();

  return 'ok';
end;
$$;

revoke all on function registrar_push(text, text, text) from public, anon;
grant execute on function registrar_push(text, text, text) to authenticated;

-- ------------------------------------------------------------------
-- ⚠️ A LIMPEZA DO 410 — nasce junto, não depois
-- ------------------------------------------------------------------
--
-- Inscrição de push MORRE sozinha: a mãe desinstala a PWA, limpa o navegador,
-- troca de telefone. O serviço de push passa a responder **410 Gone** (ou 404), e
-- aquele endpoint nunca mais vai entregar nada.
--
-- Sem esta função, a tabela vira lixo que cresce: cada envio tenta entregar em
-- endpoints mortos, gasta invocação, e o número de "inscritas" mente. Um ano
-- assim e ninguém sabe mais quantas mães realmente recebem.
--
-- Quem chama é a Edge Function de envio, no mesmo laço em que envia — 410 chegou,
-- linha sai. Não é rotina de manutenção agendada que alguém precisa lembrar de
-- criar: é consequência imediata da resposta do servidor de push.
--
-- `security definer` porque quem apaga é o serviço, e ele não tem sessão de
-- usuária. O parâmetro é o endpoint, que é o que a resposta HTTP identifica.

create or replace function apagar_push_morto(endpoint_morto text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  delete from push_subscriptions where endpoint = endpoint_morto;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function apagar_push_morto(text) from public, anon, authenticated;
-- Só service_role executa: é o envio que descobre que o endpoint morreu.

commit;

-- ------------------------------------------------------------------
-- CONFERÊNCIA, depois de rodar
-- ------------------------------------------------------------------
--
-- 1 · Duas policies, ambas da usuária, e NENHUMA de insert?
--     Esperado: select e delete. Se aparecer insert, a trava caiu.
--
-- select polname, polcmd from pg_policy where polrelid = 'push_subscriptions'::regclass;
--
-- 2 · O quadro completo das policies continua o esperado?
--     afiliadas 1 · comissoes 1 · indicacoes 0 · saques 1 · push_subscriptions 2
--
-- select c.relname, count(p.polname) from pg_class c
-- left join pg_policy p on p.polrelid = c.oid
-- where c.relname in ('afiliadas','indicacoes','comissoes','saques','push_subscriptions')
-- group by c.relname order by c.relname;

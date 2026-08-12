// O webhook da Stripe — a única coisa que escreve na tabela `assinaturas`.
//
//   supabase functions deploy stripe-webhook --use-api
//
// ------------------------------------------------------------------
// A AUTENTICAÇÃO AQUI É A ASSINATURA, NÃO O JWT
//
// `verify_jwt = false` no `config.toml`, porque quem chama é a Stripe e ela não
// tem sessão no Supabase. Isso não deixa o endpoint aberto: a primeira coisa que
// esta função faz é verificar a assinatura criptográfica do corpo com o
// `STRIPE_WEBHOOK_SECRET`. Sem assinatura válida, nada é lido e nada é gravado.
//
// ⚠️ `constructEventAsync`, e não `constructEvent`. A versão síncrona usa a
// crypto do Node, que não existe no Deno — ela falha em runtime, e o sintoma é
// TODO evento sendo recusado como inválido enquanto o segredo está certo.
//
// ⚠️ O corpo tem que ser lido como TEXTO CRU. Qualquer `JSON.parse` antes da
// verificação muda os bytes e a assinatura deixa de bater.
//
// ------------------------------------------------------------------
// WEBHOOK NÃO CHEGA EM ORDEM, E ISSO É O BUG QUE CUSTA CARO
//
// A Stripe reentrega e reordena. Um `customer.subscription.updated` gerado 3s
// antes pode chegar DEPOIS de um `deleted` gerado 1s antes — e a assinatura
// cancelada volta a valer sozinha, dando acesso pago de graça sem ninguém notar.
//
// Por isso cada linha guarda `ultimo_evento_em`, e evento mais velho que o
// gravado é descartado. É a diferença entre "a última mensagem que chegou" e "o
// último estado que aconteceu".

import Stripe from 'npm:stripe@22.4.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { lerAmbiente } from '../_shared/ambiente.ts';

/**
 * Os eventos que importam.
 *
 * Deliberadamente curto. `checkout.session.completed` não está aqui: ele diz que
 * a mãe terminou o formulário, não que a assinatura existe e está paga. Quem diz
 * isso são os eventos de `subscription`, e usar o de checkout como atalho é como
 * se dá acesso a quem abandonou o pagamento no último passo.
 */
const EVENTOS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  /**
   * O sexto, e ele não é sobre assinatura: é sobre a comissão da afiliada.
   *
   * A comissão nasce no PAGAMENTO, não na assinatura criada. São 7 dias grátis —
   * creditar na criação geraria saldo sobre quem pode cancelar antes de pagar
   * qualquer coisa, e aí ou a Ninna paga por nada, ou estorna saldo que a
   * afiliada já viu, que é pior.
   *
   * Daria para inferir de um `subscription.updated` que muda `trialing → active`.
   * Não é o que se faz aqui, e a razão é o modo de falha: no dia em que a Stripe
   * mudar essa transição, nada dá erro — só para de creditar em silêncio, e a
   * afiliada divulga sem receber. `invoice.paid` é explícito e carrega o valor
   * pago dentro, que é exatamente o número de que a comissão precisa.
   */
  'invoice.paid',
]);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('método não suportado', { status: 405 });

  const chaveStripe = lerAmbiente('STRIPE_API_KEY');
  const segredoWebhook = lerAmbiente('STRIPE_WEBHOOK_SECRET');
  const url = lerAmbiente('SUPABASE_URL');
  const service = lerAmbiente('SUPABASE_SERVICE_ROLE_KEY');
  if (!chaveStripe || !segredoWebhook || !url || !service) {
    console.error('[webhook] faltando variável de ambiente');
    // 500 e não 400: a Stripe reentrega em 5xx, e é isso que se quer enquanto o
    // problema é nosso.
    return new Response('configuração ausente', { status: 500 });
  }

  const assinatura = req.headers.get('stripe-signature');
  if (!assinatura) return new Response('sem assinatura', { status: 400 });

  const stripe = new Stripe(chaveStripe, { apiVersion: '2026-07-29.dahlia' });

  let evento: Stripe.Event;
  try {
    const corpoCru = await req.text();
    evento = await stripe.webhooks.constructEventAsync(corpoCru, assinatura, segredoWebhook);
  } catch (erro) {
    // 400 de propósito: assinatura inválida não melhora com reentrega, e pedir
    // pra Stripe insistir num corpo adulterado seria pior que recusar.
    console.error('[webhook] assinatura inválida:', erro instanceof Error ? erro.message : erro);
    return new Response('assinatura inválida', { status: 400 });
  }

  if (!EVENTOS.has(evento.type)) {
    // 200 sem fazer nada: evento que não interessa não é erro, e devolver 4xx
    // faria a Stripe reentregar para sempre e marcar o endpoint como quebrado.
    return new Response('ignorado', { status: 200 });
  }

  const comoServico = createClient(url, service);

  /**
   * A fatura paga segue por outro caminho, e a separação é o ponto.
   *
   * Tudo abaixo assume que `evento.data.object` é uma `Subscription` e escreve em
   * `assinaturas`. Uma fatura não é uma assinatura, não tem `status` nem
   * `ended_at`, e não deve encostar naquela tabela — passá-la pelo mesmo caminho
   * gravaria lixo no que decide se a mãe tem acesso pago.
   */
  if (evento.type === 'invoice.paid') {
    return await creditarComissao(evento, comoServico);
  }

  try {
    const assinaturaStripe = evento.data.object as Stripe.Subscription;
    const customerId =
      typeof assinaturaStripe.customer === 'string'
        ? assinaturaStripe.customer
        : assinaturaStripe.customer?.id;

    if (!customerId) {
      console.error('[webhook] evento sem cliente:', evento.id);
      return new Response('sem cliente', { status: 200 });
    }

    // O vínculo pelo metadata vem primeiro: ele sobrevive à linha local sumir.
    // O customer_id é o caminho normal.
    const userId =
      (assinaturaStripe.metadata?.supabase_user_id as string | undefined) ??
      (
        await comoServico
          .from('assinaturas')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
      ).data?.user_id;

    if (!userId) {
      // Sem dono conhecido não há o que atualizar. 200 porque reentregar não
      // resolveria — o vínculo não vai aparecer sozinho.
      console.error('[webhook] cliente sem usuária:', customerId, evento.id);
      return new Response('sem usuária', { status: 200 });
    }

    const eventoEm = new Date(evento.created * 1000).toISOString();

    // A trava contra reordenação. Lida antes de escrever, comparada depois.
    const { data: atual } = await comoServico
      .from('assinaturas')
      .select('ultimo_evento_em')
      .eq('user_id', userId)
      .maybeSingle();

    if (atual?.ultimo_evento_em && new Date(atual.ultimo_evento_em) > new Date(eventoEm)) {
      console.log(`[webhook] ${evento.id} é mais velho que o estado gravado — ignorado`);
      return new Response('fora de ordem', { status: 200 });
    }

    // Até quando o acesso vale.
    //
    // `ended_at` ANTES de `current_period_end`, e a ordem é o ponto:
    //
    // - assinatura viva (active, trialing, cancelar-no-fim-do-período) tem
    //   `ended_at` nulo, e vale até o fim do período pago — que é a promessa:
    //   quem cancelou hoje não perde o mês que já pagou;
    // - assinatura encerrada NA HORA (estorno, fraude, cortesia revogada) tem
    //   `ended_at` preenchido com o instante em que acabou, e é ele que manda.
    //
    // Só `current_period_end` dava um mês de graça a quem foi cortado hoje: a
    // Stripe deixa o fim do período no futuro mesmo depois de encerrar.
    const fimDoPeriodo = assinaturaStripe.ended_at ?? assinaturaStripe.items?.data?.[0]?.current_period_end;

    const { error } = await comoServico.from('assinaturas').upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: assinaturaStripe.id,
        // `deleted` chega com status 'canceled'; guardamos o que a Stripe diz e
        // deixamos a leitura para `acesso.ts` — é lá que "cancelada com mês pago
        // ainda vale" está escrito e testado.
        status: assinaturaStripe.status,
        price_id: assinaturaStripe.items?.data?.[0]?.price?.id ?? null,
        valida_ate: fimDoPeriodo ? new Date(fimDoPeriodo * 1000).toISOString() : null,
        ultimo_evento_em: eventoEm,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) throw new Error(error.message);

    console.log(`[webhook] ${evento.type} → ${assinaturaStripe.status} (${userId})`);
    return new Response('ok', { status: 200 });
  } catch (erro) {
    // 500 para a Stripe reentregar: aqui a falha é nossa e provavelmente passa.
    console.error('[webhook]', erro instanceof Error ? erro.message : erro);
    return new Response('erro interno', { status: 500 });
  }
});

/**
 * A comissão da afiliada, creditada quando a fatura é paga.
 *
 * ------------------------------------------------------------------
 * O QUE ELA GARANTE, E ONDE CADA GARANTIA MORA
 *
 * | Garantia | Onde |
 * |---|---|
 * | Não credita a mesma fatura duas vezes | índice único da `008` |
 * | **Não credita duas vezes a mesma indicação** — comissão é única | índice único da `009` |
 * | Não inventa percentual | vem gravado na linha da indicação |
 * | Não credita quem não foi indicada | não há linha em `indicacoes` |
 *
 * O `if` daqui existe para não gastar viagem ao banco. Quem está CERTO são os
 * índices: a Stripe entrega em paralelo, e duas entregas simultâneas leem "não
 * existe crédito" ao mesmo tempo. `if` não resolve corrida; índice único resolve.
 *
 * ------------------------------------------------------------------
 * ⚠️ E AQUI O 500 É O COMPORTAMENTO CERTO, AO CONTRÁRIO DO RESTO
 *
 * No caminho da assinatura, "cliente sem usuária" devolve 200: o vínculo não vai
 * aparecer sozinho, e pedir reentrega seria insistir para sempre num evento que
 * nunca vai casar.
 *
 * Aqui é o oposto. `invoice.paid` PODE chegar antes de `subscription.created` —
 * a Stripe não promete ordem —, e nesse instante a linha em `assinaturas` ainda
 * não existe. Devolver 200 perderia a comissão para sempre, em silêncio. Com 500
 * a Stripe reentrega por horas, e a essa altura o vínculo existe.
 *
 * A diferença entre os dois casos é uma pergunta só: **esperar resolve?** Lá não,
 * aqui sim.
 */
async function creditarComissao(
  evento: Stripe.Event,
  comoServico: ReturnType<typeof createClient>
): Promise<Response> {
  try {
    const fatura = evento.data.object as Stripe.Invoice;

    const customerId =
      typeof fatura.customer === 'string' ? fatura.customer : fatura.customer?.id;
    const pago = fatura.amount_paid ?? 0;

    // Fatura de valor zero não gera comissão e NÃO consome a indicação: cupom de
    // 100% ou fatura de fechamento de trial não são "a primeira fatura paga". A
    // próxima que tiver valor credita normalmente.
    if (!customerId || pago <= 0) {
      return new Response('sem valor a comissionar', { status: 200 });
    }

    const { data: assinatura } = await comoServico
      .from('assinaturas')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    const userId = assinatura?.user_id as string | undefined;
    if (!userId) {
      // Ver o aviso acima: aqui esperar resolve, então 500 para reentregar.
      console.error(`[webhook] fatura ${fatura.id} sem usuária ainda — pedindo reentrega`);
      return new Response('usuária ainda não vinculada', { status: 500 });
    }

    const { data: indicacao } = await comoServico
      .from('indicacoes')
      .select('id, afiliada_user_id, percentual')
      .eq('indicada_user_id', userId)
      .maybeSingle();

    if (!indicacao) {
      // O caso comum: a maioria das mães não vem de afiliada.
      return new Response('sem indicação', { status: 200 });
    }

    const valor = Math.round((pago * (indicacao.percentual as number)) / 100);
    if (valor <= 0) return new Response('comissão arredondou para zero', { status: 200 });

    const { error } = await comoServico.from('comissoes').insert({
      afiliada_user_id: indicacao.afiliada_user_id,
      indicacao_id: indicacao.id,
      tipo: 'credito',
      valor_centavos: valor,
      stripe_invoice_id: fatura.id,
    });

    if (error) {
      // 23505 é violação de índice único, e aqui ela é o DESFECHO ESPERADO em
      // dois casos legítimos: reentrega da mesma fatura, e a segunda fatura da
      // mesma indicação (mês 2 em diante). Nos dois, o crédito certo já existe.
      //
      // Tratar isso como erro faria a Stripe reentregar para sempre um evento
      // que já foi processado com sucesso.
      if (error.code === '23505') {
        console.log(`[webhook] comissão da fatura ${fatura.id} já estava creditada`);
        return new Response('já creditada', { status: 200 });
      }
      throw new Error(error.message);
    }

    console.log(
      `[webhook] comissão de ${valor} centavos creditada para ${indicacao.afiliada_user_id}`
    );
    return new Response('creditada', { status: 200 });
  } catch (erro) {
    console.error('[webhook/comissao]', erro instanceof Error ? erro.message : erro);
    return new Response('erro interno', { status: 500 });
  }
}

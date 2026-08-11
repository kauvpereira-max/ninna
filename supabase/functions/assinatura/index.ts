// Cria a sessão de Checkout e a do Portal do Cliente.
//
//   supabase functions deploy assinatura --use-api
//
// ------------------------------------------------------------------
// O QUE ELA FAZ
//
// Duas coisas, e nenhuma delas decide nada sobre acesso:
//
//   POST { acao: 'assinar', plano: 'mensal' | 'anual' }  → URL do Checkout
//   POST { acao: 'gerenciar' }                            → URL do Portal
//
// Quem decide se a assinatura vale é `src/lib/acesso.ts`, a partir do que o
// webhook gravou. Esta função só abre portas hospedadas pela Stripe.
//
// ------------------------------------------------------------------
// POR QUE CHECKOUT HOSPEDADO, E NÃO FORMULÁRIO PRÓPRIO
//
// Cartão nunca toca o nosso código. Sem campo de cartão, não há PCI para
// carregar, não há dado de pagamento no bundle que a mãe baixa, e a tela de
// pagamento é a mesma que ela já viu em outros lugares — o que, numa compra de
// R$24,90 feita às 3h da manhã, é confiança que não se constrói de outro jeito.
//
// O Portal do Cliente segue a mesma lógica: cancelar, trocar cartão e ver
// faturas são telas da Stripe. Construir isso à mão seria reimplementar, pior,
// o que já existe — e cancelamento difícil é reclamação em vez de churn limpo.

import Stripe from 'npm:stripe@22.4.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { headersCors, respostaDePreflight } from '../_shared/cors.ts';

// ------------------------------------------------------------------
// Configuração
// ------------------------------------------------------------------

/**
 * Os dois preços do produto Ninna, por variável de ambiente.
 *
 * Eles não são segredo — identificam, não autorizam — mas MUDAM entre teste e
 * produção: modo live tem outros IDs. Escritos no código, virar o modo seria um
 * commit, e virada de modo não pode depender de deploy de código.
 *
 * Configurados como secrets, ao lado da STRIPE_API_KEY.
 */
type Plano = 'mensal' | 'anual';

const PRECOS: Record<Plano, string | undefined> = {
  mensal: Deno.env.get('STRIPE_PRICE_MENSAL'),
  anual: Deno.env.get('STRIPE_PRICE_ANUAL'),
};

/** Sete dias, como previsto no brand deck. O custo disso está no PRODUTO.md §5. */
const DIAS_DE_TESTE = 7;

const APP_URL = 'https://ninna-sigma.vercel.app';

/**
 * Rótulo do fluxo no painel da Stripe, para comparar checkouts depois.
 * O sufixo de 8 letras é exigência da API a partir de `2026-03-25.dahlia`.
 */
const IDENTIFICADOR_DO_FLUXO = 'ninna-pwa-checkout-qvbtkzmr';

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const ERRO =
  'Não consegui abrir a tela de pagamento agora. Tenta de novo em instantes — nada foi cobrado.';

// ------------------------------------------------------------------
// A função
// ------------------------------------------------------------------

async function tratar(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ erro: 'método não suportado' }, 405);

  const autorizacao = req.headers.get('Authorization') ?? '';
  if (!autorizacao.startsWith('Bearer ')) return json({ erro: 'sem sessão' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const chaveStripe = Deno.env.get('STRIPE_API_KEY');
  if (!url || !anon || !service || !chaveStripe) {
    console.error('[assinatura] faltando variável de ambiente');
    return json({ erro: ERRO }, 500);
  }

  // Cliente com o JWT dela: é quem responde "quem está pedindo isto?".
  const comoUsuaria = createClient(url, anon, {
    global: { headers: { Authorization: autorizacao } },
  });
  const { data: sessao } = await comoUsuaria.auth.getUser();
  const usuaria = sessao?.user;
  if (!usuaria?.email) return json({ erro: 'sem sessão' }, 401);

  let corpo: { acao?: unknown; plano?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'corpo inválido' }, 400);
  }

  // Instância própria, nunca a chave global do módulo — o padrão global está
  // depreciado em todos os SDKs atuais.
  const stripe = new Stripe(chaveStripe, { apiVersion: '2026-07-29.dahlia' });
  const comoServico = createClient(url, service);

  try {
    // O cliente da Stripe é criado uma vez e reaproveitado para sempre. Se ela
    // cancelar e voltar, volta para o mesmo cliente, com o histórico de cobrança
    // junto — e sem duplicar cartão salvo.
    const { data: linha } = await comoServico
      .from('assinaturas')
      .select('stripe_customer_id')
      .eq('user_id', usuaria.id)
      .maybeSingle();

    let customerId = linha?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const cliente = await stripe.customers.create({
        email: usuaria.email,
        // O vínculo mora dos DOIS lados: aqui, para o webhook saber de quem é o
        // evento mesmo se a linha local sumir.
        metadata: { supabase_user_id: usuaria.id },
      });
      customerId = cliente.id;

      await comoServico
        .from('assinaturas')
        .upsert(
          { user_id: usuaria.id, stripe_customer_id: customerId, atualizado_em: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    }

    if (corpo.acao === 'gerenciar') {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${APP_URL}/(tabs)/mais`,
      });
      return json({ url: portal.url });
    }

    if (corpo.acao === 'assinar') {
      const plano = corpo.plano as Plano;
      if (plano !== 'mensal' && plano !== 'anual') {
        return json({ erro: 'plano inválido' }, 400);
      }
      const priceId = PRECOS[plano];
      if (!priceId) {
        console.error(`[assinatura] falta STRIPE_PRICE_${plano.toUpperCase()}`);
        return json({ erro: ERRO }, 500);
      }

      const checkout = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        // `payment_method_types` fica FORA de propósito: com ele, a Stripe deixa
        // de escolher dinamicamente os meios habilitados no painel, e travar em
        // cartão hoje impediria o Pix de entrar amanhã sem mexer em código.
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: DIAS_DE_TESTE,
          metadata: { supabase_user_id: usuaria.id },
        },
        integration_identifier: IDENTIFICADOR_DO_FLUXO,
        success_url: `${APP_URL}/assinatura?estado=pronto`,
        cancel_url: `${APP_URL}/assinatura?estado=cancelado`,
        locale: 'pt-BR',
      });

      return json({ url: checkout.url });
    }

    return json({ erro: 'ação desconhecida' }, 400);
  } catch (erro) {
    // A mensagem da Stripe pode conter id de cliente e detalhe de conta — vai
    // para o log, nunca para a mãe.
    console.error('[assinatura]', erro instanceof Error ? erro.message : erro);
    return json({ erro: ERRO }, 500);
  }
}

/**
 * A casca de CORS, por fora de tudo.
 *
 * O preflight é respondido ANTES de qualquer checagem — ele não traz método
 * POST, nem sessão, nem corpo, e testar as três nele foi o bug de 11/08/2026.
 *
 * Os headers entram por aqui, e não em cada `json()`: é uma resposta só que
 * passa por este ponto, então não existe caminho de saída que esqueça deles.
 */
Deno.serve(async (req: Request) => {
  const preflight = respostaDePreflight(req);
  if (preflight) return preflight;

  const resposta = await tratar(req);
  const cabecalhos = new Headers(resposta.headers);
  for (const [chave, valor] of Object.entries(headersCors(req))) cabecalhos.set(chave, valor);

  return new Response(resposta.body, {
    status: resposta.status,
    statusText: resposta.statusText,
    headers: cabecalhos,
  });
});


/**
 * CORS para as funções que o NAVEGADOR chama.
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO EXISTE
 *
 * Antes de mandar um POST cross-origin com `Authorization`, o navegador manda um
 * `OPTIONS` perguntando permissão — o preflight. Função que responde 405 a
 * qualquer coisa que não seja POST reprova o preflight, e o navegador cancela o
 * POST antes de enviá-lo.
 *
 * O sintoma é cruel: do lado da mãe é "não consegui abrir a tela de pagamento",
 * e do lado do log não há erro nenhum da Stripe nem da Anthropic — porque o
 * corpo da função nunca rodou. Foi assim que apareceu, em 11/08/2026.
 *
 * Passou batido porque os testes de ponta a ponta rodam no Node, que não faz
 * preflight. Teste no runtime errado é a regra 2 do CLAUDE.md por outro ângulo:
 * ele não estava vazio, ele não estava no lugar onde a falha mora.
 *
 * O `stripe-webhook` NÃO usa isto de propósito: quem chama é a Stripe,
 * servidor-para-servidor, sem origem e sem preflight.
 *
 * ------------------------------------------------------------------
 * POR QUE LISTA DE ORIGENS, E NÃO `*`
 *
 * `*` funcionaria — estas funções autenticam por header, não por cookie, então
 * não há CSRF a explorar aqui. Mas `*` também autoriza qualquer página da
 * internet a chamar a função com o JWT que ela conseguir, e a lista custa três
 * linhas. Origem desconhecida não recebe autorização nenhuma.
 */

const ORIGENS_FIXAS = new Set([
  'https://ninna-sigma.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
]);

/** Deploys de preview da Vercel: `ninna-<hash>-<escopo>.vercel.app`. */
const PREVIEW_DA_VERCEL = /^https:\/\/ninna-[a-z0-9-]+\.vercel\.app$/;

function origemAutorizada(origem: string | null): string | null {
  if (!origem) return null;
  if (ORIGENS_FIXAS.has(origem)) return origem;
  return PREVIEW_DA_VERCEL.test(origem) ? origem : null;
}

/**
 * Os headers de CORS para esta requisição.
 *
 * `Vary: Origin` não é detalhe: sem ele, um cache intermediário serviria a
 * resposta autorizada de uma origem para outra.
 *
 * `apikey` e `x-client-info` estão na lista porque o `functions.invoke` do
 * supabase-js os manda sempre — faltando um, o preflight reprova de novo, e o
 * sintoma é idêntico ao que não ter CORS nenhum produz.
 */
export function headersCors(req: Request): Record<string, string> {
  const origem = origemAutorizada(req.headers.get('Origin'));
  if (!origem) return {};
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * A resposta ao preflight, ou `null` quando não é preflight.
 *
 * Vem ANTES de qualquer checagem de método, sessão ou corpo — o `OPTIONS` não
 * carrega nenhuma das três, e testá-las nele é exatamente o erro que isto
 * conserta.
 */
export function respostaDePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: headersCors(req) });
}

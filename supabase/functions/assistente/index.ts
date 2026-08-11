// A Edge Function do assistente — o Desenho B do PRODUTO.md §3.1.
//
//   supabase functions deploy assistente
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// ------------------------------------------------------------------
// O QUE ELA FAZ, E O QUE ELA DE PROPÓSITO NÃO FAZ
//
// Faz: recebe a pergunta, pede ao modelo que escolha UMA consulta da superfície,
// roda a consulta contra os registros daquele bebê e devolve a frase que o
// `copyInsight.ts` escreveu.
//
// NÃO faz: o modelo não vê registro nenhum, não calcula nada e não escreve o
// texto que a mãe lê. Isso não é economia de token — é o que torna a resposta
// verificável. A frase é determinística, passa nas varreduras de tom e é
// ancorada por construção.
//
// ------------------------------------------------------------------
// TRÊS BARREIRAS, E NENHUMA DELAS É UM PEDIDO DE BOM COMPORTAMENTO
//
// 1. A chave da API mora aqui, nunca no bundle. Todo `EXPO_PUBLIC_` vai pro
//    JavaScript que a mãe baixa; uma chave de API lá é uma chave pública.
//
// 2. Os registros são lidos com o JWT DELA, não com a service_role. A RLS
//    continua valendo dentro da função, então uma conta não alcança o bebê de
//    outra nem por bug de código nosso.
//
// 3. A pergunta de saúde não tem consulta que a responda. O modelo devolve
//    {"fora":"saude"} ou devolve qualquer outra coisa que o `interpretar()`
//    recusa — nos dois caminhos a mãe recebe o texto travado que devolve a
//    decisão pra ela.

import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { headersCors, respostaDePreflight } from '../_shared/cors.ts';
import { lerAmbiente } from '../_shared/ambiente.ts';

import {
  gramaticaParaModelo,
  interpretar,
  responder,
  RESPOSTA_DESCONHECIDA,
  RESPOSTA_SAUDE,
  type EventoBruto,
} from '../../../src/lib/consultas.ts';
import { narrar } from '../../../src/lib/copyInsight.ts';
import { validarAncoragem } from '../../../src/lib/ancoragem.ts';
import { temAcesso, type StatusAssinatura } from '../../../src/lib/acesso.ts';

// ------------------------------------------------------------------
// Configuração
// ------------------------------------------------------------------

/**
 * Teto generoso de propósito: quase ninguém encosta nele, e o pior caso deixa de
 * ser ilimitado. É o que faz a conta do §5 ter um máximo conhecido.
 */
const LIMITE_DIARIO = 30;

/**
 * Durante os 7 dias grátis o custo do assistente é real e a receita é zero.
 *
 * No teto normal, um teste levado ao máximo custa ~R$4,65 — quase um mês inteiro
 * da margem do plano anual (PRODUTO.md §5). Com 10 por dia o pior caso cai para
 * ~R$1,55, e dez perguntas por dia continua generoso para quem está conhecendo.
 *
 * Não é desconfiança de quem testa: é o teto existir onde o custo existe.
 */
const LIMITE_DIARIO_EM_TESTE = 10;

/** Janela de registros que a superfície pode precisar — 15 dias + folga. */
const DIAS_DE_HISTORICO = 17;

const FUSO_DO_MERCADO = 'America/Sao_Paulo';

const RESPOSTA_LIMITE =
  'Por hoje já conversamos bastante — amanhã eu volto a responder. Seus registros ' +
  'continuam aqui, e a Rotina mostra tudo que você anotou.';

/**
 * A recusa por falta de assinatura.
 *
 * Diz o que ela CONTINUA tendo, e nessa ordem: registrar e ver a rotina seguem
 * grátis, e é isso que constrói o histórico que dá valor ao assistente. Uma
 * recusa que só diz "assine" transforma um limite em porta na cara.
 */
const RESPOSTA_SEM_ASSINATURA =
  'O assistente faz parte do plano da Ninna. Seus registros e o que já sei sobre a rotina ' +
  'continuam aqui, sem prazo — quando quiser conversar comigo, é só assinar na aba Mais.';

const RESPOSTA_ERRO =
  'Não consegui responder agora. Tenta de novo em instantes — seus registros estão salvos.';

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Dia do mercado, não do cliente e não em UTC — ver o comentário da migration. */
function diaDoMercado(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DO_MERCADO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

// ------------------------------------------------------------------
// Leitura dos registros — com o JWT dela
// ------------------------------------------------------------------

type Linha = { tipo: string; ocorrido_em: string; terminou_em: string | null };

/**
 * Os tipos que esta função sabe transformar em evento.
 *
 * A lista é declarada, e não derivada da tabela: `registros` vai receber os 14
 * tipos que faltam antes de a superfície de consulta saber o que fazer com eles,
 * e um Peso chegando aqui como evento desconhecido viraria contagem errada numa
 * resposta que a mãe lê. Somar tipo à superfície é somar tipo aqui.
 */
const TIPOS_CONHECIDOS = new Set<string>([
  'amamentar',
  'mamadeira',
  'fralda',
  'sono',
  'humor',
  'sintoma',
]);

/**
 * Uma consulta, e o mapa de tabelas some.
 *
 * Havia aqui um segundo desenho do schema — cinco tabelas, qual coluna de tempo
 * cada uma usa, e a regra de que `type` separa amamentação de mamadeira. Ele
 * vivia longe do `registros.ts` e teria que ser corrigido junto com ele, o que é
 * a definição de deriva. Agora o tipo é uma coluna e não há o que mapear.
 */
async function lerEventos(
  cliente: ReturnType<typeof createClient>,
  babyId: string,
  desde: Date
): Promise<EventoBruto[]> {
  const { data, error } = await cliente
    .from('registros')
    .select('tipo, ocorrido_em, terminou_em')
    .eq('baby_id', babyId)
    .gte('ocorrido_em', desde.toISOString())
    .order('ocorrido_em', { ascending: true });

  if (error) throw new Error(`registros: ${error.message}`);

  const eventos: EventoBruto[] = [];
  for (const linha of (data ?? []) as unknown as Linha[]) {
    if (!linha.ocorrido_em || !TIPOS_CONHECIDOS.has(linha.tipo)) continue;
    eventos.push({
      tipo: linha.tipo as EventoBruto['tipo'],
      ocorridoEm: linha.ocorrido_em,
      // `fimEm` só faz sentido onde existe fim. Ausente ≠ nulo: nulo é "sono
      // ainda correndo", e o `duracaoMinutos` da superfície conta com isso.
      fimEm: linha.tipo === 'sono' ? linha.terminou_em : undefined,
    });
  }
  return eventos;
}

// ------------------------------------------------------------------
// A escolha da consulta — a única coisa que o modelo faz
// ------------------------------------------------------------------

const { instrucoes, schema } = gramaticaParaModelo();

async function escolherConsulta(anthropic: Anthropic, pergunta: string): Promise<unknown> {
  const resposta = await anthropic.messages.create({
    model: 'claude-opus-5',
    max_tokens: 2048,
    // O prompt é estável entre chamadas; o cache paga a partir da segunda.
    cache_control: { type: 'ephemeral' },
    system: instrucoes,
    // `effort: low` porque a tarefa é interpretar uma frase curta, não raciocinar.
    // O pensamento fica LIGADO (é o padrão do Opus 5): desligá-lo neste modelo
    // pode vazar marcação interna na saída, e a saída aqui é um JSON validado —
    // uma frase a mais de raciocínio custa menos que uma resposta malformada.
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: pergunta }],
  });

  // `stop_reason` ANTES de ler `content`: os classificadores do Opus 5 podem
  // recusar, e aí `content` vem vazio.
  //
  // Não usamos `fallbacks` de propósito. Recusa aqui é o desfecho DESEJADO —
  // significa que a pergunta era clínica —, e roteá-la para outro modelo seria
  // procurar quem responda o que a Ninna decidiu não responder.
  if (resposta.stop_reason === 'refusal') return { fora: 'saude' };

  const bloco = resposta.content.find((b) => b.type === 'text');
  if (!bloco || bloco.type !== 'text') return { fora: 'desconhecida' };

  try {
    return JSON.parse(bloco.text);
  } catch {
    return { fora: 'desconhecida' };
  }
}

// ------------------------------------------------------------------
// A função
// ------------------------------------------------------------------

async function tratar(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ erro: 'método não suportado' }, 405);

  const autorizacao = req.headers.get('Authorization') ?? '';
  if (!autorizacao.startsWith('Bearer ')) return json({ erro: 'sem sessão' }, 401);

  const url = lerAmbiente('SUPABASE_URL');
  const anon = lerAmbiente('SUPABASE_ANON_KEY');
  const service = lerAmbiente('SUPABASE_SERVICE_ROLE_KEY');
  const chaveDaApi = lerAmbiente('ANTHROPIC_API_KEY');
  if (!url || !anon || !service || !chaveDaApi) {
    console.error('[assistente] faltando variável de ambiente');
    return json({ resposta: RESPOSTA_ERRO }, 500);
  }

  // Cliente COM O JWT DELA: a RLS vale dentro da função (barreira 2).
  const comoUsuaria = createClient(url, anon, {
    global: { headers: { Authorization: autorizacao } },
  });

  const { data: sessao } = await comoUsuaria.auth.getUser();
  const usuaria = sessao?.user;
  if (!usuaria) return json({ erro: 'sem sessão' }, 401);

  let corpo: { pergunta?: unknown; babyId?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'corpo inválido' }, 400);
  }

  const pergunta = typeof corpo.pergunta === 'string' ? corpo.pergunta.trim() : '';
  const babyId = typeof corpo.babyId === 'string' ? corpo.babyId : '';
  if (!pergunta || !babyId) return json({ erro: 'pergunta e babyId são obrigatórios' }, 400);
  if (pergunta.length > 500) return json({ resposta: RESPOSTA_DESCONHECIDA });

  const agora = new Date();

  // --- Teto diário. Escrita com service_role: se o cliente pudesse escrever
  // --- aqui, poderia zerar o próprio contador e o teto viraria decoração.
  const comoServico = createClient(url, service);
  const dia = diaDoMercado(agora);

  // --- O portão. A leitura mora em src/lib/acesso.ts, que é onde a fronteira
  // --- entre grátis e pago está escrita e testada.
  const { data: linhaAssinatura } = await comoServico
    .from('assinaturas')
    .select('status, valida_ate')
    .eq('user_id', usuaria.id)
    .maybeSingle();

  const assinatura = {
    status: (linhaAssinatura?.status as StatusAssinatura | undefined) ?? 'nenhuma',
    validaAte: (linhaAssinatura?.valida_ate as string | null | undefined) ?? null,
  };

  if (!temAcesso('assistente', assinatura, agora)) {
    // Sem cobrar o teto: pergunta que não foi respondida não consome cota.
    return json({ resposta: RESPOSTA_SEM_ASSINATURA, restantes: 0, semAssinatura: true });
  }

  const limiteDeHoje = assinatura.status === 'trialing' ? LIMITE_DIARIO_EM_TESTE : LIMITE_DIARIO;

  const { data: usoAtual } = await comoServico
    .from('assistant_usage')
    .select('perguntas')
    .eq('user_id', usuaria.id)
    .eq('dia', dia)
    .maybeSingle();

  const jaFeitas = (usoAtual?.perguntas as number | undefined) ?? 0;
  if (jaFeitas >= limiteDeHoje) {
    return json({ resposta: RESPOSTA_LIMITE, restantes: 0, limite: true });
  }

  await comoServico
    .from('assistant_usage')
    .upsert({ user_id: usuaria.id, dia, perguntas: jaFeitas + 1 }, { onConflict: 'user_id,dia' });

  try {
    const anthropic = new Anthropic({ apiKey: chaveDaApi });
    const bruto = await escolherConsulta(anthropic, pergunta);
    const consulta = interpretar(bruto);

    if ('fora' in consulta) {
      return json({
        resposta: consulta.fora === 'saude' ? RESPOSTA_SAUDE : RESPOSTA_DESCONHECIDA,
        restantes: limiteDeHoje - jaFeitas - 1,
      });
    }

    // O nome vem da mesma leitura com RLS: bebê de outra conta não aparece, e a
    // função não tem o que responder sobre ele.
    const { data: bebe } = await comoUsuaria
      .from('babies')
      .select('name')
      .eq('id', babyId)
      .maybeSingle();
    if (!bebe) return json({ erro: 'bebê não encontrado' }, 404);

    const desde = new Date(agora.getTime() - DIAS_DE_HISTORICO * 24 * 60 * 60_000);
    const eventos = await lerEventos(comoUsuaria, babyId, desde);

    const resultado = responder(consulta, eventos, { agora, fusoHorario: FUSO_DO_MERCADO });
    const frase = narrar(resultado, bebe.name as string);

    // Cinto e suspensório: no Desenho B a frase é ancorada por construção, mas
    // uma mudança futura em `narrar()` poderia soltá-la. Número solto na mão da
    // mãe é o erro que este projeto inteiro existe pra não cometer — então a
    // resposta some em vez de sair errada, e o log grita.
    if (resultado.estado === 'ok') {
      const problemas = validarAncoragem(frase, resultado.numeros);
      if (problemas.length > 0) {
        console.error(
          `[assistente] frase não ancorada: "${frase}" — sobrou ${problemas
            .map((p) => p.trecho)
            .join(', ')}`
        );
        return json({ resposta: RESPOSTA_ERRO, restantes: limiteDeHoje - jaFeitas - 1 });
      }
    }

    return json({ resposta: frase, restantes: limiteDeHoje - jaFeitas - 1 });
  } catch (erro) {
    // A mensagem de erro nunca vaza pra mãe: ela pode conter nome de tabela.
    console.error('[assistente]', erro instanceof Error ? erro.message : erro);
    return json({ resposta: RESPOSTA_ERRO, restantes: limiteDeHoje - jaFeitas - 1 });
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


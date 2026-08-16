// As regras das notificações — `src/lib/notificacoes.ts`.
//
//   node scripts/teste-notificacoes.ts
//
// POR QUE ESTE ARQUIVO EXISTE
//
// Notificação é a única coisa deste app que fala com a mãe **sem ela ter aberto
// nada**. Todo o resto — card, assistente, tela de registro — só aparece porque
// ela foi lá. Aqui é o app tocando o telefone dela às 3 da manhã, ou não.
//
// Então o que este teste defende não é aritmética de horário: é que a regra do
// silêncio não tenha exceção, que o teto exista, e que a copy não escorregue para
// a categoria que este bloco decidiu não ter — culpa e previsão.
//
// A parte da copy tem contra-prova: as frases proibidas TÊM que ser pegas. Sem
// isso, a lista de proibições poderia estar vazia e o teste passaria igual.

import {
  REGISTROS_ANTES_DO_CONVITE,
  SILENCIO_COMECA,
  SILENCIO_TERMINA,
  TETO_DIARIO_PADRAO,
  copyDoConvite,
  dentroDoSilencio,
  impedimentoDoAviso,
  impedimentoDoConvite,
  montarAviso,
  type Estado,
  type EstadoDoConvite,
  type Pedido,
} from '../src/lib/notificacoes.ts';

let falhas = 0;
function conferir(nome: string, ok: boolean, detalhe?: string) {
  if (ok) return;
  falhas++;
  console.log(`[ FALHA] ${nome}${detalhe ? `\n         ${detalhe}` : ''}`);
}

const base: Estado = { hora: 10, padroesHoje: 0, sonosAvisados: [] };

// ------------------------------------------------------------------
// 1. O silêncio noturno, hora a hora
// ------------------------------------------------------------------

for (let h = 0; h < 24; h++) {
  const esperado = h >= SILENCIO_COMECA || h < SILENCIO_TERMINA;
  conferir(`${String(h).padStart(2, '0')}h — silêncio ${esperado}`, dentroDoSilencio(h) === esperado);
}

// As bordas, uma a uma: erro de `>` contra `>=` desloca a janela em uma hora, e
// uma hora aqui é a diferença entre avisar às 20h59 e às 21h.
conferir('20h ainda notifica', !dentroDoSilencio(20));
conferir('21h já silencia', dentroDoSilencio(21));
conferir('7h ainda silencia', dentroDoSilencio(7));
conferir('8h já notifica', !dentroDoSilencio(8));

// ⚠️ A regra que mais importa: NEM o sono em aberto fura o silêncio.
//
// É o único aviso sensível a tempo, e por isso é o candidato natural a virar
// exceção "só desta vez". Não é: o sono continua em aberto às 8h, o registro é
// editável, e o valor do aviso é fazer corrigir — não impedir. A mãe às 3h está
// com o bebê no colo, não dormindo.
for (const h of [21, 23, 0, 3, 5, 7]) {
  conferir(
    `${h}h — sono em aberto NÃO fura o silêncio`,
    impedimentoDoAviso({ tipo: 'sono_aberto', sonoId: 'a', horaDeInicio: '14:30' }, { ...base, hora: h }) ===
      'silencio',
  );
  conferir(
    `${h}h — padrão novo NÃO fura o silêncio`,
    impedimentoDoAviso({ tipo: 'padrao_novo', metrica: 'duracao_soneca', nome: 'Liz' }, { ...base, hora: h }) ===
      'silencio',
  );
}

// ------------------------------------------------------------------
// 2. Os tetos
// ------------------------------------------------------------------

const padrao: Pedido = { tipo: 'padrao_novo', metrica: 'duracao_soneca', nome: 'Liz' };
conferir('o primeiro padrão do dia passa', impedimentoDoAviso(padrao, base) === null);
conferir(
  'o segundo padrão do dia é barrado',
  impedimentoDoAviso(padrao, { ...base, padroesHoje: TETO_DIARIO_PADRAO }) === 'teto',
);

const sono: Pedido = { tipo: 'sono_aberto', sonoId: 'sono-1', horaDeInicio: '14:30' };
conferir('sono em aberto passa mesmo com o teto de padrão cheio', impedimentoDoAviso(sono, { ...base, padroesHoje: 9 }) === null);
conferir(
  'o mesmo sono não é avisado duas vezes',
  impedimentoDoAviso(sono, { ...base, sonosAvisados: ['sono-1'] }) === 'ja_avisado',
);
conferir(
  'outro sono no mesmo dia passa',
  impedimentoDoAviso({ ...sono, sonoId: 'sono-2' }, { ...base, sonosAvisados: ['sono-1'] }) === null,
);

// ------------------------------------------------------------------
// 3. A copy — e o que ela não pode virar
// ------------------------------------------------------------------

const convite = copyDoConvite('Liz');

const TODAS = [
  ...[
    montarAviso(sono),
    montarAviso({ tipo: 'padrao_novo', metrica: 'intervalo_mamadas', nome: 'Liz' }),
    montarAviso({ tipo: 'padrao_novo', metrica: 'duracao_soneca', nome: 'Liz' }),
    montarAviso({ tipo: 'padrao_novo', metrica: 'horario_soneca', nome: 'Liz' }),
  ].flatMap((a) => [a.titulo, a.corpo]),
  // ⚠️ A copy do CONVITE entra na mesma varredura, e é a que mais precisa.
  //
  // Ela é a tela que promete o que vai chegar, e é exatamente ali que o "calor
  // extra" do CLAUDE.md se instala: prometer mais para ela aceitar mais. Uma
  // promessa a mais aqui não é redação — é a notificação que este bloco decidiu
  // não ter, entrando pela porta da frente.
  convite.titulo,
  convite.corpo,
  convite.silencio,
  convite.aceitar,
  convite.recusar,
];

const PROIBIDO: { padrao: RegExp; porque: string }[] = [
  // As duas categorias que este bloco decidiu não ter.
  { padrao: /\bvoc[êe] n[ãa]o\b|\besqueceu\b|\bfaz \d+ dias?\b|\bsentimos sua falta\b|\bcad[êe] voc[êe]\b/i, porque: 'culpa' },
  { padrao: /\best[áa] na hora\b|\bhora d[ae]\b|\bdaqui a pouco\b|\bdeveria\b|\bprecisa\b|\bj[áa] passou\b/i, porque: 'previsão ou prescrição' },
  // As da tese e do tom, que já valem em todo o app.
  { padrao: /\b(ele|ela|eles|elas|dele|dela)\b/i, porque: 'pronome de gênero' },
  { padrao: /\b(beb[êe]s|crian[çc]as|rec[ée]m[- ]nascidos)\b/i, porque: 'população' },
  { padrao: /\b(o normal|o esperado|a m[ée]dia|o t[íi]pico)\b/i, porque: 'linguagem de média' },
  { padrao: /\bde \d+ (meses|semanas|anos)\b|\bnessa idade\b/i, porque: 'faixa etária' },
  { padrao: /\bfebre\b|\bsintoma\b|\bgrave\b|\bprocure\b|\bnormal\b/i, porque: 'saúde' },
];

for (const frase of TODAS) {
  for (const r of PROIBIDO) {
    conferir(`a copy não cruza a linha (${r.porque})`, !r.padrao.test(frase), `"${frase}"`);
  }
}

// Contra-prova: sem isto, a lista poderia estar vazia e tudo passaria.
const DEVE_REPROVAR = [
  'Você não registrou nada hoje.',
  'Está na hora da mamada.',
  'Faz 3 dias que a gente não se vê.',
  'Ela costuma dormir agora.',
  'Bebês nessa idade dormem menos.',
  'O normal é mamar de 3 em 3 horas.',
  'A febre já passou?',
];
for (const frase of DEVE_REPROVAR) {
  conferir(
    `a lista pega "${frase.slice(0, 34)}…"`,
    PROIBIDO.some((r) => r.padrao.test(frase)),
    'uma proibição deixou passar o que ela existe pra pegar',
  );
}

// ------------------------------------------------------------------
// 4. O formato que o service worker espera
// ------------------------------------------------------------------

for (const pedido of [sono, padrao] as Pedido[]) {
  const a = montarAviso(pedido);
  conferir('tem título', a.titulo.length > 3, JSON.stringify(a));
  conferir('tem corpo', a.corpo.length > 10, JSON.stringify(a));
  conferir('a url começa com /', a.url.startsWith('/'), a.url);
  conferir('tem tag para colapsar', a.tag.length > 3, a.tag);
}

// A tag do sono é POR SONO, e a do padrão é POR MÉTRICA. Se as duas fossem
// iguais, o service worker colapsaria avisos de sonos diferentes num só.
conferir(
  'sonos diferentes têm tags diferentes',
  montarAviso({ tipo: 'sono_aberto', sonoId: 'a', horaDeInicio: '10:00' }).tag !==
    montarAviso({ tipo: 'sono_aberto', sonoId: 'b', horaDeInicio: '10:00' }).tag,
);
conferir(
  'métricas diferentes têm tags diferentes',
  montarAviso({ tipo: 'padrao_novo', metrica: 'duracao_soneca', nome: 'Liz' }).tag !==
    montarAviso({ tipo: 'padrao_novo', metrica: 'horario_soneca', nome: 'Liz' }).tag,
);

// O nome do bebê aparece no padrão e NÃO no sono em aberto — ver o motivo no
// módulo. Não é detalhe de estilo: é o que fica visível na tela de bloqueio.
conferir('o padrão diz o nome', montarAviso(padrao).corpo.includes('Liz'));
conferir('o sono em aberto NÃO diz o nome', !montarAviso(sono).corpo.includes('Liz'));

// ------------------------------------------------------------------
// 5. O convite — quando ele pode aparecer
// ------------------------------------------------------------------
//
// ⚠️ O que está sendo defendido aqui não é uma tela: é o PROMPT DO NAVEGADOR,
// que só existe uma vez na vida da conta. Um convite que aparece cedo demais faz
// a mãe tocar em "Bloquear", e `denied` não se desfaz de dentro do app — o canal
// morre para aquele aparelho, para sempre, sem nada no repositório reclamando.
//
// Por isso o teste não confere casos escolhidos a dedo: ele varre TODAS as
// combinações e caracteriza o `null` por completo. Condição nova que alguém
// somar à função sem somar aqui derruba a segunda metade; condição que alguém
// afrouxar derruba a primeira.

// ⚠️ O PISO DO LIMIAR, congelado — e ele existe porque a varredura abaixo NÃO o
// defende. Ela deriva a expectativa do próprio `REGISTROS_ANTES_DO_CONVITE`, e
// por isso passaria inteira com o limiar em zero. É a mesma armadilha do
// `teste-niveis.ts`: constante que o teste importa não é constante que o teste
// guarda.
//
// Subir é livre — mais conservador nunca queima o prompt. Descer é o que não
// pode: com 0, o convite volta a ser a primeira coisa que a mãe vê, que é
// exatamente o desenho que este bloco recusou.
conferir(
  'o limiar do convite não desceu',
  REGISTROS_ANTES_DO_CONVITE >= 3,
  `está ${REGISTROS_ANTES_DO_CONVITE}; o piso é 3`,
);

const PERMISSOES = ['default', 'granted', 'denied'] as const;
let combinacoes = 0;
let convitesPossiveis = 0;

for (const suportado of [true, false]) {
  for (const permissao of PERMISSOES) {
    for (const jaInscrito of [true, false]) {
      for (const dispensado of [true, false]) {
        for (let registros = 0; registros <= REGISTROS_ANTES_DO_CONVITE + 2; registros++) {
          const e: EstadoDoConvite = { suportado, permissao, jaInscrito, dispensado, registros };
          const merece =
            suportado &&
            permissao === 'default' &&
            !jaInscrito &&
            !dispensado &&
            registros >= REGISTROS_ANTES_DO_CONVITE;

          const resultado = impedimentoDoConvite(e);
          combinacoes++;
          if (merece) convitesPossiveis++;

          conferir(
            'o convite aparece exatamente quando deve',
            (resultado === null) === merece,
            `${JSON.stringify(e)} → ${resultado ?? 'aparece'}`,
          );
        }
      }
    }
  }
}

// Contra-prova da varredura acima: se `merece` fosse sempre falso, ou sempre
// verdadeiro, o laço passaria inteiro sem provar nada.
conferir('a varredura do convite tem os dois desfechos', convitesPossiveis > 0 && convitesPossiveis < combinacoes);

// A precedência, que a varredura não vê: ela só olha `null` contra não-`null`, e
// para ela tanto faz QUAL impedimento voltou. O motivo é o que a tela mostraria.
conferir(
  'sem suporte vence tudo',
  impedimentoDoConvite({
    suportado: false,
    permissao: 'default',
    jaInscrito: false,
    dispensado: false,
    registros: 99,
  }) === 'sem_suporte',
);
conferir(
  'já inscrito vence a permissão',
  impedimentoDoConvite({
    suportado: true,
    permissao: 'granted',
    jaInscrito: true,
    dispensado: false,
    registros: 99,
  }) === 'ja_inscrito',
);
conferir(
  'permissão já respondida vence o "cedo demais"',
  impedimentoDoConvite({
    suportado: true,
    permissao: 'denied',
    jaInscrito: false,
    dispensado: false,
    registros: 0,
  }) === 'ja_respondeu',
);

// O limiar, nas duas bordas: um a menos cala, o limiar convida.
conferir(
  `${REGISTROS_ANTES_DO_CONVITE - 1} registros ainda é cedo`,
  impedimentoDoConvite({
    suportado: true,
    permissao: 'default',
    jaInscrito: false,
    dispensado: false,
    registros: REGISTROS_ANTES_DO_CONVITE - 1,
  }) === 'cedo_demais',
);
conferir(
  `${REGISTROS_ANTES_DO_CONVITE} registros já convida`,
  impedimentoDoConvite({
    suportado: true,
    permissao: 'default',
    jaInscrito: false,
    dispensado: false,
    registros: REGISTROS_ANTES_DO_CONVITE,
  }) === null,
);

// O convite diz o silêncio, e diz o silêncio DE VERDADE. Sem isto, mudar
// `SILENCIO_COMECA` deixaria a tela prometendo uma janela que não existe mais —
// e a mãe descobriria pelo telefone vibrando às 21h30.
conferir('o convite anuncia o silêncio real', convite.silencio.includes(`${SILENCIO_COMECA}h`) && convite.silencio.includes(`${SILENCIO_TERMINA}h`), convite.silencio);

// Ele fala do bebê dela pelo nome — é a tese, na tela que pede permissão.
conferir('o convite diz o nome', convite.corpo.includes('Liz'), convite.corpo);

console.log(
  falhas === 0
    ? `\nNotificações: silêncio das ${SILENCIO_COMECA}h às ${SILENCIO_TERMINA}h sem exceção, tetos de pé, e a copy sem culpa nem previsão.`
    : `\n${falhas} falha(s) nas notificações.`,
);

process.exit(falhas === 0 ? 0 : 1);

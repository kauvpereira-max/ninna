/**
 * A copy de saúde, num lugar só.
 *
 * A Ninna diz duas coisas sobre saúde, em dois momentos diferentes: quando a mãe
 * salva um sintoma, e quando ela pergunta ao assistente algo que o app não pode
 * responder. Os dois textos fazem **a mesma promessa** — registrar, não avaliar,
 * e devolver a decisão para ela.
 *
 * ------------------------------------------------------------------
 * POR QUE UMA CLÁUSULA E DUAS FRASES, E NÃO UM TEXTO SÓ
 *
 * Os momentos são diferentes e as aberturas têm que ser diferentes: "Anotado"
 * confirma que o registro entrou; "Não consigo te ajudar com isso" recusa. Usar
 * o mesmo texto nos dois lugares diria a coisa errada em um deles.
 *
 * O que NÃO pode divergir é a promessa. Ela é uma constante, e as duas frases a
 * compõem. No dia em que alguém reescrever uma abertura, a promessa continua
 * idêntica nas duas porque é literalmente o mesmo `const` — e se alguém mexer na
 * promessa, muda nas duas ao mesmo tempo.
 *
 * Antes disso, eram dois literais soltos em arquivos distantes, já divergindo em
 * "fale"/"fala" sem que nada notasse.
 *
 * `scripts/teste-copy-saude.ts` guarda as duas.
 *
 * ------------------------------------------------------------------
 * O QUE ESSA COPY NUNCA FAZ — regra travada, ver CLAUDE.md
 *
 * Nunca avalia gravidade e nunca sugere urgência ("procure agora", "corra").
 * Nunca lista sinal de alarme, nunca cita temperatura, número ou faixa.
 * Nunca diz "provavelmente não é nada" nem "isso é normal".
 * Não diagnostica, não tranquiliza e não alarma: registra, e quem decide é a mãe.
 *
 * Este módulo não importa nada de propósito — ele roda no app, no Node dos
 * testes e no Deno da Edge Function.
 */

/**
 * A promessa. É a única frase que aparece nos dois lugares, e é por isso que ela
 * existe separada.
 *
 * "Se você estiver preocupada" descreve o estado DA MÃE e devolve a decisão para
 * ela — é o oposto de alarmar, e é por isso que a varredura de tom precisa abrir
 * exceção declarada para ela em vez de reprová-la por conter "preocupada".
 */
export const DEVOLVE_A_DECISAO =
  'Se você estiver preocupada, confie no seu instinto e fale com o pediatra.';

/**
 * Depois de salvar um sintoma. Confirma o registro e para por aí.
 *
 * "quem examina é ele" é o pediatra — o único pronome de gênero permitido na
 * copy do app, com exceção declarada na varredura de gênero.
 */
export const AVISO_AO_SALVAR_SINTOMA = `Anotado. ${DEVOLVE_A_DECISAO} O Ninna acompanha, mas quem examina é ele.`;

/**
 * Quando o assistente recebe uma pergunta clínica.
 *
 * A primeira metade explica o limite sem se desculpar por ele: a Ninna não sabe
 * o que não foi registrado, e isso é o desenho, não uma falha.
 */
export const RECUSA_DE_SAUDE = `Não consigo te ajudar com isso — eu só sei o que você registrou. ${DEVOLVE_A_DECISAO}`;

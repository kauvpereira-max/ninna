/**
 * Leitura de variável de ambiente que apara espaço em branco — e avisa.
 *
 * ------------------------------------------------------------------
 * POR QUE ISTO EXISTE
 *
 * Um `\t` no fim do `STRIPE_PRICE_MENSAL` derrubou o Checkout inteiro em
 * 11/08/2026. O caractere entrou colado num copiar-e-colar do painel da Stripe,
 * é invisível na caixinha do secret, e a Stripe respondeu `No such price:
 * '\tprice_1U3Fxh…'`.
 *
 * O que torna essa classe de erro cara não é a causa — é a distância entre o
 * sintoma e ela. Do lado da mãe foi uma frase genérica. Do lado do log foi
 * sorte: a mensagem da Stripe imprimiu o `\t` por extenso. Um espaço comum não
 * teria aparecido em lugar nenhum.
 *
 * ------------------------------------------------------------------
 * POR QUE APARAR **E** AVISAR, E NÃO SÓ APARAR
 *
 * `trim()` sozinho conserta e apaga o rastro: o próximo caractere invisível
 * também vira nada, e o secret segue torto no painel sem ninguém saber. Some o
 * sintoma, some o sinal, e a próxima vez que isso importar vai ser numa
 * variável onde aparar não basta.
 *
 * Então: apara sempre, e quando a aparagem tiver mudado alguma coisa, deixa uma
 * linha no log dizendo QUAL variável veio torta. O valor nunca é impresso —
 * são chaves de API, e log é lugar que muita gente lê.
 */

/** Só o nome e o que sobrava — nunca o valor. */
function avisar(nome: string, bruto: string, limpo: string): void {
  const sobra = bruto.length - limpo.length;
  console.warn(
    `[ambiente] ${nome} veio com ${sobra} caractere(s) de espaço em branco nas pontas. ` +
      `Aparado para esta execução, mas o secret no painel continua torto — corrija lá.`
  );
}

/**
 * Lê e apara. Devolve `undefined` para variável ausente **ou vazia**, porque as
 * duas dão no mesmo: um secret que é só espaço não configura nada, e deixá-lo
 * virar string vazia empurra a falha para longe daqui.
 */
export function lerAmbiente(nome: string): string | undefined {
  const bruto = Deno.env.get(nome);
  if (bruto === undefined) return undefined;

  const limpo = bruto.trim();
  if (limpo !== bruto) avisar(nome, bruto, limpo);

  return limpo === '' ? undefined : limpo;
}

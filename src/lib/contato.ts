/**
 * O canal humano do §3.7 — um lugar só, porque o número aparece no app, no termo
 * e no roteiro de instalação, e três cópias divergem no dia em que ele mudar.
 *
 * PREENCHER ANTES DA E1: só dígitos, com DDI e DDD, sem +, espaço ou traço.
 * Exemplo do formato: '5511987654321'.
 *
 * Enquanto estiver vazio, o item "Relatar problema" NÃO aparece na aba Mais.
 * Link de WhatsApp quebrado na mão de uma mãe é pior que item ausente: ela toca,
 * cai numa tela de erro do navegador e conclui que não existe canal — que é
 * exatamente o R6 (bug de mãe real nunca chega até você) acontecendo em silêncio.
 */
export const WHATSAPP_SUPORTE: string = '';

/**
 * O texto já vem pronto na conversa. Não é enfeite: a mãe que toca em "relatar
 * problema" está irritada e com o bebê no colo, e a tela em branco do WhatsApp
 * pede que ela componha a frase inteira. Metade dos relatos morre aí.
 *
 * Termina com espaço de propósito — o cursor fica depois dos dois-pontos.
 */
const CONVITE_PROBLEMA = 'Oi! Encontrei um problema na Ninna: ';

export function canalDeProblemaConfigurado(): boolean {
  return /^\d{12,13}$/.test(WHATSAPP_SUPORTE);
}

/**
 * `wa.me` em vez de `whatsapp://`: o esquema nativo não abre nada na web, e a
 * mãe do beta acessa a Ninna instalada como PWA. O `wa.me` resolve para o app
 * quando ele existe e para o WhatsApp Web quando não.
 */
export function urlRelatarProblema(): string {
  return `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(CONVITE_PROBLEMA)}`;
}

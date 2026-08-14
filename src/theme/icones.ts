/**
 * Os desenhos do protótipo — 21 paths SVG, literais.
 *
 * ------------------------------------------------------------------
 * POR QUE ELES SUBSTITUEM O IONICONS
 *
 * Ionicons não era fidelidade, era **substituição**: outro traço, outra
 * gramática de forma. E vários destes não existem em biblioteca nenhuma — a
 * fralda é desenho próprio, a bomba de extração idem, e a balança do peso não
 * tem equivalente.
 *
 * Todos usam `viewBox="0 0 24 24"` e são preenchidos (`fill-rule: evenodd`), não
 * traçados. Silhueta sólida, que é o que os faz funcionar dentro do círculo
 * pastel com a tinta da família.
 *
 * ------------------------------------------------------------------
 * ELES MORAM AQUI, E NÃO NO `categorias.ts`
 *
 * O `categorias.ts` é importado pelos testes que rodam no Node, e precisa
 * continuar sendo dado puro. Aqui também é só dado — o componente que os
 * desenha é o `IconeDoTipo`.
 *
 * `sun` e `clock` vêm do protótipo e não estão no mapeamento de tipos dele;
 * `clock` passou a ser usado pelos cards de Padrões, na métrica de duração.
 */
export const ICONES = {
  heart: 'M12 20.5C6.5 17 3.5 13.6 3.5 10.2A4.7 4.7 0 0 1 12 7.4a4.7 4.7 0 0 1 8.5 2.8c0 3.4-3 6.8-8.5 10.3z',
  moon: 'M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11z',
  bottle: 'M9.4 2.6h5.2v1.6l-1.3 2h-2.6l-1.3-2zM9 7.6h6v11.8a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z',
  diaper: 'M3.8 5.6h16.4v3.6c0 5.4-3.7 9.2-8.2 9.2S3.8 14.6 3.8 9.2z',
  drop: 'M12 2.8s6.4 6.9 6.4 10.7a6.4 6.4 0 1 1-12.8 0C5.6 9.7 12 2.8 12 2.8z',
  bowl: 'M3.4 10.4h17.2v1.2a8.6 8.6 0 0 1-17.2 0z',
  cup: 'M6 6.6h12l-1.6 13.2a1.6 1.6 0 0 1-1.6 1.4H9.2a1.6 1.6 0 0 1-1.6-1.4z',
  pump: 'M6.4 3.4h11.2v4L14 11v9.6h-4V11L6.4 7.4z',
  pill: 'M5.6 13.4 13.4 5.6a4.4 4.4 0 0 1 6.2 6.2l-7.8 7.8a4.4 4.4 0 0 1-6.2-6.2z',
  thermo: 'M9.6 4.4a2.4 2.4 0 0 1 4.8 0v8.8a4.4 4.4 0 1 1-4.8 0z',
  face: 'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2zM9.2 9.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zm5.6 0a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zM7.9 14h8.2a4.1 4.1 0 0 1-8.2 0z',
  scale: 'M4.6 7.4h14.8l1.8 13.2H2.8zM12 9.8a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z',
  ruler: 'M3.4 8.6h17.2v6.8H3.4zM6.4 9.4h1.2v3.2H6.4zm4 0h1.2v3.2h-1.2zm4 0h1.2v3.2h-1.2z',
  donut: 'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2zm0 3.6a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  blocks: 'M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7z',
  stroller: 'M4 12.4a8 8 0 0 1 16 0zM5.2 14h13.6L16.4 18H7.6zM7.4 18.8a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4zm9.2 0a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z',
  book: 'M3.6 4.8h7.2v14.4H3.6zm9.6 0h7.2v14.4h-7.2z',
  syringe: 'M13.6 3.2 20.8 10.4l-1.8 1.8-1.4-1.4-6.6 6.6-3.8 1 1-3.8 6.6-6.6-1.2-1.2z',
  stairs: 'M3.6 16h4.6v5.2H3.6zm5.8-4h4.6v9.2H9.4zm5.8-4h4.6v13.2h-4.6z',
  sun: 'M12 7.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6zM11 1.4h2v3.6h-2zm0 17.6h2v3.6h-2zM1.4 11H5v2H1.4zm17.6 0h3.6v2H19zM4 5.4l1.4-1.4 2.5 2.5L6.5 8zm12.1 12.1 1.4-1.4 2.5 2.5-1.4 1.4zM18.6 4 20 5.4l-2.5 2.5-1.4-1.4zM4 18.6l2.5-2.5L8 17.5 5.4 20z',
  clock: 'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2zm1 3.8v5l3.6 2.1-1 1.7-4.6-2.7V7.2z',
} as const;

export type NomeDoIcone = keyof typeof ICONES;

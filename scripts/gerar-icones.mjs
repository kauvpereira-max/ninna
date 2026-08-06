// Gera os ícones da PWA a partir de `assets/icon.png`.
//
//   node scripts/gerar-icones.mjs
//
// Roda uma vez, à mão, e o resultado é versionado em `public/`. Não entra no
// build nem no bundle.
//
// POR QUE ESCREVER UM REDIMENSIONADOR EM VEZ DE INSTALAR UM
//
// BETA.md §3.5: zero dependência nova de produção — este projeto já teve um
// pacote quebrar o `expo export --platform web`, que é o canal único do beta.
// `sharp` e `jimp` puxam binário nativo ou centenas de arquivos por uma conta
// que o `zlib` do próprio Node resolve.
//
// O escopo é deliberadamente estreito: lê UM formato (PNG RGB de 8 bits, não
// entrelaçado, que é o que `assets/icon.png` é) e recusa qualquer outro em vez
// de tentar adivinhar. Redimensionador de uso geral seria um projeto; isto é uma
// conta de média.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync, deflateSync, crc32 } from 'node:zlib';

const RAIZ = join(import.meta.dirname, '..');
const ORIGEM = join(RAIZ, 'assets', 'icon.png');
const DESTINO = join(RAIZ, 'public');

const TAMANHOS = [
  { arquivo: 'icone-180.png', lado: 180, para: 'apple-touch-icon (iOS)' },
  { arquivo: 'icone-192.png', lado: 192, para: 'manifest' },
  { arquivo: 'icone-512.png', lado: 512, para: 'manifest / splash' },
];

// ------------------------------------------------------------------
// Leitura
// ------------------------------------------------------------------

function lerPng(caminho) {
  const bin = readFileSync(caminho);

  const assinatura = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!assinatura.every((b, i) => bin[i] === b)) throw new Error('não é um PNG');

  const largura = bin.readUInt32BE(16);
  const altura = bin.readUInt32BE(20);
  const profundidade = bin[24];
  const tipoCor = bin[25];
  const entrelacado = bin[28];

  if (profundidade !== 8 || tipoCor !== 2 || entrelacado !== 0) {
    throw new Error(
      `só sei ler PNG RGB de 8 bits não entrelaçado — este é profundidade ${profundidade}, tipo ${tipoCor}, entrelaçado ${entrelacado}`
    );
  }

  // IDAT pode vir partido em vários chunks; o fluxo comprimido é a concatenação.
  const pedacos = [];
  let o = 8;
  while (o < bin.length) {
    const tamanho = bin.readUInt32BE(o);
    const tipo = bin.toString('ascii', o + 4, o + 8);
    if (tipo === 'IDAT') pedacos.push(bin.subarray(o + 8, o + 8 + tamanho));
    if (tipo === 'IEND') break;
    o += 12 + tamanho;
  }

  return { largura, altura, dados: desfiltrar(inflateSync(Buffer.concat(pedacos)), largura, altura) };
}

/**
 * Desfaz os filtros por linha do PNG.
 *
 * Cada scanline começa com um byte dizendo como ela foi filtrada em relação ao
 * pixel da esquerda (a) e ao de cima (b). Sem desfazer isso, os bytes
 * descomprimidos são deltas, não cores.
 */
function desfiltrar(bruto, largura, altura) {
  const canais = 3;
  const bytesPorLinha = largura * canais;
  const saida = Buffer.alloc(bytesPorLinha * altura);

  for (let y = 0; y < altura; y++) {
    const filtro = bruto[y * (bytesPorLinha + 1)];
    const entrada = y * (bytesPorLinha + 1) + 1;
    const destino = y * bytesPorLinha;

    for (let x = 0; x < bytesPorLinha; x++) {
      const valor = bruto[entrada + x];
      const a = x >= canais ? saida[destino + x - canais] : 0;
      const b = y > 0 ? saida[destino - bytesPorLinha + x] : 0;
      const c = x >= canais && y > 0 ? saida[destino - bytesPorLinha + x - canais] : 0;

      let recomposto;
      switch (filtro) {
        case 0: recomposto = valor; break;
        case 1: recomposto = valor + a; break;
        case 2: recomposto = valor + b; break;
        case 3: recomposto = valor + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          recomposto = valor + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`filtro PNG desconhecido: ${filtro}`);
      }
      saida[destino + x] = recomposto & 0xff;
    }
  }

  return saida;
}

// ------------------------------------------------------------------
// Redimensionamento
// ------------------------------------------------------------------

/**
 * Média de área (box filter), não vizinho mais próximo.
 *
 * De 1024 pra 180 cada pixel de saída cobre ~5,7 de entrada: pegar só um deles
 * jogaria fora 96% da imagem e serrilharia toda curva do ícone. A média custa
 * alguns milissegundos e roda uma vez na vida.
 */
function redimensionar(origem, ladoDestino) {
  const canais = 3;
  const { largura, altura, dados } = origem;
  const saida = Buffer.alloc(ladoDestino * ladoDestino * canais);

  const escalaX = largura / ladoDestino;
  const escalaY = altura / ladoDestino;

  for (let y = 0; y < ladoDestino; y++) {
    const y0 = Math.floor(y * escalaY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * escalaY));

    for (let x = 0; x < ladoDestino; x++) {
      const x0 = Math.floor(x * escalaX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * escalaX));

      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * largura + sx) * canais;
          r += dados[i]; g += dados[i + 1]; b += dados[i + 2];
          n++;
        }
      }

      const i = (y * ladoDestino + x) * canais;
      saida[i] = Math.round(r / n);
      saida[i + 1] = Math.round(g / n);
      saida[i + 2] = Math.round(b / n);
    }
  }

  return { largura: ladoDestino, altura: ladoDestino, dados: saida };
}

// ------------------------------------------------------------------
// Escrita
// ------------------------------------------------------------------

function chunk(tipo, conteudo) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(conteudo.length);

  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), conteudo]);
  const verificacao = Buffer.alloc(4);
  verificacao.writeUInt32BE(crc32(corpo) >>> 0);

  return Buffer.concat([tamanho, corpo, verificacao]);
}

function escreverPng({ largura, altura, dados }) {
  const canais = 3;
  const bytesPorLinha = largura * canais;

  // Filtro 0 (nenhum) em todas as linhas: o ganho de compressão dos outros não
  // vale a complexidade num arquivo de 512px que é gerado uma vez.
  const comFiltro = Buffer.alloc((bytesPorLinha + 1) * altura);
  for (let y = 0; y < altura; y++) {
    comFiltro[y * (bytesPorLinha + 1)] = 0;
    dados.copy(comFiltro, y * (bytesPorLinha + 1) + 1, y * bytesPorLinha, (y + 1) * bytesPorLinha);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;   // bits por canal
  ihdr[9] = 2;   // RGB
  ihdr[10] = 0;  // compressão deflate
  ihdr[11] = 0;  // filtro adaptativo
  ihdr[12] = 0;  // sem entrelaçamento

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(comFiltro, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------

const origem = lerPng(ORIGEM);
console.log(`origem: assets/icon.png ${origem.largura}x${origem.altura}\n`);

mkdirSync(DESTINO, { recursive: true });

for (const { arquivo, lado, para } of TAMANHOS) {
  const png = escreverPng(redimensionar(origem, lado));
  writeFileSync(join(DESTINO, arquivo), png);
  console.log(`public/${arquivo.padEnd(16)} ${String(lado).padStart(4)}x${lado}  ${(png.length / 1024).toFixed(1).padStart(6)} kB  ${para}`);
}

console.log('\nPronto. Os arquivos são versionados — não precisa rodar de novo a menos que assets/icon.png mude.');

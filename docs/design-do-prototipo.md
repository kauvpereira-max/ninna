# Design do protótipo — especificação extraída

Extraída em 13/08/2026 do `Ninna — Protótipo offline.html` (Claude Design), lendo
o markup renderizado, não a aparência. Todos os valores abaixo são literais do
arquivo.

> **Esta é a referência visual do bloco de interface.** Onde ela divergir do
> `src/theme/tokens.ts`, a decisão é de produto — mas a divergência precisa ser
> notada, não resolvida em silêncio.

---

## ⚠️ O que NÃO copiar

O protótipo desenha um produto maior que o app de hoje. Três coisas nele não
existem e **não devem ser construídas** por causa deste documento:

| No protótipo | Por quê não |
|---|---|
| Tab bar de **5 abas** (Hoje · Rotina · Ninna · Evolução · Mais) | O app tem 4 (Hoje · Rotina · Ninna · Mais). Evolução é o bloco da curva de crescimento, ainda não decidido |
| Card de **previsão** ("Próxima soneca em 42 minutos") | O motor descreve o passado. Previsão é o bloco 5, com backtesting antes |
| Tela **Evolução** e tela **Insights** | Mesma razão |

E a copy do card de monitoramento do protótipo — *"A Liz costuma demonstrar fome
um pouco antes desse horário"* — **viola as regras de copy**: tem artigo de
gênero antes do nome e prevê comportamento. A copy do app está certa; o protótipo
é anterior às regras.

**Este documento é sobre fidelidade visual do que existe.** Espaçamento,
tipografia, cor, raio, sombra. Não sobre escopo.

---

## Paleta, por frequência real de uso

Contada no markup, não na documentação de marca.

### Tinta (texto)
| Hex | Uso | Ocorrências |
|---|---|---|
| `#2B211D` | Títulos, números de destaque | 63 |
| `#5C4A42` | Texto principal | 51 |
| `#8A6A60` | Texto de apoio | 29 |
| `#9C7C6C` | Rótulos, seções | 6 |
| `#B8A69C` | Texto terciário (o rótulo abaixo do registro) | 8 |

### Marca
| Hex | Uso |
|---|---|
| `#E08A80` | CTA primário, botão "Concluir" |
| `#A85A4E` | Texto sobre fundo rosa claro, rótulos de seção em modal |
| `#F3C9C5` | Rosa base |
| `#C4776C` | Seta de "avançar" |
| `#F4796B` | Botão "+" do grid e links de ação ("Ver tudo", "Relatórios") |

### Fundos
| Hex | Uso |
|---|---|
| `#FFFDFA` | Fundo da Home e dos modais |
| `#FFF9F2` | Fundo de onboarding e confirmação |
| `#F9F4EF` | Card de nota do dia |
| `#F4EBE3` | Botão de fechar do modal |
| `#FDF2EC` | Faixa de total dentro do modal |

### Linhas e bordas
| Hex | Uso |
|---|---|
| `#F3EDE6` | Divisórias horizontais e borda de card branco |
| `#F3E2D8` | Borda do rodapé de modal, trilho de progresso |
| `#F1EBE4` | Borda do seletor de bebê |
| `#F2E3DA` | Borda da tab bar |

---

## Tipografia

**Fredoka** só em título e número de destaque. **Nunito Sans** no resto.

| Elemento | Família | Tamanho | Peso | Cor |
|---|---|---|---|---|
| Saudação ("Bom dia, Kauane") | Fredoka | **25px** | 600 | `#2B211D` |
| Subtítulo da saudação | — | 14.5px | 500 | `#7A5C4E` |
| Título de seção ("Últimos registros") | Fredoka | **19px** | 600 | `#2B211D` |
| Rótulo de seção ("Registre a rotina") | Fredoka | 18px | 500 | `#9C7C6C` |
| Título de modal | Fredoka | 18px | 600 | `#2B211D` |
| Número grande (timer, stat) | Fredoka | 21–24px | 600 | `#2B211D` |
| Item da lista (detalhe) | — | 16px | **700** | `#2B211D` |
| Rótulo do item | — | 12.5px | 600 | `#B8A69C` |
| Rótulo do atalho | — | 13px | 600 | `#5C4A42` |
| Label da tab bar | — | 11px | 600 | ativo/inativo |

Detalhes que aparecem em quase todo texto corrido:
- `line-height: 1.45` a `1.55`
- `text-wrap: pretty`
- `letter-spacing: -.2px` em títulos grandes; `.2px` a `1px` em rótulos maiúsculos

---

## Raios

| Valor | Onde |
|---|---|
| **999px** | Tudo que é redondo: atalhos, avatares, botões de ação, chips, CTA (79 usos — é o raio dominante) |
| **26px** | Tab bar |
| **24px** | Card de monitoramento |
| **22px** | Card "Converse com a Ninna" |
| **20px** | Cards de conteúdo, card de padrão, modal interno |
| **16px** | Faixa de total, blocos menores |
| **12px** | Mini-cards de estatística |

---

## Sombras

Quatro, e cada uma tem função:

```
0 1px 3px rgba(92,74,66,.08)      card branco, elevação mínima
0 2px 10px rgba(92,74,66,.06)     card sobre fundo claro
0 8px 20px rgba(224,138,128,.35)  CTA coral — a sombra é colorida
0 6px 22px rgba(92,74,66,.07)     tab bar flutuante
```

A sombra do CTA **tem a cor do botão**, não cinza. É o que dá o brilho.

---

## Espaçamento

- Respiro lateral da tela: **20px**
- Entre blocos: **16–20px** de margem superior
- Padding interno de card: **16–22px**
- Grid de atalhos: `repeat(4, 1fr)`, `gap: 8px`
- Grid de stats: `1fr 1fr 1fr`, `gap: 8px`
- Padding do scroll: `52px` no topo, `124px` embaixo (espaço da tab bar)

---

## Home, elemento por elemento

Ordem exata do protótipo, de cima para baixo:

**1. Cabeçalho** — `padding: 0 20px 20px`, flex com `gap: 12px`
- Esquerda: saudação Fredoka 25px + subtítulo com a idade
- Direita: pill do bebê — fundo branco, borda `#F1EBE4`, raio 999px,
  `padding: 5px 10px 5px 5px`, avatar 34px + seta de 10px

**2. Card de monitoramento** — raio 24px, `padding: 22px 20px 6px`, borda 1.5px
- Chip pulsante de 26px com ponto de 9px dentro (animação `nnPulse`, 3.2s)
- Frase de 17.5px, `line-height: 1.55`
- Linhas separadas por `border-top: 1px`
- Rodapé com link centralizado + seta

**3. Card "Converse com a Ninna"** — raio 22px, borda `#EFD5CD`,
`background: linear-gradient(180deg, #FFFFFF 0%, #FDF4F1 100%)`

**4. Nota do dia** — fundo `#F9F4EF`, raio 20px, `padding: 16px`, ícone + texto

**5. Divisória** — `height: 1px`, `background: #F3EDE6`, margem lateral 20px

**6. "Registre a rotina"** — grid de 4 colunas
- Atalho: círculo de **70px** em cor pastel + rótulo 13px embaixo, `gap: 9px`
- Badge de "+" no canto superior esquerdo do círculo: 20px, fundo
  `rgba(255,255,255,.8)`
- Último item: círculo `#F4796B` sólido com "+" branco e sombra colorida

**7. Mini-stats** — três cards brancos, raio 12px, `padding: 11px 12px`,
número Fredoka 21px + rótulo 12px

**8. Últimos registros** — a diferença mais visível do app atual:
- **Timeline com linha vertical**: `position: absolute; left: 81px; width: 2px;
  background: #F3EDE6`
- Cada item: hora à direita (46px, alinhada à direita) + círculo de 44px com
  `box-shadow: 0 0 0 4px #FFFDFA` (o anel que "corta" a linha) + detalhe
- Detalhe 16px peso 700, rótulo 12.5px cor `#B8A69C`

---

## Modal de registro

Padrão idêntico nos seis:

```
inset: 0, z-index: 60, fundo #FFFDFA
sheet ocupando 84% da altura, alinhado embaixo
animação nnUp .26s cubic-bezier(.2,.8,.3,1)
```

- **Cabeçalho**: botão fechar de 40px redondo, fundo `#F4EBE3` + título Fredoka
  18px centralizado + espaçador de 40px (para o título ficar no centro real)
- **Corpo**: `padding: 8px 20px 20px`, com scroll
- **Rodapé**: `border-top: 1px solid #F3E2D8`, `padding: 12px 20px 28px`
- **CTA**: largura total, **54px** de altura, raio 999px, `#E08A80`, texto branco
  16.5px peso 700, sombra `0 8px 20px rgba(224,138,128,.35)`

---

## Confirmação pós-registro

Tela cheia sobre gradiente `#FFF9F2 → #FDEFE6`, com:
- Blob orgânico de 190px:
  `border-radius: 64% 36% 58% 42% / 46% 58% 42% 54%`
- Badge de check branco de 46px no canto
- "Anotado" em Fredoka 26px
- Botão "Continuar" com borda 1.5px `#F8D5D1`, fundo transparente

---

## Animações

Definidas no protótipo, todas curtas e suaves:

| Nome | Uso | Definição |
|---|---|---|
| `nnFade` | entrada de card | `opacity 0→1`, `translateY(10px)→0` |
| `nnUp` | entrada de modal | `translateY(18px)→0` + fade |
| `nnSheet` | sheet subindo | `translateY(100%)→0` |
| `nnPulse` | ponto do monitoramento | `scale(1)→1.35`, `opacity 1→.35`, 3.2s |
| `nnBreathe` | ícone da Ninna | `scale(1)→1.06`, 4.6–5.2s |
| `nnPop` | badge | `scale(.4)→1.06→1` |

Curva padrão: `cubic-bezier(.2,.8,.3,1)`.

Em React Native, `nnFade`/`nnUp` saem com `Animated`; `nnPulse`/`nnBreathe`
pedem loop. Se custar caro, o card estático continua correto — **animação é
acabamento, não requisito**.

---

## O que provavelmente mais muda no app hoje

Por ordem de impacto visual, olhando as telas em produção:

1. **A timeline dos últimos registros** — hoje é lista simples; no protótipo tem
   linha vertical, hora à esquerda e anel branco no ícone
2. **O tamanho dos atalhos** — 70px de círculo com rótulo embaixo
3. **A saudação em Fredoka 25px** com a idade do bebê logo abaixo
4. **O pill do bebê** no canto superior direito, com avatar
5. **A sombra colorida do CTA** — o `#E08A80` com brilho próprio
6. **Os mini-stats** de três colunas, que não existem hoje

---

## Uma nota sobre o filtro da Rotina

Não está no protótipo — ele foi desenhado com 6 tipos, e o app tem 19. A tela de
filtro com 20 chips é problema novo, sem referência visual. Vale resolver, mas é
decisão de design, não fidelidade.

---

# Adendo — extraído do código do protótipo (13/08/2026)

O documento acima veio do markup. Isto veio do **script**, e resolve as duas
lacunas apontadas no diagnóstico.

## As cores pastéis dos atalhos

Dez famílias. Cada uma é um par `[fundo, tinta]` — o círculo usa o primeiro, o
ícone e o texto usam o segundo.

| Família | Fundo (círculo) | Tinta (ícone) |
|---|---|---|
| coral | `#FDE7E1` | `#D9502F` |
| amarelo | `#FCF2D6` | `#C08A1E` |
| roxo | `#ECE7F8` | `#7A67A8` |
| verde | `#DDF0E7` | `#3F8368` |
| azul | `#E2EEF7` | `#43799A` |
| rosa | `#FBE7E4` | `#B96C63` |
| terra | `#F8E7D9` | `#A55E30` |
| lavanda | `#ECE9F9` | `#7A6DB8` |
| salvia | `#E3F0E6` | `#5A8768` |
| ameixa | `#F7E6EF` | `#8B4E6E` |

Isto **não é** a paleta de categoria do `tokens.ts`. Aquela é sólida e vívida,
para badge com ícone branco; esta é pastel, para círculo com ícone colorido. As
duas podem coexistir — mas são sistemas diferentes, e vale decidir qual vence
onde.

## Os 20 tipos, com a cor de cada um

O protótipo já atribuiu família a todos os 20 — inclusive Habilidade, que o app
ainda não tem.

| Tipo | Família | Tipo | Família |
|---|---|---|---|
| Amamentar | coral | Sintoma | coral |
| Mamadeira | verde | Humor | rosa |
| Fralda | amarelo | Peso | ameixa |
| Sono | roxo | Altura | salvia |
| Banho | azul | Circunferência | lavanda |
| Comida | terra | Atividade | terra |
| Hidratação | azul | Passeio | verde |
| Extração | verde | Leitura | lavanda |
| Medicação | rosa | Vacina | azul |
| Vitamina | amarelo | Habilidade | ameixa |

Duas coisas a notar:

1. **As famílias repetem de propósito.** Verde cobre Mamadeira, Extração e
   Passeio; azul cobre Banho, Hidratação e Vacina. Com 20 tipos, cor não é
   identidade única — é agrupamento semântico.
2. **Não bate com o `tokens.ts` de hoje.** Lá, Amamentar é `#E15C42` (coral
   vívido) e Sono é `#9B8AC4`. Aqui são pastéis de outra família.

## Ícones: o protótipo usa PNG, não SVG

Cada tipo tem um arquivo próprio — `ic-diaper.png`, `ic-moon.png`,
`ic-bottle.png`, e assim por diante, mais `liz-full.png` para a ilustração da
confirmação. São **20 imagens** que não estão no repositório do app.

Sem elas, a fidelidade visual dos atalhos não é alcançável — o app usa Ionicons,
que é outro sistema. Isso é decisão de produto e tem custo: ou os PNGs são
exportados do Claude Design, ou o app fica com ícones de biblioteca.

## Estado ativo tem cor própria

No modal de amamentação, o botão muda quando o timer está correndo:

```
parado:  #E08A80  com  0 8px 20px rgba(224,138,128,.35)
rodando: #E15C42  com  0 8px 22px rgba(225,92,66,.45)
```

O coral de vigilância aparece aqui — em botão, contrariando a regra do
`CLAUDE.md`. Mas o contexto é outro: é **estado ativo de um cronômetro**, não
decoração. Vale decidir se a regra ganha essa exceção ou se o estado usa outro
recurso (borda, pulso) em vez de coral.

## Botão desabilitado

O CTA da fralda quando nada foi escolhido:

```
fundo #F3D9D3 · texto #C6A79F · sem sombra
```

Rosa dessaturado, não cinza. O `tokens.ts` não tem estado desabilitado.

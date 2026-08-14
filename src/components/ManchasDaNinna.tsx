import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { amostrar, comFase } from '../lib/deriva.ts';

/**
 * As três manchas radiais do fundo da aba Ninna.
 *
 * ------------------------------------------------------------------
 * POR QUE ELAS VOLTARAM
 *
 * Ficaram fora na primeira passada (divergência 10 do
 * `docs/design-do-prototipo.md`) por falta de gradiente radial: o
 * `expo-linear-gradient` não faz. O registro dizia "se um dia o
 * `react-native-svg` entrar por outro motivo, elas voltam" — e ele entrou, pelos
 * 21 ícones dos atalhos.
 *
 * E ficaram fora INTEIRAS, não viraram cor chapada, porque **o movimento era o
 * ponto**: três manchas paradas são três blocos de cor sem razão de existir.
 *
 * ------------------------------------------------------------------
 * ⚠️ NENHUM DOS TRÊS DO FECHAMENTO DE BLOCO ENXERGA ISTO — É REGRA 2b
 *
 * `tsc` prova que compila, os testes não abrem tela e o `expo export` empacota
 * uma animação quebrada com o mesmo sucesso que uma correta. O que este arquivo
 * faz só existe no navegador, a 60fps, ao longo de 21 segundos.
 *
 * Daí a escolha de driver: o `Animated` do próprio React Native, não o
 * `reanimated`. Os dois estão instalados — o `reanimated` vem junto com o
 * `expo-router` —, mas o `reanimated` 4 depende do plugin de worklets do Babel
 * estar certo, e worklet mal configurado falha **em runtime**. Três manchas de
 * 16 a 21 segundos não precisam sair da thread de JS: a suavidade aqui não é o
 * problema, e a dependência a mais seria risco sem contrapartida.
 */

// ------------------------------------------------------------------
// As três, medidas do protótipo
// ------------------------------------------------------------------

type Mancha = {
  id: string;
  cor: string;
  tamanho: number;
  duracao: number;
  /** O `-6s` do CSS, já em fração do ciclo. */
  fase: number;
  posicao: { top?: number; bottom?: number; left?: number; right?: number };
};

const MANCHAS: Mancha[] = [
  {
    id: 'nnMancha1',
    cor: '#FBE3DC',
    tamanho: 260,
    duracao: 16000,
    fase: 0,
    posicao: { top: -70, left: -60 },
  },
  {
    id: 'nnMancha2',
    cor: '#EFE9F8',
    tamanho: 240,
    duracao: 21000,
    fase: 6 / 21,
    posicao: { top: 120, right: -90 },
  },
  {
    id: 'nnMancha3',
    cor: '#FCF3DC',
    tamanho: 220,
    duracao: 19000,
    fase: 11 / 19,
    posicao: { bottom: 80, left: -40 },
  },
];

// `useNativeDriver` não existe no react-native-web: ligá-lo lá só rende um aviso
// no console e cai no driver de JS do mesmo jeito.
const NATIVO = Platform.OS !== 'web';

// ------------------------------------------------------------------

function UmaMancha({ mancha, parada }: { mancha: Mancha; parada: boolean }) {
  const relogio = useRef(new Animated.Value(0)).current;
  const raio = mancha.tamanho / 2;

  useEffect(() => {
    if (parada) return;
    relogio.setValue(0);
    const laco = Animated.loop(
      Animated.timing(relogio, {
        toValue: 1,
        duration: mancha.duracao,
        // O `ease-in-out` do CSS é por PERNA do keyframe, não pelo ciclo — com
        // três pernas, aplicá-lo ao ciclo inteiro daria uma parada no meio que o
        // protótipo não tem. Linear aqui, e a suavidade fica no desenho.
        easing: Easing.linear,
        useNativeDriver: NATIVO,
      }),
    );
    laco.start();
    return () => laco.stop();
  }, [relogio, mancha.duracao, parada]);

  const curva = comFase(mancha.fase);
  const inicio = amostrar(mancha.fase);

  const animado = parada
    ? [{ translateX: inicio.x }, { translateY: inicio.y }, { scale: inicio.escala }]
    : [
        {
          translateX: relogio.interpolate({ inputRange: curva.entrada, outputRange: curva.x }),
        },
        {
          translateY: relogio.interpolate({ inputRange: curva.entrada, outputRange: curva.y }),
        },
        {
          scale: relogio.interpolate({ inputRange: curva.entrada, outputRange: curva.escala }),
        },
      ];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: mancha.tamanho, height: mancha.tamanho },
        mancha.posicao,
        { transform: animado },
      ]}
    >
      <Svg width={mancha.tamanho} height={mancha.tamanho}>
        <Defs>
          {/* O `radial-gradient(circle, cor 0%, transparente 70%)` do protótipo:
              70% do raio até o canto (130·√2 ≈ 184) dá 129px — a borda do
              círculo. Ou seja, a cor chega a zero exatamente onde a mancha
              acaba, e o `border-radius: 999px` do CSS não recorta nada. */}
          <RadialGradient id={mancha.id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={mancha.cor} stopOpacity={1} />
            <Stop offset="1" stopColor={mancha.cor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={raio} cy={raio} r={raio} fill={`url(#${mancha.id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * O fundo da aba Ninna. Vai como primeiro filho do container, que precisa de
 * `overflow: 'hidden'` — as três sangram para fora de propósito.
 */
export function ManchasDaNinna() {
  // Quem pediu menos movimento no sistema recebe as manchas PARADAS, na pose
  // inicial. É o único caso em que "três blocos de cor" é a resposta certa: ali
  // elas não são decoração sem razão, são a razão sendo respeitada.
  const [parada, setParada] = useState(false);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduzir) => {
        if (vivo) setParada(reduzir);
      })
      .catch(() => {});
    const inscricao = AccessibilityInfo.addEventListener('reduceMotionChanged', setParada);
    return () => {
      vivo = false;
      inscricao.remove();
    };
  }, []);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      // Os três juntos, porque cada um cobre uma plataforma e nenhum cobre as
      // três: `importantForAccessibility` é Android, `accessibilityElementsHidden`
      // é iOS, e `aria-hidden` é a web. Conferido no navegador em 14/08/2026 — só
      // com os dois primeiros, o atributo saía `null` no DOM.
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={StyleSheet.absoluteFill}
    >
      {MANCHAS.map((m) => (
        <UmaMancha key={m.id} mancha={m} parada={parada} />
      ))}
    </View>
  );
}

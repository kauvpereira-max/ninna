import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, typography } from '../theme/tokens';

/**
 * A tela de "Pronto" depois de salvar um registro.
 *
 * ------------------------------------------------------------------
 * ELA SE DISPENSA SOZINHA — E ESSA É A DIVERGÊNCIA DELIBERADA
 *
 * No protótipo esta tela tem um botão "Continuar" e fica até a mãe tocar. Aqui
 * ela sai sozinha em 1,2s, e um toque em qualquer lugar antecipa.
 *
 * O motivo é de uso, não de escopo: o protótipo foi desenhado com **6 tipos** e
 * uso ocasional. O app tem **19**, e a mãe registra mamada, fralda e sono
 * VÁRIAS VEZES POR DIA, às 3h, com o bebê no colo.
 *
 * > Um passo a mais a cada registro deixa de ser encanto e vira atrito — e o
 * > custo aparece justamente em quem usa mais.
 *
 * O visual é o do protótipo, inteiro. Só a permanência muda. Se um dia houver
 * dado de uso mostrando que a tela é bem-vinda, voltar ao botão é trocar o
 * `useEffect` por um `<Button>`.
 *
 * ------------------------------------------------------------------
 * ⚠️ O BLOB NÃO É EXATAMENTE O DO PROTÓTIPO, E ISSO É LIMITAÇÃO DE PLATAFORMA
 *
 * O protótipo usa `border-radius: 64% 36% 58% 42% / 46% 58% 42% 54%` — quatro
 * cantos com raios ELÍPTICOS, cada um com um valor horizontal e outro vertical.
 * O React Native só aceita um número por canto: cantos circulares, nunca
 * elípticos.
 *
 * O que está aqui é a média dos dois valores de cada canto, em pixels sobre os
 * 190 do blob. A silhueta fica orgânica e assimétrica como a do protótipo, mas
 * não é a mesma curva. O idêntico exigiria `react-native-svg` e um `<Path>` —
 * uma dependência inteira para uma forma decorativa.
 */
type Props = {
  onFim: () => void;
  /** Quanto tempo até sair sozinha. Em ms. */
  duracaoMs?: number;
};

const BLOB = 190;

export function ConfirmacaoPronto({ onFim, duracaoMs = 1200 }: Props) {
  // `useRef` para o callback não reiniciar o timer a cada render — sem isso,
  // um render no meio do caminho zeraria a contagem e a tela ficaria presa.
  const fim = useRef(onFim);
  fim.current = onFim;

  useEffect(() => {
    const t = setTimeout(() => fim.current(), duracaoMs);
    return () => clearTimeout(t);
  }, [duracaoMs]);

  return (
    <Pressable
      onPress={onFim}
      accessibilityRole="button"
      accessibilityLabel="Registro salvo. Toque para voltar."
      style={styles.tudo}
    >
      <LinearGradient
        colors={[colors.neutro50, colors.confirmacaoFim]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.tudo}
      >
        <View style={styles.centro}>
          <View style={styles.blob}>
            <View style={styles.badge}>
              <Ionicons name="checkmark" size={26} color={colors.rosa700} />
            </View>
          </View>

          <Text style={styles.pronto}>Pronto</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tudo: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  blob: {
    width: BLOB,
    height: BLOB,
    backgroundColor: colors.rosa300,
    // A média de cada par do protótipo, em pixels sobre 190. Ver o cabeçalho:
    // canto elíptico não existe em React Native.
    borderTopLeftRadius: 104,
    borderTopRightRadius: 89,
    borderBottomRightRadius: 95,
    borderBottomLeftRadius: 91,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    // No canto do blob, como no protótipo — não centralizado nele.
    position: 'absolute',
    top: 8,
    right: 8,
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.neutro0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * "Pronto", e não "Anotado".
   *
   * "Anotado." é a abertura da copy de saúde (`copySaude.ts`), e ela tem peso
   * ali: confirma um registro que a mãe pode estar fazendo preocupada, e a frase
   * inteira devolve a decisão a ela. Usar a mesma abertura para confirmar um
   * banho esvaziaria isso — e o `teste-copy-saude.ts` defende justamente que as
   * duas aberturas sejam diferentes.
   *
   * "Pronto" é o que se diz quando algo simples deu certo. Não compete.
   *
   * `h1` é exatamente Fredoka 26 SemiBold, que é o que o protótipo pede aqui.
   */
  pronto: { ...typography.h1, color: colors.headline },
});

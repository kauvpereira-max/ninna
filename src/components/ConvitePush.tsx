import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import {
  copyDoConvite,
  impedimentoDoConvite,
  type EstadoDoConvite,
} from '../lib/notificacoes.ts';
import {
  conviteDispensado,
  dispensarConvite,
  estadoDePush,
  ligarNotificacoes,
} from '../lib/push.ts';
import { colors, spacing, radius, typography } from '../theme/tokens';

/**
 * O convite da Ninna, que vem ANTES do prompt do navegador.
 *
 * A decisão de aparecer não mora aqui: mora em `impedimentoDoConvite`, que é puro
 * e testado. Este arquivo só junta o estado do navegador com o número de
 * registros e pinta o resultado — o que sobra dele não tem como ser testado no
 * Node, e é por isso que a regra saiu daqui.
 *
 * ⚠️ `ligarNotificacoes` PRECISA sair de dentro do `onPress`. O navegador só
 * aceita `requestPermission()` vindo de gesto — chamada dentro de um `useEffect`
 * é ignorada, e ignorada em silêncio.
 */
export function ConvitePush({ nomeBebe, registros }: { nomeBebe: string; registros: number }) {
  const [doNavegador, setDoNavegador] = useState<Omit<EstadoDoConvite, 'registros'> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [desfecho, setDesfecho] = useState<string | null>(null);
  const [saiuDaTela, setSaiuDaTela] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [push, dispensado] = await Promise.all([estadoDePush(), conviteDispensado()]);
      if (!vivo) return;
      setDoNavegador({
        suportado: push.suportado,
        permissao: push.permissao,
        jaInscrito: push.inscrito,
        dispensado,
      });
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Enquanto a resposta do navegador não chega, nada é pintado. Um card que
  // aparece e some meio segundo depois é pior que um card que demora a aparecer.
  if (saiuDaTela || !doNavegador) return null;
  if (impedimentoDoConvite({ ...doNavegador, registros }) !== null) return null;

  const copy = copyDoConvite(nomeBebe);

  async function aceitar() {
    setOcupado(true);
    const { frase } = await ligarNotificacoes();
    setOcupado(false);
    // Vale para os dois desfechos: deu certo, ela lê a confirmação; deu errado ou
    // ela bloqueou, ela lê o porquê. Sumir calado nos dois casos é que não.
    setDesfecho(frase);
  }

  async function agoraNao() {
    setSaiuDaTela(true);
    await dispensarConvite();
  }

  return (
    <View style={styles.card}>
      <View style={styles.cabecalho}>
        <View style={styles.icone}>
          <Ionicons name="notifications-outline" size={18} color={colors.rosa700} />
        </View>
        <Text style={styles.titulo}>{copy.titulo}</Text>
      </View>

      <Text style={styles.corpo}>{copy.corpo}</Text>
      <Text style={styles.silencio}>{copy.silencio}</Text>

      {desfecho ? (
        <Text style={styles.desfecho}>{desfecho}</Text>
      ) : (
        <View style={styles.acoes}>
          <Button
            label={copy.aceitar}
            onPress={aceitar}
            loading={ocupado}
            accessibilityLabel={`${copy.aceitar} as notificações da Ninna`}
            style={styles.botao}
          />
          <Button
            label={copy.recusar}
            variant="secondary"
            onPress={agoraNao}
            disabled={ocupado}
            style={styles.botao}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutro0,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.respiro,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icone: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.rosa100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { ...typography.bodyLarge, color: colors.headline, flex: 1 },
  corpo: { ...typography.body, color: colors.neutro600, marginTop: spacing.sm },
  silencio: { ...typography.caption, color: colors.neutro500, marginTop: 4 },
  desfecho: { ...typography.body, color: colors.neutro600, marginTop: spacing.md },
  acoes: { gap: spacing.sm, marginTop: spacing.md },
  botao: { width: '100%' },
});

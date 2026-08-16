import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { copyDoConvite } from '../src/lib/notificacoes.ts';
import {
  desligarNotificacoes,
  estadoDePush,
  ligarNotificacoes,
  type EstadoDePush,
} from '../src/lib/push.ts';
import { useBaby } from '../src/contexts/BabyContext';
import { colors, spacing, radius, typography } from '../src/theme/tokens';

/**
 * O caminho permanente para ligar e desligar — Mais › Notificações.
 *
 * O `ConvitePush` da Home some depois de respondido, e some para sempre no
 * "agora não". Esta tela é o que garante que a decisão continue reversível: sem
 * ela, um toque em "Agora não" fecharia o assunto para sempre.
 *
 * ⚠️ **O aparelho é a unidade, não a conta.** A inscrição é por navegador
 * instalado, então "ligado" aqui quer dizer ligado NESTE aparelho. O telefone
 * pode estar ligado e o tablet não — e a tela diz isso, em vez de deixar a mãe
 * concluir que desligou em todo lugar.
 */
export default function NotificacoesScreen() {
  const { bebeAtivo } = useBaby();
  const [estado, setEstado] = useState<EstadoDePush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  const reler = useCallback(async () => {
    setEstado(await estadoDePush());
  }, []);

  useEffect(() => {
    void reler();
  }, [reler]);

  async function alternar(ligar: boolean) {
    setOcupado(true);
    setRecado(null);
    const { frase } = ligar ? await ligarNotificacoes() : await desligarNotificacoes();
    setRecado(frase);
    await reler();
    setOcupado(false);
  }

  const copy = copyDoConvite(bebeAtivo?.name ?? 'seu bebê');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.titulo}>Notificações</Text>

        <View style={styles.card}>
          <Text style={styles.corpo}>{copy.corpo}</Text>
          <Text style={styles.silencio}>{copy.silencio}</Text>
        </View>

        {estado === null ? null : !estado.suportado ? (
          // Sem `PushManager` não há o que ligar. É o caso do Safari em aba, onde
          // o caminho é instalar na tela de início — e quem conduz isso é o
          // banner de instalação, não esta tela.
          <Text style={styles.explicacao}>
            Este navegador não recebe notificações. No iPhone, isso funciona depois que a Ninna
            está na tela de início.
          </Text>
        ) : estado.permissao === 'denied' ? (
          <Text style={styles.explicacao}>
            O navegador está bloqueando as notificações deste site. Dá pra liberar nos ajustes do
            site, e depois voltar aqui.
          </Text>
        ) : (
          <View style={styles.acao}>
            <Text style={styles.estado}>
              {estado.inscrito ? 'Ligadas neste aparelho.' : 'Desligadas neste aparelho.'}
            </Text>
            <Button
              label={estado.inscrito ? 'Desligar' : 'Ligar as notificações'}
              variant={estado.inscrito ? 'secondary' : 'primary'}
              onPress={() => alternar(!estado.inscrito)}
              loading={ocupado}
            />
          </View>
        )}

        {recado ? <Text style={styles.recado}>{recado}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.superficie },
  scroll: {
    paddingHorizontal: spacing.respiro,
    paddingVertical: spacing.lg,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  titulo: { ...typography.h1, color: colors.headline, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.neutro0,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  corpo: { ...typography.body, color: colors.neutro600 },
  silencio: { ...typography.caption, color: colors.neutro500, marginTop: 4 },
  explicacao: { ...typography.body, color: colors.neutro500, marginTop: spacing.lg },
  acao: { marginTop: spacing.lg, gap: spacing.sm },
  estado: { ...typography.bodyLarge, color: colors.headline },
  recado: { ...typography.body, color: colors.neutro600, marginTop: spacing.md },
});

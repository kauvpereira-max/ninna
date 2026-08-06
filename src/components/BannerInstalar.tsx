import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/tokens';

/**
 * Conduz a instalação na tela de início. Não é sugestão — é requisito funcional.
 *
 * BETA.md §3.1: no iOS, site aberto no Safari sem "Adicionar à Tela de Início"
 * tem o storage limpo pelo sistema depois de ~7 dias de inatividade. A mãe é
 * deslogada, perde o acesso e conclui que o app quebrou — justamente quando o
 * motor teria o primeiro insight (R1). PWA instalada não sofre essa limpeza.
 *
 * POR QUE ELE VOLTA
 *
 * O "agora não" vale só pra sessão atual: o estado mora em memória, sem
 * AsyncStorage e sem "não mostrar de novo". Um botão de dispensar permanente
 * transformaria o requisito em preferência, e a mãe que dispensou no primeiro
 * minuto — antes de entender pra que serve — nunca mais veria o aviso, e sumiria
 * do beta sete dias depois sem ninguém saber por quê.
 *
 * Some sozinho quando a instalação acontece: em modo standalone o banner não
 * renderiza, então ele não fica cobrando quem já fez.
 */

function jaInstalado(): boolean {
  // No nativo não existe "instalar pela tela de início" — o app já é o app.
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;

  // `navigator.standalone` é o sinal do iOS; `display-mode: standalone` é o
  // padrão que o Chrome e o Safari mais novo respeitam. Um dos dois basta.
  const iOS = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const padrao = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  return iOS || padrao;
}

function ehIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  // iPad novo se anuncia como Mac; o que o denuncia é ter tela de toque.
  const iPadDisfarcado = /Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadDisfarcado;
}

export function BannerInstalar() {
  const [escondidoAgora, setEscondidoAgora] = useState(false);

  if (escondidoAgora || jaInstalado()) return null;

  const iOS = ehIOS();

  return (
    <View style={styles.barra}>
      <View style={styles.icone}>
        <Ionicons name="phone-portrait-outline" size={18} color={colors.rosa700} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.titulo}>Deixa a Ninna na sua tela de início</Text>
        <Text style={styles.passos}>
          {iOS
            ? 'Toque em Compartilhar, ali embaixo, e escolha "Adicionar à Tela de Início".'
            : 'Abra o menu do navegador e escolha "Instalar aplicativo".'}
        </Text>
        {/* A razão, sem jargão: ela precisa saber que não é enfeite. */}
        <Text style={styles.motivo}>
          Assim o app abre direto pelo ícone e você continua conectada, mesmo depois de uns dias
          sem abrir.
        </Text>
      </View>

      <Pressable
        onPress={() => setEscondidoAgora(true)}
        accessibilityRole="button"
        accessibilityLabel="Fechar o aviso de instalação por agora"
        hitSlop={12}
        style={styles.fechar}
      >
        <Ionicons name="close" size={18} color={colors.neutro500} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.rosa100,
    borderBottomWidth: 1,
    borderBottomColor: colors.rosa200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  icone: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.neutro0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    ...typography.body,
    color: colors.headline,
    fontFamily: 'NunitoSans_700Bold',
  },
  passos: { ...typography.caption, color: colors.neutro600, marginTop: 2 },
  motivo: { ...typography.caption, color: colors.neutro500, marginTop: 2 },
  // Alvo de toque de 44px sem ocupar 44px de layout — o hitSlop faz o resto.
  fechar: { padding: spacing.xs },
});

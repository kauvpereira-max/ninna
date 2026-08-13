import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/tokens';

type Props = {
  nomeBebe: string;
  texto: string;
  /** Frase de aprendizado em vez de padrão — muda o ícone, nunca o tom. */
  aprendendo: boolean;
};

/**
 * O card "A ROTINA DE {NOME}" da Home.
 *
 * ------------------------------------------------------------------
 * ELE ERA ESCURO E FICOU CLARO — E ISSO MUDOU UMA REGRA
 *
 * Até 13/08/2026 este card era a única superfície escura do app, e o
 * `CLAUDE.md` dizia que "coral + superfície escura" eram a paleta de vigilância,
 * exclusiva dele. O protótipo desenha o mesmo card CLARO.
 *
 * A regra foi reescrita em vez de mantida: **vigilância se marca por borda e
 * chip, nunca por superfície.** Mantida a redação velha, ela ficaria sem
 * sujeito — o único lugar que usava fundo escuro deixou de usar. O
 * `noiteSurface` saiu junto, no mesmo commit.
 *
 * ------------------------------------------------------------------
 * O ESTADO DE ATENÇÃO EXISTE NO PROTÓTIPO E NÃO TEM GATILHO AQUI
 *
 * O protótipo tem dois estados: repouso (`#FDF4F1` / `#EFD5CD`) e atenção
 * (`#FFF6F3` / `#E88A7D`). **O app não sabe entrar no segundo.**
 *
 * Os dois estados que ele tem — `aprendendo` e narrando padrão — são os dois
 * calmos: um diz "ainda estou conhecendo", o outro descreve o que viu. Nenhum é
 * alarme, e a Ninna não avalia gravidade (é a copy de saúde, e é regra travada).
 *
 * Por isso só o repouso foi implementado, e as duas cores de atenção NÃO viraram
 * token: token sem consumidor é o que faz alguém achar que o estado existe. Ele
 * pertence ao bloco de monitoramento ampliado (`PRODUTO.md` §3.4), que é quem
 * pode ter algo a alarmar.
 *
 * ------------------------------------------------------------------
 * Sem artigo antes do nome no rótulo: `sex` é opcional no cadastro, e "DE A LIZ"
 * não existe.
 *
 * O card não tem número solto, rótulo de métrica, unidade nem barra de
 * progresso. É uma frase. Tudo que parecesse painel empurraria a mãe a comparar
 * o bebê com uma referência que a Ninna não tem e não quer ter.
 */
export function CardInsight({ nomeBebe, texto, aprendendo }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.cabecalho}>
        {/* O chip de 26px com o ponto de 9px dentro. É ELE que marca vigilância
            agora que não há superfície escura.

            Estático por enquanto: a animação `nnPulse` (3,2s) é o bloco de
            acabamento, e o próprio documento diz que animação não é requisito. */}
        <View style={styles.chip}>
          <View style={styles.ponto} />
        </View>
        <Text style={styles.label}>A ROTINA DE {nomeBebe.toUpperCase()}</Text>
        <Ionicons
          name={aprendendo ? 'eye-outline' : 'moon'}
          size={16}
          color={colors.rosa700}
        />
      </View>

      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.superficieRosada,
    borderWidth: 1.5,
    borderColor: colors.bordaRosada,
    // 24 e não 20: no protótipo o card de monitoramento tem raio próprio, maior
    // que o dos cards de conteúdo. Ele é o único elemento com essa medida.
    borderRadius: radius.lg,
    paddingTop: 22,
    paddingHorizontal: spacing.respiro,
    // O protótipo fecha com 6px embaixo porque tem um rodapé com link. O link
    // ficou de fora (ele abre Insights, que não existe — decisão nº 3 do
    // documento), e 6px sem o rodapé deixaria a frase colada na borda.
    paddingBottom: spacing.respiro,
    marginBottom: spacing.respiro,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.neutro0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ponto: {
    width: 9,
    height: 9,
    borderRadius: radius.full,
    backgroundColor: colors.coral500,
  },
  label: {
    ...typography.itemRotulo,
    // `rosa700` é o token que o próprio documento descreve como "texto sobre
    // fundo rosa claro". Era `coral500`, que sobre fundo claro seria vigilância
    // virando decoração — exatamente o que a regra nova proíbe.
    color: colors.rosa700,
    fontFamily: 'NunitoSans_700Bold',
    letterSpacing: 0.6,
    flex: 1,
  },
  texto: { ...typography.fraseMonitoramento, color: colors.headline },
});

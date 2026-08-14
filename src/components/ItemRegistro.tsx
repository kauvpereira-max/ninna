import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { IconeDoTipo } from './IconeDoTipo';
import { Ionicons } from '@expo/vector-icons';
import type { RegistroRecente } from '../lib/registros';
import { CATEGORIA_POR_TIPO } from '../theme/categorias';
import { colors, typography } from '../theme/tokens';

/**
 * No Safari do iPhone, segurar o dedo sobre um elemento dispara o callout do
 * sistema e a seleção de texto antes de qualquer handler do app. Sem isso, o
 * long-press vira "copiar/compartilhar" do navegador em vez de atalho do app.
 *
 * Só existe na web: no nativo essas propriedades não são estilo válido de RN.
 */
export const semCalloutNaWeb =
  Platform.OS === 'web' ? ({ userSelect: 'none', WebkitTouchCallout: 'none' } as any) : null;

/**
 * A GEOMETRIA DA TIMELINE, num lugar só.
 *
 * O `ListaDeRegistros` desenha a linha vertical e precisa acertar o eixo dos
 * círculos daqui. Os números moram neste arquivo — que é quem os usa para
 * montar a linha — e são IMPORTADOS lá, nunca repetidos: dois `80` escritos em
 * arquivos diferentes é a linha saindo do eixo na primeira vez que alguém
 * ajustar a largura da hora.
 */
const HORA = 46;
const GAP_HORA = 8;
/** O anel: círculo de 44 mais 4px de borda da cor do fundo, que "corta" a linha. */
const ANEL = 52;
const CIRCULO = 44;
const GAP_TEXTO = 12;
const PAD_VERTICAL = 6;

/** Onde o eixo dos círculos cai, contado da borda esquerda da lista. */
export const TIMELINE_X = HORA + GAP_HORA + ANEL / 2;
/** E a que altura o centro do primeiro (e do último) círculo fica. */
export const TIMELINE_Y = PAD_VERTICAL + ANEL / 2;

type Props = {
  registro: RegistroRecente;
  /** Texto da esquerda: hora na Rotina, momento relativo na Home. */
  horaLabel: string;
  /** Sobrescreve o resumo — a Home recalcula o sono em andamento num tick local. */
  resumo?: string;
  onPress: () => void;
  /** Só a Home passa: encerrar o sono aberto sem sair da tela. */
  acao?: React.ReactNode;
};

export function ItemRegistro({ registro, horaLabel, resumo, onPress, acao }: Props) {
  const visual = CATEGORIA_POR_TIPO[registro.tipo];
  const texto = resumo ?? registro.resumo;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir registro de ${visual.label}: ${texto}, ${horaLabel}`}
      style={[styles.item, semCalloutNaWeb]}
    >
      {/* Duas linhas porque a Home manda momento relativo ("ontem 11:05"), que
          não cabe em 46px numa linha só. A Rotina manda só "11:05" e usa uma. */}
      <Text style={styles.hora} numberOfLines={2}>
        {horaLabel}
      </Text>

      <View style={styles.anel}>
        <View style={[styles.circulo, { backgroundColor: visual.bg }]}>
          <IconeDoTipo nome={visual.icon} tamanho={20} cor={visual.tinta} />
        </View>
      </View>

      <View style={styles.texto}>
        <Text style={[styles.resumo, registro.emAndamento && styles.ativo]}>{texto}</Text>
        <Text style={styles.categoria}>{visual.label}</Text>
      </View>

      {acao}
    </Pressable>
  );
}

/**
 * O item deixou de ser CARD e virou linha do tempo.
 *
 * Foi-se o fundo branco, o raio e a elevação: no protótipo estes itens não são
 * cartões sobre o fundo, são linhas atravessadas por um fio vertical. O que
 * separa um do outro passa a ser o ritmo dos círculos, não a moldura.
 *
 * E a hora mudou de lado — era a última coluna, agora é a primeira, alinhada à
 * direita contra o fio. É o que dá a leitura de cronologia: o olho desce pela
 * coluna de horas.
 *
 * Um efeito colateral bom: a `acao` (encerrar sono) ocupava o lugar da hora e a
 * escondia. Agora as duas convivem — a mãe vê a hora do sono aberto E o botão.
 */
const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: PAD_VERTICAL,
    // Dedo de mãe com bebê no colo, no meio da madrugada.
    minHeight: 44,
  },
  hora: {
    ...typography.itemRotulo,
    color: colors.neutro500,
    width: HORA,
    textAlign: 'right',
    /**
     * `flexShrink: 0` NÃO É DETALHE — é o que sustenta o alinhamento da linha.
     *
     * O `ListaDeRegistros` posiciona o fio vertical num `left` CONSTANTE,
     * calculado a partir deste `HORA`. Se a coluna de hora encolher, o círculo
     * anda para a esquerda e o fio fica onde estava: a linha passa a cortar os
     * ícones fora do centro.
     *
     * E ela encolhe: no react-native-web o `Text` sai com `flex-shrink: 1`, e
     * `width` sozinho não segura nada dentro de uma linha apertada — tela
     * estreita com resumo longo bastaria.
     *
     * Medido em 13/08/2026 numa janela sem área de renderização: a hora colapsou
     * para 0 e o desalinhamento saiu exatamente 46px, a largura desta coluna.
     * O ambiente era degenerado, o mecanismo não.
     */
    flexShrink: 0,
  },
  // O anel é da COR DO FUNDO, e é ele que "corta" a linha vertical: sem isso o
  // fio atravessaria o círculo por trás e apareceria dos dois lados dele.
  anel: {
    width: ANEL,
    height: ANEL,
    borderRadius: ANEL / 2,
    backgroundColor: colors.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: GAP_HORA,
    marginRight: GAP_TEXTO,
  },
  circulo: {
    width: CIRCULO,
    height: CIRCULO,
    borderRadius: CIRCULO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { flex: 1 },
  resumo: { ...typography.itemDetalhe, color: colors.headline },
  /**
   * Sono em andamento. Hoje é só a COR DO TEXTO do resumo — `coral600`
   * (`#C94A32`) —, não fundo sólido nem ícone branco.
   *
   * ⚠️ NÃO LEIA ISTO COMO DECISÃO DE VIGILÂNCIA. É coral porque, quando foi
   * escrito, coral era o único recurso disponível para dizer "está correndo": os
   * pares pastéis não existiam ainda, e a paleta de categoria era sólida e
   * vívida. Não é a superfície escura do card de monitoramento, e não herda a
   * regra dele.
   *
   * A ALTERNATIVA, para quem for mexer nisto:
   *
   * O par `pastel.roxo` é exatamente o material para este caso — o sono já veste
   * essa família no círculo. Em andamento poderia ser o item inteiro com fundo
   * `#ECE7F8` e texto na tinta `#7A67A8`, em vez de trocar a cor do texto por
   * coral. Fica dentro do sistema, usa a cor do próprio tipo, e não pede que o
   * coral signifique duas coisas.
   *
   * Não foi feito porque não é o bloco disto, e trocar o realce do sono no meio
   * dos blocos de fidelidade misturaria fidelidade com desenho novo — o
   * protótipo não desenha o sono em andamento na lista.
   */
  ativo: { color: colors.coral600 },
  categoria: { ...typography.itemRotulo, color: colors.textoTerciario },
});

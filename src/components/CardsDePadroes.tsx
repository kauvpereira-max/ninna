import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { IconeDoTipo } from './IconeDoTipo';
import type { NomeDoIcone } from '../theme/icones';
import { colors, spacing, radius, typography } from '../theme/tokens';
import type { ChaveDePadrao } from '../lib/copyInsight';

/**
 * A seção "Padrões da {bebê}" — cards horizontais com o que o motor já sabe.
 *
 * ------------------------------------------------------------------
 * A COR É POR MÉTRICA, NUNCA POR POSIÇÃO
 *
 * Soneca é sempre roxo, mamada é sempre rosa. Se a cor viesse da posição, a
 * mesma métrica trocaria de cor quando a outra saísse de cena — o carrossel
 * encolhe de dois cards para um, e o sobrevivente muda de cor sem nada ter
 * mudado nele.
 *
 * Cor que muda de significado entre um dia e outro é ruído com cara de
 * informação.
 *
 * As três vêm do protótipo. A quarta dele — o amarelo de fralda — não é usada:
 * o motor não tem métrica de fralda, e um par de cores esperando métrica é o
 * mesmo que token sem consumidor.
 *
 * ------------------------------------------------------------------
 * O TEXTO NÃO MORA AQUI
 *
 * Ele vem do `copyInsight.ts`, pelo `descreverPadroes`. Do protótipo veio só a
 * forma — 212px, chip de 36px, 14/600 na tinta.
 *
 * A copy dele não podia ser copiada: "ficou mais consistente" é julgamento,
 * "estável há cinco dias" é adjetivo avaliativo sobre uma estabilidade que o
 * motor não mede, e "no mesmo ritmo do mês passado" é comparação entre janelas
 * que ele não calcula. É o que o `teste-linguagem-media` existe para barrar.
 */

const PALETA: Record<ChaveDePadrao, { fundo: string; tinta: string; icone: NomeDoIcone }> = {
  horario: { fundo: '#EAE5F7', tinta: '#5B4A86', icone: 'moon' },
  intervalo: { fundo: '#F6E7E2', tinta: '#A85A4E', icone: 'heart' },
  // O verde do protótipo era do card de "rotina mais consistente", que não
  // existe. Fica com a DURAÇÃO da soneca, que é a terceira métrica do motor e
  // não podia dividir o roxo com o horário: as duas são sono, e apareceriam
  // lado a lado indistinguíveis.
  duracao: { fundo: '#DDEBDF', tinta: '#426B52', icone: 'clock' },
};

type Props = {
  nomeBebe: string;
  padroes: { chave: ChaveDePadrao; texto: string }[];
};

export function CardsDePadroes({ nomeBebe, padroes }: Props) {
  // A seção inteira some quando não há o que dizer. Não há carrossel vazio nem
  // título sobre o nada — quando o motor tem uma métrica só, ela já está no card
  // de monitoramento, e repetir aqui seria a mesma frase duas vezes na rolagem.
  if (padroes.length === 0) return null;

  const sozinho = padroes.length === 1;

  return (
    <View style={estilos.secao}>
      <Text style={estilos.titulo}>Padrões de {nomeBebe}</Text>

      {/* Com um card só não há o que rolar, e um card de 212px sozinho num
          scroll parece corte. Ele passa a ocupar a largura. */}
      {sozinho ? (
        <View style={estilos.faixa}>
          <Card {...padroes[0]} largura="100%" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.faixa}
        >
          {padroes.map((p) => (
            <Card key={p.chave} {...p} largura={212} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Card({
  chave,
  texto,
  largura,
}: {
  chave: ChaveDePadrao;
  texto: string;
  largura: number | '100%';
}) {
  const cor = PALETA[chave];
  return (
    <View style={[estilos.card, { backgroundColor: cor.fundo, width: largura }]}>
      <View style={estilos.chip}>
        <IconeDoTipo nome={cor.icone} tamanho={20} cor={cor.tinta} />
      </View>
      <Text style={[estilos.texto, { color: cor.tinta }]}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { marginBottom: spacing.respiro },
  titulo: { ...typography.tituloSecao, color: colors.headline, marginBottom: 12 },
  // O protótipo sangra o scroll até a borda da tela e compensa com padding
  // interno. Aqui a coluna já é limitada a 480 pelo `scroll` da Home, então o
  // respiro lateral vem de lá e este só cuida do vão entre cards.
  faixa: { gap: 12, paddingVertical: 4 },
  card: {
    flex: 0,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 12,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    // Branco translúcido: a mesma peça funciona sobre os três fundos sem
    // precisar de uma variante por cor — igual ao badge "+" dos atalhos.
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { ...typography.itemRotulo, fontSize: 14, lineHeight: 20 },
});

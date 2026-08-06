import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../src/theme/tokens';

/**
 * A versão curta do termo, dentro do app.
 *
 * O termo completo é um PDF que a mãe recebe por WhatsApp antes de criar a conta
 * (`docs/embaixadora/termo-participacao.md`) — e PDF recebido no dia 1 não está à
 * mão no dia 12, quando ela se pergunta onde foi parar o que registrou. Esta tela
 * é onde ela reencontra a resposta sem precisar pedir.
 *
 * NÃO é um resumo livre: cada bloco aqui corresponde a uma promessa do termo, com
 * os mesmos prazos. Divergir de um dia entre os dois textos é o bastante para o
 * termo virar papel. Ao mexer em um, mexer no outro.
 *
 * A versão e a data no rodapé existem pelo mesmo motivo: o aceite dela é de uma
 * versão específica, e é preciso poder olhar a tela e saber qual.
 */
export default function SobreScreen() {
  const router = useRouter();

  function fechar() {
    // Na web a rota modal pode ser aberta direto pela URL, sem histórico pra voltar.
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/mais');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>Sobre a Ninna</Text>
            <Text style={styles.subtitulo}>O combinado, em versão curta</Text>
          </View>
          <Pressable
            onPress={fechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={styles.fechar}
          >
            <Ionicons name="close" size={22} color={colors.neutro500} />
          </Pressable>
        </View>

        <Secao titulo="A Ninna ainda está sendo feita">
          <Text style={styles.texto}>
            Um teste fechado, com três mães, até 25 de agosto de 2026. Pode ter erro, pode mudar
            de um dia pro outro. Se algo te atrapalhar, me avisa — é pra isso que o teste existe.
          </Text>
        </Secao>

        <Secao titulo="O que fica guardado">
          <Text style={styles.texto}>
            Seu nome e seu e-mail. O nome do seu bebê, a data de nascimento e o que mais você
            quiser preencher. E os registros que você fizer: mamada, sono, fralda, humor e
            sintoma, com o horário.
          </Text>
          <Text style={styles.texto}>
            Não peço documento, não peço endereço, e não acesso sua agenda, seus contatos, suas
            fotos nem sua localização.
          </Text>
        </Secao>

        <Secao titulo="Só você vê">
          <Text style={styles.texto}>
            Cada conta enxerga apenas os próprios dados, e isso é uma regra do banco, não uma
            promessa de tela: mesmo que alguém tente, o banco recusa. Nada aqui é vendido,
            compartilhado ou usado para publicidade.
          </Text>
        </Secao>

        <Secao titulo="A Ninna não dá conselho médico">
          <Text style={styles.texto}>
            A Ninna descreve o que você registrou — por volta de tal horário, mais ou menos tanto
            tempo. Não diz se está certo ou errado, não avalia gravidade e não substitui consulta.
            Se você estiver preocupada com alguma coisa, confie no seu instinto e fale com o
            pediatra: a Ninna acompanha, mas quem examina é o pediatra.
          </Text>
        </Secao>

        <Secao titulo="Como apagar tudo">
          <Text style={styles.texto}>
            Me manda uma mensagem no WhatsApp, no mesmo contato por onde você recebeu o convite,
            dizendo que quer apagar seus dados. Confirmo em até 1 dia e apago em até 2: sua conta,
            seu bebê e todos os registros. Não precisa dar motivo.
          </Text>
        </Secao>

        <Secao titulo="No fim do teste">
          <Text style={styles.texto}>
            Em 25 de agosto de 2026 eu apago tudo, por padrão. Se você quiser continuar usando e
            manter seus registros, é só me dizer — mas precisa ser dito: o silêncio significa
            apagar.
          </Text>
        </Secao>

        <Text style={styles.rodape}>Termo de participação — versão 1, de 06/08/2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutro50 },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titulo: { ...typography.h1, color: colors.headline, marginBottom: spacing.xs },
  subtitulo: { ...typography.body, color: colors.neutro500 },
  fechar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutro100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secao: { marginTop: spacing.xl, gap: spacing.sm },
  secaoTitulo: { ...typography.h3, color: colors.headline },
  texto: { ...typography.bodyLarge, color: colors.neutro600 },
  rodape: {
    ...typography.caption,
    color: colors.neutro400,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
});

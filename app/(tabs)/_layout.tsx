import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/tokens';

// BETA (21 dias): três abas, e só. O esqueleto inicial tinha seis — Ninna, Insights
// e Evolução eram telas que diziam "não implementada", e mãe de primeira viagem que
// abre isso conclui que o app está quebrado, não que a função virá depois.
//
// O insight personalizado mora no card da Home, não numa aba própria: ele é a
// primeira coisa que a mãe deve ver ao abrir, não algo que ela precise procurar.
//
// As três abas removidas voltam depois do beta — a decisão está em BETA.md e o
// código delas continua no commit de baseline do repositório.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.rosa500,
        tabBarInactiveTintColor: colors.neutro400,
        tabBarStyle: {
          backgroundColor: colors.neutro0,
          borderTopColor: colors.neutro100,
        },
        tabBarLabelStyle: {
          fontFamily: 'NunitoSans_600SemiBold',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rotina"
        options={{
          title: 'Rotina',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      {/* A Ninna entra como item igual aos outros — mesmo tamanho, mesma linha.
          Nunca botão flutuante elevado com position absolute: já foi corrigido
          uma vez e continua valendo (CLAUDE.md).

          Terceira posição, e não segunda: entra sem empurrar Rotina de lugar,
          e continua a um toque. */}
      <Tabs.Screen
        name="ninna"
        options={{
          title: 'Ninna',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/tokens';

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
      <Tabs.Screen
        name="ninna"
        options={{
          title: 'Ninna',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => <Ionicons name="bulb" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="evolucao"
        options={{
          title: 'Evolução',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
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

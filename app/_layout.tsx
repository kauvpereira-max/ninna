import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { BabyProvider, useBaby } from '../src/contexts/BabyContext';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { bebeAtivo, loading: babyLoading } = useBaby();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const grupo = segments[0];
    const inAuthGroup = grupo === '(auth)';
    const inOnboarding = grupo === '(onboarding)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Com sessão válida, o destino depende de já existir bebê — espera o fetch.
    if (babyLoading) return;

    if (!bebeAtivo) {
      if (!inOnboarding) router.replace('/(onboarding)/cadastro-bebe');
      return;
    }

    if (inAuthGroup || inOnboarding) router.replace('/(tabs)');
  }, [session, authLoading, babyLoading, bebeAtivo, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      {/* Registrar é ação de segundos, feita com o bebê no colo: entra por cima da Home
          e sai no gesto de arrastar pra baixo, sem parecer que saiu do app. */}
      <Stack.Screen name="registro/[tipo]" options={{ presentation: 'modal' }} />
      {/* Mesmo tratamento pro seletor de bebê e pro cadastro chamado por ele. */}
      <Stack.Screen name="bebes/index" options={{ presentation: 'modal' }} />
      <Stack.Screen name="bebes/novo" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          Fredoka_500Medium: require('../assets/fonts/Fredoka-Medium.ttf'),
          Fredoka_600SemiBold: require('../assets/fonts/Fredoka-SemiBold.ttf'),
          NunitoSans_400Regular: require('../assets/fonts/NunitoSans-Regular.ttf'),
          NunitoSans_600SemiBold: require('../assets/fonts/NunitoSans-SemiBold.ttf'),
          NunitoSans_700Bold: require('../assets/fonts/NunitoSans-Bold.ttf'),
        });
      } catch {
        // O app é distribuído como PWA: a fonte vem por download, e download falha —
        // 4G ruim no quarto do bebê às 3h da manhã é o caso normal, não o excepcional.
        // Sem este catch, `setFontsLoaded(true)` nunca roda, a splash nunca sai e a mãe
        // fica numa tela branca permanente. Ela não relata isso: ela desinstala.
        //
        // Com o catch, o React Native cai na fonte de sistema. O app fica menos bonito
        // e continua inteiro — todo o resto (tamanho, peso, espaçamento) vem dos tokens,
        // não da família da fonte.
      } finally {
        // No `finally` de propósito: seja qual for o desfecho, a splash TEM que sair.
        setFontsLoaded(true);
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BabyProvider>
          <RootNavigator />
        </BabyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}


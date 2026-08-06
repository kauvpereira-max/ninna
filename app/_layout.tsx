import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { BabyProvider, useBaby } from '../src/contexts/BabyContext';
import { BannerInstalar } from '../src/components/BannerInstalar';
import { CAMINHO_NOVA_SENHA } from '../src/lib/urls';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading: authLoading, emRecuperacao } = useAuth();
  const { bebeAtivo, loading: babyLoading } = useBaby();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    const grupo = segments[0];
    const inAuthGroup = grupo === '(auth)';
    const inOnboarding = grupo === '(onboarding)';

    // Antes de qualquer outra via: o link de recuperação CRIA sessão, então sem
    // este desvio a regra "tem sessão → tabs" mandaria a mãe pra Home logada,
    // com a senha antiga ainda valendo e sem nunca ver o formulário de troca.
    // Vale também sem sessão (link expirado) — a tela é quem explica o que houve.
    if (emRecuperacao) {
      // `usePathname` e não `segments`: `(auth)` é grupo, some da URL, e a rota
      // final é `/nova-senha`.
      if (pathname !== CAMINHO_NOVA_SENHA) router.replace('/(auth)/nova-senha');
      return;
    }

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
  }, [session, authLoading, babyLoading, bebeAtivo, segments, pathname, emRecuperacao]);

  return (
    <>
      {/* Fica acima do Stack, e não dentro de uma tela, porque o primeiro acesso
          da mãe é a tela de login — e no iOS a PWA instalada tem armazenamento
          SEPARADO do Safari. Instalar depois de criar a conta faria ela entrar de
          novo dentro do app instalado. Melhor instalar antes. */}
      <BannerInstalar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        {/* Registrar é ação de segundos, feita com o bebê no colo: entra por cima da Home
            e sai no gesto de arrastar pra baixo, sem parecer que saiu do app. */}
        <Stack.Screen name="registro/[tipo]" options={{ presentation: 'modal' }} />
        {/* Detalhe do registro — mesma lógica: abre por cima da lista e volta pra ela. */}
        <Stack.Screen name="detalhe/[tipo]/[id]" options={{ presentation: 'modal' }} />
        {/* Mesmo tratamento pro seletor de bebê e pro cadastro chamado por ele. */}
        <Stack.Screen name="bebes/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="bebes/novo" options={{ presentation: 'modal' }} />
        {/* Sobre também entra por cima: é consulta, e a mãe volta pra onde estava. */}
        <Stack.Screen name="sobre" options={{ presentation: 'modal' }} />
      </Stack>
    </>
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


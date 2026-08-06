import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Preencher no .env (ver .env.example) — nunca commitar valores reais
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase não configurado — copie .env.example para .env e preencha suas credenciais.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Só na web, e é o que faz o link de recuperação funcionar: o e-mail devolve
    // a mãe com os tokens no fragmento da URL, e é o supabase-js quem os troca
    // por sessão. No nativo não existe fragmento de URL pra ler — deixar ligado
    // lá só adicionaria trabalho na inicialização.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

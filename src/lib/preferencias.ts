// Preferências locais do aparelho (não vão pro Supabase).
// AsyncStorage já é dependência do projeto — a sessão do Supabase usa o mesmo storage
// (ver src/lib/supabase.ts).
//
// Nenhuma função daqui joga exceção: preferência é conforto, não pode derrubar tela.
// Falha de leitura vira "não tem nada salvo", falha de escrita vira só um warn.

import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAVE_BEBE_ATIVO = 'ninna.bebeAtivo';

export async function lerBebeAtivoSalvo(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHAVE_BEBE_ATIVO);
  } catch (erro) {
    console.warn('[preferencias] falha ao ler bebê ativo:', erro);
    return null;
  }
}

export async function salvarBebeAtivo(babyId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE_BEBE_ATIVO, babyId);
  } catch (erro) {
    console.warn('[preferencias] falha ao salvar bebê ativo:', erro);
  }
}

export async function limparBebeAtivo(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAVE_BEBE_ATIVO);
  } catch (erro) {
    console.warn('[preferencias] falha ao limpar bebê ativo:', erro);
  }
}

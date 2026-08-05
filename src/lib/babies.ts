// Acesso à tabela `babies`. As policies de RLS já limitam tudo ao dono,
// mas o user_id vai explícito no insert porque a policy de insert usa `with check`.

import { supabase } from './supabase';
import type { Baby, NovoBebe } from '../types/database';

type Resultado<T> = { data: T; error: string | null };

const ERRO_GENERICO = 'Não consegui falar com o servidor agora. Tenta de novo em instantes.';

export async function listarBebes(): Promise<Resultado<Baby[]>> {
  const { data, error } = await supabase
    .from('babies')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[babies] falha ao listar:', error.message);
    return { data: [], error: ERRO_GENERICO };
  }
  return { data: (data ?? []) as Baby[], error: null };
}

export async function criarBebe(userId: string, bebe: NovoBebe): Promise<Resultado<Baby | null>> {
  const { data, error } = await supabase
    .from('babies')
    .insert({ ...bebe, user_id: userId })
    .select()
    .single();

  if (error) {
    console.warn('[babies] falha ao criar:', error.message);
    return { data: null, error: 'Não consegui salvar o cadastro agora. Tenta de novo em instantes.' };
  }
  return { data: data as Baby, error: null };
}

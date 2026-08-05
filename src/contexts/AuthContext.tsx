import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { limparBebeAtivo } from '../lib/preferencias';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** Nome da mãe, como ela pediu pra ser chamada. Null em conta criada antes do D2. */
  nomeMae: string | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    nome: string,
  ) => Promise<{ error: string | null; precisaConfirmarEmail: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

/**
 * O nome da mãe mora em `user_metadata`, não numa tabela `profiles`.
 *
 * Uma tabela exigiria trigger de criação, RLS própria e uma quarta via no
 * RootNavigator (sem sessão → sem perfil → sem bebê → tabs) pra guardar um campo
 * de texto. Decisão registrada em BETA.md §3.4; migra quando o perfil da mãe
 * tiver mais de três campos.
 *
 * Conta criada antes do D2 não tem a chave — daí o retorno nullable, e daí toda
 * a copy que usa o nome precisar de uma versão sem ele.
 */
function extrairNome(user: User | null): string | null {
  const bruto = user?.user_metadata?.nome;
  if (typeof bruto !== 'string') return null;
  const limpo = bruto.trim();
  return limpo.length > 0 ? limpo : null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, nome: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome: nome.trim() } },
    });
    if (error) return { error: error.message, precisaConfirmarEmail: false };

    // No beta a confirmação de e-mail está DESLIGADA no painel do Supabase, então o
    // signUp já devolve sessão e o RootNavigator leva a mãe direto pro cadastro do
    // bebê — sem passo intermediário, que é onde se perde gente no primeiro contato.
    //
    // Mesmo assim não assumimos isso: quem liga a confirmação é uma chave no painel,
    // fora deste código, e ela vai ser religada antes de qualquer abertura pública.
    // Sem sessão de volta = confirmação ligada, e aí a tela precisa dizer isso.
    return { error: null, precisaConfirmarEmail: data.session === null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    // Bebê ativo é preferência de conta, não do aparelho: a próxima mãe que entrar
    // neste celular não pode herdar o filho da anterior.
    await limparBebeAtivo();
  }

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider
      value={{ session, user, nomeMae: extrairNome(user), loading, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return ctx;
}

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { limparBebeAtivo } from '../lib/preferencias';
import { traduzirErroAuth } from '../lib/mensagens-auth';
import { urlRetornoResetSenha, retornoDeRecuperacaoNaUrl } from '../lib/urls';

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
  /** Dispara o e-mail de reset. Ver a nota sobre enumeração em `recuperar-senha.tsx`. */
  enviarResetSenha: (email: string) => Promise<{ error: string | null }>;
  /** Troca a senha da sessão de recuperação aberta pelo link do e-mail. */
  definirNovaSenha: (senha: string) => Promise<{ error: string | null }>;
  /**
   * True enquanto a mãe está voltando de um link de recuperação. Segura o
   * RootNavigator na tela de definir senha: sem isso a sessão que o link cria
   * levaria ela direto pra Home, logada, com a senha antiga ainda valendo e sem
   * nunca ver o formulário.
   */
  emRecuperacao: boolean;
  /** Desiste da recuperação (botão "voltar pro login" da tela de nova senha). */
  sairDaRecuperacao: () => void;
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
  // Lido de forma síncrona na primeira renderização: o supabase-js limpa o
  // fragmento da URL durante a inicialização dele, que pode ser antes do
  // listener abaixo existir. Ver `retornoDeRecuperacaoNaUrl`.
  const [emRecuperacao, setEmRecuperacao] = useState(() => retornoDeRecuperacaoNaUrl() !== null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((evento, newSession) => {
      setSession(newSession);
      if (evento === 'PASSWORD_RECOVERY') setEmRecuperacao(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, nome: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome: nome.trim() } },
    });
    if (error) return { error: traduzirErroAuth(error), precisaConfirmarEmail: false };

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
    return { error: error ? traduzirErroAuth(error) : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    // Bebê ativo é preferência de conta, não do aparelho: a próxima mãe que entrar
    // neste celular não pode herdar o filho da anterior.
    await limparBebeAtivo();
  }

  async function enviarResetSenha(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: urlRetornoResetSenha(),
    });
    return { error: error ? traduzirErroAuth(error) : null };
  }

  async function definirNovaSenha(senha: string) {
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return { error: traduzirErroAuth(error) };

    // Deu certo: a sessão da recuperação vira sessão normal e o RootNavigator
    // volta a mandar pelo caminho de sempre (bebê cadastrado → tabs).
    setEmRecuperacao(false);
    return { error: null };
  }

  function sairDaRecuperacao() {
    setEmRecuperacao(false);
  }

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        nomeMae: extrairNome(user),
        loading,
        signUp,
        signIn,
        signOut,
        enviarResetSenha,
        definirNovaSenha,
        emRecuperacao,
        sairDaRecuperacao,
      }}
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

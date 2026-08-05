import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { criarBebe, listarBebes } from '../lib/babies';
import { lerBebeAtivoSalvo, limparBebeAtivo, salvarBebeAtivo } from '../lib/preferencias';
import type { Baby, NovoBebe } from '../types/database';

type BabyContextValue = {
  bebes: Baby[];
  /** Bebê em foco. Null = a conta ainda não tem bebê cadastrado (dispara o onboarding). */
  bebeAtivo: Baby | null;
  loading: boolean;
  error: string | null;
  selecionarBebe: (id: string) => void;
  cadastrarBebe: (bebe: NovoBebe) => Promise<{ error: string | null }>;
  recarregar: () => Promise<void>;
};

const BabyContext = createContext<BabyContextValue | undefined>(undefined);

export function BabyProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;

  const [bebes, setBebes] = useState<Baby[]>([]);
  const [bebeAtivoId, setBebeAtivoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Descarta respostas de um usuário que já não é o atual (troca de conta / logout
  // durante um fetch em andamento).
  const requisicaoAtual = useRef(0);

  // Espelha o bebeAtivoId pra `carregar` poder consultá-lo sem virar dependência
  // do useCallback (o que refaria o fetch a cada troca de bebê).
  const bebeAtivoIdRef = useRef<string | null>(null);

  const definirAtivo = useCallback((id: string | null) => {
    bebeAtivoIdRef.current = id;
    setBebeAtivoId(id);
  }, []);

  const carregar = useCallback(async () => {
    const token = ++requisicaoAtual.current;

    if (!userId) {
      setBebes([]);
      definirAtivo(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Lista e preferência salva vão juntas de propósito: enquanto as duas não
    // voltarem, `loading` segue true e a Home não renderiza. A mãe não pode ver o
    // nome de um filho aparecer e trocar pelo do outro um instante depois.
    const [{ data, error }, idSalvo] = await Promise.all([listarBebes(), lerBebeAtivoSalvo()]);
    if (token !== requisicaoAtual.current) return;

    const existe = (id: string | null) => !!id && data.some((b) => b.id === id);

    let escolhido: string | null;
    if (existe(bebeAtivoIdRef.current)) {
      escolhido = bebeAtivoIdRef.current; // recarga no meio da sessão não pula de bebê
    } else if (existe(idSalvo)) {
      escolhido = idSalvo;
    } else {
      escolhido = data[0]?.id ?? null; // primeira abertura, ou id salvo que não vale mais
    }

    // Id órfão — bebê apagado, ou chave sobrando de outra conta. Some sem avisar:
    // não é erro que a mãe precise ver.
    if (idSalvo && !existe(idSalvo)) limparBebeAtivo();

    setBebes(data);
    setError(error);
    definirAtivo(escolhido);
    setLoading(false);
  }, [userId, definirAtivo]);

  useEffect(() => {
    // Só decidimos qualquer coisa depois que o AuthContext souber se há sessão.
    if (authLoading) return;
    carregar();
  }, [authLoading, carregar]);

  const selecionarBebe = useCallback(
    (id: string) => {
      definirAtivo(id);
      // Grava em segundo plano: a troca na tela não espera o disco.
      salvarBebeAtivo(id);
    },
    [definirAtivo]
  );

  const cadastrarBebe = useCallback(
    async (bebe: NovoBebe) => {
      if (!userId) return { error: 'Sua sessão expirou. Entra de novo pra continuar.' };

      const { data, error } = await criarBebe(userId, bebe);
      if (error || !data) return { error: error ?? 'Não consegui salvar o cadastro.' };

      setBebes((atuais) => [...atuais, data]);
      // Quem acabou de ser cadastrado vira o bebê em foco, e isso persiste.
      definirAtivo(data.id);
      salvarBebeAtivo(data.id);
      return { error: null };
    },
    [userId, definirAtivo]
  );

  const bebeAtivo = bebes.find((b) => b.id === bebeAtivoId) ?? null;

  return (
    <BabyContext.Provider
      value={{ bebes, bebeAtivo, loading, error, selecionarBebe, cadastrarBebe, recarregar: carregar }}
    >
      {children}
    </BabyContext.Provider>
  );
}

export function useBaby() {
  const ctx = useContext(BabyContext);
  if (!ctx) throw new Error('useBaby precisa estar dentro de um BabyProvider');
  return ctx;
}

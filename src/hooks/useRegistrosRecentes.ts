import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { listarRegistrosRecentes, type RegistroRecente } from '../lib/registros';

/**
 * Últimos registros do bebê ativo.
 *
 * Recarrega a cada foco da tela — é o que faz o registro recém-salvo aparecer na Home
 * quando a rota /registro/[tipo] fecha, sem precisar de estado global pra isso.
 */
export function useRegistrosRecentes(babyId: string | null, limite: number = 8) {
  const [registros, setRegistros] = useState<RegistroRecente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Mesmo cuidado do BabyContext: descarta resposta de um bebê que já não é o atual.
  const requisicaoAtual = useRef(0);

  const carregar = useCallback(async () => {
    const token = ++requisicaoAtual.current;

    if (!babyId) {
      setRegistros([]);
      setErro(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const { data, error } = await listarRegistrosRecentes(babyId, limite);
    if (token !== requisicaoAtual.current) return;

    setRegistros(data);
    setErro(error);
    setCarregando(false);
  }, [babyId, limite]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return { registros, carregando, erro, recarregar: carregar };
}

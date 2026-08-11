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
  const [carregandoRequisicao, setCarregandoRequisicao] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Mesmo cuidado do BabyContext: descarta resposta de um bebê que já não é o atual.
  const requisicaoAtual = useRef(0);

  /**
   * O mesmo buraco de um render do `useHistorico`, e aqui ele dói mais.
   *
   * Sem bebê ativo, `carregar` esvazia a lista e desliga o carregando. Quando o
   * bebê chega, o efeito de foco só roda DEPOIS do render — e nesse render a
   * Home tem `carregando: false` com a lista vazia, então ela pisca a frase de
   * "nenhum registro ainda".
   *
   * Esta é a tela das 3h da manhã. A mãe abre o app com o bebê no colo e lê, por
   * uma fração de segundo, que não há nada registrado. A tela não pode afirmar
   * ausência antes de ter perguntado.
   */
  const chavePedida = `${babyId ?? ''}|${limite}`;
  const [chaveCarregada, setChaveCarregada] = useState<string | null>(null);
  const carregando = carregandoRequisicao || chaveCarregada !== chavePedida;

  const carregar = useCallback(async () => {
    const token = ++requisicaoAtual.current;

    if (!babyId) {
      setRegistros([]);
      setErro(null);
      setCarregandoRequisicao(false);
      setChaveCarregada(chavePedida);
      return;
    }

    setCarregandoRequisicao(true);
    const { data, error } = await listarRegistrosRecentes(babyId, limite);
    if (token !== requisicaoAtual.current) return;

    setRegistros(data);
    setErro(error);
    setChaveCarregada(chavePedida);
    setCarregandoRequisicao(false);
  }, [babyId, limite, chavePedida]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return { registros, carregando, erro, recarregar: carregar };
}

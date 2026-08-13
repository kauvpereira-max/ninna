import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { contarHoje, type ContagensDeHoje } from '../lib/registros.ts';

/**
 * As contagens do dia para os mini-stats da Home.
 *
 * Recarrega a cada foco, igual ao `useRegistrosRecentes` — é o que faz o número
 * subir assim que a mãe fecha o modal de registro.
 *
 * ------------------------------------------------------------------
 * `prontas` NÃO É `!carregando`, E A DIFERENÇA É A LIÇÃO DA HOME
 *
 * Enquanto não houve resposta, `contagens` é `{0, 0, 0}` — que é um estado
 * indistinguível de "nenhum registro hoje". A tela mostraria três zeros
 * confiantes antes de ter perguntado qualquer coisa.
 *
 * É o mesmo erro que o `useRegistrosRecentes` documenta ("a tela não pode
 * afirmar ausência antes de ter perguntado"), e aqui ele é pior: lá pisca uma
 * frase, aqui piscam três números que a mãe pode ler como perda de registro.
 *
 * Por isso `prontas` só fica verdadeiro depois de uma resposta REAL para o bebê
 * atual. Antes disso a Home não desenha os cards.
 */
export function useContagensDeHoje(babyId: string | null) {
  const [contagens, setContagens] = useState<ContagensDeHoje>({
    mamadas: 0,
    sonecas: 0,
    fraldas: 0,
  });
  const [prontas, setProntas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Mesmo cuidado do resto: resposta de um bebê que já não é o atual é descartada.
  const requisicaoAtual = useRef(0);

  const carregar = useCallback(async () => {
    const token = ++requisicaoAtual.current;

    if (!babyId) {
      setContagens({ mamadas: 0, sonecas: 0, fraldas: 0 });
      setProntas(false);
      setErro(null);
      return;
    }

    const { data, error } = await contarHoje(babyId);
    if (token !== requisicaoAtual.current) return;

    setContagens(data);
    setErro(error);
    // Com erro as contagens vêm zeradas, e três zeros de uma falha de rede
    // mentiriam com a mesma cara de três zeros de um dia sem registro.
    setProntas(!error);
  }, [babyId]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  return { contagens, prontas, erro };
}

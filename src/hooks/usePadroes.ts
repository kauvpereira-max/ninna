import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { listarParaPadroes } from '../lib/registros';
import {
  calcularPadroes,
  fusoDoDispositivo,
  JANELA_DIAS,
  type Padroes,
} from '../lib/padroes';

/**
 * Os três padrões do bebê ativo, calculados no cliente.
 *
 * Lê a janela de 7 dias e chama `calcularPadroes`. Não existe tabela
 * `baby_patterns` nem Edge Function no beta (BETA.md §3.2): o volume real é de
 * ~40 registros por bebê por semana, e um segundo ambiente pra depurar às 2h da
 * manhã custa mais do que a conta que ele economizaria.
 *
 * O FUSO É O DO DISPOSITIVO, RESOLVIDO NA HORA DA CONTA
 *
 * `timestamptz` volta do Postgres como instante; "horário médio da soneca" é
 * conceito de hora local. Quem faz essa conversão é `padroes.ts`, e o fuso entra
 * aqui — resolvido a cada carga, não uma vez na vida do módulo. Mãe que viaja e
 * abre o app em outro fuso passa a ler os horários no relógio que ela está
 * olhando, que é o que "a soneca dela é por volta das 13h" significa pra quem
 * está com o bebê no colo.
 *
 * Recarrega a cada foco, mesmo padrão do `useRegistrosRecentes`: é o que faz o
 * registro recém-salvo entrar na conta quando o modal fecha.
 */
export function usePadroes(babyId: string | null) {
  const [padroes, setPadroes] = useState<Padroes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Mesmo cuidado do useRegistrosRecentes: resposta de um bebê que já não é o
  // atual não pode sobrescrever a do bebê que está na tela.
  const requisicaoAtual = useRef(0);

  const carregar = useCallback(async () => {
    const token = ++requisicaoAtual.current;

    if (!babyId) {
      setPadroes(null);
      setErro(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);

    const agora = new Date();
    const desde = new Date(agora.getTime() - JANELA_DIAS * 24 * 60 * 60_000);

    const { data, error } = await listarParaPadroes(babyId, { desde });
    if (token !== requisicaoAtual.current) return;

    if (error) {
      // Sem dado confiável não se calcula nada: `padroes` fica null e a tela
      // mostra o mesmo que mostraria com poucos registros. Número calculado
      // sobre leitura incompleta é o R3.
      setPadroes(null);
      setErro(error);
      setCarregando(false);
      return;
    }

    setPadroes(
      calcularPadroes(data, {
        agora,
        fusoHorario: fusoDoDispositivo(),
      })
    );
    setErro(null);
    setCarregando(false);
  }, [babyId]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return { padroes, carregando, erro, recarregar: carregar };
}

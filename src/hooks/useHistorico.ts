import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  listarRegistros,
  type CursorRegistro,
  type RegistroRecente,
  type TipoRegistro,
} from '../lib/registros';
import { chaveDoDia } from '../lib/horario';

/** Um dia da lista, com os registros daquele dia já ordenados. */
export type GrupoDoDia = {
  /** 'AAAA-MM-DD' em hora local — serve de key e de base pro rótulo. */
  dia: string;
  registros: RegistroRecente[];
};

const PAGINA = 20;

/**
 * Histórico paginado do bebê ativo, agrupado por dia.
 *
 * Separado de `useRegistrosRecentes` de propósito: a Home quer sempre os últimos
 * 8, recarregados a cada foco; o histórico acumula páginas e não pode perdê-las
 * quando a mãe volta do detalhe de um registro. Um hook só, tentando servir aos
 * dois, ou recarregaria demais ou de menos.
 */
export function useHistorico(
  babyId: string | null,
  /**
   * Null = todos os tipos.
   *
   * O filtro desce para a CONSULTA, não é aplicado sobre a página já carregada.
   * Filtrando só o que está em memória, "Amamentação" mostraria 2 itens porque
   * os outros estão na página 3 — e a mãe concluiria que quase não amamentou na
   * semana. Trocar de filtro reinicia o cursor: é outra lista, não um recorte
   * da mesma.
   */
  tipo: TipoRegistro | null = null,
  janelaDias: number | null = null
) {
  const [grupos, setGrupos] = useState<GrupoDoDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [temMais, setTemMais] = useState(false);

  const cursor = useRef<CursorRegistro | null>(null);
  // Mesmo cuidado do BabyContext: resposta de um bebê que já não é o atual é
  // descartada, em vez de sobrescrever a lista do bebê certo.
  const requisicaoAtual = useRef(0);

  const janela = useCallback(() => {
    if (!janelaDias) return null;
    const d = new Date();
    d.setDate(d.getDate() - (janelaDias - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, [janelaDias]);

  const carregar = useCallback(
    async ({ continuando }: { continuando: boolean }) => {
      const token = ++requisicaoAtual.current;

      if (!babyId) {
        setGrupos([]);
        setErro(null);
        setTemMais(false);
        setCarregando(false);
        return;
      }

      if (continuando) setCarregandoMais(true);
      else setCarregando(true);

      const { data, error } = await listarRegistros(babyId, {
        desde: janela(),
        limite: PAGINA,
        cursor: continuando ? cursor.current : null,
        tipos: tipo ? [tipo] : null,
      });

      if (token !== requisicaoAtual.current) return;

      cursor.current = data.proximoCursor;
      setTemMais(data.temMais);
      setErro(error);
      setGrupos((anteriores) =>
        agrupar(continuando ? [...achatar(anteriores), ...data.registros] : data.registros)
      );

      setCarregando(false);
      setCarregandoMais(false);
    },
    [babyId, janela, tipo]
  );

  // Recarrega do zero a cada foco — e também quando `tipo` muda, porque `carregar`
  // é dependência daqui. É o que faz o registro apagado no detalhe sumir da lista
  // quando a mãe volta. Perde a paginação acumulada, e isso é o certo: lista que
  // continua mostrando um registro que já não existe é pior que rolagem perdida.
  useFocusEffect(
    useCallback(() => {
      cursor.current = null;
      carregar({ continuando: false });
    }, [carregar])
  );

  const carregarMais = useCallback(() => {
    if (carregando || carregandoMais || !temMais) return;
    carregar({ continuando: true });
  }, [carregando, carregandoMais, temMais, carregar]);

  return {
    grupos,
    carregando,
    carregandoMais,
    erro,
    temMais,
    carregarMais,
    recarregar: () => {
      cursor.current = null;
      return carregar({ continuando: false });
    },
  };
}

function achatar(grupos: GrupoDoDia[]): RegistroRecente[] {
  return grupos.flatMap((g) => g.registros);
}

/**
 * Quebra a lista já ordenada em dias.
 *
 * A ordem vem pronta da camada de dados, então basta cortar quando a chave do dia
 * muda — sem reordenar nada e sem `Map`, que perderia a ordem de inserção se
 * alguma chave se repetisse fora de sequência.
 */
function agrupar(registros: RegistroRecente[]): GrupoDoDia[] {
  const grupos: GrupoDoDia[] = [];
  for (const registro of registros) {
    const dia = chaveDoDia(registro.ocorridoEm);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.registros.push(registro);
    else grupos.push({ dia, registros: [registro] });
  }
  return grupos;
}

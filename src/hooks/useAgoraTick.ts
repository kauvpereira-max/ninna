import { useEffect, useState } from 'react';

/**
 * Relógio local que avança sozinho enquanto `ativo` for true.
 *
 * Existe pro sono em andamento: o resumo vem do servidor com o `agora` do momento
 * do fetch, então sem isso a duração ficaria congelada até a lista recarregar.
 * Com `ativo` false o intervalo nem chega a ser criado — sem sono aberto, nada
 * precisa contar. O clear cobre desmontagem e a volta pra false.
 */
export function useAgoraTick(ativo: boolean, intervaloMs: number = 30_000) {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (!ativo) return;

    setAgora(new Date());
    const intervalo = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(intervalo);
  }, [ativo, intervaloMs]);

  return agora;
}

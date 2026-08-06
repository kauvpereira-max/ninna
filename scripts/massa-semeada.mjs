// O gerador da massa de teste, separado do script que escreve no banco.
//
// Mora sozinho porque a massa é GABARITO do motor (BETA.md §9-bis): dá pra
// calcular os três números esperados sem tocar no Supabase, e o `semear-registros.mjs`
// e a conferência do gabarito passam a ler a MESMA rotina. Duplicar o gerador
// faria o gabarito divergir do que foi realmente semeado sem ninguém notar —
// que é a pior falha possível pra um gabarito.
//
// Nada aqui toca em rede, credencial ou banco.

export const MARCA = 'SEMEADO';
export const NOME_BEBE_TESTE = 'SEMEADO-Teste';
export const DIAS = 7;

/**
 * Aleatoriedade determinística, com a semente reiniciada a cada chamada.
 *
 * Semente fixa: duas execuções produzem a mesma massa. Sem isso, "conferi o
 * intervalo médio na calculadora" não significa nada na execução seguinte.
 */
const SEMENTE_INICIAL = 20260805;

function criarGerador() {
  let semente = SEMENTE_INICIAL;
  const aleatorio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  return {
    aleatorio,
    entre: (min, max) => min + aleatorio() * (max - min),
    inteiro: (min, max) => Math.floor(min + aleatorio() * (max - min + 1)),
    escolher: (lista) => lista[Math.floor(aleatorio() * lista.length)],
  };
}

/**
 * 7 dias de rotina plausível.
 *
 * Plausível e não aleatória de propósito: motor alimentado com ruído produz
 * número sem sentido, e aí não dá pra saber se o erro é da matemática ou dos
 * dados. Então o bebê tem rotina de bebê — mama a cada ~3h, três sonecas em
 * faixas parecidas, e uma noite por volta das 20h.
 *
 * O dia de HOJE é semeado só até a hora atual: registro no futuro apareceria
 * como "ontem" na lista (a máscara HH:MM lê hora futura como do dia anterior).
 * Por isso o dia 0 é o último do laço — os seis dias anteriores são idênticos
 * em qualquer execução, e só a cauda de hoje cresce ao longo do dia.
 */
export function gerarMassa(babyId, { agora = new Date() } = {}) {
  const { aleatorio, entre, inteiro, escolher } = criarGerador();

  const meiaNoite = (diasAtras) => {
    const d = new Date(agora);
    d.setDate(d.getDate() - diasAtras);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const iso = (dia, horas) =>
    new Date(meiaNoite(dia).getTime() + horas * 3_600_000).toISOString();

  const alimentacao = [];
  const sono = [];
  const fralda = [];
  const humor = [];
  const sintoma = [];

  for (let dia = DIAS - 1; dia >= 0; dia--) {
    const hoje = dia === 0;
    const agoraHoras = agora.getHours() + agora.getMinutes() / 60;
    const limite = hoje ? agoraHoras : 24;

    // Mamadas a cada ~3h, começando às 6h.
    for (let h = 6; h < limite; h += entre(2.7, 3.3)) {
      const peito = aleatorio() < 0.6;
      alimentacao.push(
        peito
          ? {
              baby_id: babyId,
              type: 'breast',
              side: escolher(['left', 'right', 'both']),
              duration_seconds: inteiro(8, 22) * 60,
              started_at: iso(dia, h),
              notes: MARCA,
            }
          : {
              baby_id: babyId,
              type: 'bottle',
              amount_ml: inteiro(6, 15) * 10,
              bottle_type: escolher(['breast_milk', 'formula']),
              started_at: iso(dia, h),
              notes: MARCA,
            }
      );
    }

    // Três sonecas em faixas estáveis + o sono da noite.
    for (const faixa of [
      [8.5, 9.5],
      [12.5, 13.5],
      [16.0, 17.0],
    ]) {
      const inicio = entre(faixa[0], faixa[1]);
      if (inicio >= limite) continue;
      const duracao = entre(0.7, 1.5);
      sono.push({
        baby_id: babyId,
        started_at: iso(dia, inicio),
        ended_at: iso(dia, inicio + duracao),
      });
    }

    const noite = entre(19.5, 20.5);
    if (noite < limite) {
      sono.push({
        baby_id: babyId,
        started_at: iso(dia, noite),
        ended_at: iso(dia, noite + entre(8, 10)),
      });
    }

    // Fraldas, humor e sintoma — esparsos.
    for (let n = 0; n < inteiro(3, 5); n++) {
      const h = entre(6, 22);
      if (h >= limite) continue;
      fralda.push({
        baby_id: babyId,
        content: escolher(['pee', 'pee', 'poop', 'both']),
        recorded_at: iso(dia, h),
        notes: MARCA,
      });
    }

    if (aleatorio() < 0.7) {
      const h = entre(7, 21);
      if (h < limite) {
        humor.push({
          baby_id: babyId,
          mood: escolher(['happy', 'calm', 'crying', 'sleepy', 'agitated', 'irritated']),
          probable_reason: escolher(['hunger', 'sleep', 'diaper', 'colic', 'holding', 'unknown']),
          recorded_at: iso(dia, h),
          notes: MARCA,
        });
      }
    }

    if (aleatorio() < 0.25) {
      const h = entre(8, 20);
      if (h < limite) {
        sintoma.push({
          baby_id: babyId,
          symptom: escolher(['fever', 'runny_nose', 'cough', 'colic']),
          intensity: escolher(['mild', 'moderate']),
          recorded_at: iso(dia, h),
          notes: MARCA,
        });
      }
    }
  }

  return { alimentacao, sono, fralda, humor, sintoma };
}

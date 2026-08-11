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

  /**
   * Uma lista só, com o `tipo` em cada linha — a forma de `registros`.
   *
   * Eram cinco listas, uma por tabela. Quem consome filtra por tipo, que é a
   * mesma coisa que o app faz agora, e o gerador deixa de ter uma segunda
   * opinião sobre onde cada registro mora.
   */
  const registros = [];

  const linha = (tipo, quando, dados, extra = {}) => ({
    baby_id: babyId,
    tipo,
    ocorrido_em: quando,
    dados,
    ...extra,
  });

  for (let dia = DIAS - 1; dia >= 0; dia--) {
    const hoje = dia === 0;
    const agoraHoras = agora.getHours() + agora.getMinutes() / 60;
    const limite = hoje ? agoraHoras : 24;

    // Mamadas a cada ~3h, começando às 6h.
    for (let h = 6; h < limite; h += entre(2.7, 3.3)) {
      const peito = aleatorio() < 0.6;
      registros.push(
        peito
          ? linha(
              'amamentar',
              iso(dia, h),
              {
                side: escolher(['left', 'right', 'both']),
                duration_seconds: inteiro(8, 22) * 60,
              },
              { notes: MARCA }
            )
          : linha(
              'mamadeira',
              iso(dia, h),
              {
                amount_ml: inteiro(6, 15) * 10,
                bottle_type: escolher(['breast_milk', 'formula']),
              },
              { notes: MARCA }
            )
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
      registros.push(
        linha('sono', iso(dia, inicio), {}, { terminou_em: iso(dia, inicio + duracao) })
      );
    }

    const noite = entre(19.5, 20.5);
    if (noite < limite) {
      registros.push(
        linha('sono', iso(dia, noite), {}, { terminou_em: iso(dia, noite + entre(8, 10)) })
      );
    }

    // Fraldas, humor e sintoma — esparsos.
    for (let n = 0; n < inteiro(3, 5); n++) {
      const h = entre(6, 22);
      if (h >= limite) continue;
      registros.push(
        linha(
          'fralda',
          iso(dia, h),
          { content: escolher(['pee', 'pee', 'poop', 'both']) },
          { notes: MARCA }
        )
      );
    }

    if (aleatorio() < 0.7) {
      const h = entre(7, 21);
      if (h < limite) {
        registros.push(
          linha(
            'humor',
            iso(dia, h),
            {
              mood: escolher(['happy', 'calm', 'crying', 'sleepy', 'agitated', 'irritated']),
              probable_reason: escolher([
                'hunger',
                'sleep',
                'diaper',
                'colic',
                'holding',
                'unknown',
              ]),
            },
            { notes: MARCA }
          )
        );
      }
    }

    if (aleatorio() < 0.25) {
      const h = entre(8, 20);
      if (h < limite) {
        registros.push(
          linha(
            'sintoma',
            iso(dia, h),
            {
              symptom: escolher(['fever', 'runny_nose', 'cough', 'colic']),
              intensity: escolher(['mild', 'moderate']),
            },
            { notes: MARCA }
          )
        );
      }
    }
  }

  // Em ordem de tempo, como o banco devolve — a massa deixa de depender da ordem
  // em que este laço monta os tipos.
  registros.sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em));
  return registros;
}

/** Os registros de um tipo — ou de vários, quando o alvo é "mamada". */
export function doTipo(registros, ...tipos) {
  return registros.filter((r) => tipos.includes(r.tipo));
}

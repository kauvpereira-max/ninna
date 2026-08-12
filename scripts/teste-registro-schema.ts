/**
 * O que este teste defende: que trocar oito lugares por um não mudou nada.
 *
 * O bloco 2 é uma refatoração, e refatoração tem um risco que funcionalidade
 * nova não tem: ela pode passar em tudo e ainda assim mudar o que a mãe lê ou o
 * que o banco recebe. Então as asserções aqui são **literais de propósito** —
 * a frase inteira, a linha inteira. Uma comparação frouxa ("tem erro no lado")
 * aprovaria uma copy diferente da que estava no ar.
 *
 * Os valores esperados foram lidos do código anterior, campo por campo, antes de
 * ele ser apagado. Se um deles precisar mudar um dia, é para o teste falhar: a
 * mudança tem que ser decidida, não herdada.
 */

import {
  COLUNAS_REAIS,
  LEITURA,
  SCHEMAS,
  TIPOS_REGISTRO,
  SINTOMA_OUTRO,
  LADOS,
  MOTIVOS_HUMOR,
  linhaParaBanco,
  mascaraNumero,
  numeroDoCampo,
  paraAColuna,
  textoDoCampo,
  resolverCampo,
  rotularValor,
  tipoDaLinha,
  validarRegistro,
  valoresDaLinha,
  type CampoSchema,
  type TipoRegistro,
  type ValoresRegistro,
} from '../src/lib/registroSchema.ts';
import { horaNoDia, horaParaData } from '../src/lib/horario.ts';
import {
  ATALHOS_DA_HOME,
  CATEGORIAS_FORA_DA_HOME,
  TETO_DE_ATALHOS,
} from '../src/theme/categorias.ts';

let falhas = 0;

function checar(nome: string, condicao: boolean, detalhe = '') {
  console.log(`[${condicao ? '  ok  ' : ' FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas++;
}

function iguais(nome: string, obtido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  checar(nome, a === b, a === b ? '' : `obtido ${a}, esperado ${b}`);
}

const horaValida = (texto: string) => horaParaData(texto) !== null;
const validar = (tipo: TipoRegistro, valores: ValoresRegistro) =>
  validarRegistro(tipo, valores, horaValida);

const HORA_OK = '14:20';
const MOMENTO = '2026-08-11T17:20:00.000Z';

console.log('\n— todo tipo tem schema, e todo schema começa pela hora —\n');

for (const tipo of TIPOS_REGISTRO) {
  const schema = SCHEMAS[tipo];
  checar(`${tipo}: schema existe e se declara com o próprio nome`, schema?.tipo === tipo);
  checar(`${tipo}: o primeiro campo é a hora`, schema.campos[0]?.entrada === 'hora');
  checar(
    `${tipo}: nenhuma chave de campo repetida`,
    new Set(schema.campos.map((c) => c.chave)).size === schema.campos.length
  );
  checar(
    `${tipo}: todo campo obrigatório tem frase própria de erro`,
    schema.campos.every((c) => !c.obrigatorio || Boolean(c.erroFalta)),
    'campo que reprova sem dizer o que falta deixa a mãe travada'
  );
}

console.log('\n— as frases de erro, exatamente como estavam antes —\n');

const VAZIO: ValoresRegistro = {};

iguais('amamentar em branco', validar('amamentar', VAZIO), {
  hora: 'Coloca no formato HH:MM, ex.: 14:20.',
  lado: 'De qual lado foi?',
});

iguais('mamadeira em branco', validar('mamadeira', VAZIO), {
  hora: 'Coloca no formato HH:MM, ex.: 14:20.',
  quantidade: 'Quantidade em ml, ex.: 90.',
  leite: 'Era leite materno ou fórmula?',
});

iguais('fralda em branco', validar('fralda', VAZIO), {
  hora: 'Coloca no formato HH:MM, ex.: 14:20.',
  conteudo: 'O que tinha na fralda?',
});

iguais('humor em branco', validar('humor', VAZIO), {
  hora: 'Coloca no formato HH:MM, ex.: 14:20.',
  humor: 'Qual estado você percebeu?',
});

iguais('sintoma em branco', validar('sintoma', VAZIO), {
  hora: 'Coloca no formato HH:MM, ex.: 14:20.',
  sintoma: 'O que você notou?',
});

iguais('sono só pede a hora', validar('sono', VAZIO), {
  hora: 'Coloca no formato HH:MM, ex.: 14:20.',
});

console.log('\n— o que é opcional continua opcional —\n');

iguais(
  'amamentação sem duração e sem observação passa',
  validar('amamentar', { hora: HORA_OK, lado: 'left' }),
  {}
);
iguais(
  'humor sem motivo passa — não saber o motivo é resposta',
  validar('humor', { hora: HORA_OK, humor: 'crying' }),
  {}
);
iguais(
  'sintoma sem intensidade passa',
  validar('sintoma', { hora: HORA_OK, sintoma: 'fever' }),
  {}
);

console.log('\n— faixa de número: fora dela reprova, dentro passa —\n');

iguais(
  'duração de 0 reprova',
  validar('amamentar', { hora: HORA_OK, lado: 'left', duracao: '0' }),
  { duracao: 'Duração em minutos, de 1 a 180.' }
);
iguais(
  'duração de 181 reprova',
  validar('amamentar', { hora: HORA_OK, lado: 'left', duracao: '181' }),
  { duracao: 'Duração em minutos, de 1 a 180.' }
);
iguais(
  'duração de 180 passa — o limite está dentro',
  validar('amamentar', { hora: HORA_OK, lado: 'left', duracao: '180' }),
  {}
);
iguais(
  'quantidade de 4 ml reprova',
  validar('mamadeira', { hora: HORA_OK, leite: 'formula', quantidade: '4' }),
  { quantidade: 'Quantidade em ml, ex.: 90.' }
);
iguais(
  'quantidade de 5 ml passa',
  validar('mamadeira', { hora: HORA_OK, leite: 'formula', quantidade: '5' }),
  {}
);

console.log('\n— o sintoma "Outro" exige descrição, e só ele —\n');

iguais(
  '"Outro" sem descrição reprova com a frase certa',
  validar('sintoma', { hora: HORA_OK, sintoma: SINTOMA_OUTRO }),
  { observacao: 'Me conta em poucas palavras o que você notou.' }
);
iguais(
  '"Outro" com descrição passa',
  validar('sintoma', { hora: HORA_OK, sintoma: SINTOMA_OUTRO, observacao: 'pele fria' }),
  {}
);
iguais(
  'febre sem descrição passa — a exigência é só do "Outro"',
  validar('sintoma', { hora: HORA_OK, sintoma: 'fever' }),
  {}
);

const campoTexto = SCHEMAS.sintoma.campos.find((c) => c.chave === 'observacao')!;
checar(
  'e o campo muda de rótulo junto',
  resolverCampo(campoTexto, { sintoma: SINTOMA_OUTRO }).rotulo === 'O que você notou?' &&
    resolverCampo(campoTexto, { sintoma: 'fever' }).rotulo === 'Observação (opcional)',
  'a tela e a validação leem o mesmo campo resolvido'
);

console.log('\n— vocabulário fechado: valor de fora não entra —\n');

iguais(
  'humor inventado reprova como se estivesse em branco',
  validar('humor', { hora: HORA_OK, humor: 'euforico' }),
  { humor: 'Qual estado você percebeu?' }
);

console.log('\n— a linha que vai para o banco, campo por campo —\n');

iguais(
  'amamentação: o tipo é coluna, o lado é chave do dados, e minutos viram segundos',
  linhaParaBanco('amamentar', { hora: HORA_OK, lado: 'left', duracao: '12' }, MOMENTO),
  {
    tipo: 'amamentar',
    ocorrido_em: MOMENTO,
    notes: null,
    dados: { side: 'left', duration_seconds: 720 },
  }
);

iguais(
  'mamadeira: o que separava os dois tipos era uma coluna fixa, agora é o próprio tipo',
  linhaParaBanco(
    'mamadeira',
    { hora: HORA_OK, quantidade: '90', leite: 'formula', observacao: 'metade' },
    MOMENTO
  ),
  {
    tipo: 'mamadeira',
    ocorrido_em: MOMENTO,
    notes: 'metade',
    dados: { amount_ml: 90, bottle_type: 'formula' },
  }
);

iguais(
  'fralda: uma coluna de tempo para todos os tipos',
  linhaParaBanco('fralda', { hora: HORA_OK, conteudo: 'both' }, MOMENTO),
  { tipo: 'fralda', ocorrido_em: MOMENTO, notes: null, dados: { content: 'both' } }
);

/**
 * A asserção mais importante desta seção, e a que o `do nothing` do backfill
 * ensinou a escrever: chave ausente e chave nula NÃO são o mesmo estado.
 *
 * As 97 linhas migradas passaram por `jsonb_strip_nulls`, então "não informado"
 * lá é a chave não existir. Se o app escrevesse `"probable_reason": null`,
 * passariam a existir duas formas de dizer a mesma coisa — e a de baixo
 * atravessa o `dados ? 'chave'` que o Postgres usa para exigir campo.
 */
iguais(
  'humor: motivo vazio some do dados — não vira chave nula',
  linhaParaBanco('humor', { hora: HORA_OK, humor: 'crying', motivo: '' }, MOMENTO),
  { tipo: 'humor', ocorrido_em: MOMENTO, notes: null, dados: { mood: 'crying' } }
);

iguais(
  'sintoma "Outro": o slug vai no dados, o texto da mãe vai na coluna notes',
  linhaParaBanco(
    'sintoma',
    { hora: HORA_OK, sintoma: SINTOMA_OUTRO, observacao: 'pele fria' },
    MOMENTO
  ),
  { tipo: 'sintoma', ocorrido_em: MOMENTO, notes: 'pele fria', dados: { symptom: 'other' } }
);

iguais(
  'sono: só o instante, e um dados vazio — não um dados ausente',
  linhaParaBanco('sono', { hora: HORA_OK }, MOMENTO),
  { tipo: 'sono', ocorrido_em: MOMENTO, dados: {} }
);

checar(
  'sono não declara campo de observação — e por isso não escreve notes',
  SCHEMAS.sono.campos.every((c) => c.coluna !== 'notes') &&
    !('notes' in linhaParaBanco('sono', { hora: HORA_OK }, MOMENTO))
);

console.log('\n— o que é coluna e o que é chave do dados —\n');

/**
 * Um formulário com TODOS os campos preenchidos, por tipo.
 *
 * As asserções abaixo perguntam "onde cada campo foi parar", e campo vazio não
 * vai a lugar nenhum — com valores parciais elas passariam sem olhar nada.
 */
const VALORES_CHEIOS: Record<TipoRegistro, ValoresRegistro> = {
  amamentar: { hora: HORA_OK, lado: 'left', duracao: '12', observacao: 'sonolenta' },
  mamadeira: { hora: HORA_OK, quantidade: '90', leite: 'formula', observacao: 'metade' },
  fralda: { hora: HORA_OK, conteudo: 'both', observacao: 'bem líquido' },
  sono: { hora: HORA_OK },
  humor: { hora: HORA_OK, humor: 'calm', motivo: 'sleep', observacao: 'depois do banho' },
  sintoma: { hora: HORA_OK, sintoma: 'fever', intensidade: 'mild', observacao: 'à tarde' },
  banho: { hora: HORA_OK, observacao: 'antes de dormir' },
  passeio: { hora: HORA_OK, duracao: '40', observacao: 'na praça' },
  leitura: { hora: HORA_OK, duracao: '15', observacao: 'O Grúfalo' },
  atividade: { hora: HORA_OK, atividade: 'tummy_time', duracao: '10', observacao: 'aguentou bem' },
  comida: { hora: HORA_OK, aceitacao: 'half', observacao: 'papinha de legumes' },
  hidratacao: { hora: HORA_OK, liquido: 'water', quantidade: '50', observacao: 'no copo' },
  extracao: { hora: HORA_OK, quantidade: '120', lado: 'left', duracao: '20', observacao: 'de manhã' },
};

checar(
  'notes é a única coluna de verdade entre os campos',
  COLUNAS_REAIS.size === 1 && COLUNAS_REAIS.has('notes'),
  [...COLUNAS_REAIS].join(', ')
);

checar(
  'todo campo que não é notes vira chave dentro do dados',
  TIPOS_REGISTRO.every((tipo) => {
    const linha = linhaParaBanco(tipo, VALORES_CHEIOS[tipo], MOMENTO);
    const dados = linha.dados as Record<string, unknown>;
    return SCHEMAS[tipo].campos
      .filter((c) => c.coluna && !COLUNAS_REAIS.has(c.coluna))
      .every((c) => c.coluna! in dados);
  }),
  'um campo que não chegasse ao dados sumiria do banco sem quebrar nada'
);

checar(
  'e nenhuma coluna de verdade vaza para dentro do dados',
  TIPOS_REGISTRO.every((tipo) => {
    const dados = linhaParaBanco(tipo, VALORES_CHEIOS[tipo], MOMENTO).dados as Record<
      string,
      unknown
    >;
    return [...COLUNAS_REAIS].every((coluna) => !(coluna in dados));
  }),
  'notes duplicado nos dois lugares divergiria na primeira edição'
);

console.log('\n— um vocabulário, dois rótulos —\n');

checar(
  'no chip é "Esquerdo", no resumo é "Peito esquerdo"',
  LADOS[0].label === 'Esquerdo' && rotularValor(LADOS, 'left') === 'Peito esquerdo'
);
checar(
  '"Não sei" vira "não identificado" na leitura',
  rotularValor(MOTIVOS_HUMOR, 'unknown') === 'não identificado'
);
checar(
  'slug desconhecido cai nele mesmo, e o registro antigo segue legível',
  rotularValor(LADOS, 'seio_esquerdo') === 'seio_esquerdo'
);

console.log('\n— o tipo da linha é leitura, não mais dedução —\n');

checar('a linha diz o próprio tipo', tipoDaLinha({ tipo: 'amamentar' }) === 'amamentar');
checar(
  'e os dois tipos de mamada deixam de depender de uma coluna fixa',
  tipoDaLinha({ tipo: 'mamadeira' }) === 'mamadeira'
);
checar(
  'tipo que este app ainda não conhece devolve null, não quebra',
  tipoDaLinha({ tipo: 'vacina' }) === null,
  'é o que faz um dos 14 que faltam sumir da lista em vez de derrubá-la'
);
checar('linha sem tipo devolve null', tipoDaLinha({}) === null);


console.log('\n— o resumo da lista, frase por frase —\n');

/**
 * As linhas cruas são escritas à mão, e não geradas por `linhaParaBanco`: o que
 * se testa aqui é a LEITURA, e alimentá-la com a saída da escrita esconderia um
 * erro que as duas cometessem juntas — o campo trocado nas duas pontas.
 *
 * ------------------------------------------------------------------
 * E ELAS TÊM A FORMA REAL DA LINHA: `dados` DENTRO, TEMPO FORA
 *
 * Isto é regra 2b do CLAUDE.md, e quase escapou. O acessor da LEITURA procura no
 * `dados` e cai para o topo da linha se não achar — então um fixture achatado
 * (`{ side: 'left' }`) continua passando **mesmo se o app parar de ler o jsonb**.
 * O teste ficaria verde defendendo uma forma que o banco não devolve mais.
 *
 * Por isso: valor de campo vai em `dados`, e só `ocorrido_em`, `terminou_em` e
 * `notes` ficam no topo — exatamente como a linha volta de `registros`.
 */
const AGORA = new Date('2026-08-11T18:00:00.000Z');

/** Monta a linha como o banco devolve, para o fixture não poder mentir a forma. */
const linhaDoBanco = (
  dados: Record<string, unknown>,
  topo: Record<string, unknown> = {}
): Record<string, unknown> => ({ dados, ...topo });

const resumir = (tipo: TipoRegistro, linha: Record<string, unknown>) =>
  LEITURA[tipo].resumir(linha, AGORA);

checar(
  'amamentação com lado e duração',
  resumir('amamentar', linhaDoBanco({ side: 'left', duration_seconds: 720 })) ===
    'Peito esquerdo · 12 min',
  resumir('amamentar', linhaDoBanco({ side: 'left', duration_seconds: 720 }))
);
checar(
  'amamentação sem duração é só o lado',
  resumir('amamentar', linhaDoBanco({ side: 'both' })) === 'Os dois peitos'
);
checar(
  'amamentação sem lado nenhum não vira frase quebrada',
  resumir('amamentar', linhaDoBanco({})) === 'Peito'
);
checar(
  'mamadeira com ml e leite',
  resumir('mamadeira', linhaDoBanco({ amount_ml: 90, bottle_type: 'formula' })) ===
    '90 ml de fórmula'
);
checar(
  'mamadeira sem quantidade cai no nome',
  resumir('mamadeira', linhaDoBanco({ bottle_type: 'breast_milk' })) ===
    'Mamadeira de leite materno'
);
checar(
  'fralda é só o conteúdo',
  resumir('fralda', linhaDoBanco({ content: 'both' })) === 'Xixi e cocô'
);
checar(
  'sono encerrado vira duração',
  resumir(
    'sono',
    linhaDoBanco(
      {},
      { ocorrido_em: '2026-08-11T12:00:00.000Z', terminou_em: '2026-08-11T13:20:00.000Z' }
    )
  ) === '1h 20min de sono'
);
checar(
  'sono aberto fala no presente',
  resumir(
    'sono',
    linhaDoBanco({}, { ocorrido_em: '2026-08-11T17:30:00.000Z', terminou_em: null })
  ) === 'Dormindo há 30 min'
);
/**
 * O contador em andamento conta desde o PRIMEIRO minuto.
 *
 * O limiar era de 2 minutos e produzia uma janela de até 2min30s (o tick é de
 * 30s) em que a Home dizia "Dormindo agora" sem se mover — exatamente enquanto a
 * mãe espera o bebê pegar no sono, olhando a tela.
 *
 * As três asserções abaixo cercam a fronteira nova. A do meio é a que importa:
 * com o limiar antigo ela devolveria "Dormindo agora" e reprovaria.
 */
checar(
  'abaixo de um minuto não há minuto para mostrar',
  resumir(
    'sono',
    linhaDoBanco({}, { ocorrido_em: '2026-08-11T17:59:30.000Z', terminou_em: null })
  ) === 'Dormindo agora',
  '"menos de 1 min" seria mais palavras para dizer o que "Dormindo agora" já diz'
);
checar(
  'no primeiro minuto o contador já anda',
  resumir(
    'sono',
    linhaDoBanco({}, { ocorrido_em: '2026-08-11T17:59:00.000Z', terminou_em: null })
  ) === 'Dormindo há 1 min',
  'com o limiar antigo, de 2 min, isto voltaria "Dormindo agora"'
);
checar(
  'e no segundo também',
  resumir(
    'sono',
    linhaDoBanco({}, { ocorrido_em: '2026-08-11T17:58:00.000Z', terminou_em: null })
  ) === 'Dormindo há 2 min'
);

/**
 * O limiar de 2 minutos NÃO existe no sono encerrado — nunca existiu, e a
 * mudança acima não o moveu para cá. Um sono curto encerrado se conta pelo que
 * foi.
 */
checar(
  'sono encerrado de 1 minuto se conta como 1 minuto',
  resumir(
    'sono',
    linhaDoBanco(
      {},
      { ocorrido_em: '2026-08-11T17:00:00.000Z', terminou_em: '2026-08-11T17:01:00.000Z' }
    )
  ) === '1 min de sono'
);
checar(
  'humor com motivo vem em minúscula',
  resumir('humor', linhaDoBanco({ mood: 'crying', probable_reason: 'hunger' })) === 'Choro · fome'
);
checar(
  '"Não sei" vira "motivo não identificado", não "por Não sei"',
  resumir('humor', linhaDoBanco({ mood: 'crying', probable_reason: 'unknown' })) ===
    'Choro · motivo não identificado'
);
checar(
  'humor sem motivo é só o estado',
  resumir('humor', linhaDoBanco({ mood: 'calm' })) === 'Tranquilidade'
);
checar(
  'sintoma com intensidade',
  resumir('sintoma', linhaDoBanco({ symptom: 'fever', intensity: 'high' })) === 'Febre · forte'
);
checar(
  'sintoma "Outro" mostra o que a mãe escreveu, e ela mora na COLUNA notes',
  resumir('sintoma', linhaDoBanco({ symptom: 'other' }, { notes: 'pele fria' })) === 'pele fria'
);
checar(
  'sintoma aposentado continua legível',
  resumir('sintoma', linhaDoBanco({ symptom: 'irritability' })) === 'Irritação'
);

console.log('\n— os quatro do bloco 3 —\n');

checar('banho é só o banho', resumir('banho', linhaDoBanco({})) === 'Banho');
checar(
  'passeio com duração se conta pela duração',
  resumir('passeio', linhaDoBanco({ duration_seconds: 2400 })) === '40 min de passeio',
  'a forma é a do sono: o badge da lista já diz o tipo'
);
checar(
  'passeio sem duração não vira frase quebrada',
  resumir('passeio', linhaDoBanco({})) === 'Passeio'
);
checar(
  'leitura com duração',
  resumir('leitura', linhaDoBanco({ duration_seconds: 900 })) === '15 min de leitura'
);
checar(
  'atividade mostra o que foi, e depois quanto durou',
  resumir('atividade', linhaDoBanco({ activity: 'tummy_time', duration_seconds: 600 })) ===
    'Tempo de bruços · 10 min'
);
checar(
  'atividade sem duração é só o que foi',
  resumir('atividade', linhaDoBanco({ activity: 'sunbath' })) === 'Banho de sol'
);
checar(
  'atividade com slug desconhecido cai no próprio slug',
  resumir('atividade', linhaDoBanco({ activity: 'capoeira' })) === 'capoeira',
  'registro antigo segue legível quando o vocabulário mudar'
);

/**
 * A faixa de duração é COMPARTILHADA, e isto é o que segura a promessa.
 *
 * `duration_seconds` é uma coluna gerada só: amamentação, passeio, leitura e
 * atividade escrevem na mesma. O gerador de SQL para com colisão se as faixas
 * discordarem — mas ele roda em outro processo, e quem some um tipo aqui pode
 * não rodá-lo. Esta asserção falha no mesmo lugar em que o campo foi escrito.
 */
const comDuracao = TIPOS_REGISTRO.map((t) => SCHEMAS[t].campos.find((c) => c.chave === 'duracao'))
  .filter((c): c is Extract<CampoSchema, { entrada: 'numero' }> => c?.entrada === 'numero');

checar(
  'todos os tipos com duração declaram a MESMA faixa',
  comDuracao.length >= 4 &&
    new Set(comDuracao.map((c) => `${c.min}|${c.max}|${c.escala}`)).size === 1,
  `${comDuracao.length} tipos, ${new Set(comDuracao.map((c) => `${c.min}|${c.max}|${c.escala}`)).size} faixa(s) — ` +
    'uma coluna gerada tem uma faixa só'
);

console.log('\n— alimentação: os três do segundo grupo —\n');

checar(
  'comida se conta pelo verbo, não pelo rótulo do chip',
  resumir('comida', linhaDoBanco({ acceptance: 'half' })) === 'Comeu metade',
  '"Comida · metade" obrigaria a montar a frase de cabeça'
);
checar(
  'e "Nada" não vira acusação',
  resumir('comida', linhaDoBanco({ acceptance: 'none' })) === 'Não quis',
  'o que aconteceu, não o que faltou'
);
checar(
  'hidratação junta quantidade e líquido',
  resumir('hidratacao', linhaDoBanco({ amount_ml: 50, liquid: 'water' })) === '50 ml de água'
);
checar(
  'e sem quantidade fica só o líquido',
  resumir('hidratacao', linhaDoBanco({ liquid: 'tea' })) === 'Chá'
);
checar(
  'extração mostra quanto saiu, e de qual lado',
  resumir('extracao', linhaDoBanco({ amount_ml: 120, side: 'left' })) === '120 ml · peito esquerdo'
);
checar(
  'extração sem lado é só a quantidade',
  resumir('extracao', linhaDoBanco({ amount_ml: 120 })) === '120 ml'
);

/**
 * A faixa de `amount_ml` é COMPARTILHADA por três tipos, e a colisão que o
 * pré-requisito 3 previu para este grupo **não aconteceu**.
 *
 * Isso não é o guarda falhando — é o caso `DEVE_PASSAR` dele. Mamadeira,
 * Hidratação e Extração cabem em 5–500 ml de verdade; meio litro é teto de
 * sanidade para as três, não um número escolhido para caber.
 *
 * Esta asserção é o que impede a resposta preguiçosa no dia em que uma delas
 * quiser mais: alargar a faixa para caber faria o teste continuar passando e a
 * faixa deixar de significar alguma coisa. Mudar aqui obriga a mudar o número
 * escrito abaixo, que é o mesmo que dizer "isto foi decidido".
 */
const comMl = TIPOS_REGISTRO.map((t) => SCHEMAS[t].campos.find((c) => c.coluna === 'amount_ml'))
  .filter((c): c is Extract<CampoSchema, { entrada: 'numero' }> => c?.entrada === 'numero');

checar(
  'os três tipos que escrevem em amount_ml declaram a MESMA faixa',
  comMl.length === 3 && new Set(comMl.map((c) => `${c.min}|${c.max}`)).size === 1,
  `${comMl.length} tipos, faixa ${comMl[0]?.min}–${comMl[0]?.max} ml — uma coluna gerada tem uma faixa só`
);

console.log('\n— os atalhos da Home, e o teto que eles têm —\n');

/**
 * O teto existe porque o grid da Home vale por ser lido de relance, com uma mão,
 * no escuro. Passando de oito ele vira lista, e lista se lê em vez de se
 * reconhecer.
 *
 * Esta asserção não é sobre código: é para a decisão voltar à mesa quando
 * alguém tentar somar o nono. Alimentação e Crescimento trazem seis tipos, e a
 * pergunta certa naquele momento não é "cabe mais um?" — é qual sai.
 */
checar(
  `a Home tem no máximo ${TETO_DE_ATALHOS} atalhos`,
  ATALHOS_DA_HOME.length <= TETO_DE_ATALHOS,
  `${ATALHOS_DA_HOME.length} hoje — passar disso é decisão de produto, não de código`
);
checar(
  'todo atalho é um tipo que existe',
  ATALHOS_DA_HOME.every((t) => TIPOS_REGISTRO.includes(t))
);
checar(
  'e todo tipo tem caminho: ou atalho, ou a tela de Mais tipos',
  TIPOS_REGISTRO.every(
    (t) => ATALHOS_DA_HOME.includes(t) || CATEGORIAS_FORA_DA_HOME.some((c) => c.key === t)
  ),
  'tipo sem caminho é tipo que a mãe não alcança — e nada mais no app reclamaria'
);

console.log('\n— o detalhe: rótulos, ordem, e nada em branco —\n');

const detalhar = (tipo: TipoRegistro, linha: Record<string, unknown>) =>
  LEITURA[tipo].detalhar(linha, AGORA).map((c) => c.rotulo);

iguais(
  'amamentação sem duração não mostra a linha de duração',
  detalhar('amamentar', linhaDoBanco({ side: 'left' }, { ocorrido_em: '2026-08-11T17:00:00.000Z' })),
  ['Lado', 'Início']
);
iguais(
  'amamentação com duração mostra as três',
  detalhar(
    'amamentar',
    linhaDoBanco(
      { side: 'left', duration_seconds: 720 },
      { ocorrido_em: '2026-08-11T17:00:00.000Z' }
    )
  ),
  ['Lado', 'Duração', 'Início']
);
iguais(
  'sono aberto diz "Até agora"; encerrado diz "Duração"',
  detalhar(
    'sono',
    linhaDoBanco({}, { ocorrido_em: '2026-08-11T17:00:00.000Z', terminou_em: null })
  ),
  ['Começou', 'Terminou', 'Até agora']
);
iguais(
  'e o encerrado troca só esse rótulo',
  detalhar(
    'sono',
    linhaDoBanco(
      {},
      { ocorrido_em: '2026-08-11T17:00:00.000Z', terminou_em: '2026-08-11T17:40:00.000Z' }
    )
  ),
  ['Começou', 'Terminou', 'Duração']
);
checar(
  'no detalhe o sintoma "Outro" mostra o rótulo, não a descrição',
  LEITURA.sintoma
    .detalhar(
      linhaDoBanco(
        { symptom: 'other' },
        { notes: 'pele fria', ocorrido_em: '2026-08-11T17:00:00.000Z' }
      ),
      AGORA
    )
    .some((c) => c.rotulo === 'Sintoma' && c.valor === 'Outro'),
  'a descrição aparece inteira no campo de observação, logo abaixo'
);
checar(
  'humor com "Não sei" mostra "não identificado" no detalhe',
  LEITURA.humor
    .detalhar(
      linhaDoBanco(
        { mood: 'crying', probable_reason: 'unknown' },
        { ocorrido_em: '2026-08-11T17:00:00.000Z' }
      ),
      AGORA
    )
    .some((c) => c.rotulo === 'Motivo provável' && c.valor === 'não identificado')
);

console.log('\n— e o acessor lê o jsonb, não o topo da linha —\n');

/**
 * O controle que torna os fixtures acima honestos.
 *
 * Se a LEITURA voltasse a ler campo do topo da linha, todos eles continuariam
 * passando — o acessor cai para o topo quando não acha no `dados`. Aqui os dois
 * lugares discordam DE PROPÓSITO, e a asserção diz qual tem que ganhar.
 */
checar(
  'com o campo nos dois lugares, quem manda é o dados',
  resumir('fralda', { dados: { content: 'poop' }, content: 'pee' }) === 'Cocô',
  'se um dia isto virar "Xixi", os fixtures acima pararam de provar a forma real'
);


console.log('\n— editar: abrir e salvar sem tocar em nada não pode mudar a linha —\n');

/**
 * A propriedade que separa "editar" de "reescrever com o que o formulário achou
 * que entendeu". Se o ida-e-volta perde alguma coisa, ela se perde no dia em que
 * a mãe abre um registro para corrigir um minuto e sai sem os outros campos.
 */
const EXEMPLOS: [TipoRegistro, ValoresRegistro][] = [
  ['amamentar', { hora: HORA_OK, lado: 'both', duracao: '21', observacao: 'sonolenta' }],
  ['amamentar', { hora: HORA_OK, lado: 'left' }],
  ['mamadeira', { hora: HORA_OK, quantidade: '90', leite: 'breast_milk' }],
  ['fralda', { hora: HORA_OK, conteudo: 'poop', observacao: 'bem líquido' }],
  ['humor', { hora: HORA_OK, humor: 'sleepy', motivo: 'holding' }],
  ['humor', { hora: HORA_OK, humor: 'calm' }],
  ['sintoma', { hora: HORA_OK, sintoma: SINTOMA_OUTRO, observacao: 'pele fria' }],
  ['sintoma', { hora: HORA_OK, sintoma: 'cough', intensidade: 'mild' }],
  ['sono', { hora: HORA_OK }],
];

for (const [tipo, valores] of EXEMPLOS) {
  const linha = linhaParaBanco(tipo, valores, MOMENTO);
  const devolta = valoresDaLinha(tipo, linha, HORA_OK);
  const outraVez = linhaParaBanco(tipo, devolta, MOMENTO);
  iguais(`${tipo}: linha → formulário → linha, sem perder nada`, outraVez, linha);
}

checar(
  'número volta na unidade do campo, não na do banco',
  valoresDaLinha('amamentar', linhaDoBanco({ side: 'left', duration_seconds: 720 }), HORA_OK)
    .duracao === '12',
  'o campo pergunta minutos; o dados guarda segundos'
);
checar(
  'chave AUSENTE no dados vira null no formulário, nunca "null" nem string vazia',
  valoresDaLinha('humor', linhaDoBanco({ mood: 'calm' }), HORA_OK).motivo === null,
  'ausente é como as 97 linhas migradas dizem "não informado"'
);
checar(
  'e chave presente e nula chega ao mesmo lugar',
  valoresDaLinha('humor', linhaDoBanco({ mood: 'calm', probable_reason: null }), HORA_OK)
    .motivo === null,
  'registro antigo não some do formulário por causa da forma que o backfill não usou'
);
checar(
  'a hora vem de fora, do instante do registro',
  valoresDaLinha('fralda', linhaDoBanco({ content: 'pee' }), '05:40').hora === '05:40'
);

console.log('\n— o campo decimal, que o crescimento vai usar —\n');

/**
 * Nenhum tipo declara `decimais` ainda — Peso, Altura e Circunferência chegam no
 * bloco 3. Os campos aqui são sintéticos de propósito: a máquina do decimal
 * precisa estar provada ANTES de o primeiro tipo depender dela, senão o teste
 * dela nasce junto com o bug dela.
 */
const ALTURA: CampoSchema = {
  entrada: 'numero',
  chave: 'altura',
  coluna: 'altura_mm',
  rotulo: 'Altura (cm)',
  obrigatorio: true,
  min: 20,
  max: 120,
  // cm na tela, milímetro na coluna: inteiro, indexável e checável.
  escala: 10,
  decimais: 1,
  digitos: 3,
  placeholder: 'ex.: 52,5',
  erroFaixa: 'Altura em cm, de 20 a 120.',
};

const PESO: CampoSchema = {
  ...ALTURA,
  chave: 'peso',
  coluna: 'peso_g',
  rotulo: 'Peso (kg)',
  min: 0.5,
  max: 30,
  // kg na tela, grama na coluna.
  escala: 1000,
  decimais: 3,
  digitos: 2,
  placeholder: 'ex.: 4,350',
  erroFaixa: 'Peso em kg, de 0,5 a 30.',
} as CampoSchema;

const campoNumero = (c: CampoSchema) => c as Extract<CampoSchema, { entrada: 'numero' }>;

checar('a vírgula é lida', numeroDoCampo('52,5', campoNumero(ALTURA)) === 52.5);
checar(
  'e o ponto também, porque o teclado em inglês oferece ponto',
  numeroDoCampo('52.5', campoNumero(ALTURA)) === 52.5
);
checar('texto que não é número devolve null', numeroDoCampo('ab', campoNumero(ALTURA)) === null);
checar('vazio devolve null, não zero', numeroDoCampo('', campoNumero(ALTURA)) === null);
checar(
  'e nada de exceção: função de schema que joga vira tela vermelha às 3h',
  numeroDoCampo('52,,5', campoNumero(ALTURA)) === null
);

/**
 * A ASSERÇÃO QUE CARREGA O PESO desta seção.
 *
 * `1.005 * 1000` em ponto flutuante dá `1004.9999999999999`. Sem arredondar,
 * esse número entra no `dados`, e a coluna gerada faz `(dados->>'peso_g')::int`
 * — que recusa com erro de cast, a mensagem mais feia que este banco sabe
 * produzir, num caminho que a mãe alcança digitando um peso normal.
 *
 * O valor não é escolhido a esmo: varrendo a faixa do campo, **360 pesos em
 * grama entre 0,5 kg e 30 kg** produzem esse erro. Não é um caso de borda
 * exótico, é 1 em 80 — e 1,005 kg é peso de prematuro, exatamente a mãe que mais
 * pesa o bebê.
 *
 * O laço abaixo é o controle, e ele é o que torna a asserção honesta: sem
 * mostrar que a multiplicação crua REALMENTE erra, a asserção passaria também
 * num mundo onde o problema não existe, e ninguém saberia por que o `Math.round`
 * está ali. O primeiro valor que eu tinha escolhido à mão (`4,35`) multiplica
 * exato — o teste teria "provado" um problema inexistente.
 */
const quebramNaMultiplicacao: number[] = [];
for (let g = 500; g <= 30_000; g++) {
  if (!Number.isInteger((g / 1000) * 1000)) quebramNaMultiplicacao.push(g);
}

checar(
  'kg com três casas vira grama inteiro',
  paraAColuna(1.005, campoNumero(PESO)) === 1005,
  `${paraAColuna(1.005, campoNumero(PESO))}`
);
checar(
  'e o controle: a multiplicação crua erra em pesos reais',
  quebramNaMultiplicacao.length > 0 && !Number.isInteger(1.005 * 1000),
  `${quebramNaMultiplicacao.length} pesos entre 0,5 e 30 kg erram — ` +
    `1,005 vira ${1.005 * 1000}, e é isso que iria para o jsonb`
);
checar(
  'e nenhum deles sobrevive ao paraAColuna',
  quebramNaMultiplicacao.every((g) => paraAColuna(g / 1000, campoNumero(PESO)) === g),
  'a varredura inteira, não uma amostra'
);
checar(
  'campo inteiro não muda de comportamento',
  paraAColuna(12, campoNumero(SCHEMAS.amamentar.campos[2])) === 720,
  '12 minutos continuam sendo 720 segundos'
);

checar('milímetro volta como cm com vírgula', textoDoCampo(525, campoNumero(ALTURA)) === '52,5');
checar('grama volta como kg', textoDoCampo(4350, campoNumero(PESO)) === '4,350');
checar(
  'campo sem decimais volta inteiro, como antes',
  textoDoCampo(720, campoNumero(SCHEMAS.amamentar.campos[2])) === '12'
);

console.log('\n— e a máscara aceita exatamente o que a validação aprova —\n');

checar('a máscara deixa digitar a vírgula', mascaraNumero('52,5', campoNumero(ALTURA)) === '52,5');
checar('o ponto vira vírgula na hora', mascaraNumero('52.5', campoNumero(ALTURA)) === '52,5');
checar(
  'a segunda vírgula não trava o campo — o corte por casas continua valendo',
  mascaraNumero('52,5,7', campoNumero(ALTURA)) === '52,5',
  'o que veio depois da primeira vírgula é decimal, e o campo tem uma casa'
);
checar(
  'as casas decimais são cortadas no limite do campo',
  mascaraNumero('52,567', campoNumero(ALTURA)) === '52,5'
);
checar('letra não entra', mascaraNumero('52a,5', campoNumero(ALTURA)) === '52,5');
checar(
  'campo sem decimais continua recusando a vírgula',
  mascaraNumero('12,5', campoNumero(SCHEMAS.amamentar.campos[2])) === '125'
);

/**
 * O par que evita o pior estado possível de um formulário: a máscara deixa
 * escrever e a validação reprova. A mãe vê o campo aceitar o que ela digitou e
 * ser recusado por isso, sem entender qual das duas coisas está errada.
 */
const comAltura: Record<string, CampoSchema[]> = { fake: [ALTURA] };
void comAltura;
checar(
  'o que a máscara produz, a leitura entende',
  numeroDoCampo(mascaraNumero('52,567', campoNumero(ALTURA)), campoNumero(ALTURA)) === 52.5
);
checar(
  'e o ida-e-volta do decimal fecha',
  textoDoCampo(paraAColuna(52.5, campoNumero(ALTURA)), campoNumero(ALTURA)) === '52,5'
);

console.log('\n— e o horário editado fica no dia do registro —\n');

/**
 * O teste que existe por causa de um perigo, não de um requisito: reusar
 * `horaParaData` na edição teleportaria para hoje qualquer registro antigo que
 * a mãe abrisse para corrigir.
 */
const DIA_ANTIGO = new Date(2026, 7, 9, 23, 19); // 09/08/2026, 23:19 local
const AGORA_LOCAL = new Date(2026, 7, 11, 18, 0);

const editada = horaNoDia('23:45', DIA_ANTIGO);
checar(
  'editar 23:19 para 23:45 mantém o dia 9',
  editada !== null &&
    editada.getDate() === 9 &&
    editada.getMonth() === 7 &&
    editada.getHours() === 23 &&
    editada.getMinutes() === 45,
  editada ? editada.toString() : 'null'
);

const noDiaCedo = horaNoDia('06:00', DIA_ANTIGO);
checar(
  'e horário anterior ao original também fica no dia 9 — sem rolar pra trás',
  noDiaCedo !== null && noDiaCedo.getDate() === 9 && noDiaCedo.getHours() === 6
);

checar(
  'formato inválido continua reprovando',
  horaNoDia('25:00', DIA_ANTIGO) === null && horaNoDia('7:00', DIA_ANTIGO) === null
);

// O controle: sem ele, as asserções acima passariam com as duas funções iguais.
const comoSeFosseCriar = horaParaData('23:45', AGORA_LOCAL);
checar(
  'a função de CRIAR ancora em hoje — é por isso que a edição não pode usá-la',
  comoSeFosseCriar !== null && comoSeFosseCriar.getDate() === 10,
  // 23:45 ainda não chegou às 18h, então CRIAR lê como ontem (dia 10) — e o
  // registro editado é do dia 9. Dois dias diferentes para a mesma string: é
  // exatamente a distância que a edição teria destruído.
  comoSeFosseCriar ? `criando daria dia ${comoSeFosseCriar.getDate()}, editando dá 9` : 'null'
);

console.log('\n— a prova de que este teste sabe reprovar —\n');

// Sem isto, tudo acima passaria com uma validação que nunca reprova e uma
// montagem que devolve o objeto vazio.
const validacaoCega = () => ({});
iguais(
  'uma validação que nunca reprova seria pega',
  validacaoCega() as Record<string, string>,
  {}
);
checar(
  'e a asserção do formulário em branco é quem pega',
  Object.keys(validar('mamadeira', VAZIO)).length === 3,
  'mamadeira em branco tem que acusar hora, quantidade e leite'
);
checar(
  'uma montagem sem escala seria pega pela duração',
  ((
    linhaParaBanco('amamentar', { hora: HORA_OK, lado: 'left', duracao: '12' }, MOMENTO)
      .dados as Record<string, unknown>
  ).duration_seconds as number) !== 12,
  '12 minutos não podem virar 12 segundos'
);

console.log(
  falhas === 0
    ? '\nSchema de registro: as frases, as colunas e o vocabulário intactos.\n'
    : `\n${falhas} falha(s).\n`
);
process.exit(falhas === 0 ? 0 : 1);

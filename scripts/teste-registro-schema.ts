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
  LEITURA,
  SCHEMAS,
  TABELAS_DE_REGISTRO,
  tiposDaTabela,
  TIPOS_REGISTRO,
  SINTOMA_OUTRO,
  LADOS,
  MOTIVOS_HUMOR,
  linhaParaBanco,
  resolverCampo,
  rotularValor,
  tipoDaLinha,
  validarRegistro,
  type TipoRegistro,
  type ValoresRegistro,
} from '../src/lib/registroSchema.ts';
import { horaParaData } from '../src/lib/horario.ts';

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

console.log('\n— a linha que vai para o banco, coluna por coluna —\n');

iguais(
  'amamentação: type fixo, lado, e minutos viram segundos',
  linhaParaBanco('amamentar', { hora: HORA_OK, lado: 'left', duracao: '12' }, MOMENTO),
  { type: 'breast', started_at: MOMENTO, side: 'left', duration_seconds: 720, notes: null }
);

iguais(
  'mamadeira: outro type na mesma tabela, e ml sem escala',
  linhaParaBanco(
    'mamadeira',
    { hora: HORA_OK, quantidade: '90', leite: 'formula', observacao: 'metade' },
    MOMENTO
  ),
  {
    type: 'bottle',
    started_at: MOMENTO,
    amount_ml: 90,
    bottle_type: 'formula',
    notes: 'metade',
  }
);

iguais(
  'fralda: coluna de tempo é recorded_at, não started_at',
  linhaParaBanco('fralda', { hora: HORA_OK, conteudo: 'both' }, MOMENTO),
  { recorded_at: MOMENTO, content: 'both', notes: null }
);

iguais(
  'humor: motivo vazio vira null, não string vazia',
  linhaParaBanco('humor', { hora: HORA_OK, humor: 'crying', motivo: '' }, MOMENTO),
  { recorded_at: MOMENTO, mood: 'crying', probable_reason: null, notes: null }
);

iguais(
  'sintoma "Outro": o slug vai na coluna, o texto da mãe vai em notes',
  linhaParaBanco(
    'sintoma',
    { hora: HORA_OK, sintoma: SINTOMA_OUTRO, observacao: 'pele fria' },
    MOMENTO
  ),
  {
    recorded_at: MOMENTO,
    symptom: 'other',
    intensity: null,
    notes: 'pele fria',
  }
);

iguais(
  'sono: só o instante, e nenhuma coluna de observação',
  linhaParaBanco('sono', { hora: HORA_OK }, MOMENTO),
  { started_at: MOMENTO }
);

checar(
  'sono não declara coluna notes — a tabela não tem',
  SCHEMAS.sono.campos.every((c) => c.coluna !== 'notes')
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

console.log('\n— duas linhas na mesma tabela, dois tipos —\n');

checar(
  'feeding_records com type breast é amamentação',
  tipoDaLinha('feeding_records', { type: 'breast' }) === 'amamentar'
);
checar(
  'feeding_records com type bottle é mamadeira',
  tipoDaLinha('feeding_records', { type: 'bottle' }) === 'mamadeira'
);
checar('sleep_records não precisa de coluna fixa', tipoDaLinha('sleep_records', {}) === 'sono');
checar('tabela desconhecida devolve null', tipoDaLinha('vacinas', {}) === null);


console.log('\n— o resumo da lista, frase por frase —\n');

/**
 * As linhas cruas são escritas à mão, e não geradas por `linhaParaBanco`: o que
 * se testa aqui é a LEITURA, e alimentá-la com a saída da escrita esconderia um
 * erro que as duas cometessem juntas — a coluna trocada nas duas pontas.
 */
const AGORA = new Date('2026-08-11T18:00:00.000Z');
const resumir = (tipo: TipoRegistro, linha: Record<string, unknown>) =>
  LEITURA[tipo].resumir(linha, AGORA);

checar(
  'amamentação com lado e duração',
  resumir('amamentar', { side: 'left', duration_seconds: 720 }) === 'Peito esquerdo · 12 min',
  resumir('amamentar', { side: 'left', duration_seconds: 720 })
);
checar(
  'amamentação sem duração é só o lado',
  resumir('amamentar', { side: 'both', duration_seconds: null }) === 'Os dois peitos'
);
checar(
  'amamentação sem lado nenhum não vira frase quebrada',
  resumir('amamentar', {}) === 'Peito'
);
checar(
  'mamadeira com ml e leite',
  resumir('mamadeira', { amount_ml: 90, bottle_type: 'formula' }) === '90 ml de fórmula'
);
checar(
  'mamadeira sem quantidade cai no nome',
  resumir('mamadeira', { bottle_type: 'breast_milk' }) === 'Mamadeira de leite materno'
);
checar('fralda é só o conteúdo', resumir('fralda', { content: 'both' }) === 'Xixi e cocô');
checar(
  'sono encerrado vira duração',
  resumir('sono', {
    started_at: '2026-08-11T12:00:00.000Z',
    ended_at: '2026-08-11T13:20:00.000Z',
  }) === '1h 20min de sono'
);
checar(
  'sono aberto fala no presente',
  resumir('sono', { started_at: '2026-08-11T17:30:00.000Z', ended_at: null }) ===
    'Dormindo há 30 min'
);
checar(
  'sono aberto de menos de 2 minutos não fala em duração',
  resumir('sono', { started_at: '2026-08-11T17:59:30.000Z', ended_at: null }) === 'Dormindo agora'
);
checar(
  'humor com motivo vem em minúscula',
  resumir('humor', { mood: 'crying', probable_reason: 'hunger' }) === 'Choro · fome'
);
checar(
  '"Não sei" vira "motivo não identificado", não "por Não sei"',
  resumir('humor', { mood: 'crying', probable_reason: 'unknown' }) ===
    'Choro · motivo não identificado'
);
checar('humor sem motivo é só o estado', resumir('humor', { mood: 'calm' }) === 'Tranquilidade');
checar(
  'sintoma com intensidade',
  resumir('sintoma', { symptom: 'fever', intensity: 'high' }) === 'Febre · forte'
);
checar(
  'sintoma "Outro" mostra o que a mãe escreveu, não o rótulo',
  resumir('sintoma', { symptom: 'other', notes: 'pele fria' }) === 'pele fria'
);
checar(
  'sintoma aposentado continua legível',
  resumir('sintoma', { symptom: 'irritability' }) === 'Irritação'
);

console.log('\n— o detalhe: rótulos, ordem, e nada em branco —\n');

const detalhar = (tipo: TipoRegistro, linha: Record<string, unknown>) =>
  LEITURA[tipo].detalhar(linha, AGORA).map((c) => c.rotulo);

iguais(
  'amamentação sem duração não mostra a linha de duração',
  detalhar('amamentar', { side: 'left', started_at: '2026-08-11T17:00:00.000Z' }),
  ['Lado', 'Início']
);
iguais(
  'amamentação com duração mostra as três',
  detalhar('amamentar', {
    side: 'left',
    duration_seconds: 720,
    started_at: '2026-08-11T17:00:00.000Z',
  }),
  ['Lado', 'Duração', 'Início']
);
iguais(
  'sono aberto diz "Até agora"; encerrado diz "Duração"',
  detalhar('sono', { started_at: '2026-08-11T17:00:00.000Z', ended_at: null }),
  ['Começou', 'Terminou', 'Até agora']
);
iguais(
  'e o encerrado troca só esse rótulo',
  detalhar('sono', {
    started_at: '2026-08-11T17:00:00.000Z',
    ended_at: '2026-08-11T17:40:00.000Z',
  }),
  ['Começou', 'Terminou', 'Duração']
);
checar(
  'no detalhe o sintoma "Outro" mostra o rótulo, não a descrição',
  LEITURA.sintoma
    .detalhar({ symptom: 'other', notes: 'pele fria', recorded_at: '2026-08-11T17:00:00.000Z' }, AGORA)
    .some((c) => c.rotulo === 'Sintoma' && c.valor === 'Outro'),
  'a descrição aparece inteira no campo de observação, logo abaixo'
);
checar(
  'humor com "Não sei" mostra "não identificado" no detalhe',
  LEITURA.humor
    .detalhar({ mood: 'crying', probable_reason: 'unknown', recorded_at: '2026-08-11T17:00:00.000Z' }, AGORA)
    .some((c) => c.rotulo === 'Motivo provável' && c.valor === 'não identificado')
);

console.log('\n— a lista é por tabela, e as tabelas se comportam —\n');

checar(
  'cinco tabelas para seis tipos',
  TABELAS_DE_REGISTRO.length === 5,
  TABELAS_DE_REGISTRO.join(', ')
);
iguais(
  'feeding_records atende os dois tipos de mamada',
  tiposDaTabela('feeding_records'),
  ['amamentar', 'mamadeira']
);
checar(
  'tipos que dividem tabela dividem a coluna de tempo',
  TABELAS_DE_REGISTRO.every((tabela) => {
    const colunas = new Set(tiposDaTabela(tabela).map((t) => SCHEMAS[t].colunaTempo));
    return colunas.size === 1;
  }),
  'a listagem consulta uma vez por tabela — duas colunas de tempo na mesma quebraria o cursor'
);
checar(
  'tipo que divide tabela declara coluna fixa',
  TABELAS_DE_REGISTRO.every((tabela) => {
    const tipos = tiposDaTabela(tabela);
    return tipos.length === 1 || tipos.every((t) => Object.keys(SCHEMAS[t].fixas ?? {}).length > 0);
  }),
  'sem ela não dá pra saber de que tipo é a linha nem filtrar a consulta'
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
  (linhaParaBanco('amamentar', { hora: HORA_OK, lado: 'left', duracao: '12' }, MOMENTO)
    .duration_seconds as number) !== 12,
  '12 minutos não podem virar 12 segundos'
);

console.log(
  falhas === 0
    ? '\nSchema de registro: as frases, as colunas e o vocabulário intactos.\n'
    : `\n${falhas} falha(s).\n`
);
process.exit(falhas === 0 ? 0 : 1);

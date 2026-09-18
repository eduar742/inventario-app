/**
 * Testes da checagem de duplicidade entre operadores (POST /contagens).
 *
 * Com varios operadores contando a mesma sessao ao mesmo tempo, o backend
 * recusa (409) quando um operador bipa um SKU que OUTRO ja contou nesta
 * rodada, a menos que confirmarDuplicidadeOperador seja enviado — evita que
 * dois operadores dupliquem a mesma pilha de material sem perceber, mas
 * ainda permite a soma legitima de multi-localizacao apos confirmacao.
 */

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const SESSAO_ID = 'sess-0001-uuid';

function buildFetchMock(status, body, asJson = true) {
  const text = asJson ? JSON.stringify(body) : body;
  return jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(text),
      headers: { get: () => null },
    })
  );
}

function carregarApiComMock(fetchMock) {
  jest.resetModules();
  global.fetch = fetchMock;
  return require('../services/api');
}

describe('registrarContagem — confirmarDuplicidadeOperador', () => {
  afterEach(() => jest.clearAllMocks());

  it('envia confirmar_duplicidade_operador=false por padrao', async () => {
    const fetchMock = buildFetchMock(201, { contagem: { id: 'c1' }, mensagem: 'ok' });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await registrarContagem({ sessaoId: SESSAO_ID, codigoQr: 'QR-001', quantidadeContada: 10 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.confirmar_duplicidade_operador).toBe(false);
  });

  it('envia confirmar_duplicidade_operador=true quando informado', async () => {
    const fetchMock = buildFetchMock(201, { contagem: { id: 'c1' }, mensagem: 'ok' });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await registrarContagem({
      sessaoId: SESSAO_ID, codigoQr: 'QR-001', quantidadeContada: 10,
      confirmarDuplicidadeOperador: true,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.confirmar_duplicidade_operador).toBe(true);
  });

  it('erro 409 de duplicidade carrega status e o detail estruturado em err.dados', async () => {
    const detail = {
      tipo: 'duplicidade_operador',
      mensagem: 'Ana Silva ja contou este produto nesta rodada (50 un). Confirme apenas se for um local diferente.',
      quantidade_ja_contada: 50.0,
      operadores_ja_contaram: ['Ana Silva'],
    };
    const fetchMock = buildFetchMock(409, { detail });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    let erroCapturado;
    try {
      await registrarContagem({ sessaoId: SESSAO_ID, codigoQr: 'QR-001', quantidadeContada: 30 });
    } catch (err) {
      erroCapturado = err;
    }

    expect(erroCapturado.status).toBe(409);
    expect(erroCapturado.dados.detail.tipo).toBe('duplicidade_operador');
    expect(erroCapturado.dados.detail.operadores_ja_contaram).toEqual(['Ana Silva']);
  });
});

// ─── logica pura de bloqueio do botao — espelha o `desabilitado` da ────────
// ContagemScreen (mesmo estilo de resumo.logica.test.js / presenca.test.js)

function botaoDesabilitado({ enviando, quantidade, localizacaoObrigatoria, locDigitada, dupOperador, dupConfirmada }) {
  return Boolean(
    enviando || !quantidade || (localizacaoObrigatoria && !locDigitada) ||
    (dupOperador && !dupConfirmada)
  );
}

describe('botaoDesabilitado (logica extraida da ContagemScreen)', () => {
  it('fica desabilitado quando ha alerta de duplicidade nao confirmado', () => {
    expect(botaoDesabilitado({
      enviando: false, quantidade: '10', localizacaoObrigatoria: false, locDigitada: '',
      dupOperador: { tipo: 'duplicidade_operador' }, dupConfirmada: false,
    })).toBe(true);
  });

  it('reabilita apos confirmar a duplicidade', () => {
    expect(botaoDesabilitado({
      enviando: false, quantidade: '10', localizacaoObrigatoria: false, locDigitada: '',
      dupOperador: { tipo: 'duplicidade_operador' }, dupConfirmada: true,
    })).toBe(false);
  });

  it('sem alerta de duplicidade, comportamento normal (habilitado com quantidade)', () => {
    expect(botaoDesabilitado({
      enviando: false, quantidade: '10', localizacaoObrigatoria: false, locDigitada: '',
      dupOperador: null, dupConfirmada: false,
    })).toBe(false);
  });
});

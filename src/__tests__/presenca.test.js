/**
 * Testes das funcoes de presenca na sessao e liberacao da 2a contagem
 * (services/api.js) — usadas para travar o inicio da recontagem ate que
 * todos os operadores tenham saido da sessao e o Lider/Gestor libere.
 *
 * Mesma estrategia de fluxo.inventario.test.js / api.chamarAPI.test.js:
 * jest.resetModules() + require() pra garantir que _fetch aponte pro mock.
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

describe('presenca na sessao', () => {
  afterEach(() => jest.clearAllMocks());

  it('entrarSessao faz POST em /presenca/entrar', async () => {
    const fetchMock = buildFetchMock(200, { presente: true, entrou_em: '2026-09-18T10:00:00' });
    const { entrarSessao } = carregarApiComMock(fetchMock);

    const resultado = await entrarSessao(SESSAO_ID);

    expect(resultado.presente).toBe(true);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/presenca/entrar`);
    expect(opcoes.method).toBe('POST');
  });

  it('heartbeatSessao faz POST em /presenca/heartbeat', async () => {
    const fetchMock = buildFetchMock(200, { presente: true, ultimo_heartbeat: '2026-09-18T10:01:00' });
    const { heartbeatSessao } = carregarApiComMock(fetchMock);

    await heartbeatSessao(SESSAO_ID);

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/presenca/heartbeat`);
    expect(opcoes.method).toBe('POST');
  });

  it('sairSessao faz POST em /presenca/sair', async () => {
    const fetchMock = buildFetchMock(200, { presente: false });
    const { sairSessao } = carregarApiComMock(fetchMock);

    const resultado = await sairSessao(SESSAO_ID);

    expect(resultado.presente).toBe(false);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/presenca/sair`);
    expect(opcoes.method).toBe('POST');
  });

  it('listarPresencaAtiva faz GET em /presenca', async () => {
    const fetchMock = buildFetchMock(200, {
      ativos: [{ usuario_id: 'op-1', nome: 'Operador 1', entrou_em: '2026-09-18T10:00:00' }],
      total_ativos: 1,
    });
    const { listarPresencaAtiva } = carregarApiComMock(fetchMock);

    const resultado = await listarPresencaAtiva(SESSAO_ID);

    expect(resultado.total_ativos).toBe(1);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/presenca`);
    expect(opcoes.method || 'GET').toBe('GET');
  });

  it('liberarRecontagem faz POST em /liberar-recontagem e retorna a sessao atualizada', async () => {
    const fetchMock = buildFetchMock(200, {
      id: SESSAO_ID, status: 'em_andamento',
      recontagem_liberada: true, operadores_ativos: 0,
    });
    const { liberarRecontagem } = carregarApiComMock(fetchMock);

    const resultado = await liberarRecontagem(SESSAO_ID);

    expect(resultado.recontagem_liberada).toBe(true);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/liberar-recontagem`);
    expect(opcoes.method).toBe('POST');
  });

  it('liberarRecontagem propaga erro 409 quando ha operador ainda ativo', async () => {
    const fetchMock = buildFetchMock(409, { detail: 'Ainda ha operador(es) com a sessao aberta: Operador 1.' });
    const { liberarRecontagem } = carregarApiComMock(fetchMock);

    await expect(liberarRecontagem(SESSAO_ID)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('Operador 1'),
    });
  });

  it('liberarRecontagem propaga erro 403 quando quem chama nao e lider/gestor', async () => {
    const fetchMock = buildFetchMock(403, { detail: 'Apenas Lider ou Gestor podem liberar a 2a contagem' });
    const { liberarRecontagem } = carregarApiComMock(fetchMock);

    await expect(liberarRecontagem(SESSAO_ID)).rejects.toMatchObject({ status: 403 });
  });

  it('registrarContagem com rodada=2 propaga erro 400 quando a sessao ainda nao foi liberada', async () => {
    const fetchMock = buildFetchMock(400, {
      detail: 'A 2a contagem (recontagem) ainda nao foi liberada para esta sessao. Aguarde o Lider ou Gestor liberar apos todos os operadores saírem.',
    });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await expect(
      registrarContagem({ sessaoId: SESSAO_ID, codigoQr: 'QR-001', quantidadeContada: 10, rodada: 2 })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('liberada') });
  });
});

// ─── logica pura de gating — espelha o bloco "Aguardando 2a contagem" de ────
// ResumoScreen.js / PendentesOperadorScreen.js (mesmo estilo de
// resumo.logica.test.js: replica a logica isolada pra testar sem renderizar)

function statusBotaoRecontagem({ recontagemLiberada, papel, operadoresAtivos }) {
  if (recontagemLiberada) return 'iniciar';
  if (papel === 'lider' || papel === 'gestor') {
    return operadoresAtivos > 0 ? 'aguardando_liberar_desabilitado' : 'pronto_para_liberar';
  }
  return 'aguardando_outro_liberar';
}

describe('statusBotaoRecontagem (logica de gating extraida das telas)', () => {
  it('mostra "iniciar" para qualquer papel quando ja liberada', () => {
    expect(statusBotaoRecontagem({ recontagemLiberada: true, papel: 'operador', operadoresAtivos: 3 }))
      .toBe('iniciar');
  });

  it('lider com operadores ainda ativos ve o botao de liberar desabilitado', () => {
    expect(statusBotaoRecontagem({ recontagemLiberada: false, papel: 'lider', operadoresAtivos: 2 }))
      .toBe('aguardando_liberar_desabilitado');
  });

  it('gestor sem operadores ativos pode liberar', () => {
    expect(statusBotaoRecontagem({ recontagemLiberada: false, papel: 'gestor', operadoresAtivos: 0 }))
      .toBe('pronto_para_liberar');
  });

  it('operador comum nunca ve o botao de liberar, so a mensagem de espera', () => {
    expect(statusBotaoRecontagem({ recontagemLiberada: false, papel: 'operador', operadoresAtivos: 0 }))
      .toBe('aguardando_outro_liberar');
  });

  it('admin tambem so ve a mensagem de espera (decisao explicita: fora da liberacao)', () => {
    expect(statusBotaoRecontagem({ recontagemLiberada: false, papel: 'admin', operadoresAtivos: 0 }))
      .toBe('aguardando_outro_liberar');
  });
});

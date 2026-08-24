/**
 * Testes unitarios de chamarAPI — o wrapper central de HTTP do app.
 *
 * Estrategia: cada teste usa jest.resetModules() + require() para
 * garantir que _fetch (capturado no nivel de modulo) aponte para o mock
 * correto, e nao para o fetch nativo de Node.
 *
 * Cenarios cobertos:
 *  1. Resposta JSON valida (caminho feliz)
 *  2. Resposta nao-JSON 503 — cold start Render.com
 *  3. Resposta nao-JSON 500 — cold start tipico
 *  4. Erro de negocio 400 com detail string
 *  5. Erro 422 com detail array (Pydantic)
 *  6. Erro de rede "Network request failed"
 *  7. Erro de rede "Failed to fetch" (browser)
 *  8. 401 sem refresh token — nao causa loop
 *  9. Header Authorization adicionado quando token existe
 * 10. registrarContagem mapeia camelCase → snake_case
 * 11. registrarContagem com campos opcionais ausentes
 * 12. registrarContagem nao faz retry em erro 400
 */

// ─── MOCKS DE MODULOS NATIVOS (declarados antes de qualquer require) ─────────

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

// ─── HELPERS ────────────────────────────────────────────────────────────────

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

/** Retorna uma instancia fresca de api.js com fetch ja mockado */
function carregarApiComMock(fetchMock) {
  jest.resetModules();
  global.fetch = fetchMock;
  return require('../services/api');
}

// ─── chamarAPI ───────────────────────────────────────────────────────────────

describe('chamarAPI', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 1. Caminho feliz
  it('retorna dados JSON quando resposta e valida', async () => {
    const { chamarAPI } = carregarApiComMock(
      buildFetchMock(200, { id: 'abc', nome: 'Produto X' })
    );
    const resultado = await chamarAPI('/api/v1/produtos/abc');
    expect(resultado).toEqual({ id: 'abc', nome: 'Produto X' });
  });

  // 2. Cold start — HTML em 503
  it('lanca "resposta inesperada" quando servidor retorna HTML em 503', async () => {
    const { chamarAPI } = carregarApiComMock(
      buildFetchMock(503, '<html><body>Service Unavailable</body></html>', false)
    );
    await expect(chamarAPI('/api/v1/contagens')).rejects.toMatchObject({
      message: expect.stringContaining('resposta inesperada'),
      status: 503,
    });
  });

  // 3. Cold start — HTML em 500
  it('lanca "resposta inesperada" quando servidor retorna HTML em 500', async () => {
    const { chamarAPI } = carregarApiComMock(
      buildFetchMock(500, '<!DOCTYPE html><html><body>Internal Error</body></html>', false)
    );
    await expect(chamarAPI('/api/v1/contagens')).rejects.toMatchObject({
      message: expect.stringContaining('resposta inesperada'),
      status: 500,
    });
  });

  // 4. Erro de negocio 400 com detail string
  it('lanca mensagem do detail quando API retorna 400 com string', async () => {
    const { chamarAPI } = carregarApiComMock(
      buildFetchMock(400, { detail: 'Este produto ja foi contado 3 vezes.' })
    );
    await expect(chamarAPI('/api/v1/contagens')).rejects.toMatchObject({
      message: 'Este produto ja foi contado 3 vezes.',
      status: 400,
    });
  });

  // 5. Erro de validacao 422 com detail array (Pydantic)
  it('concatena mensagens quando detail e array de erros Pydantic', async () => {
    const { chamarAPI } = carregarApiComMock(
      buildFetchMock(422, {
        detail: [
          { msg: 'Field required', loc: ['body', 'sessao_id'] },
          { msg: 'Field required', loc: ['body', 'codigo_qr'] },
        ],
      })
    );
    const err = await chamarAPI('/api/v1/contagens').catch(e => e);
    expect(err.message).toContain('Field required');
    expect(err.status).toBe(422);
  });

  // 6. Sem internet — React Native
  it('lanca "Sem conexao" quando fetch joga Network request failed', async () => {
    jest.resetModules();
    global.fetch = jest.fn(() => Promise.reject(new Error('Network request failed')));
    const { chamarAPI } = require('../services/api');
    await expect(chamarAPI('/api/v1/lojas')).rejects.toMatchObject({
      message: expect.stringContaining('Sem conexao'),
      status: 0,
    });
  });

  // 7. Sem internet — browser
  it('lanca "Sem conexao" quando fetch joga Failed to fetch', async () => {
    jest.resetModules();
    global.fetch = jest.fn(() => Promise.reject(new Error('Failed to fetch')));
    const { chamarAPI } = require('../services/api');
    await expect(chamarAPI('/api/v1/lojas')).rejects.toMatchObject({
      message: expect.stringContaining('Sem conexao'),
    });
  });

  // 8. 401 sem refresh token — nao deve causar loop infinito
  it('nao causa loop infinito ao receber 401 sem refresh token', async () => {
    const fetchMock = buildFetchMock(401, { detail: 'Token invalido ou expirado' });
    const { chamarAPI } = carregarApiComMock(fetchMock);
    const err = await chamarAPI('/api/v1/sessoes').catch(e => e);
    expect(err).toBeTruthy();
    // Sem refresh token disponivel, deve fazer apenas 1 chamada
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // 9. Header Authorization
  it('inclui header Authorization quando token esta armazenado', async () => {
    jest.resetModules();
    const fetchMock = buildFetchMock(200, { ok: true });
    global.fetch = fetchMock;
    // Simula token armazenado
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'inventario_token') return Promise.resolve('meu-token-jwt');
      return Promise.resolve(null);
    });
    const { chamarAPI } = require('../services/api');

    await chamarAPI('/api/v1/sessoes');

    const [, opcoes] = fetchMock.mock.calls[0];
    expect(opcoes.headers['Authorization']).toBe('Bearer meu-token-jwt');
  });
});

// ─── registrarContagem ───────────────────────────────────────────────────────

describe('registrarContagem', () => {
  // 10. Mapeamento camelCase → snake_case
  it('mapeia parametros camelCase para snake_case no body', async () => {
    const fetchMock = buildFetchMock(200, { contagem: { numero_contagem: 1 }, status_produto: 'ok' });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await registrarContagem({
      sessaoId: 'sessao-123',
      codigoQr: 'QR-PROD001',
      quantidadeContada: 42,
      localizacao: 'Prateleira A',
      confirmarLocalizacao: true,
      observacoes: 'Caixa aberta',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      sessao_id: 'sessao-123',
      codigo_qr: 'QR-PROD001',
      quantidade_contada: 42,
      localizacao: 'Prateleira A',
      confirmar_localizacao: true,
      observacoes: 'Caixa aberta',
    });
  });

  // 11. Campos opcionais ausentes → null / false
  it('envia localizacao e confirmarLocalizacao como null/false quando ausentes', async () => {
    const fetchMock = buildFetchMock(200, { contagem: { numero_contagem: 1 }, status_produto: 'ok' });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await registrarContagem({
      sessaoId: 'sessao-123',
      codigoQr: 'QR-PROD002',
      quantidadeContada: 10,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.localizacao).toBeNull();
    expect(body.confirmar_localizacao).toBe(false);
    expect(body.observacoes).toBeNull();
  });

  // 12. Erro 400 "ja contado 3 vezes" — sem retry
  it('lanca erro 400 imediatamente sem retry quando produto ja foi contado 3 vezes', async () => {
    const fetchMock = buildFetchMock(400, { detail: 'Este produto ja foi contado 3 vezes.' });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await expect(
      registrarContagem({ sessaoId: 'x', codigoQr: 'QR-001', quantidadeContada: 5 })
    ).rejects.toMatchObject({
      message: 'Este produto ja foi contado 3 vezes.',
      status: 400,
    });

    // DEVE ter sido chamado EXATAMENTE 1 vez — a remocao do retry era o bug original
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

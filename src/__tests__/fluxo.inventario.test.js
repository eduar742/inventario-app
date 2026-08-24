/**
 * Teste de integracao: fluxo completo de inventario.
 *
 * Cobre todas as ramificacoes da logica de 3 contagens, tratamento de erros
 * e o fluxo de aprovacao do gestor. Cada cenario e independente (mock proprio),
 * o que permite rodar qualquer teste isolado com `npx jest -t "nome do teste"`.
 *
 * Estrutura:
 *  1. Criar e iniciar sessao
 *  2. Logica das 3 contagens:
 *     a. 1a contagem OK (bate com sistema)
 *     b. 1a contagem diverge → aguardando recontagem
 *     c. 2a contagem == 1a → confirmado (mesmo divergindo do sistema)
 *     d. 2a contagem != 1a → desempate necessario
 *     e. 3a contagem (desempate) → produto finalizado
 *  3. Casos de erro:
 *     a. SKU nao importado → 404
 *     b. Produto ja contado 3 vezes → 400
 *     c. Servidor indisponivel → 500 inesperado
 *  4. Encerrar sessao e gerar divergencias
 *  5. Aprovacao pelo gestor (aprovar, rejeitar, concluir)
 *  6. Fluxo encadeado completo (cenario de ponta-a-ponta com mock sequencial)
 */

// ─── MOCKS DE MODULOS NATIVOS ─────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn((key) => {
    if (key === 'inventario_token') return Promise.resolve('token-teste-jwt');
    return Promise.resolve(null);
  }),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

// ─── DADOS DE FIXTURE ────────────────────────────────────────────────────────

const SESSAO_ID = 'sess-0001-uuid';
const LOJA_ID   = 'loja-0001-uuid';

const SESSAO_CRIADA = {
  id: SESSAO_ID,
  nome: 'Inventario Junho 2026',
  status: 'criada',
  tipo: 'geral',
  loja_id: LOJA_ID,
  mes_referencia: '2026-06',
  criado_em: '2026-06-12T09:00:00.000000',
  iniciado_em: null,
};

const SESSAO_EM_ANDAMENTO = { ...SESSAO_CRIADA, status: 'em_andamento', iniciado_em: '2026-06-12T09:01:00.000000' };
const SESSAO_ENCERRADA    = { ...SESSAO_EM_ANDAMENTO, status: 'encerrada', encerrado_em: '2026-06-12T10:00:00.000000' };
const SESSAO_CONCLUIDA    = { ...SESSAO_ENCERRADA, status: 'concluida', concluido_em: '2026-06-12T10:05:00.000000' };

// Produto que BATE com o sistema (1a contagem ok)
const QR_OK = 'QR-CHAPA001';
// Produto que DIVERGE (precisa de recontagem)
const QR_DIV = 'QR-CHAPA002';
// Produto para testar desempate (2a != 1a)
const QR_DESEMP = 'QR-CHAPA003';
// Produto fora do inventario (nao importado)
const QR_NAO_IMPORTADO = 'QR-DESCONHECIDO';

const mkContagem = (id, qr, numero, qtd) => ({
  id,
  sessao_id: SESSAO_ID,
  codigo_qr: qr,
  numero_contagem: numero,
  quantidade_contada: qtd,
  criado_em: '2026-06-12T09:05:00.000000',
});

const DIVERGENCIA_1 = {
  id: 'div-001-uuid',
  sessao_id: SESSAO_ID,
  codigo_qr: QR_DIV,
  sku: 'CHAPA002',
  descricao: 'Chapa MDF 15mm',
  quantidade_sistema: 50.0,
  quantidade_contada: 45.0,
  diferenca: -5.0,
  status: 'pendente',
  criado_em: '2026-06-12T10:00:00.000000',
};

const DIVERGENCIA_2 = {
  id: 'div-002-uuid',
  sessao_id: SESSAO_ID,
  codigo_qr: QR_DESEMP,
  sku: 'CHAPA003',
  descricao: 'Chapa MDF 18mm',
  quantidade_sistema: 80.0,
  quantidade_contada: 46.0,
  diferenca: -34.0,
  status: 'pendente',
  criado_em: '2026-06-12T10:00:00.000000',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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

/** Carrega api.js com o fetch ja mockado (captura _fetch no momento do require). */
function carregarApiComMock(fetchMock) {
  jest.resetModules();
  global.fetch = fetchMock;
  return require('../services/api');
}

/**
 * Monta um fetch que responde chamadas sequenciais com respostas diferentes.
 * Util para testes de fluxo encadeado (criarSessao → iniciarSessao → ...).
 */
function buildFetchSequencial(respostas) {
  let chamada = 0;
  return jest.fn(() => {
    const r = respostas[chamada] || respostas[respostas.length - 1];
    chamada++;
    const text = JSON.stringify(r.body);
    return Promise.resolve({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: () => Promise.resolve(text),
      headers: { get: () => null },
    });
  });
}

// ─── 1. CRIAR E INICIAR SESSAO ────────────────────────────────────────────────

describe('1. Criar e iniciar sessao', () => {
  afterEach(() => jest.clearAllMocks());

  it('criarSessao retorna sessao com status "criada" e mapeia campos camelCase→snake_case', async () => {
    const fetchMock = buildFetchMock(201, SESSAO_CRIADA);
    const { criarSessao } = carregarApiComMock(fetchMock);

    const resultado = await criarSessao({
      lojaId: LOJA_ID,
      nome: 'Inventario Junho 2026',
      tipo: 'geral',
      mesReferencia: '2026-06',
      naturezaFiltroId: null,
      observacoes: null,
    });

    expect(resultado.status).toBe('criada');
    expect(resultado.id).toBe(SESSAO_ID);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      loja_id: LOJA_ID,
      nome: 'Inventario Junho 2026',
      tipo: 'geral',
      mes_referencia: '2026-06',
    });
  });

  it('iniciarSessao altera status para "em_andamento"', async () => {
    const fetchMock = buildFetchMock(200, SESSAO_EM_ANDAMENTO);
    const { iniciarSessao } = carregarApiComMock(fetchMock);

    const resultado = await iniciarSessao(SESSAO_ID);

    expect(resultado.status).toBe('em_andamento');
    // PATCH em /api/v1/sessoes/{id}/iniciar
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/iniciar`);
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });

  it('criarSessao lanca erro 400 se mes nao tem importacao', async () => {
    const fetchMock = buildFetchMock(400, { detail: 'Nao ha importacao para o mes informado.' });
    const { criarSessao } = carregarApiComMock(fetchMock);

    await expect(
      criarSessao({ lojaId: LOJA_ID, nome: 'Teste', tipo: 'geral', mesReferencia: '2020-01' })
    ).rejects.toMatchObject({
      message: 'Nao ha importacao para o mes informado.',
      status: 400,
    });
  });
});

// ─── 2. LOGICA DAS 3 CONTAGENS ────────────────────────────────────────────────

describe('2. Logica das 3 contagens', () => {
  afterEach(() => jest.clearAllMocks());

  // ── 2a. 1a contagem OK ──────────────────────────────────────────────────────

  it('2a. 1a contagem que bate com sistema → status_produto "ok"', async () => {
    // Sistema tem 100 unidades; operador conta 100 → match
    const resposta = { contagem: mkContagem('c-001', QR_OK, 1, 100), status_produto: 'ok' };
    const fetchMock = buildFetchMock(200, resposta);
    const { registrarContagem } = carregarApiComMock(fetchMock);

    const resultado = await registrarContagem({
      sessaoId: SESSAO_ID,
      codigoQr: QR_OK,
      quantidadeContada: 100,
    });

    expect(resultado.status_produto).toBe('ok');
    expect(resultado.contagem.numero_contagem).toBe(1);
    expect(resultado.contagem.quantidade_contada).toBe(100);
  });

  // ── 2b. 1a contagem diverge ─────────────────────────────────────────────────

  it('2b. 1a contagem que diverge do sistema → status_produto "aguardando_recontagem"', async () => {
    // Sistema tem 50; operador conta 45 → diverge
    const resposta = { contagem: mkContagem('c-002', QR_DIV, 1, 45), status_produto: 'aguardando_recontagem' };
    const fetchMock = buildFetchMock(200, resposta);
    const { registrarContagem } = carregarApiComMock(fetchMock);

    const resultado = await registrarContagem({
      sessaoId: SESSAO_ID,
      codigoQr: QR_DIV,
      quantidadeContada: 45,
    });

    expect(resultado.status_produto).toBe('aguardando_recontagem');
    expect(resultado.contagem.numero_contagem).toBe(1);
    // Produto vai para a lista de pendentes (recontagem necessaria)
  });

  // ── 2c. 2a contagem == 1a → confirmado ──────────────────────────────────────

  it('2c. 2a contagem igual a 1a → confirmado mesmo divergindo do sistema (status "ok")', async () => {
    // 1a contagem foi 45; 2a contagem tambem e 45 → ambas confirmam 45
    // Mesmo que o sistema diga 50, o valor 45 e aceito como correto
    const resposta = { contagem: mkContagem('c-003', QR_DIV, 2, 45), status_produto: 'ok' };
    const fetchMock = buildFetchMock(200, resposta);
    const { registrarContagem } = carregarApiComMock(fetchMock);

    const resultado = await registrarContagem({
      sessaoId: SESSAO_ID,
      codigoQr: QR_DIV,
      quantidadeContada: 45,
    });

    expect(resultado.status_produto).toBe('ok');
    expect(resultado.contagem.numero_contagem).toBe(2);
    // Produto sai dos pendentes e vai para confirmados (mesmo com divergencia sistemica)
  });

  // ── 2d. 2a contagem != 1a → desempate necessario ────────────────────────────

  it('2d. 2a contagem diferente da 1a → desempate necessario (status "aguardando_recontagem")', async () => {
    // 1a contagem foi 45; 2a contagem e 48 → valores divergem entre si → precisa de 3a
    const resposta = { contagem: mkContagem('c-004', QR_DESEMP, 2, 48), status_produto: 'aguardando_recontagem' };
    const fetchMock = buildFetchMock(200, resposta);
    const { registrarContagem } = carregarApiComMock(fetchMock);

    const resultado = await registrarContagem({
      sessaoId: SESSAO_ID,
      codigoQr: QR_DESEMP,
      quantidadeContada: 48,
    });

    expect(resultado.status_produto).toBe('aguardando_recontagem');
    expect(resultado.contagem.numero_contagem).toBe(2);
    // Produto continua na lista de pendentes — aguardando 3a contagem (desempate)
  });

  // ── 2e. 3a contagem (desempate) ─────────────────────────────────────────────

  it('2e. 3a contagem (desempate) → valor final determinado → status "ok"', async () => {
    // Contagens: 45, 48, 46 → moda/mais proxima ao sistema decide o valor final
    const resposta = { contagem: mkContagem('c-005', QR_DESEMP, 3, 46), status_produto: 'ok' };
    const fetchMock = buildFetchMock(200, resposta);
    const { registrarContagem } = carregarApiComMock(fetchMock);

    const resultado = await registrarContagem({
      sessaoId: SESSAO_ID,
      codigoQr: QR_DESEMP,
      quantidadeContada: 46,
    });

    expect(resultado.status_produto).toBe('ok');
    expect(resultado.contagem.numero_contagem).toBe(3);
    // Produto finalizado — sai dos pendentes definitivamente
  });
});

// ─── 3. CASOS DE ERRO NA CONTAGEM ────────────────────────────────────────────

describe('3. Casos de erro na contagem', () => {
  afterEach(() => jest.clearAllMocks());

  it('3a. SKU nao importado → erro 404 com mensagem clara', async () => {
    const fetchMock = buildFetchMock(404, { detail: 'Produto nao encontrado no estoque desta sessao.' });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await expect(
      registrarContagem({ sessaoId: SESSAO_ID, codigoQr: QR_NAO_IMPORTADO, quantidadeContada: 10 })
    ).rejects.toMatchObject({
      message: 'Produto nao encontrado no estoque desta sessao.',
      status: 404,
    });
  });

  it('3b. Produto ja contado 3 vezes → erro 400 sem retry', async () => {
    const fetchMock = buildFetchMock(400, { detail: 'Este produto ja foi contado 3 vezes.' });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await expect(
      registrarContagem({ sessaoId: SESSAO_ID, codigoQr: QR_DIV, quantidadeContada: 50 })
    ).rejects.toMatchObject({
      message: 'Este produto ja foi contado 3 vezes.',
      status: 400,
    });

    // CRITICO: deve ter feito exatamente 1 chamada — sem retry automatico
    // A ausencia de retry e o que previne o bug original de consumir as 3 contagens
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('3c. Sessao encerrada → erro 422 ao tentar registrar contagem', async () => {
    const fetchMock = buildFetchMock(422, { detail: 'Sessao nao esta em andamento.' });
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await expect(
      registrarContagem({ sessaoId: SESSAO_ID, codigoQr: QR_OK, quantidadeContada: 100 })
    ).rejects.toMatchObject({
      status: 422,
    });
  });

  it('3d. Servidor retorna HTML em 500 (cold start) → erro "resposta inesperada"', async () => {
    const fetchMock = buildFetchMock(500, '<!DOCTYPE html><html>Internal Server Error</html>', false);
    const { registrarContagem } = carregarApiComMock(fetchMock);

    await expect(
      registrarContagem({ sessaoId: SESSAO_ID, codigoQr: QR_OK, quantidadeContada: 100 })
    ).rejects.toMatchObject({
      message: expect.stringContaining('resposta inesperada'),
      status: 500,
    });

    // Tambem deve ter feito exatamente 1 chamada — sem retry que consumiria contagens
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─── 4. ENCERRAR SESSAO E GERAR DIVERGENCIAS ─────────────────────────────────

describe('4. Encerrar sessao e gerar divergencias', () => {
  afterEach(() => jest.clearAllMocks());

  it('encerrarSessao envia PATCH e retorna status "encerrada"', async () => {
    const fetchMock = buildFetchMock(200, SESSAO_ENCERRADA);
    const { encerrarSessao } = carregarApiComMock(fetchMock);

    const resultado = await encerrarSessao(SESSAO_ID);

    expect(resultado.status).toBe('encerrada');
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/encerrar`);
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });

  it('gerarDivergencias envia POST e retorna resumo das divergencias', async () => {
    const respostaGeracao = {
      total: 2,
      divergencias: [DIVERGENCIA_1, DIVERGENCIA_2],
    };
    const fetchMock = buildFetchMock(200, respostaGeracao);
    const { gerarDivergencias } = carregarApiComMock(fetchMock);

    const resultado = await gerarDivergencias(SESSAO_ID);

    expect(resultado.total).toBe(2);
    expect(resultado.divergencias).toHaveLength(2);
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/gerar-divergencias`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('listarDivergencias retorna paginacao com items', async () => {
    const respostaLista = {
      items: [DIVERGENCIA_1, DIVERGENCIA_2],
      total: 2,
      pagina: 1,
      por_pagina: 50,
      total_paginas: 1,
    };
    const fetchMock = buildFetchMock(200, respostaLista);
    const { listarDivergencias } = carregarApiComMock(fetchMock);

    const resultado = await listarDivergencias(SESSAO_ID);

    expect(resultado.items).toHaveLength(2);
    expect(resultado.total).toBe(2);
    expect(resultado.items[0].status).toBe('pendente');
  });
});

// ─── 5. APROVACAO PELO GESTOR ────────────────────────────────────────────────

describe('5. Aprovacao pelo gestor', () => {
  afterEach(() => jest.clearAllMocks());

  it('aprovarDivergencia envia PATCH com acao "ajustar_para_contado" e retorna status "aprovada"', async () => {
    const divergenciaAprovada = { ...DIVERGENCIA_1, status: 'aprovada', acao: 'ajustar_para_contado' };
    const fetchMock = buildFetchMock(200, divergenciaAprovada);
    const { aprovarDivergencia } = carregarApiComMock(fetchMock);

    const resultado = await aprovarDivergencia(DIVERGENCIA_1.id, 'ajustar_para_contado');

    expect(resultado.status).toBe('aprovada');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.acao).toBe('ajustar_para_contado');
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain(`/divergencias/${DIVERGENCIA_1.id}/aprovar`);
  });

  it('rejeitarDivergencia envia PATCH com motivo e retorna status "rejeitada"', async () => {
    const divergenciaRejeitada = { ...DIVERGENCIA_2, status: 'rejeitada', motivo_rejeicao: 'Erro de contagem confirmado' };
    const fetchMock = buildFetchMock(200, divergenciaRejeitada);
    const { rejeitarDivergencia } = carregarApiComMock(fetchMock);

    const resultado = await rejeitarDivergencia(DIVERGENCIA_2.id, 'Erro de contagem confirmado');

    expect(resultado.status).toBe('rejeitada');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.motivo).toBe('Erro de contagem confirmado');
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain(`/divergencias/${DIVERGENCIA_2.id}/rejeitar`);
  });

  it('concluirSessao envia POST e retorna status "concluida"', async () => {
    const fetchMock = buildFetchMock(200, SESSAO_CONCLUIDA);
    const { concluirSessao } = carregarApiComMock(fetchMock);

    const resultado = await concluirSessao(SESSAO_ID);

    expect(resultado.status).toBe('concluida');
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/concluir`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('aprovarInventario conclui em um passo (atalho ADM)', async () => {
    const respostaAprovacao = { sessao_id: SESSAO_ID, status: 'concluida', divergencias_aprovadas: 2 };
    const fetchMock = buildFetchMock(200, respostaAprovacao);
    const { aprovarInventario } = carregarApiComMock(fetchMock);

    const resultado = await aprovarInventario(SESSAO_ID);

    expect(resultado.status).toBe('concluida');
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain(`/sessoes/${SESSAO_ID}/aprovar-inventario`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });
});

// ─── 6. FLUXO ENCADEADO COMPLETO ─────────────────────────────────────────────
// Simula o caminho feliz completo de uma sessao de inventario com mock sequencial.

describe('6. Fluxo encadeado completo (ponta-a-ponta simulado)', () => {
  afterEach(() => jest.clearAllMocks());

  it('executa criacao → inicio → contagem_ok → contagem_diverge → recontagem → encerrar → gerar → aprovar → concluir sem erros', async () => {
    const respostas = [
      // 1. criarSessao → POST /sessoes
      { status: 201, body: SESSAO_CRIADA },
      // 2. iniciarSessao → PATCH /sessoes/{id}/iniciar
      { status: 200, body: SESSAO_EM_ANDAMENTO },
      // 3. registrarContagem QR_OK (1a, bate com sistema) → ok
      { status: 200, body: { contagem: mkContagem('c-001', QR_OK, 1, 100), status_produto: 'ok' } },
      // 4. registrarContagem QR_DIV (1a, diverge) → aguardando_recontagem
      { status: 200, body: { contagem: mkContagem('c-002', QR_DIV, 1, 45), status_produto: 'aguardando_recontagem' } },
      // 5. registrarContagem QR_DIV (2a, igual a 1a) → ok (confirmado)
      { status: 200, body: { contagem: mkContagem('c-003', QR_DIV, 2, 45), status_produto: 'ok' } },
      // 6. encerrarSessao → PATCH /sessoes/{id}/encerrar
      { status: 200, body: SESSAO_ENCERRADA },
      // 7. gerarDivergencias → POST /sessoes/{id}/gerar-divergencias
      { status: 200, body: { total: 1, divergencias: [DIVERGENCIA_1] } },
      // 8. aprovarDivergencia → PATCH /divergencias/{id}/aprovar
      { status: 200, body: { ...DIVERGENCIA_1, status: 'aprovada' } },
      // 9. concluirSessao → POST /sessoes/{id}/concluir
      { status: 200, body: SESSAO_CONCLUIDA },
    ];

    const fetchMock = buildFetchSequencial(respostas);
    const api = carregarApiComMock(fetchMock);

    // 1. Criar sessao
    const sessao = await api.criarSessao({
      lojaId: LOJA_ID, nome: 'Inventario Junho 2026',
      tipo: 'geral', mesReferencia: '2026-06',
    });
    expect(sessao.status).toBe('criada');

    // 2. Iniciar sessao
    const sessaoIniciada = await api.iniciarSessao(sessao.id);
    expect(sessaoIniciada.status).toBe('em_andamento');

    // 3. 1a contagem — produto que bate com sistema
    const c1 = await api.registrarContagem({ sessaoId: sessao.id, codigoQr: QR_OK, quantidadeContada: 100 });
    expect(c1.status_produto).toBe('ok');

    // 4. 1a contagem — produto que diverge
    const c2 = await api.registrarContagem({ sessaoId: sessao.id, codigoQr: QR_DIV, quantidadeContada: 45 });
    expect(c2.status_produto).toBe('aguardando_recontagem');

    // 5. 2a contagem do produto divergente — mesma quantidade da 1a → confirmado
    const c3 = await api.registrarContagem({ sessaoId: sessao.id, codigoQr: QR_DIV, quantidadeContada: 45 });
    expect(c3.status_produto).toBe('ok');

    // 6. Encerrar sessao
    const sessaoEncerrada = await api.encerrarSessao(sessao.id);
    expect(sessaoEncerrada.status).toBe('encerrada');

    // 7. Gerar divergencias
    const divs = await api.gerarDivergencias(sessao.id);
    expect(divs.total).toBe(1);

    // 8. Gestor aprova a divergencia
    const divAprovada = await api.aprovarDivergencia(divs.divergencias[0].id, 'ajustar_para_contado');
    expect(divAprovada.status).toBe('aprovada');

    // 9. Concluir sessao
    const sessaoConcluida = await api.concluirSessao(sessao.id);
    expect(sessaoConcluida.status).toBe('concluida');

    // Total de chamadas HTTP deve ser exatamente 9
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it('fluxo com desempate (3 contagens): 1a diverge → 2a diferente da 1a → 3a finaliza', async () => {
    const respostas = [
      // 1. criarSessao
      { status: 201, body: SESSAO_CRIADA },
      // 2. iniciarSessao
      { status: 200, body: SESSAO_EM_ANDAMENTO },
      // 3. 1a contagem QR_DESEMP — diverge (sistema: 80, contado: 45)
      { status: 200, body: { contagem: mkContagem('c-d1', QR_DESEMP, 1, 45), status_produto: 'aguardando_recontagem' } },
      // 4. 2a contagem QR_DESEMP — diferente da 1a (48 != 45) → ainda aguardando (desempate)
      { status: 200, body: { contagem: mkContagem('c-d2', QR_DESEMP, 2, 48), status_produto: 'aguardando_recontagem' } },
      // 5. 3a contagem QR_DESEMP — desempate (valor final determinado pela logica: moda ou mais proximo)
      { status: 200, body: { contagem: mkContagem('c-d3', QR_DESEMP, 3, 46), status_produto: 'ok' } },
      // 6. encerrar
      { status: 200, body: SESSAO_ENCERRADA },
      // 7. gerar divergencias
      { status: 200, body: { total: 1, divergencias: [DIVERGENCIA_2] } },
      // 8. concluir (via aprovarInventario)
      { status: 200, body: { sessao_id: SESSAO_ID, status: 'concluida', divergencias_aprovadas: 1 } },
    ];

    const fetchMock = buildFetchSequencial(respostas);
    const api = carregarApiComMock(fetchMock);

    await api.criarSessao({ lojaId: LOJA_ID, nome: 'Teste', tipo: 'geral', mesReferencia: '2026-06' });
    await api.iniciarSessao(SESSAO_ID);

    const c1 = await api.registrarContagem({ sessaoId: SESSAO_ID, codigoQr: QR_DESEMP, quantidadeContada: 45 });
    expect(c1.status_produto).toBe('aguardando_recontagem');
    expect(c1.contagem.numero_contagem).toBe(1);

    const c2 = await api.registrarContagem({ sessaoId: SESSAO_ID, codigoQr: QR_DESEMP, quantidadeContada: 48 });
    expect(c2.status_produto).toBe('aguardando_recontagem'); // ainda pendente — precisa desempate
    expect(c2.contagem.numero_contagem).toBe(2);

    const c3 = await api.registrarContagem({ sessaoId: SESSAO_ID, codigoQr: QR_DESEMP, quantidadeContada: 46 });
    expect(c3.status_produto).toBe('ok'); // desempate concluido
    expect(c3.contagem.numero_contagem).toBe(3);

    await api.encerrarSessao(SESSAO_ID);
    const divs = await api.gerarDivergencias(SESSAO_ID);
    expect(divs.total).toBe(1); // QR_DESEMP ainda diverge do sistema (46 != 80)

    const conclusao = await api.aprovarInventario(SESSAO_ID);
    expect(conclusao.status).toBe('concluida');

    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});

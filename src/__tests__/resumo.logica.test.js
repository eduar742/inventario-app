/**
 * Testes de logica pura da ResumoScreen.
 *
 * Testa as funcoes centrais do fluxo de finalizacao de inventario:
 *  1. Agrupamento de contagens por QR code (mapa) com soma de parciais
 *  2. Deduplicacao via itensSalvosRef (previne dupla contagem no Tentar novamente)
 *  3. Deteccao do tipo de erro (cold start vs limite 3 contagens vs outro)
 *  4. Logica de acumulador de quantidades parciais
 */

// ─── FUNCOES EXTRAIDAS DA RESUMOSCREEN ─────────────────────────────────────
// Replicamos a logica inline para testar isoladamente sem renderizar o componente

/**
 * Agrupa lista de contagens por codigoQr, somando quantidades parciais.
 * Espelha o bloco "Agrupa por codigoQr" de finalizarInventario.
 */
function agruparContagensPorQr(contagens) {
  const mapa = {};
  for (const c of contagens) {
    if (!mapa[c.codigoQr]) {
      mapa[c.codigoQr] = {
        codigoQr: c.codigoQr,
        sku: c.sku,
        descricao: c.descricao,
        unidadeMedida: c.unidadeMedida,
        quantidadeTotal: 0,
        obsLista: [],
      };
    }
    mapa[c.codigoQr].quantidadeTotal += c.quantidade;
    if (c.observacoes) mapa[c.codigoQr].obsLista.push(c.observacoes);
  }
  return mapa;
}

/**
 * Determina o tipo de erro baseado na mensagem — espelha a deteccao em finalizarInventario.
 */
function classificarErro(mensagem) {
  if (!mensagem) return 'outro';
  // "inesperada" = HTML de cold start; "demorou" = timeout 60s
  if (mensagem.includes('inesperada') || mensagem.includes('demorou')) return 'cold_start';
  if (mensagem.includes('3 vezes')) return 'ja_contado';
  return 'outro';
}

// ─── TESTES ─────────────────────────────────────────────────────────────────

describe('agruparContagensPorQr', () => {
  it('agrupa produto unico com uma bipagem', () => {
    const contagens = [
      { codigoQr: 'QR-001', sku: 'SKU001', descricao: 'Produto A', unidadeMedida: 'UN', quantidade: 10 },
    ];
    const mapa = agruparContagensPorQr(contagens);
    expect(Object.keys(mapa)).toHaveLength(1);
    expect(mapa['QR-001'].quantidadeTotal).toBe(10);
  });

  it('soma quantidades parciais do mesmo QR (estoque em multiplas localizacoes)', () => {
    const contagens = [
      { codigoQr: 'QR-001', sku: 'SKU001', descricao: 'Produto A', unidadeMedida: 'UN', quantidade: 50 },
      { codigoQr: 'QR-001', sku: 'SKU001', descricao: 'Produto A', unidadeMedida: 'UN', quantidade: 30 },
    ];
    const mapa = agruparContagensPorQr(contagens);
    expect(mapa['QR-001'].quantidadeTotal).toBe(80);
  });

  it('trata tres produtos distintos como entradas separadas', () => {
    const contagens = [
      { codigoQr: 'QR-001', sku: 'S1', descricao: 'P1', unidadeMedida: 'UN', quantidade: 5 },
      { codigoQr: 'QR-002', sku: 'S2', descricao: 'P2', unidadeMedida: 'M2', quantidade: 12 },
      { codigoQr: 'QR-003', sku: 'S3', descricao: 'P3', unidadeMedida: 'KG', quantidade: 3 },
    ];
    const mapa = agruparContagensPorQr(contagens);
    expect(Object.keys(mapa)).toHaveLength(3);
    expect(mapa['QR-002'].quantidadeTotal).toBe(12);
  });

  it('acumula observacoes de bipagens distintas do mesmo produto', () => {
    const contagens = [
      { codigoQr: 'QR-001', sku: 'S1', descricao: 'P1', unidadeMedida: 'UN', quantidade: 10, observacoes: 'Caixa A' },
      { codigoQr: 'QR-001', sku: 'S1', descricao: 'P1', unidadeMedida: 'UN', quantidade: 20, observacoes: 'Caixa B' },
    ];
    const mapa = agruparContagensPorQr(contagens);
    expect(mapa['QR-001'].obsLista).toEqual(['Caixa A', 'Caixa B']);
    expect(mapa['QR-001'].quantidadeTotal).toBe(30);
  });

  it('ignora observacoes nulas ou vazias', () => {
    const contagens = [
      { codigoQr: 'QR-001', sku: 'S1', descricao: 'P1', unidadeMedida: 'UN', quantidade: 5, observacoes: null },
      { codigoQr: 'QR-001', sku: 'S1', descricao: 'P1', unidadeMedida: 'UN', quantidade: 5 },
    ];
    const mapa = agruparContagensPorQr(contagens);
    expect(mapa['QR-001'].obsLista).toHaveLength(0);
  });

  it('retorna mapa vazio para lista de contagens vazia', () => {
    expect(agruparContagensPorQr([])).toEqual({});
  });

  it('preserva sku, descricao e unidadeMedida do primeiro registro', () => {
    const contagens = [
      { codigoQr: 'QR-001', sku: 'SKUABC', descricao: 'Chapa MDF 15mm', unidadeMedida: 'M2', quantidade: 8 },
    ];
    const mapa = agruparContagensPorQr(contagens);
    expect(mapa['QR-001'].sku).toBe('SKUABC');
    expect(mapa['QR-001'].descricao).toBe('Chapa MDF 15mm');
    expect(mapa['QR-001'].unidadeMedida).toBe('M2');
  });
});

// ─── itensSalvosRef — prevencao de dupla contagem ──────────────────────────

describe('logica de deduplicacao itensSalvosRef', () => {
  /**
   * Simula o comportamento de finalizarInventario com o ref:
   * - Itens no ref sao pulados (nao re-enviados)
   * - Itens salvos com sucesso sao adicionados ao ref
   * - O ref persiste entre chamadas (simulado aqui com um objeto)
   */
  function simularFinalizarComRef(mapa, itensSalvos, registrarFn) {
    const confirmados = [];
    const erros = [];

    for (const item of Object.values(mapa)) {
      if (itensSalvos[item.codigoQr]) continue; // ja salvo — pula

      try {
        const resp = registrarFn(item);
        itensSalvos[item.codigoQr] = { item, resp };
        confirmados.push({ item, resp });
      } catch (err) {
        erros.push({ item, erro: err.message });
      }
    }

    return { confirmados, erros };
  }

  it('nao re-envia itens ja presentes no ref (Tentar novamente seguro)', () => {
    const mapa = {
      'QR-001': { codigoQr: 'QR-001', quantidadeTotal: 10 },
      'QR-002': { codigoQr: 'QR-002', quantidadeTotal: 5 },
    };
    const itensSalvos = {
      'QR-001': { item: { codigoQr: 'QR-001' }, resp: { status_produto: 'ok' } },
    };
    const registrar = jest.fn(() => ({ status_produto: 'ok' }));

    const { confirmados } = simularFinalizarComRef(mapa, itensSalvos, registrar);

    // QR-001 deve ser pulado; QR-002 deve ser registrado
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar.mock.calls[0][0].codigoQr).toBe('QR-002');
    expect(confirmados).toHaveLength(1);
    expect(confirmados[0].item.codigoQr).toBe('QR-002');
  });

  it('salva item no ref apos registro bem-sucedido', () => {
    const mapa = { 'QR-001': { codigoQr: 'QR-001', quantidadeTotal: 10 } };
    const itensSalvos = {};
    const registrar = jest.fn(() => ({ status_produto: 'ok' }));

    simularFinalizarComRef(mapa, itensSalvos, registrar);

    expect(itensSalvos['QR-001']).toBeDefined();
    expect(itensSalvos['QR-001'].resp).toEqual({ status_produto: 'ok' });
  });

  it('nao salva item no ref quando registro falha', () => {
    const mapa = { 'QR-001': { codigoQr: 'QR-001', quantidadeTotal: 10 } };
    const itensSalvos = {};
    const registrar = jest.fn(() => { throw new Error('Erro de rede'); });

    const { erros } = simularFinalizarComRef(mapa, itensSalvos, registrar);

    expect(itensSalvos['QR-001']).toBeUndefined(); // nao salvo
    expect(erros).toHaveLength(1);
    expect(erros[0].erro).toBe('Erro de rede');
  });

  it('na segunda tentativa, apenas itens com erro sao reenviados', () => {
    const mapa = {
      'QR-001': { codigoQr: 'QR-001', quantidadeTotal: 10 },
      'QR-002': { codigoQr: 'QR-002', quantidadeTotal: 5 },
      'QR-003': { codigoQr: 'QR-003', quantidadeTotal: 7 },
    };
    const itensSalvos = {};

    // 1a tentativa: QR-001 e QR-002 falham, QR-003 ok
    let chamadas = 0;
    const registrar1 = jest.fn((item) => {
      chamadas++;
      if (item.codigoQr !== 'QR-003') throw new Error('Servidor indisponivel');
      return { status_produto: 'ok' };
    });
    simularFinalizarComRef(mapa, itensSalvos, registrar1);

    expect(itensSalvos['QR-003']).toBeDefined();
    expect(itensSalvos['QR-001']).toBeUndefined();

    // 2a tentativa: todos devem ser ok agora, mas QR-003 deve ser pulado
    const registrar2 = jest.fn(() => ({ status_produto: 'ok' }));
    simularFinalizarComRef(mapa, itensSalvos, registrar2);

    expect(registrar2).toHaveBeenCalledTimes(2); // apenas QR-001 e QR-002
    const qrsEnviados = registrar2.mock.calls.map(c => c[0].codigoQr).sort();
    expect(qrsEnviados).toEqual(['QR-001', 'QR-002']);
  });

  it('quando todos os itens estao no ref, nao chama registrar nenhuma vez', () => {
    const mapa = { 'QR-001': { codigoQr: 'QR-001' } };
    const itensSalvos = { 'QR-001': { item: {}, resp: {} } };
    const registrar = jest.fn();

    simularFinalizarComRef(mapa, itensSalvos, registrar);
    expect(registrar).not.toHaveBeenCalled();
  });
});

// ─── classificarErro ─────────────────────────────────────────────────────────

describe('classificarErro', () => {
  it('classifica cold start pelo texto "resposta inesperada"', () => {
    expect(classificarErro('Erro 503: resposta inesperada do servidor')).toBe('cold_start');
  });

  it('classifica cold start pelo texto "servidor"', () => {
    expect(classificarErro('O servidor demorou para responder')).toBe('cold_start');
  });

  it('classifica "3 vezes" como ja_contado', () => {
    expect(classificarErro('Este produto ja foi contado 3 vezes.')).toBe('ja_contado');
  });

  it('classifica erro desconhecido como "outro"', () => {
    expect(classificarErro('Sessao nao esta em andamento')).toBe('outro');
  });

  it('classifica erro de rede como "outro"', () => {
    expect(classificarErro('Sem conexao com o servidor')).toBe('outro');
  });

  it('retorna "outro" para mensagem nula', () => {
    expect(classificarErro(null)).toBe('outro');
  });

  it('retorna "outro" para mensagem vazia', () => {
    expect(classificarErro('')).toBe('outro');
  });
});

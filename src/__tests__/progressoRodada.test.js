/**
 * Testes da logica de progresso por rodada na AcompanhamentoSessaoScreen —
 * mesmo estilo de resumo.logica.test.js: replica a logica isolada.
 *
 * Antes desta mudanca, o painel usava total_produtos_loja/total_produtos_contados
 * (soma das 3 rodadas), entao ficava preso perto de 100% assim que a 1a
 * contagem terminava, mesmo com a 2a/3a ainda pendentes. Agora usa os campos
 * *_rodada_atual que o backend calcula (ver _progresso_por_rodada).
 */

const ROTULO_RODADA = {
  1: '1ª contagem em andamento',
  2: '2ª contagem em andamento',
  3: '3ª contagem em andamento (desempate)',
};

function derivarProgresso(sessaoInfo) {
  const rodadaAtual = sessaoInfo?.rodada_atual || 1;
  const total = sessaoInfo?.total_produtos_rodada_atual || 0;
  const contados = sessaoInfo?.total_produtos_contados_rodada_atual || 0;
  const faltam = Math.max(total - contados, 0);
  const percentual = sessaoInfo?.percentual_progresso_rodada_atual || 0;
  const rotulo = ROTULO_RODADA[rodadaAtual] || `${rodadaAtual}ª contagem em andamento`;
  return { rodadaAtual, total, contados, faltam, percentual, rotulo };
}

describe('derivarProgresso (logica extraida da AcompanhamentoSessaoScreen)', () => {
  it('rodada 1: usa os campos *_rodada_atual, nao os agregados das 3 rodadas', () => {
    const sessaoInfo = {
      rodada_atual: 1,
      total_produtos_rodada_atual: 50,
      total_produtos_contados_rodada_atual: 30,
      percentual_progresso_rodada_atual: 60.0,
      // campos agregados antigos, deliberadamente diferentes pra provar que
      // nao sao mais usados aqui
      total_produtos_loja: 999,
      total_produtos_contados: 999,
      percentual_progresso: 99.9,
    };
    const r = derivarProgresso(sessaoInfo);
    expect(r).toMatchObject({ rodadaAtual: 1, total: 50, contados: 30, faltam: 20, percentual: 60.0 });
    expect(r.rotulo).toBe('1ª contagem em andamento');
  });

  it('rodada 2: rotulo e numeros refletem so a recontagem pendente', () => {
    const r = derivarProgresso({
      rodada_atual: 2,
      total_produtos_rodada_atual: 8,
      total_produtos_contados_rodada_atual: 3,
      percentual_progresso_rodada_atual: 37.5,
    });
    expect(r.faltam).toBe(5);
    expect(r.rotulo).toBe('2ª contagem em andamento');
  });

  it('rodada 3 (desempate): rotulo especifico e nunca passa de 100%', () => {
    const r = derivarProgresso({
      rodada_atual: 3,
      total_produtos_rodada_atual: 2,
      total_produtos_contados_rodada_atual: 2,
      percentual_progresso_rodada_atual: 100.0,
    });
    expect(r.faltam).toBe(0);
    expect(r.percentual).toBe(100.0);
    expect(r.rotulo).toBe('3ª contagem em andamento (desempate)');
  });

  it('sem dados ainda (sessaoInfo null): valores default seguros', () => {
    const r = derivarProgresso(null);
    expect(r).toMatchObject({ rodadaAtual: 1, total: 0, contados: 0, faltam: 0, percentual: 0 });
  });

  it('faltam nunca fica negativo mesmo com dado inconsistente', () => {
    const r = derivarProgresso({
      rodada_atual: 2, total_produtos_rodada_atual: 3, total_produtos_contados_rodada_atual: 5,
    });
    expect(r.faltam).toBe(0);
  });
});

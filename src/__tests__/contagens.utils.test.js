/**
 * Testes de src/utils/contagens.js — agrupamento por RODADA.
 *
 * Regressao: Historico e Revisar contagens usavam numero_contagem (sequencial
 * de bipagens) como se fosse a rodada, entao uma parcela de outro local virava
 * "2a contagem" e o "valor final" era a ultima bipagem (ex: 2 em vez de 40).
 */
import { rodadaDaContagem, agruparPorRodada, valorFinalContagens } from '../utils/contagens';

const c = (numero_contagem, rodada, quantidade_contada) => ({ numero_contagem, rodada, quantidade_contada });

describe('rodadaDaContagem', () => {
  it('usa o campo rodada, nao numero_contagem', () => {
    expect(rodadaDaContagem(c(4, 1, 10))).toBe(1);
  });
  it('assume 1a rodada quando o campo nao vem (dado legado)', () => {
    expect(rodadaDaContagem({ numero_contagem: 2, quantidade_contada: 5 })).toBe(1);
  });
});

describe('agruparPorRodada', () => {
  it('soma as parcelas de locais diferentes da mesma rodada', () => {
    const r = agruparPorRodada([c(1, 1, 38), c(2, 1, 2), c(3, 2, 40)]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ rodada: 1, total: 40 });
    expect(r[0].parcelas).toHaveLength(2);
    expect(r[1]).toMatchObject({ rodada: 2, total: 40 });
  });
});

describe('valorFinalContagens (espelha _calcular_status_produto do backend)', () => {
  it('multi-localizacao na 1a rodada: soma (38 + 2 = 40), nao a ultima bipagem', () => {
    expect(valorFinalContagens([c(1, 1, 38), c(2, 1, 2)])).toBe(40);
  });
  it('1a e 2a iguais: valor confirmado', () => {
    expect(valorFinalContagens([c(1, 1, 33), c(2, 2, 33)])).toBe(33);
  });
  it('1a e 2a diferentes: null (aguardando desempate)', () => {
    expect(valorFinalContagens([c(1, 1, 10), c(2, 2, 11)])).toBeNull();
  });
  it('com 3a rodada: vale o desempate, nao a soma das 3 (10+11+10)', () => {
    expect(valorFinalContagens([c(1, 1, 10), c(2, 2, 11), c(3, 3, 10)])).toBe(10);
  });
  it('sem contagens: null', () => {
    expect(valorFinalContagens([])).toBeNull();
  });
});

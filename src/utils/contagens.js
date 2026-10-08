// Utilitarios de contagem por RODADA.
//
// Atencao: `numero_contagem` e so o sequencial de bipagens do produto na
// sessao (1, 2, 3...). Varias bipagens da mesma rodada sao parcelas de
// locais diferentes (multi-localizacao) e devem ser SOMADAS. A rodada real
// (1a contagem, 2a recontagem, 3a desempate) esta no campo `rodada`.
//
// A regra do valor final espelha `_calcular_status_produto` do backend
// (app/api/v1/endpoints/contagens.py) — manter as duas em sincronia.

/** Rodada de uma contagem (registros antigos sem o campo contam como 1a). */
export function rodadaDaContagem(c) {
  return Number(c?.rodada) || 1;
}

/**
 * Agrupa as bipagens por rodada.
 * Retorna [{ rodada, total, parcelas: [contagens] }] em ordem de rodada.
 */
export function agruparPorRodada(contagens) {
  const mapa = {};
  for (const c of contagens || []) {
    const r = rodadaDaContagem(c);
    if (!mapa[r]) mapa[r] = { rodada: r, total: 0, parcelas: [] };
    mapa[r].total += parseFloat(c.quantidade_contada || 0);
    mapa[r].parcelas.push(c);
  }
  return Object.values(mapa).sort((a, b) => a.rodada - b.rodada);
}

/**
 * Valor final das contagens de um produto, pela regra das 3 contagens:
 * - so a 1a rodada: o total dela
 * - 1a e 2a iguais: valor confirmado
 * - 1a e 2a diferentes: null (aguardando desempate)
 * - com 3a rodada: a moda entre as 3. Se as 3 forem diferentes, o backend usa
 *   a mais proxima do saldo do sistema — o app nao conhece o saldo (inventario
 *   cego), entao retorna null; use desempatePelaRegraDoSistema() para o rotulo.
 */
export function valorFinalContagens(contagens) {
  const rodadas = agruparPorRodada(contagens);
  if (rodadas.length === 0) return null;
  if (rodadas.length === 1) return rodadas[0].total;
  if (rodadas.length === 2) {
    return rodadas[0].total === rodadas[1].total ? rodadas[0].total : null;
  }
  const [r1, r2, r3] = rodadas.map(r => r.total);
  if (r3 === r1 || r3 === r2) return r3;
  if (r1 === r2) return r1;
  return null;
}

/** true quando as 3 contagens sao todas diferentes (valor final = mais proxima do sistema). */
export function desempatePelaRegraDoSistema(contagens) {
  const rodadas = agruparPorRodada(contagens);
  if (rodadas.length < 3) return false;
  const [r1, r2, r3] = rodadas.map(r => r.total);
  return r1 !== r2 && r1 !== r3 && r2 !== r3;
}

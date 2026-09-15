import { limparCodigoQr } from '../utils/qrCode';

describe('limparCodigoQr', () => {
  it('mantem o codigo quando nao ha asterisco', () => {
    expect(limparCodigoQr('QR-CHP001')).toBe('QR-CHP001');
  });

  it('considera somente o trecho antes do primeiro asterisco (lote/pedido descartados)', () => {
    expect(limparCodigoQr('CHP001*LOTE123*PC000456')).toBe('CHP001');
  });

  it('remove quebras de linha e espacos nas bordas', () => {
    expect(limparCodigoQr('  CHP001*LOTE123\r\n')).toBe('CHP001');
  });

  it('retorna string vazia para entrada vazia ou nula', () => {
    expect(limparCodigoQr('')).toBe('');
    expect(limparCodigoQr(null)).toBe('');
    expect(limparCodigoQr(undefined)).toBe('');
  });
});

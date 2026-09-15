// Utilitario para interpretar o conteudo bruto lido do QR Code / codigo de barras.
// O QR Code do produto traz SKU + lote + pedido de compra + outras infos,
// tudo separado por asterisco (ex: "CHP001*LOTE123*PC000456").
// Para o inventario so interessa o que vem antes do primeiro asterisco.

/** Extrai o codigo do produto a partir da leitura bruta do QR/codigo de barras. */
export function limparCodigoQr(raw) {
  const semQuebras = (raw || '').replace(/[\r\n\t]+/g, '').trim();
  const indiceAsterisco = semQuebras.indexOf('*');
  const codigo = indiceAsterisco >= 0 ? semQuebras.slice(0, indiceAsterisco) : semQuebras;
  return codigo.trim();
}

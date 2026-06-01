// Service de exportacao para Excel.
// - Mobile (iOS/Android): usa expo-file-system + expo-sharing
// - Web (notebook/browser): converte base64 em download direto via link HTML

import { Platform, Alert } from 'react-native';
import { chamarAPI } from './api';

// ── WEB: dispara download do arquivo direto no browser ──────────────────────
function _downloadWeb(base64, nomeArquivo, mimeType) {
  // Converte base64 para Blob
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);

  // Cria link invisivel, clica e remove
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── MOBILE: salva e abre dialogo de compartilhamento ───────────────────────
async function _downloadMobile(base64, nomeArquivo, mimeType) {
  const { default: FileSystem } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');

  const destino = FileSystem.documentDirectory + nomeArquivo;
  await FileSystem.writeAsStringAsync(destino, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const podeCompartilhar = await Sharing.isAvailableAsync();
  if (!podeCompartilhar) {
    Alert.alert('Arquivo salvo', `Salvo em:\n${nomeArquivo}`);
    return;
  }

  await Sharing.shareAsync(destino, {
    mimeType,
    dialogTitle: 'Exportar arquivo',
    UTI: nomeArquivo.endsWith('.pdf') ? 'com.adobe.pdf' : 'com.microsoft.excel.xlsx',
  });

  try { await FileSystem.deleteAsync(destino, { idempotent: true }); } catch (_) {}
}

// ── Funcao central ──────────────────────────────────────────────────────────
function _mimeType(nomeArquivo) {
  if (nomeArquivo.endsWith('.pdf'))  return 'application/pdf';
  if (nomeArquivo.endsWith('.zip'))  return 'application/zip';
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

async function _exportar(caminho, nomeArquivoFallback) {
  const dados = await chamarAPI(caminho);
  if (!dados?.arquivo_base64) throw new Error('Resposta de exportacao invalida');

  const nomeArquivo = dados.nome_arquivo || nomeArquivoFallback;
  const mime = _mimeType(nomeArquivo);

  if (Platform.OS === 'web') {
    _downloadWeb(dados.arquivo_base64, nomeArquivo, mime);
  } else {
    await _downloadMobile(dados.arquivo_base64, nomeArquivo, mime);
  }
}

// ── API publica ──────────────────────────────────────────────────────────────

export async function exportarSessao(sessaoId) {
  await _exportar(
    `/api/v1/sessoes/${sessaoId}/exportar`,
    `sessao_${sessaoId.slice(0, 8)}.xlsx`,
  );
}

export async function exportarEstoque(lojaId, mesReferencia) {
  const params = mesReferencia ? `?mes_referencia=${mesReferencia}` : '';
  await _exportar(
    `/api/v1/lojas/${lojaId}/estoque/exportar${params}`,
    `estoque_${lojaId.slice(0, 8)}.xlsx`,
  );
}

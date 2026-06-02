// Service de exportacao para Excel/PDF/ZIP.
// Web: download direto via link <a> no browser
// Mobile: salva via expo-file-system e abre compartilhamento

import { Platform, Alert } from 'react-native';
import { chamarAPI } from './api';

// ── WEB: download direto no browser ────────────────────────────────────────
function _downloadWeb(base64, nomeArquivo, mimeType) {
  try {
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      buffer[i] = bytes.charCodeAt(i);
    }
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  } catch (err) {
    console.error('[exportacao] Erro ao baixar no browser:', err);
    window.alert(`Erro ao baixar o arquivo:\n${err.message}`);
  }
}

// ── MOBILE: salva e compartilha ─────────────────────────────────────────────
async function _downloadMobile(base64, nomeArquivo, mimeType) {
  const { default: FileSystem } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');

  const destino = FileSystem.documentDirectory + nomeArquivo;
  await FileSystem.writeAsStringAsync(destino, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const podeCompartilhar = await Sharing.isAvailableAsync();
  if (!podeCompartilhar) {
    Alert.alert('Arquivo salvo', `Salvo: ${nomeArquivo}`);
    return;
  }

  await Sharing.shareAsync(destino, {
    mimeType,
    dialogTitle: 'Exportar arquivo',
    UTI: nomeArquivo.endsWith('.pdf') ? 'com.adobe.pdf' : 'com.microsoft.excel.xlsx',
  });

  try { await FileSystem.deleteAsync(destino, { idempotent: true }); } catch (_) {}
}

// ── Detecta tipo MIME pelo nome ─────────────────────────────────────────────
function _mimeType(nome) {
  if (nome.endsWith('.pdf'))  return 'application/pdf';
  if (nome.endsWith('.zip'))  return 'application/zip';
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

// ── Funcao central ──────────────────────────────────────────────────────────
async function _exportar(caminho, nomeArquivoFallback) {
  console.log('[exportacao] chamando:', caminho);

  const dados = await chamarAPI(caminho);

  if (!dados) {
    throw new Error('Servidor nao retornou dados. Tente novamente.');
  }
  if (!dados.arquivo_base64) {
    console.error('[exportacao] Resposta invalida:', dados);
    throw new Error('Arquivo nao gerado pelo servidor. Verifique se a sessao esta concluida.');
  }

  const nomeArquivo = dados.nome_arquivo || nomeArquivoFallback;
  const mime = _mimeType(nomeArquivo);

  console.log('[exportacao] baixando:', nomeArquivo, `(${Math.round(dados.arquivo_base64.length * 0.75 / 1024)} KB)`);

  if (Platform.OS === 'web') {
    _downloadWeb(dados.arquivo_base64, nomeArquivo, mime);
  } else {
    await _downloadMobile(dados.arquivo_base64, nomeArquivo, mime);
  }
}

// ── Funcao de aviso compativel com web ──────────────────────────────────────
function _avisar(titulo, mensagem) {
  if (Platform.OS === 'web') {
    window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo);
  } else {
    Alert.alert(titulo, mensagem);
  }
}

// ── API pública ──────────────────────────────────────────────────────────────

export async function exportarSessao(sessaoId) {
  await _exportar(
    `/api/v1/sessoes/${sessaoId}/exportar`,
    `sessao_${String(sessaoId).slice(0, 8)}.xlsx`,
  );
}

export async function exportarEstoque(lojaId, mesReferencia) {
  const params = mesReferencia ? `?mes_referencia=${mesReferencia}` : '';
  await _exportar(
    `/api/v1/lojas/${lojaId}/estoque/exportar${params}`,
    `estoque_${String(lojaId).slice(0, 8)}.xlsx`,
  );
}

// Wrapper com feedback visual integrado (para uso direto em botoes)
export async function exportarComFeedback(fn, setCarregando) {
  if (setCarregando) setCarregando(true);
  try {
    await fn();
  } catch (err) {
    const msg = err?.message || 'Tente novamente';
    _avisar('Erro ao exportar', msg);
    console.error('[exportacao] erro:', err);
  } finally {
    if (setCarregando) setCarregando(false);
  }
}

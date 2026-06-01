// Service de exportacao para Excel.
// Backend retorna base64 JSON — frontend salva com writeAsStringAsync (Expo Go compativel).

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { chamarAPI } from './api';

// Importa chamarAPI internamente — precisa ser exportada pelo api.js
// Se nao estiver exportada, use fetch direto com o token.
async function _exportar(caminho, nomeArquivo) {
  // Chama o endpoint de exportacao (retorna { nome_arquivo, arquivo_base64 })
  const dados = await chamarAPI(caminho);

  if (!dados?.arquivo_base64) {
    throw new Error('Resposta de exportacao invalida');
  }

  const destino = FileSystem.documentDirectory + (dados.nome_arquivo || nomeArquivo);

  // Salva o arquivo Excel a partir do base64
  await FileSystem.writeAsStringAsync(destino, dados.arquivo_base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Verifica se o dispositivo suporta compartilhamento
  const podeCompartilhar = await Sharing.isAvailableAsync();
  if (!podeCompartilhar) {
    Alert.alert('Arquivo exportado', `Salvo em:\n${destino}`);
    return;
  }

  await Sharing.shareAsync(destino, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar planilha Excel',
    UTI: 'com.microsoft.excel.xlsx',
  });

  // Limpa o arquivo temporario apos o compartilhamento
  try {
    await FileSystem.deleteAsync(destino, { idempotent: true });
  } catch (_) {}
}

export async function exportarSessao(sessaoId) {
  await _exportar(`/api/v1/sessoes/${sessaoId}/exportar`, `sessao_${sessaoId.slice(0, 8)}.xlsx`);
}

export async function exportarEstoque(lojaId, mesReferencia) {
  const params = mesReferencia ? `?mes_referencia=${mesReferencia}` : '';
  await _exportar(`/api/v1/lojas/${lojaId}/estoque/exportar${params}`, `estoque_${lojaId.slice(0, 8)}.xlsx`);
}

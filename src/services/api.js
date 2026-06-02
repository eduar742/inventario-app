// Service centralizado para comunicacao com a API do Render.
// Todas as chamadas HTTP do app passam por aqui.

import AsyncStorage from '@react-native-async-storage/async-storage';

// URL da API em producao (Render)
// Quando o TI definir hospedagem propria, basta trocar esta URL
const API_BASE_URL = 'https://inventario-api-bc1p.onrender.com';

const TOKEN_KEY = '@inventario:token';
const USUARIO_KEY = '@inventario:usuario';

// ============================================================
// HELPERS DE TOKEN (armazenamento local seguro)
// ============================================================

export async function salvarToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function pegarToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function removerToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USUARIO_KEY);
}

export async function salvarUsuario(usuario) {
  await AsyncStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

export async function pegarUsuario() {
  const dados = await AsyncStorage.getItem(USUARIO_KEY);
  return dados ? JSON.parse(dados) : null;
}

// ============================================================
// WRAPPER DE FETCH COM TOKEN AUTOMATICO
// ============================================================

// No browser usa o fetch nativo (evita polyfill do React Native que pode
// ter comportamento diferente com CORS em ambiente web)
// Extrai mensagem legivel do campo 'detail' da API.
// detail pode ser string (FastAPI simples) ou array (erros de validacao Pydantic).
function _extrairMensagem(detail, status) {
  if (!detail) return `Erro ${status}`;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(e => e.msg || e.message || JSON.stringify(e)).join('; ');
  }
  if (typeof detail === 'object') return JSON.stringify(detail);
  return String(detail);
}

const _fetch = typeof window !== 'undefined' && window.fetch
  ? window.fetch.bind(window)
  : fetch;

export async function chamarAPI(caminho, opcoes = {}) {
  const url = `${API_BASE_URL}${caminho}`;
  const token = await pegarToken();

  const headers = {
    'Content-Type': 'application/json',
    ...opcoes.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const resposta = await _fetch(url, {
      ...opcoes,
      headers,
    });

    const texto = await resposta.text();
    let dados = null;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch (_) {
      if (!resposta.ok) {
        const erro = new Error(`Erro ${resposta.status}: resposta inesperada do servidor`);
        erro.status = resposta.status;
        throw erro;
      }
    }

    if (!resposta.ok) {
      const erro = new Error(_extrairMensagem(dados?.detail, resposta.status));
      erro.status = resposta.status;
      erro.dados = dados;
      throw erro;
    }

    return dados;
  } catch (err) {
    // Log para facilitar debug no browser (F12 > Console)
    if (typeof window !== 'undefined') {
      console.error('[API]', caminho, err.message, err);
    }
    if (err.message === 'Network request failed' || err.message === 'Failed to fetch') {
      const erro = new Error('Sem conexao com o servidor. Verifique sua internet.');
      erro.status = 0;
      throw erro;
    }
    throw err;
  }
}

// ============================================================
// ENDPOINTS DE AUTENTICACAO
// ============================================================

export async function login(email, senha) {
  const dados = await chamarAPI('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });

  // Salva token e dados do usuario localmente
  await salvarToken(dados.access_token);
  await salvarUsuario(dados.usuario);

  return dados;
}

export async function logout() {
  await removerToken();
}

// ============================================================
// ENDPOINTS DE LOJAS
// ============================================================

export async function listarLojas() {
  return await chamarAPI('/api/v1/lojas');
}

// ============================================================
// ENDPOINTS DE SESSOES
// ============================================================

export async function listarSessoes(filtros = {}) {
  const params = new URLSearchParams(filtros).toString();
  const caminho = params ? `/api/v1/sessoes?${params}` : '/api/v1/sessoes';
  return await chamarAPI(caminho);
}

export async function buscarSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}`);
}

export async function listarPendentes(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/pendentes`);
}

export async function criarSessao({ lojaId, nome, tipo, mesReferencia, naturezaFiltroId, observacoes }) {
  return await chamarAPI('/api/v1/sessoes', {
    method: 'POST',
    body: JSON.stringify({
      loja_id: lojaId,
      nome,
      tipo,
      mes_referencia: mesReferencia,
      natureza_filtro_id: naturezaFiltroId || null,
      observacoes: observacoes || null,
    }),
  });
}

export async function iniciarSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/iniciar`, { method: 'PATCH' });
}

export async function encerrarSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/encerrar`, { method: 'PATCH' });
}

export async function gerarDivergencias(sessaoId, forcaRegerar = false) {
  const q = forcaRegerar ? '?forcar_regenerar=true' : '';
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/gerar-divergencias${q}`, { method: 'POST' });
}

export async function concluirSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/concluir`, { method: 'POST' });
}

export async function listarDivergencias(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/divergencias`);
}

export async function aprovarDivergencia(divergenciaId, acao = 'ajustar_para_contado') {
  return await chamarAPI(`/api/v1/divergencias/${divergenciaId}/aprovar`, {
    method: 'PATCH',
    body: JSON.stringify({ acao }),
  });
}

export async function rejeitarDivergencia(divergenciaId, motivo = 'Rejeitado pelo gestor') {
  return await chamarAPI(`/api/v1/divergencias/${divergenciaId}/rejeitar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo }),
  });
}

export async function listarRecontagemNecessaria(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/recontagem-necessaria`);
}

// M5: aprova todas as divergencias e conclui a sessao em um unico passo
export async function aprovarInventario(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/aprovar-inventario`, { method: 'POST' });
}

// M6: relatório consolidado — retorna blob Excel de todas as lojas
export async function baixarRelatorioConsolidado({ naturezaId, mesReferencia } = {}) {
  const url_base = 'https://inventario-api-bc1p.onrender.com';
  const token = await pegarToken();
  const params = new URLSearchParams();
  if (naturezaId) params.append('natureza_id', naturezaId);
  if (mesReferencia) params.append('mes_referencia', mesReferencia);

  const url = `${url_base}/api/v1/relatorios/consolidado${params.toString() ? '?' + params : ''}`;
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!resposta.ok) {
    const texto = await resposta.text();
    let mensagem = `Erro ${resposta.status}`;
    try { const d = JSON.parse(texto); mensagem = _extrairMensagem(d?.detail, resposta.status) || mensagem; } catch (_) {}
    const erro = new Error(mensagem); erro.status = resposta.status; throw erro;
  }

  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      const cd = resposta.headers.get('content-disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      resolve({ base64, nomeArquivo: match ? match[1] : 'relatorio_consolidado.xlsx' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// ENDPOINTS DE ESTOQUE E PRODUTOS
// ============================================================

export async function buscarEstoque(codigoQr, lojaId) {
  return await chamarAPI(
    `/api/v1/estoque/buscar?codigo_qr=${codigoQr}&loja_id=${lojaId}`
  );
}

export async function buscarProdutoPorQR(codigoQr) {
  return await chamarAPI(`/api/v1/produtos/qr/${codigoQr}`);
}

// ============================================================
// ENDPOINT DE CONTAGEM (o mais usado!)
// ============================================================

export async function registrarContagem({ sessaoId, codigoQr, quantidadeContada, observacoes }) {
  return await chamarAPI('/api/v1/contagens', {
    method: 'POST',
    body: JSON.stringify({
      sessao_id: sessaoId,
      codigo_qr: codigoQr,
      quantidade_contada: quantidadeContada,
      observacoes: observacoes || null,
    }),
  });
}

export async function listarContagensDaSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/contagens`);
}

export async function cancelarSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/cancelar`, {
    method: 'PATCH',
  });
}

// ============================================================
// ENDPOINTS DE USUARIOS (ADM)
// ============================================================

export async function listarUsuarios() {
  return await chamarAPI('/api/v1/usuarios');
}

export async function criarUsuarioAPI({ nome, email, senha, papel, lojaId, lojasIds }) {
  return await chamarAPI('/api/v1/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      nome, email, senha, papel,
      loja_id: lojaId || null,
      lojas_ids: lojasIds && lojasIds.length > 0 ? lojasIds : null,
    }),
  });
}

export async function atualizarUsuario(usuarioId, { nome, papel, lojaId, lojasIds, ativo }) {
  return await chamarAPI(`/api/v1/usuarios/${usuarioId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      nome,
      papel,
      loja_id: lojaId !== undefined ? (lojaId || '') : undefined,
      lojas_ids: lojasIds !== undefined ? lojasIds : undefined,
      ativo,
    }),
  });
}

// ============================================================
// ENDPOINTS DE NATUREZAS
// ============================================================

export async function listarNaturezas() {
  return await chamarAPI('/api/v1/naturezas');
}

// ============================================================
// ENDPOINTS DE IMPORTACAO
// ============================================================

export async function importarPlanilha({ lojaId, mesReferencia, arquivo, modo = 'completo' }) {
  const url = `${API_BASE_URL}/api/v1/importacoes`;
  const token = await pegarToken();

  const formData = new FormData();
  formData.append('loja_id', lojaId);
  formData.append('mes_referencia', mesReferencia);
  formData.append('modo', modo);

  // Web: expo-document-picker retorna arquivo.file (File nativo do browser)
  // Mobile: usa o objeto {uri, name, type} do React Native
  if (arquivo.file) {
    formData.append('arquivo', arquivo.file, arquivo.name);
  } else {
    formData.append('arquivo', {
      uri: arquivo.uri,
      name: arquivo.name,
      type: arquivo.mimeType || 'application/octet-stream',
    });
  }

  // Usa _fetch (fetch nativo do browser) para evitar problemas de CORS com polyfill RN
  const fetchFn = typeof window !== 'undefined' && window.fetch
    ? window.fetch.bind(window)
    : fetch;

  try {
    const resposta = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      // Content-Type omitido: fetch define o boundary multipart automaticamente
      body: formData,
    });

    const texto = await resposta.text();
    let dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch (_) {}

    if (!resposta.ok) {
      const erro = new Error(_extrairMensagem(dados?.detail, resposta.status));
      erro.status = resposta.status;
      throw erro;
    }

    return dados;
  } catch (err) {
    if (typeof window !== 'undefined') console.error('[importarPlanilha]', err);
    if (err.message === 'Network request failed' || err.message === 'Failed to fetch') {
      const erro = new Error('Sem conexao com o servidor.');
      erro.status = 0;
      throw erro;
    }
    throw err;
  }
}

export async function listarImportacoes(filtros = {}) {
  const params = new URLSearchParams(filtros).toString();
  const caminho = params ? `/api/v1/importacoes?${params}` : '/api/v1/importacoes';
  return await chamarAPI(caminho);
}

export async function buscarImportacao(importacaoId) {
  return await chamarAPI(`/api/v1/importacoes/${importacaoId}`);
}

// Retorna lista de meses ja importados para uma loja (deduplicados, ordenados)
export async function listarMesesImportados(lojaId) {
  const importacoes = await listarImportacoes({ loja_id: lojaId, status: 'sucesso' });
  const meses = [...new Set(importacoes.map(i => i.mes_referencia))].sort().reverse();
  return meses;
}

// ============================================================
// ENDPOINTS DE DASHBOARD
// ============================================================

function _dashParams(naturezaFiltroId, grupoMaterial) {
  const p = new URLSearchParams();
  if (naturezaFiltroId) p.append('natureza_filtro_id', naturezaFiltroId);
  if (grupoMaterial)    p.append('grupo_material', grupoMaterial);
  return p.toString() ? `?${p}` : '';
}

export async function buscarDashboardGeral(naturezaFiltroId, grupoMaterial) {
  return await chamarAPI(`/api/v1/dashboard${_dashParams(naturezaFiltroId, grupoMaterial)}`);
}

export async function buscarDashboardLojas(naturezaFiltroId, grupoMaterial) {
  return await chamarAPI(`/api/v1/dashboard/lojas${_dashParams(naturezaFiltroId, grupoMaterial)}`);
}

export async function buscarDashboardHistorico(lojaId, meses = 6, naturezaFiltroId, grupoMaterial) {
  const p = new URLSearchParams({ meses });
  if (naturezaFiltroId) p.append('natureza_filtro_id', naturezaFiltroId);
  if (grupoMaterial)    p.append('grupo_material', grupoMaterial);
  return await chamarAPI(`/api/v1/dashboard/historico/${lojaId}?${p}`);
}

export async function buscarGruposMaterial(lojaId, naturezaFiltroId) {
  const p = naturezaFiltroId ? `?natureza_filtro_id=${naturezaFiltroId}` : '';
  return await chamarAPI(`/api/v1/dashboard/grupos-material/${lojaId}${p}`);
}

// ============================================================
// ENDPOINTS DE RELATORIOS
// ============================================================

export async function listarPerfisRelatorio() {
  return await chamarAPI('/api/v1/relatorios/perfis');
}

// Retorna o arquivo como base64 JSON { nome_arquivo, arquivo_base64 }
// O endpoint retorna binario direto — usamos fetch manual aqui
export async function baixarRelatorio({ sessaoId, formato, perfil, abas }) {
  const API_BASE_URL = 'https://inventario-api-bc1p.onrender.com';
  const token = await pegarToken();

  const params = new URLSearchParams({ formato, perfil });
  if (abas && abas.length > 0) params.append('abas', abas.join(','));

  const url = `${API_BASE_URL}/api/v1/relatorios/sessao/${sessaoId}/exportar?${params}`;

  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    let mensagem = `Erro ${resposta.status}`;
    try {
      const dados = JSON.parse(texto);
      mensagem = _extrairMensagem(dados?.detail, resposta.status) || mensagem;
    } catch (_) {}
    const erro = new Error(mensagem);
    erro.status = resposta.status;
    throw erro;
  }

  // Converte para base64 para salvar com expo-file-system
  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      // Extrai nome do header Content-Disposition
      const cd = resposta.headers.get('content-disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const nomeArquivo = match ? match[1] : `relatorio.${formato}`;
      resolve({ base64, nomeArquivo });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
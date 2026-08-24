// Service centralizado para comunicacao com a API do Render.
// Todas as chamadas HTTP do app passam por aqui.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navRef } from '../navigation/navRef';

// URL da API em producao (Render)
// Quando o TI definir hospedagem propria, basta trocar esta URL
const API_BASE_URL = 'https://inventario-api-bc1p.onrender.com';

const TOKEN_KEY         = 'inventario_token';
const REFRESH_TOKEN_KEY = 'inventario_refresh';
const USUARIO_KEY       = 'inventario_usuario';

// ============================================================
// HELPERS DE TOKEN (armazenamento local seguro)
// ============================================================

// SecureStore disponivel apenas em iOS/Android; usa AsyncStorage como fallback no web
const _armazenar = Platform.OS === 'web'
  ? (k, v) => AsyncStorage.setItem(k, v)
  : (k, v) => SecureStore.setItemAsync(k, v);
const _ler = Platform.OS === 'web'
  ? (k) => AsyncStorage.getItem(k)
  : (k) => SecureStore.getItemAsync(k);
const _remover = Platform.OS === 'web'
  ? (k) => AsyncStorage.removeItem(k)
  : (k) => SecureStore.deleteItemAsync(k);

export async function salvarToken(token) {
  await _armazenar(TOKEN_KEY, token);
}

export async function pegarToken() {
  return await _ler(TOKEN_KEY);
}

export async function salvarRefreshToken(token) {
  await _armazenar(REFRESH_TOKEN_KEY, token);
}

export async function pegarRefreshToken() {
  return await _ler(REFRESH_TOKEN_KEY);
}

export async function removerToken() {
  await _remover(TOKEN_KEY);
  await _remover(REFRESH_TOKEN_KEY);
  await _remover(USUARIO_KEY);
}

export async function salvarUsuario(usuario) {
  await _armazenar(USUARIO_KEY, JSON.stringify(usuario));
}

export async function pegarUsuario() {
  const dados = await _ler(USUARIO_KEY);
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

// Wrapper com timeout de 60s (Render.com free tier pode ter cold start de ~50s)
async function _fetchComTimeout(url, opcoes = {}, ms = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await _fetch(url, { ...opcoes, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      const erro = new Error('O servidor demorou para responder. Tente novamente em instantes.');
      erro.status = 0;
      throw erro;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Flag que evita loop: se o refresh em si retornar 401, nao tenta refresh de novo
let _refreshEmAndamento = false;

async function _tentarRefreshSilencioso() {
  if (_refreshEmAndamento) return false;
  _refreshEmAndamento = true;
  try {
    const refreshToken = await pegarRefreshToken();
    if (!refreshToken) return false;
    // Chama chamarAPI com _skipRefresh=true para evitar recursao
    const dados = await chamarAPI('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }, true);
    await salvarToken(dados.access_token);
    await salvarRefreshToken(dados.refresh_token);
    await salvarUsuario(dados.usuario);
    return true;
  } catch (_) {
    return false;
  } finally {
    _refreshEmAndamento = false;
  }
}

// _skipRefresh=true: chamada interna que nao tenta refresh em caso de 401 (evita loop)
export async function chamarAPI(caminho, opcoes = {}, _skipRefresh = false) {
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
    const resposta = await _fetchComTimeout(url, {
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

      if (resposta.status === 401 && !caminho.includes('/auth/login') && !_skipRefresh) {
        // Tenta renovar o token silenciosamente antes de deslogar
        const renovado = await _tentarRefreshSilencioso();
        if (renovado) {
          // Retry da requisicao original com o novo token
          return await chamarAPI(caminho, opcoes, true);
        }
        // Refresh falhou: sessao encerrada
        await removerToken();
        if (navRef.isReady()) {
          navRef.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }

      throw erro;
    }

    return dados;
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error('[API]', caminho, err.message);
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

  await salvarToken(dados.access_token);
  await salvarRefreshToken(dados.refresh_token);
  await salvarUsuario(dados.usuario);

  return dados;
}

export async function logout() {
  // Revoga o refresh token no servidor antes de apagar localmente
  const refreshToken = await pegarRefreshToken();
  if (refreshToken) {
    try {
      await chamarAPI('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (_) {
      // Falha no logout remoto nao impede limpeza local
    }
  }
  await removerToken();
}

// Busca perfil do usuario logado diretamente no servidor (fonte autoritativa de papel/permissoes)
export async function buscarPerfilAtual() {
  return await chamarAPI('/api/v1/auth/me');
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

export async function listarSessoes(filtros = {}, page = 1, pageSize = 50) {
  const params = new URLSearchParams({ ...filtros, page, page_size: pageSize }).toString();
  return await chamarAPI(`/api/v1/sessoes?${params}`);
  // Retorna {items, total, pagina, por_pagina, total_paginas}
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

export async function listarDivergencias(sessaoId, page = 1, pageSize = 50, status = null) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (status) params.append('status', status);
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/divergencias?${params}`);
  // Retorna {items, total, pagina, por_pagina, total_paginas}
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

export async function definirCustoDivergencia(divergenciaId, custoUnitario) {
  return await chamarAPI(`/api/v1/divergencias/${divergenciaId}/definir-custo`, {
    method: 'PATCH',
    body: JSON.stringify({ custo_unitario: custoUnitario }),
  });
}

export async function atualizarInfoProduto(produtoId, dados) {
  return await chamarAPI(`/api/v1/produtos/${produtoId}`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
}

export async function listarEdicoesProduto(produtoId) {
  return await chamarAPI(`/api/v1/produtos/${produtoId}/edicoes`);
}

export async function adicionarNotaAdm(sessaoId, nota) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/nota-adm`, {
    method: 'PATCH',
    body: JSON.stringify({ nota }),
  });
}

export async function listarRecontagemNecessaria(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/recontagem-necessaria`);
}

// FASE 5.1: SKUs com divergencia recorrente
export async function buscarSkusProblematicos(ultimasSessoes = 6, top = 10, lojaId = null) {
  const p = new URLSearchParams({ ultimas_sessoes: ultimasSessoes, top });
  if (lojaId) p.append('loja_id', lojaId);
  return await chamarAPI(`/api/v1/dashboard/skus-problematicos?${p}`);
}

// FASE 5.2: Métricas de participação por operador em uma sessão
export async function buscarParticipacaoOperadores(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/participacao-operadores`);
}

// FASE 5.3: Exportar audit log como xlsx
export async function exportarAuditLog({ dataInicio, dataFim, usuarioId, tipoAcao } = {}) {
  const token = await pegarToken();
  const p = new URLSearchParams();
  if (dataInicio) p.append('data_inicio', dataInicio);
  if (dataFim)    p.append('data_fim',    dataFim);
  if (usuarioId)  p.append('usuario_id',  usuarioId);
  if (tipoAcao)   p.append('tipo_acao',   tipoAcao);
  const url = `${API_BASE_URL}/api/v1/audit-log/export${p.toString() ? '?' + p : ''}`;
  const resposta = await _fetchComTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resposta.ok) {
    const texto = await resposta.text();
    let msg = `Erro ${resposta.status}`;
    try { const d = JSON.parse(texto); msg = _extrairMensagem(d?.detail, resposta.status) || msg; } catch (_) {}
    const erro = new Error(msg); erro.status = resposta.status; throw erro;
  }
  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      const cd = resposta.headers.get('content-disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      resolve({ base64, nomeArquivo: match ? match[1] : 'audit_log.xlsx' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// M5: aprova todas as divergencias e conclui a sessao em um unico passo
export async function aprovarInventario(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/aprovar-inventario`, { method: 'POST' });
}

// M6: relatório consolidado — retorna blob Excel de todas as lojas
export async function baixarRelatorioConsolidado({ naturezaId, mesReferencia, mesReferencias, lojaIds } = {}) {
  const token = await pegarToken();
  const params = new URLSearchParams();
  if (naturezaId) params.append('natureza_id', naturezaId);
  if (mesReferencia) params.append('mes_referencia', mesReferencia);
  (mesReferencias || []).forEach(m => params.append('mes_referencias', m));
  (lojaIds || []).forEach(id => params.append('loja_ids', id));

  const url = `${API_BASE_URL}/api/v1/relatorios/consolidado${params.toString() ? '?' + params : ''}`;
  const resposta = await _fetchComTimeout(url, { headers: { Authorization: `Bearer ${token}` } });

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

export async function registrarContagem({ sessaoId, codigoQr, quantidadeContada, rodada = 1, localizacao, confirmarLocalizacao, observacoes }) {
  return await chamarAPI('/api/v1/contagens', {
    method: 'POST',
    body: JSON.stringify({
      sessao_id: sessaoId,
      codigo_qr: codigoQr,
      quantidade_contada: quantidadeContada,
      rodada,
      localizacao: localizacao || null,
      confirmar_localizacao: confirmarLocalizacao || false,
      observacoes: observacoes || null,
    }),
  });
}

// Processa uma rodada: determina pendentes para proxima rodada ou encerra sessao.
// Retorna { pendentes, sessao_encerrada, total_registrados, rodada_processada }
export async function processarRodada(sessaoId, rodada) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/processar-rodada`, {
    method: 'POST',
    body: JSON.stringify({ rodada }),
  });
}

export async function listarContagensDaSessao(sessaoId, page = 1, pageSize = 50) {
  const params = new URLSearchParams({ page, page_size: pageSize }).toString();
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/contagens?${params}`);
}

export async function ajustarContagem(contagemId, { quantidade, justificativa }) {
  return await chamarAPI(`/api/v1/contagens/${contagemId}/ajuste`, {
    method: 'PATCH',
    body: JSON.stringify({ quantidade, justificativa: justificativa || null }),
  });
}

export async function listarAjustesSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/ajustes`);
}

export async function cancelarSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/cancelar`, {
    method: 'PATCH',
  });
}

// Distribuicao de SKUs por natureza para uma loja/mes — usado na criacao de sessao
export async function listarEstoqueNaturezas(lojaId, mesReferencia) {
  return await chamarAPI(
    `/api/v1/sessoes/estoque-naturezas?loja_id=${lojaId}&mes_referencia=${mesReferencia}`
  );
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

export async function atualizarUsuario(usuarioId, { nome, papel, lojaId, lojasIds, ativo, novaSenha }) {
  return await chamarAPI(`/api/v1/usuarios/${usuarioId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      nome,
      papel,
      loja_id: lojaId !== undefined ? (lojaId || '') : undefined,
      lojas_ids: lojasIds !== undefined ? lojasIds : undefined,
      ativo,
      nova_senha: novaSenha || undefined,
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

  try {
    const resposta = await _fetchComTimeout(url, {
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
    if (typeof window !== 'undefined') console.error('[importarPlanilha]', err.message);
    if (err.message === 'Network request failed' || err.message === 'Failed to fetch') {
      const erro = new Error('Sem conexao com o servidor.');
      erro.status = 0;
      throw erro;
    }
    throw err;
  }
}

// Importacao de inventario historico (cria sessao ja concluida)
export async function importarInventarioHistorico({ lojaId, mesReferencia, nomeSessao, naturezaId, arquivo }) {
  const url = `${API_BASE_URL}/api/v1/importacoes/historico`;
  const token = await pegarToken();

  const formData = new FormData();
  formData.append('loja_id', lojaId);
  formData.append('mes_referencia', mesReferencia);
  if (nomeSessao) formData.append('nome_sessao', nomeSessao);
  if (naturezaId) formData.append('natureza_id', naturezaId);

  if (arquivo.file) {
    formData.append('arquivo', arquivo.file, arquivo.name);
  } else {
    formData.append('arquivo', { uri: arquivo.uri, name: arquivo.name, type: arquivo.mimeType || 'application/octet-stream' });
  }

  try {
    const resposta = await _fetchComTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const texto = await resposta.text();
    let dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch (_) {}
    if (!resposta.ok) {
      const erro = new Error(_extrairMensagem(dados?.detail, resposta.status));
      erro.status = resposta.status; throw erro;
    }
    return dados;
  } catch (err) {
    if (typeof window !== 'undefined') console.error('[importarHistorico]', err.message);
    if (err.message === 'Network request failed' || err.message === 'Failed to fetch') {
      const erro = new Error('Sem conexao com o servidor.'); erro.status = 0; throw erro;
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

function _dashParams(naturezaFiltroId, grupoMaterial, lojaIds, mesReferencias) {
  const p = new URLSearchParams();
  if (naturezaFiltroId) p.append('natureza_filtro_id', naturezaFiltroId);
  if (grupoMaterial)    p.append('grupo_material', grupoMaterial);
  (lojaIds      || []).forEach(id => p.append('loja_ids', id));
  (mesReferencias || []).forEach(m  => p.append('mes_referencias', m));
  return p.toString() ? `?${p}` : '';
}

export async function buscarDashboardGeral(naturezaFiltroId, grupoMaterial, lojaIds, mesReferencias) {
  return await chamarAPI(`/api/v1/dashboard${_dashParams(naturezaFiltroId, grupoMaterial, lojaIds, mesReferencias)}`);
}

export async function buscarDashboardLojas(naturezaFiltroId, grupoMaterial, lojaIds, mesReferencias) {
  return await chamarAPI(`/api/v1/dashboard/lojas${_dashParams(naturezaFiltroId, grupoMaterial, lojaIds, mesReferencias)}`);
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
  const token = await pegarToken();

  const params = new URLSearchParams({ formato, perfil });
  if (abas && abas.length > 0) params.append('abas', abas.join(','));

  const url = `${API_BASE_URL}/api/v1/relatorios/sessao/${sessaoId}/exportar?${params}`;

  const resposta = await _fetchComTimeout(url, {
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
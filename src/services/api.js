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
    const resposta = await fetch(url, {
      ...opcoes,
      headers,
    });

    const texto = await resposta.text();
    let dados = null;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch (_) {
      // Servidor retornou texto puro em vez de JSON (ex: proxy/504)
      if (!resposta.ok) {
        const erro = new Error(`Erro ${resposta.status}: resposta inesperada do servidor`);
        erro.status = resposta.status;
        throw erro;
      }
    }

    if (!resposta.ok) {
      const erro = new Error(dados?.detail || `Erro ${resposta.status}`);
      erro.status = resposta.status;
      erro.dados = dados;
      throw erro;
    }

    return dados;
  } catch (err) {
    // Erro de rede (sem internet, timeout)
    if (err.message === 'Network request failed') {
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

export async function criarSessao({ lojaId, nome, tipo, mesReferencia, observacoes }) {
  return await chamarAPI('/api/v1/sessoes', {
    method: 'POST',
    body: JSON.stringify({
      loja_id: lojaId,
      nome,
      tipo,
      mes_referencia: mesReferencia,
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

export async function gerarDivergencias(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/gerar-divergencias`, { method: 'POST' });
}

export async function concluirSessao(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/concluir`, { method: 'POST' });
}

export async function listarDivergencias(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/divergencias`);
}

export async function aprovarDivergencia(divergenciaId) {
  return await chamarAPI(`/api/v1/divergencias/${divergenciaId}/aprovar`, { method: 'PATCH' });
}

export async function rejeitarDivergencia(divergenciaId) {
  return await chamarAPI(`/api/v1/divergencias/${divergenciaId}/rejeitar`, { method: 'PATCH' });
}

export async function listarRecontagemNecessaria(sessaoId) {
  return await chamarAPI(`/api/v1/sessoes/${sessaoId}/recontagem-necessaria`);
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

export async function criarUsuarioAPI({ nome, email, senha, papel, lojaId }) {
  return await chamarAPI('/api/v1/usuarios', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha, papel, loja_id: lojaId || null }),
  });
}

export async function atualizarUsuario(usuarioId, { nome, papel, lojaId, ativo }) {
  return await chamarAPI(`/api/v1/usuarios/${usuarioId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      nome,
      papel,
      loja_id: lojaId !== undefined ? (lojaId || '') : undefined,
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
  formData.append('arquivo', {
    uri: arquivo.uri,
    name: arquivo.name,
    type: arquivo.mimeType || 'application/octet-stream',
  });

  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Content-Type omitido: o fetch define automaticamente com boundary para multipart
      },
      body: formData,
    });

    const texto = await resposta.text();
    const dados = texto ? JSON.parse(texto) : null;

    if (!resposta.ok) {
      const erro = new Error(dados?.detail || `Erro ${resposta.status}`);
      erro.status = resposta.status;
      throw erro;
    }

    return dados;
  } catch (err) {
    if (err.message === 'Network request failed') {
      const erro = new Error('Sem conexao com o servidor. Verifique sua internet.');
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
      mensagem = dados?.detail || mensagem;
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
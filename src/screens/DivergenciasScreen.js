// Tela de divergencias de uma sessao concluida.
// ADM e Gestor podem aprovar ou rejeitar cada divergencia.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  ActivityIndicator, RefreshControl, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarDivergencias, aprovarDivergencia, rejeitarDivergencia, concluirSessao, aprovarInventario, pegarUsuario, buscarPerfilAtual, definirCustoDivergencia, atualizarInfoProduto, ajustarDivergencia } from '../services/api';
import Paginacao from '../components/Paginacao';
import { avisar, confirmar as confirmarAlerta } from '../utils/alertas';

const STATUS_COR = {
  pendente:     { bg: colors.warningSoft, txt: colors.warning },
  aprovada_adm: { bg: colors.infoSoft,    txt: colors.info    },
  aprovada:     { bg: colors.successSoft, txt: colors.success },
  rejeitada:    { bg: colors.dangerSoft,  txt: colors.danger  },
};

const STATUS_ROTULO = {
  pendente:     'PENDENTE',
  aprovada_adm: 'AGUARDANDO GESTOR',
  aprovada:     'APROVADA',
  rejeitada:    'REJEITADA',
};

export default function DivergenciasScreen({ navigation, route }) {
  const { sessao, loja } = route.params;
  // Sessao ja concluida (revisao posterior): botoes de aprovar/concluir nao fazem
  // mais sentido aqui — o backend so aceita essas acoes em 'aguardando_aprovacao'
  // e retornaria erro se chamadas de novo.
  const sessaoConcluida = sessao.status === 'concluida';

  // Acesso a tela: somente ADM e Gestor da loja
  const [papelUsuario, setPapelUsuario] = useState(null);
  const acessoPermitido = papelUsuario === 'admin' || papelUsuario === 'gestor';
  // Papeis leitura-somente nao podem aprovar/rejeitar divergencias (defesa extra —
  // a navegacao ja restringe quem chega nesta tela a ADM/Gestor)
  const isReadOnly = !acessoPermitido;
  // Somente ADM ve quantidades brutas (saldo sistema, contado, diferenca em unidades)
  // Gestor ve apenas impacto financeiro durante aprovacao — diferencas ficam nos relatorios
  const escondeQuantidades = papelUsuario !== 'admin';

  const [divergencias, setDivergencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processando, setProcessando] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  // Modal de custo + info do produto (ADM define antes da aprovacao do gestor)
  const [modalCusto, setModalCusto] = useState(null);
  const [custoInput, setCustoInput] = useState('');
  const [descricaoInput, setDescricaoInput] = useState('');
  const [grupoInput, setGrupoInput] = useState('');
  const [unidadeInput, setUnidadeInput] = useState('');
  const [salvandoCusto, setSalvandoCusto] = useState(false);

  // Modal de ajuste de quantidade pelo ADM (justificativa obrigatoria)
  const [modalAjuste, setModalAjuste] = useState(null);
  const [quantidadeAjusteInput, setQuantidadeAjusteInput] = useState('');
  const [justificativaAjusteInput, setJustificativaAjusteInput] = useState('');
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);

  useEffect(() => {
    async function carregarPapel() {
      let papel = null;
      try {
        let u = await pegarUsuario();
        // Fallback ao servidor se o cache nao tiver o papel
        if (!u?.papel) u = await buscarPerfilAtual();
        papel = u?.papel || null;
      } catch (_) {}
      setPapelUsuario(papel);
      if (papel !== 'admin' && papel !== 'gestor') {
        avisar('Acesso restrito', 'Apenas ADM e Gestor da loja podem acessar as divergencias.');
        navigation.goBack();
        return;
      }
      carregar();
    }
    carregarPapel();
  }, []);

  async function carregar(p = pagina) {
    try {
      const dados = await listarDivergencias(sessao.id, p, PAGE_SIZE);
      setDivergencias(dados.items || []);
      setTotalPaginas(dados.total_paginas || 1);
      setTotal(dados.total || 0);
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel carregar as divergencias');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  async function executarAprovar(div) {
    setProcessando(div.id);
    try {
      const atualizado = await aprovarDivergencia(div.id);
      setDivergencias(prev =>
        prev.map(d => d.id === div.id ? { ...d, ...atualizado } : d)
      );
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel aprovar');
    } finally {
      setProcessando(null);
    }
  }

  async function executarRejeitar(div) {
    setProcessando(div.id);
    try {
      const atualizado = await rejeitarDivergencia(div.id);
      setDivergencias(prev =>
        prev.map(d => d.id === div.id ? { ...d, ...atualizado } : d)
      );
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel rejeitar');
    } finally {
      setProcessando(null);
    }
  }

  function abrirModalCusto(div) {
    setModalCusto(div);
    setCustoInput(div.custo_unitario != null
      ? String(parseFloat(div.custo_unitario).toFixed(2)).replace('.', ',')
      : '');
    setDescricaoInput(div.descricao_produto || '');
    setGrupoInput(div.grupo_material || '');
    setUnidadeInput(div.unidade_medida || 'UN');
  }

  async function salvarCusto() {
    const custo = parseFloat(custoInput.replace(',', '.'));
    if (isNaN(custo) || custo <= 0) {
      avisar('Custo invalido', 'Informe um valor numerico maior que zero.');
      return;
    }
    setSalvandoCusto(true);
    try {
      // Atualiza dados do produto se algum campo foi alterado
      const dadosProduto = {};
      if (descricaoInput.trim() && descricaoInput.trim() !== modalCusto.descricao_produto)
        dadosProduto.descricao = descricaoInput.trim();
      if (grupoInput.trim() && grupoInput.trim() !== modalCusto.grupo_material)
        dadosProduto.grupo_material = grupoInput.trim();
      if (unidadeInput.trim() && unidadeInput.trim() !== modalCusto.unidade_medida)
        dadosProduto.unidade_medida = unidadeInput.trim().toUpperCase();

      if (Object.keys(dadosProduto).length > 0) {
        await atualizarInfoProduto(modalCusto.produto_id, dadosProduto);
      }

      // Define custo unitario na divergencia
      const atualizado = await definirCustoDivergencia(modalCusto.id, custo);
      setDivergencias(prev =>
        prev.map(d => d.id === modalCusto.id
          ? { ...d,
              custo_unitario: atualizado.custo_unitario,
              custo_unitario_definido: true,
              valor_ajuste: atualizado.valor_ajuste,
              descricao_produto: descricaoInput.trim() || d.descricao_produto,
              grupo_material: grupoInput.trim() || d.grupo_material,
              unidade_medida: unidadeInput.trim().toUpperCase() || d.unidade_medida }
          : d
        )
      );
      setModalCusto(null);
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel salvar');
    } finally {
      setSalvandoCusto(false);
    }
  }

  function abrirModalAjuste(div) {
    setModalAjuste(div);
    setQuantidadeAjusteInput(String(parseFloat(div.quantidade_final)).replace('.', ','));
    setJustificativaAjusteInput('');
  }

  async function salvarAjuste() {
    const quantidade = parseFloat(quantidadeAjusteInput.replace(',', '.'));
    if (isNaN(quantidade) || quantidade < 0) {
      avisar('Quantidade invalida', 'Informe uma quantidade numerica valida.');
      return;
    }
    if (justificativaAjusteInput.trim().length < 5) {
      avisar('Justificativa obrigatoria', 'Descreva o motivo do ajuste (minimo 5 caracteres).');
      return;
    }
    setSalvandoAjuste(true);
    try {
      const atualizado = await ajustarDivergencia(modalAjuste.id, quantidade, justificativaAjusteInput.trim());
      setDivergencias(prev =>
        prev.map(d => d.id === modalAjuste.id ? { ...d, ...atualizado } : d)
      );
      setModalAjuste(null);
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel ajustar a quantidade');
    } finally {
      setSalvandoAjuste(false);
    }
  }

  function _fmtAjuste(div) {
    if (!escondeQuantidades) {
      return `${_fmtNum(div.diferenca)} ${div.unidade_medida || ''}`;
    }
    if (div.valor_ajuste != null) {
      const sinal = div.valor_ajuste >= 0 ? '+' : '-';
      const abs = Math.abs(div.valor_ajuste).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${sinal}R$ ${abs}`;
    }
    return 'ajuste';
  }

  function handleAprovar(div) {
    confirmarAlerta(
      'Aprovar divergencia',
      `Aprovar ajuste de ${_fmtAjuste(div)} para "${div.descricao_produto}"?`,
    ).then(ok => { if (ok) executarAprovar(div); });
  }

  function handleRejeitar(div) {
    confirmarAlerta(
      'Rejeitar divergencia',
      `Rejeitar ajuste para "${div.descricao_produto}"? O saldo do sistema sera mantido.`,
    ).then(ok => { if (ok) executarRejeitar(div); });
  }

  function _fmtNum(v) {
    if (v == null) return '—';
    const n = parseFloat(v);
    return (n > 0 ? '+' : '') + n.toFixed(3).replace(/\.?0+$/, '');
  }

  function renderDivergencia({ item: div }) {
    const cores = STATUS_COR[div.status] || STATUS_COR.pendente;
    const emProcessamento = processando === div.id;
    const diferenca = parseFloat(div.diferenca || 0);

    return (
      <View style={estilos.card}>
        {/* Cabecalho do card */}
        <View style={estilos.cardTopo}>
          <View style={estilos.cardTextos}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {div.bloqueado_lote && (
                <Text style={estilos.alertaIcone} accessibilityLabel="Aprovacao individual obrigatoria">
                  ⚠️
                </Text>
              )}
              <Text style={estilos.produto} numberOfLines={2}>{div.descricao_produto || div.sku}</Text>
            </View>
            <Text style={estilos.sku}>{div.sku}</Text>
            {div.bloqueado_lote && (
              <Text style={estilos.motivoBloqueio}>
                {escondeQuantidades ? 'Requer aprovacao individual' : div.motivo_bloqueio}
              </Text>
            )}
          </View>
          <View style={[estilos.badge, { backgroundColor: cores.bg }]}>
            <Text style={[estilos.badgeTexto, { color: cores.txt }]}>
              {STATUS_ROTULO[div.status] || div.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Numeros — admin ve Sistema/Contado/Diferenca; gestor/gerente/auditor veem somente impacto financeiro */}
        {escondeQuantidades ? (
          // Gestor nao ve quantidades, saldos nem contagens — apenas o ajuste financeiro
          <View style={estilos.ajusteFinRow}>
            <Text style={estilos.ajusteFinLabel}>Impacto financeiro</Text>
            <Text style={[estilos.ajusteFinValor, {
              color: div.valor_ajuste == null ? colors.textSecondary
                     : div.valor_ajuste > 0   ? colors.success
                     : div.valor_ajuste < 0   ? colors.danger
                     : colors.text,
            }]}>
              {div.valor_ajuste != null
                ? (div.valor_ajuste >= 0 ? '+' : '-') + 'R$ ' +
                  Math.abs(div.valor_ajuste).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : 'Sem custo cadastrado'}
            </Text>
          </View>
        ) : (
          <View style={estilos.numerosRow}>
            <View style={estilos.numero}>
              <Text style={estilos.numeroValor}>{_fmtNum(div.quantidade_sistema)}</Text>
              <Text style={estilos.numeroLabel}>Sistema</Text>
            </View>
            <View style={estilos.numeroDivisor} />
            <View style={estilos.numero}>
              <Text style={estilos.numeroValor}>{_fmtNum(div.quantidade_final)}</Text>
              <Text style={estilos.numeroLabel}>Contado</Text>
            </View>
            <View style={estilos.numeroDivisor} />
            <View style={estilos.numero}>
              <Text style={[estilos.numeroValor, {
                color: diferenca === 0 ? colors.success : diferenca > 0 ? colors.warning : colors.danger
              }]}>
                {_fmtNum(div.diferenca)}
              </Text>
              <Text style={estilos.numeroLabel}>Diferenca</Text>
            </View>
          </View>
        )}

        {/* Parcelas por localização — apenas ADM ve (evita expor quantidades contadas) */}
        {!escondeQuantidades && div.parcelas && div.parcelas.length > 1 && (
          <View style={estilos.parcelasBox}>
            <Text style={estilos.parcelasTitulo}>Parcelas por localização:</Text>
            <View style={estilos.parcelasLinha}>
              {div.parcelas.map((p, i) => (
                <View key={i} style={estilos.parcelaChip}>
                  {p.localizacao ? (
                    <Text style={estilos.parcelaLocal}>{p.localizacao}</Text>
                  ) : (
                    <Text style={estilos.parcelaLocal}>#{p.numero}</Text>
                  )}
                  <Text style={estilos.parcelaQtd}>
                    {parseFloat(p.quantidade).toFixed(0)}
                    {p.operador ? ` · ${p.operador.split(' ')[0]}` : ''}
                  </Text>
                </View>
              ))}
              <View style={estilos.parcelaSoma}>
                <Text style={estilos.parcelaSomaTxt}>
                  = {parseFloat(div.quantidade_final).toFixed(0)} {div.unidade_medida || ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Alerta do motor (ex: SKU tambem tem saldo em Quarentena). So o ADM:
            o texto traz quantidades e o Gestor aprova as cegas. */}
        {!escondeQuantidades && !!div.observacoes && div.observacoes.startsWith('Atencao') && (
          <View style={estilos.alertaMotorBox}>
            <Text style={estilos.alertaMotorTxt}>⚠️ {div.observacoes}</Text>
          </View>
        )}

        {/* Ajuste de quantidade feito pelo ADM — visivel para ADM e Gestor */}
        {div.quantidade_final_original != null && (
          <View style={estilos.ajusteBox}>
            <Text style={estilos.ajusteTitulo}>Quantidade ajustada pelo ADM</Text>
            {!escondeQuantidades && (
              <Text style={estilos.ajusteValores}>
                {parseFloat(div.quantidade_final_original).toFixed(0)} → {parseFloat(div.quantidade_final).toFixed(0)} {div.unidade_medida || ''}
                {div.ajustado_por_nome ? ` · ${div.ajustado_por_nome}` : ''}
              </Text>
            )}
            {!!div.justificativa_ajuste && (
              <Text style={estilos.ajusteJustificativa}>"{div.justificativa_ajuste}"</Text>
            )}
          </View>
        )}

        {/* Custo unitario — ADM informa, gestor ve antes de aprovar */}
        {['pendente', 'aprovada_adm'].includes(div.status) && (
          <View style={estilos.custoRow}>
            <View style={{ flex: 1 }}>
              {div.custo_unitario_definido ? (
                <Text style={estilos.custoValor}>
                  {'Custo: '}
                  {div.custo_unitario != null
                    ? `R$ ${parseFloat(div.custo_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/${div.unidade_medida || 'UN'}`
                    : 'Definido'}
                </Text>
              ) : (
                <Text style={estilos.custoAusente}>⚠️ Custo nao informado</Text>
              )}
            </View>
            {papelUsuario === 'admin' && (
              <TouchableOpacity
                style={estilos.botaoDefinirCusto}
                onPress={() => abrirModalCusto(div)}
              >
                <Text style={estilos.botaoDefinirCustoTexto}>
                  {div.custo_unitario_definido ? 'Atualizar custo' : 'Informar custo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ADM pode corrigir a quantidade final antes da 1a etapa de aprovacao */}
        {div.status === 'pendente' && papelUsuario === 'admin' && (
          <TouchableOpacity
            style={estilos.botaoAjustarQtd}
            onPress={() => abrirModalAjuste(div)}
          >
            <Text style={estilos.botaoAjustarQtdTexto}>Alterar quantidade (ADM)</Text>
          </TouchableOpacity>
        )}

        {/* Botoes de acao — respeitam a etapa (1a: ADM, 2a: Gestor apos ADM) */}
        {['pendente', 'aprovada_adm'].includes(div.status) && !isReadOnly && (() => {
          const aguardandoAdm = div.status === 'pendente' && papelUsuario !== 'admin';
          const podeAgir = (div.status === 'pendente' && papelUsuario === 'admin')
            || (div.status === 'aprovada_adm' && (papelUsuario === 'admin' || papelUsuario === 'gestor'));

          if (aguardandoAdm) {
            return (
              <View style={estilos.avisoEtapa}>
                <Text style={estilos.avisoEtapaTexto}>Aguardando aprovação do ADM</Text>
              </View>
            );
          }
          if (!podeAgir) return null;

          return (
            <View style={estilos.acoes}>
              {emProcessamento ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <TouchableOpacity
                    style={[estilos.botaoAcao, estilos.botaoAprovar,
                      !div.custo_unitario_definido && estilos.botaoDesabilitado]}
                    onPress={() => {
                      if (!div.custo_unitario_definido) {
                        avisar(
                          'Custo nao informado',
                          papelUsuario === 'admin'
                            ? 'Informe o custo unitario acima antes de aprovar.'
                            : 'O ADM precisa informar o custo unitario antes da aprovacao.',
                        );
                        return;
                      }
                      handleAprovar(div);
                    }}
                  >
                    <Text style={[estilos.botaoAprovarTexto,
                      !div.custo_unitario_definido && estilos.textoDesabilitado]}>
                      {div.status === 'pendente' ? 'Aprovar (ADM)' : 'Aprovar definitivamente'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[estilos.botaoAcao, estilos.botaoRejeitar]}
                    onPress={() => handleRejeitar(div)}
                  >
                    <Text style={estilos.botaoRejeitarTexto}>Rejeitar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })()}
      </View>
    );
  }

  const [concluindo, setConcluindo] = useState(false);
  const [aprovandoTudo, setAprovandoTudo] = useState(false);
  // "Pendentes" = ainda nao resolvidas em nenhuma das duas etapas (ADM ou Gestor)
  const pendentes  = divergencias.filter(d => d.status === 'pendente' || d.status === 'aprovada_adm').length;
  const aprovadas  = divergencias.filter(d => d.status === 'aprovada').length;
  const rejeitadas = divergencias.filter(d => d.status === 'rejeitada').length;

  // Etapa em lote: ADM aprova 'pendente'; Gestor so aprova o que o ADM ja aprovou ('aprovada_adm')
  const statusAlvoLote = papelUsuario === 'admin' ? 'pendente' : 'aprovada_adm';
  const itensDaEtapa = divergencias.filter(d => d.status === statusAlvoLote);
  const bloqueadasLote = itensDaEtapa.filter(d => d.bloqueado_lote);
  const aprovaveisPorLote = itensDaEtapa.filter(d => !d.bloqueado_lote);

  // M5: aprova em lote (somente as que passam nos limites)
  async function handleAprovarTudo() {
    const nBloq = bloqueadasLote.length;
    const nAprov = aprovaveisPorLote.length;
    const limite = divergencias[0]
      ? `R$ ${(divergencias[0].limite_valor_brl || 500).toLocaleString('pt-BR', {minimumFractionDigits:2})} ou ${divergencias[0].limite_diferenca_pct || 10}% de diferença`
      : 'limites configurados';

    const etapaTexto = papelUsuario === 'admin' ? '(1ª etapa — ADM)' : '(2ª etapa — Gestor)';
    let msg = `Aprovar em lote ${etapaTexto} ${nAprov} divergencia(s)?`;
    if (nBloq > 0) {
      msg += `\n\n⚠️ ${nBloq} divergencia(s) NÃO serão incluídas por excederem ${limite}.\nElas exigem aprovação individual.`;
    }
    confirmarAlerta('Aprovar inventario', msg).then(ok => { if (ok) executarAprovarTudo(); });
  }

  async function executarAprovarTudo() {
    setAprovandoTudo(true);
    try {
      const resultado = await aprovarInventario(sessao.id);
      const nAprov = resultado.total_aprovadas || 0;
      const nBloq = resultado.total_bloqueadas || 0;
      if (resultado.sessao_status === 'concluida') {
        avisar('Inventario aprovado!', resultado.mensagem || 'Sessao concluida.');
        // popTo volta a tela de Sessoes existente (navigate empilharia outra no RN7)
        navigation.popTo('Sessoes', { loja, filtroInicial: 'concluidas' });
      } else {
        avisar(
          `${nAprov} aprovada(s) em lote`,
          resultado.mensagem || (nBloq > 0
            ? `${nBloq} divergencia(s) bloqueada(s) requerem aprovação individual.`
            : 'Falta a proxima etapa de aprovacao para concluir a sessao.')
        );
        carregar(pagina); // recarrega para mostrar o estado atual
      }
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel aprovar o inventario');
    } finally {
      setAprovandoTudo(false);
    }
  }

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Carregando divergencias...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      {/* Resumo no topo */}
      <View style={estilos.resumo}>
        <ResumoItem valor={divergencias.length} rotulo="Total"    cor={colors.text} />
        <ResumoItem valor={pendentes}           rotulo="Pendentes" cor={colors.warning} />
        <ResumoItem valor={aprovadas}           rotulo="Aprovadas" cor={colors.success} />
        <ResumoItem valor={rejeitadas}          rotulo="Rejeitadas" cor={colors.danger} />
      </View>

      {/* Totalizador financeiro — visivel somente para gestor/gerente/auditor */}
      {escondeQuantidades && divergencias.length > 0 && (
        <TotalizadorFinanceiro divergencias={divergencias} totalPaginas={totalPaginas} />
      )}

      {/* M5: Botao de aprovacao em lote — ADM aprova 'pendente', Gestor aprova 'aprovada_adm' */}
      {divergencias.length > 0 && itensDaEtapa.length > 0 && !isReadOnly && !sessaoConcluida && (
        <View>
          {bloqueadasLote.length > 0 && (
            <View style={estilos.alertaLote}>
              <Text style={estilos.alertaLoteTxt}>
                ⚠️ {bloqueadasLote.length} divergência{bloqueadasLote.length > 1 ? 's' : ''} marcada{bloqueadasLote.length > 1 ? 's' : ''} com ⚠️ excedem os limites configurados e exigem aprovação individual.
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={estilos.botaoAprovarTudo}
            onPress={handleAprovarTudo}
            disabled={aprovandoTudo}
          >
            {aprovandoTudo
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={estilos.botaoAprovarTudoTexto}>
                  {bloqueadasLote.length > 0
                    ? `Aprovar em lote (${aprovaveisPorLote.length} de ${itensDaEtapa.length})`
                    : papelUsuario === 'admin'
                      ? `Aprovar (ADM) — 1ª etapa (${itensDaEtapa.length})`
                      : `Aprovar (Gestor) — 2ª etapa (${itensDaEtapa.length})`
                  }
                </Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Banner: prontos para concluir (com ou sem divergencias) */}
      {pendentes === 0 && (
        <View style={estilos.bannerProntoParaConcluir}>
          <Text style={estilos.bannerProntoTitulo}>
            {sessaoConcluida
              ? 'Sessao ja concluida'
              : divergencias.length === 0
                ? 'Inventario sem divergencias!'
                : 'Todas as divergencias foram resolvidas!'}
          </Text>
          <Text style={estilos.bannerProntoTexto}>
            {sessaoConcluida
              ? `${aprovadas} aprovada(s) · ${rejeitadas} rejeitada(s) · inventario ja finalizado.`
              : divergencias.length === 0
                ? 'Todos os produtos bateram com o sistema. Clique abaixo para finalizar.'
                : `${aprovadas} aprovada(s) · ${rejeitadas} rejeitada(s) · Clique abaixo para finalizar.`}
          </Text>
        </View>
      )}

      {/* Concluir sessao — aparece quando nao ha pendentes e a sessao ainda nao foi concluida
          (backend so aceita /concluir com status 'aguardando_aprovacao') */}
      {pendentes === 0 && !isReadOnly && !sessaoConcluida && (
        <TouchableOpacity
          style={estilos.botaoConcluir}
          onPress={async () => {
            setConcluindo(true);
            try {
              await concluirSessao(sessao.id);
              avisar('Sessao concluida!', 'O inventario foi finalizado com sucesso.');
              // Volta para Sessoes mostrando diretamente a aba "Concluidas"
              // (popTo: navigate empilharia outra tela de Sessoes no RN7)
              navigation.popTo('Sessoes', { loja, filtroInicial: 'concluidas' });
            } catch (err) {
              avisar('Erro', err.message || 'Nao foi possivel concluir');
            } finally {
              setConcluindo(false);
            }
          }}
          disabled={concluindo}
        >
          {concluindo
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={estilos.botaoConcluirTexto}>Concluir sessao de inventario</Text>
          }
        </TouchableOpacity>
      )}

      {/* Modal de custo unitario — apenas ADM */}
      <Modal
        visible={!!modalCusto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalCusto(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={estilos.modalOverlay}
        >
          <View style={estilos.modalBox}>
            <Text style={estilos.modalTitulo}>Informacoes do produto</Text>
            <Text style={estilos.modalSku}>{modalCusto?.sku}</Text>

            {/* Dados do produto — editaveis pelo ADM */}
            <Text style={estilos.modalSecaoLabel}>DESCRICAO</Text>
            <TextInput
              style={estilos.modalInputTexto}
              value={descricaoInput}
              onChangeText={setDescricaoInput}
              placeholder="Descricao do produto"
              autoCapitalize="words"
            />

            <View style={estilos.modalLinhaDupla}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.modalSecaoLabel}>GRUPO DE MATERIAL</Text>
                <TextInput
                  style={estilos.modalInputTexto}
                  value={grupoInput}
                  onChangeText={setGrupoInput}
                  placeholder="Ex: Chapas MDF"
                  autoCapitalize="words"
                />
              </View>
              <View style={{ width: 80, marginLeft: spacing.sm }}>
                <Text style={estilos.modalSecaoLabel}>UNIDADE</Text>
                <TextInput
                  style={estilos.modalInputTexto}
                  value={unidadeInput}
                  onChangeText={setUnidadeInput}
                  placeholder="UN"
                  autoCapitalize="characters"
                  maxLength={5}
                />
              </View>
            </View>

            {/* Custo para calculo de impacto */}
            <Text style={[estilos.modalSecaoLabel, { marginTop: spacing.sm }]}>CUSTO UNITARIO (R$)</Text>
            <TextInput
              style={estilos.modalInput}
              value={custoInput}
              onChangeText={setCustoInput}
              placeholder="Ex: 25,90"
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <Text style={estilos.modalDica}>Valor por {unidadeInput || modalCusto?.unidade_medida || 'UN'} sem o simbolo R$</Text>
            <View style={estilos.modalAcoes}>
              <TouchableOpacity
                style={[estilos.botaoAcao, estilos.botaoRejeitar, { flex: 1 }]}
                onPress={() => setModalCusto(null)}
              >
                <Text style={estilos.botaoRejeitarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[estilos.botaoAcao, estilos.botaoAprovar, { flex: 1 }]}
                onPress={salvarCusto}
                disabled={salvandoCusto}
              >
                {salvandoCusto
                  ? <ActivityIndicator size="small" color={colors.success} />
                  : <Text style={estilos.botaoAprovarTexto}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de ajuste de quantidade — apenas ADM, justificativa obrigatoria */}
      <Modal
        visible={!!modalAjuste}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAjuste(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={estilos.modalOverlay}
        >
          <View style={estilos.modalBox}>
            <Text style={estilos.modalTitulo}>Alterar quantidade contada</Text>
            <Text style={estilos.modalSku}>{modalAjuste?.descricao_produto || modalAjuste?.sku}</Text>

            <Text style={[estilos.modalSecaoLabel, { marginTop: spacing.sm }]}>QUANTIDADE FINAL</Text>
            <TextInput
              style={estilos.modalInput}
              value={quantidadeAjusteInput}
              onChangeText={setQuantidadeAjusteInput}
              placeholder="Ex: 316"
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <Text style={estilos.modalDica}>
              Valor contado pelos operadores: {modalAjuste ? parseFloat(modalAjuste.quantidade_final).toFixed(0) : ''} {modalAjuste?.unidade_medida || ''}
            </Text>

            <Text style={estilos.modalSecaoLabel}>JUSTIFICATIVA (OBRIGATORIA)</Text>
            <TextInput
              style={[estilos.modalInputTexto, { minHeight: 70, textAlignVertical: 'top' }]}
              value={justificativaAjusteInput}
              onChangeText={setJustificativaAjusteInput}
              placeholder="Ex: pedido em transito confirmado no ERP"
              multiline
            />

            <View style={estilos.modalAcoes}>
              <TouchableOpacity
                style={[estilos.botaoAcao, estilos.botaoRejeitar, { flex: 1 }]}
                onPress={() => setModalAjuste(null)}
              >
                <Text style={estilos.botaoRejeitarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[estilos.botaoAcao, estilos.botaoAprovar, { flex: 1 }]}
                onPress={salvarAjuste}
                disabled={salvandoAjuste}
              >
                {salvandoAjuste
                  ? <ActivityIndicator size="small" color={colors.success} />
                  : <Text style={estilos.botaoAprovarTexto}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={divergencias}
        renderItem={renderDivergencia}
        keyExtractor={item => item.id}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={
          <View style={estilos.vazio}>
            <Text style={estilos.vazioTexto}>Nenhuma divergencia encontrada nesta sessao</Text>
          </View>
        }
        ListFooterComponent={
          <Paginacao
            pagina={pagina}
            totalPaginas={totalPaginas}
            total={total}
            porPagina={PAGE_SIZE}
            onAnterior={() => { const p = pagina - 1; setPagina(p); setCarregando(true); carregar(p); }}
            onProxima={() => { const p = pagina + 1; setPagina(p); setCarregando(true); carregar(p); }}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setPagina(1); setRefreshing(true); carregar(1); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

function ResumoItem({ valor, rotulo, cor }) {
  return (
    <View style={estilos.resumoItem}>
      <Text style={[estilos.resumoValor, { color: cor }]}>{valor}</Text>
      <Text style={estilos.resumoRotulo}>{rotulo}</Text>
    </View>
  );
}

// Totalizador financeiro — somente para gestor/gerente/auditor (escondeQuantidades)
function TotalizadorFinanceiro({ divergencias, totalPaginas }) {
  function calcTotal(itens) {
    return itens.reduce((sum, d) => sum + (parseFloat(d.valor_ajuste) || 0), 0);
  }
  function fmtMoeda(v) {
    if (v === 0) return 'R$ 0,00';
    const sinal = v > 0 ? '+' : '-';
    const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sinal}R$ ${abs}`;
  }
  function corMoeda(v) {
    if (v > 0) return colors.success;
    if (v < 0) return colors.danger;
    return colors.textSecondary;
  }

  // Pendente = qualquer etapa ainda aberta (aguardando ADM ou aguardando Gestor),
  // igual ao contador "Pendentes" do topo da tela
  const pendentes  = divergencias.filter(d => d.status === 'pendente' || d.status === 'aprovada_adm');
  const aprovadas  = divergencias.filter(d => d.status === 'aprovada');
  const rejeitadas = divergencias.filter(d => d.status === 'rejeitada');

  const totalAprov  = calcTotal(aprovadas);
  const totalPend   = calcTotal(pendentes);
  const totalRejeit = calcTotal(rejeitadas);
  const totalGeral  = calcTotal(divergencias);

  return (
    <View style={estTot.container}>
      <View style={estTot.cabecalho}>
        <Text style={estTot.titulo}>Resultado Financeiro</Text>
        {totalPaginas > 1 && (
          <Text style={estTot.aviso}>pagina atual</Text>
        )}
      </View>
      <View style={estTot.linha}>
        <View style={estTot.celula}>
          <Text style={[estTot.valor, { color: corMoeda(totalAprov) }]}>{fmtMoeda(totalAprov)}</Text>
          <Text style={estTot.rotulo}>Aprovado ({aprovadas.length})</Text>
        </View>
        <View style={estTot.divisor} />
        <View style={estTot.celula}>
          <Text style={[estTot.valor, { color: totalPend !== 0 ? colors.warning : colors.textSecondary }]}>{fmtMoeda(totalPend)}</Text>
          <Text style={estTot.rotulo}>Pendente ({pendentes.length})</Text>
        </View>
        <View style={estTot.divisor} />
        <View style={estTot.celula}>
          <Text style={[estTot.valor, { color: colors.textSecondary }]}>{fmtMoeda(totalRejeit)}</Text>
          <Text style={estTot.rotulo}>Rejeitado ({rejeitadas.length})</Text>
        </View>
      </View>
      <View style={estTot.saldoRow}>
        <Text style={estTot.saldoLabel}>Impacto total (todos):</Text>
        <Text style={[estTot.saldoValor, { color: corMoeda(totalGeral) }]}>{fmtMoeda(totalGeral)}</Text>
      </View>
    </View>
  );
}

const estTot = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titulo: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aviso: {
    fontSize: 10,
    color: colors.warning,
    fontStyle: 'italic',
  },
  linha: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  celula: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  divisor: {
    width: 1,
    backgroundColor: colors.border,
  },
  valor: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  rotulo: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  saldoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saldoLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  saldoValor: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});


const estilos = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textoCarregando: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  resumo: {
    flexDirection: 'row', backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  resumoItem:  { flex: 1, alignItems: 'center' },
  resumoValor: { fontSize: fontSize.xl, fontWeight: '700' },
  resumoRotulo: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  lista: { padding: spacing.md },
  card: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTopo:     { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: spacing.sm },
  cardTextos:   { flex: 1, marginRight: spacing.sm },
  produto:      { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  sku:          { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  badge:        { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeTexto:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  numerosRow:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border,
                  paddingTop: spacing.sm, marginBottom: spacing.sm },
  numero:       { flex: 1, alignItems: 'center' },
  numeroDivisor: { width: 1, backgroundColor: colors.border },
  numeroValor:  { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  numeroLabel:  { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  // Bloco de ajuste financeiro (visivel para gestor, gerente, auditor)
  ajusteFinRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.sm, marginBottom: spacing.sm,
  },
  ajusteFinLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  ajusteFinValor: { fontSize: fontSize.lg, fontWeight: '700' },
  // Parcelas por localização
  parcelasBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#0D9488',
  },
  parcelasTitulo: { fontSize: 10, fontWeight: '700', color: '#0D9488', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  parcelasLinha:  { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  parcelaChip: {
    backgroundColor: '#FFFFFF', borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  parcelaLocal: { fontSize: 10, fontWeight: '700', color: '#0F172A' },
  parcelaQtd:   { fontSize: 11, color: '#475569', marginTop: 1 },
  parcelaSoma: {
    backgroundColor: '#0D9488', borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  parcelaSomaTxt: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  // Custo unitario no card
  custoRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.xs, marginBottom: spacing.xs,
  },
  custoValor: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  custoAusente: { fontSize: fontSize.sm, color: colors.warning, fontWeight: '600', flex: 1 },
  botaoDefinirCusto: {
    backgroundColor: '#EFF6FF', borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.primary,
  },
  botaoDefinirCustoTexto: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },
  botaoDesabilitado: { opacity: 0.45 },
  textoDesabilitado: { color: colors.textMuted },

  // Ajuste de quantidade pelo ADM
  alertaMotorBox: {
    backgroundColor: colors.warningSoft, borderLeftWidth: 3, borderLeftColor: colors.warning,
    borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm,
  },
  alertaMotorTxt: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 18 },
  ajusteBox: {
    backgroundColor: colors.infoSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
  },
  ajusteTitulo: { fontSize: 10, fontWeight: '700', color: colors.info, textTransform: 'uppercase', letterSpacing: 0.5 },
  ajusteValores: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600', marginTop: 2 },
  ajusteJustificativa: { fontSize: fontSize.xs, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  botaoAjustarQtd: {
    alignSelf: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.info,
    marginBottom: spacing.sm,
  },
  botaoAjustarQtdTexto: { fontSize: fontSize.xs, fontWeight: '700', color: colors.info },
  // Aviso de etapa (gestor aguardando ADM aprovar primeiro)
  avisoEtapa: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.sm, alignItems: 'center',
  },
  avisoEtapaTexto: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic' },
  // Modal de custo
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.background, borderRadius: radius.lg,
    padding: spacing.lg, width: '100%', maxWidth: 400,
  },
  modalTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: 2 },
  modalSku: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.sm },
  modalSecaoLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  modalInputTexto: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, fontSize: fontSize.sm, color: colors.text,
    marginBottom: spacing.sm,
  },
  modalLinhaDupla: { flexDirection: 'row', alignItems: 'flex-start' },
  modalInput: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm,
    padding: spacing.sm, fontSize: fontSize.xl, color: colors.text,
    textAlign: 'center', marginBottom: spacing.xs,
    fontWeight: '700',
  },
  modalDica: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  modalAcoes: { flexDirection: 'row', gap: spacing.sm },

  acoes:        { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1,
                  borderTopColor: colors.border, paddingTop: spacing.sm },
  botaoAcao:    { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  botaoAprovar: { backgroundColor: colors.successSoft },
  botaoAprovarTexto: { fontSize: fontSize.sm, fontWeight: '700', color: colors.success },
  botaoRejeitar: { backgroundColor: colors.dangerSoft },
  botaoRejeitarTexto: { fontSize: fontSize.sm, fontWeight: '700', color: colors.danger },
  vazio:        { alignItems: 'center', padding: spacing.xl },
  vazioTexto:   { fontSize: fontSize.md, color: colors.textMuted },
  bannerProntoParaConcluir: {
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  bannerProntoTitulo: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 4,
  },
  bannerProntoTexto: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  botaoConcluir: {
    margin: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  botaoConcluirTexto: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
  // Alerta de limite de aprovacao em lote
  alertaLote: {
    marginHorizontal: spacing.md,
    marginBottom: 0,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  alertaLoteTxt: { fontSize: fontSize.sm, color: '#92400E', lineHeight: 18 },
  alertaIcone:   { fontSize: 14 },
  motivoBloqueio:{ fontSize: 10, color: '#D97706', fontWeight: '600', marginTop: 2 },

  // M5: botao de aprovacao em lote
  botaoAprovarTudo: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  botaoAprovarTudoTexto: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
});

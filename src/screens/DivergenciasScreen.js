// Tela de divergencias de uma sessao concluida.
// ADM e Gestor podem aprovar ou rejeitar cada divergencia.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarDivergencias, aprovarDivergencia, rejeitarDivergencia, concluirSessao, aprovarInventario, pegarUsuario, buscarPerfilAtual } from '../services/api';
import Paginacao from '../components/Paginacao';
import { avisar, confirmar as confirmarAlerta } from '../utils/alertas';

const STATUS_COR = {
  pendente:  { bg: colors.warningSoft,  txt: colors.warning },
  aprovada:  { bg: colors.successSoft,  txt: colors.success },
  rejeitada: { bg: colors.dangerSoft,   txt: colors.danger  },
};

export default function DivergenciasScreen({ navigation, route }) {
  const { sessao, loja } = route.params;

  // Papeis leitura-somente nao podem aprovar/rejeitar divergencias
  const [papelUsuario, setPapelUsuario] = useState('gestor');
  const isReadOnly = ['gerente', 'auditor'].includes(papelUsuario);
  // Admin e gestor veem quantidades brutas (saldo sistema, contado, diferenca em unidades)
  const escondeQuantidades = papelUsuario !== 'admin' && papelUsuario !== 'gestor';

  const [divergencias, setDivergencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processando, setProcessando] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    carregar();
    async function carregarPapel() {
      try {
        let u = await pegarUsuario();
        // Fallback ao servidor se o cache nao tiver o papel
        if (!u?.papel) u = await buscarPerfilAtual();
        if (u?.papel) setPapelUsuario(u.papel);
      } catch (_) {}
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
      await aprovarDivergencia(div.id);
      setDivergencias(prev =>
        prev.map(d => d.id === div.id ? { ...d, status: 'aprovada' } : d)
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
      await rejeitarDivergencia(div.id);
      setDivergencias(prev =>
        prev.map(d => d.id === div.id ? { ...d, status: 'rejeitada' } : d)
      );
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel rejeitar');
    } finally {
      setProcessando(null);
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
              {div.status.toUpperCase()}
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

        {/* Botoes de acao apenas para quem pode escrever */}
        {div.status === 'pendente' && !isReadOnly && (
          <View style={estilos.acoes}>
            {emProcessamento ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={[estilos.botaoAcao, estilos.botaoAprovar]}
                  onPress={() => handleAprovar(div)}
                >
                  <Text style={estilos.botaoAprovarTexto}>Aprovar ajuste</Text>
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
        )}
      </View>
    );
  }

  const [concluindo, setConcluindo] = useState(false);
  const [aprovandoTudo, setAprovandoTudo] = useState(false);
  const pendentes  = divergencias.filter(d => d.status === 'pendente').length;
  const aprovadas  = divergencias.filter(d => d.status === 'aprovada').length;
  const rejeitadas = divergencias.filter(d => d.status === 'rejeitada').length;

  // Quantidade de divergencias pendentes bloqueadas do lote (excedem limites)
  const bloqueadasLote = divergencias.filter(d => d.status === 'pendente' && d.bloqueado_lote);
  const aprovaveisPorLote = divergencias.filter(d => d.status === 'pendente' && !d.bloqueado_lote);

  // M5: aprova em lote (somente as que passam nos limites)
  async function handleAprovarTudo() {
    const nBloq = bloqueadasLote.length;
    const nAprov = aprovaveisPorLote.length;
    const limite = divergencias[0]
      ? `R$ ${(divergencias[0].limite_valor_brl || 500).toLocaleString('pt-BR', {minimumFractionDigits:2})} ou ${divergencias[0].limite_diferenca_pct || 10}% de diferença`
      : 'limites configurados';

    let msg = `Aprovar em lote ${nAprov} divergencia(s)?`;
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
      if (nBloq > 0) {
        avisar(
          `${nAprov} aprovada(s) em lote`,
          `${nBloq} divergencia(s) bloqueada(s) requerem aprovação individual.\n\n${resultado.mensagem}`
        );
        carregar(pagina); // recarrega para mostrar as restantes
      } else {
        avisar('Inventario aprovado!', resultado.mensagem || 'Sessao concluida.');
        navigation.navigate('Sessoes', { loja, filtroInicial: 'concluidas' });
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

      {/* M5: Botao de aprovacao em lote — apenas para quem pode escrever */}
      {divergencias.length > 0 && pendentes > 0 && !isReadOnly && (
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
                    ? `Aprovar em lote (${aprovaveisPorLote.length} de ${pendentes})`
                    : `Aprovar todo o inventario (${pendentes} pendente${pendentes > 1 ? 's' : ''})`
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
            {divergencias.length === 0
              ? 'Inventario sem divergencias!'
              : 'Todas as divergencias foram resolvidas!'}
          </Text>
          <Text style={estilos.bannerProntoTexto}>
            {divergencias.length === 0
              ? 'Todos os produtos bateram com o sistema. Clique abaixo para finalizar.'
              : `${aprovadas} aprovada(s) · ${rejeitadas} rejeitada(s) · Clique abaixo para finalizar.`}
          </Text>
        </View>
      )}

      {/* Concluir sessao — aparece quando nao ha pendentes (inclusive sem divergencias) */}
      {pendentes === 0 && (
        <TouchableOpacity
          style={estilos.botaoConcluir}
          onPress={async () => {
            setConcluindo(true);
            try {
              await concluirSessao(sessao.id);
              avisar('Sessao concluida!', 'O inventario foi finalizado com sucesso.');
              // Navega para Sessoes mostrando diretamente a aba "Concluidas"
              navigation.navigate('Sessoes', { loja, filtroInicial: 'concluidas' });
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

  const pendentes  = divergencias.filter(d => d.status === 'pendente');
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

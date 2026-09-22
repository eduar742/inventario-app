// Tela de acuracidade de uma sessao ja concluida (e aprovada).
// Acesso: lider, gestor, auditor e admin — operador nao ve (inventario cego).

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import { buscarResumoSessao } from '../services/api';
import CardsAcuracidadeSessao from '../components/CardsAcuracidadeSessao';
import { avisar } from '../utils/alertas';

export default function AcuracidadeSessaoScreen({ route }) {
  const { sessao } = route.params;

  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarResumoSessao(sessao.id)
      .then(r => setResumo(r))
      .catch(err => avisar('Erro', err.message || 'Nao foi possivel carregar a acuracidade da sessao'))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoCarregando}>Calculando indicadores...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      <ScrollView contentContainerStyle={estilos.scroll}>
        <View style={estilos.cabecalho}>
          <Text style={estilos.nomeSessao}>{resumo?.nome_sessao || sessao.nome}</Text>
          <Text style={estilos.nomeLoja}>{resumo?.nome_loja}</Text>
        </View>

        {resumo ? (
          <CardsAcuracidadeSessao resumo={resumo} />
        ) : (
          <Text style={estilos.vazio}>Nao foi possivel carregar os indicadores desta sessao.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  textoCarregando: { marginTop: spacing.md, fontSize: fontSize.md, color: colors.textSecondary },
  scroll: { padding: spacing.lg },
  cabecalho: { marginBottom: spacing.lg },
  nomeSessao: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  nomeLoja: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  vazio: {
    fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center',
    marginTop: spacing.xl,
  },
});

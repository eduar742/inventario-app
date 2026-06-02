// Barra de filtro por natureza para o dashboard.
// Mostra chips: Todas | Natureza Venda | Natureza Quarentena | ...

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarNaturezas } from '../services/api';

export default function NaturezaFiltro({ value, onChange }) {
  const [naturezas, setNaturezas] = useState([]);

  useEffect(() => {
    listarNaturezas().then(setNaturezas).catch(() => {});
  }, []);

  const opcoes = [
    { id: null, nome: 'Todas' },
    ...naturezas.map(n => ({ id: n.id, nome: n.nome })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.scroll}>
      <View style={estilos.row}>
        {opcoes.map(op => {
          const ativo = value === op.id;
          return (
            <TouchableOpacity
              key={op.id ?? 'todas'}
              style={[estilos.chip, ativo && estilos.chipAtivo]}
              onPress={() => onChange(op.id)}
            >
              <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>
                {op.nome}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTexto: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipTextoAtivo: { color: colors.white },
});

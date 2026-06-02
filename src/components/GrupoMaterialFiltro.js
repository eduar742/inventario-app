// Filtro por grupo de material no dashboard.
// Chips aparecem dinamicamente baseados nos grupos existentes na loja.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';

export default function GrupoMaterialFiltro({ grupos = [], value, onChange }) {
  if (!grupos || grupos.length === 0) return null;

  const opcoes = [
    { id: null, nome: 'Todos os grupos' },
    ...grupos.map(g => ({ id: g, nome: g })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.scroll}>
      <View style={estilos.row}>
        {opcoes.map(op => {
          const ativo = value === op.id;
          return (
            <TouchableOpacity
              key={op.id ?? 'todos'}
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
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipAtivo: {
    backgroundColor: '#7C3AED',  // roxo — diferente do chip de natureza (azul)
    borderColor: '#7C3AED',
  },
  chipTexto: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipTextoAtivo: { color: colors.white },
});

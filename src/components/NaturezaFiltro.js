// Filtro por natureza — multi-select.
// Mostra: Todas | Natureza Venda | Natureza Quarentena
// Normaliza nomes: prefixo "Natureza " em entradas sem ele; remove duplicatas.

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarNaturezas } from '../services/api';

export default function NaturezaFiltro({ value = [], onChange }) {
  const [naturezas, setNaturezas] = useState([]);

  useEffect(() => {
    listarNaturezas().then(setNaturezas).catch(() => {});
  }, []);

  // Normaliza: prefixo "Natureza " se ausente; remove duplicatas pelo nome normalizado
  const opcoes = naturezas
    .map(n => ({
      id:   n.id,
      nome: n.nome.startsWith('Natureza ') ? n.nome : `Natureza ${n.nome}`,
    }))
    .filter((n, i, arr) => arr.findIndex(x => x.nome === n.nome) === i);

  const tudoSelecionado = value.length === 0;

  function toggle(id) {
    if (value.includes(id)) {
      onChange(value.filter(x => x !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.scroll}>
      <View style={estilos.row}>
        <TouchableOpacity
          style={[estilos.chip, tudoSelecionado && estilos.chipAtivo]}
          onPress={() => onChange([])}
        >
          <Text style={[estilos.chipTexto, tudoSelecionado && estilos.chipTextoAtivo]}>
            Todas
          </Text>
        </TouchableOpacity>
        {opcoes.map(op => {
          const ativo = value.includes(op.id);
          return (
            <TouchableOpacity
              key={op.id}
              style={[estilos.chip, ativo && estilos.chipAtivo]}
              onPress={() => toggle(op.id)}
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
  scroll:         { flexGrow: 0 },
  row:            { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip:           { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipAtivo:      { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTexto:      { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipTextoAtivo: { color: colors.white },
});

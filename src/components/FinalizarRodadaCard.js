// Controle das rodadas pelo Lider/Gestor/ADM: finaliza a rodada aberta e
// inicia a proxima (1a -> 2a -> 3a -> encerra a sessao). Itens sem contagem
// na rodada recebem 0 ("nao encontrado") — ex: item na planilha que nao
// existe no fisico, que antes travava a sessao em "Itens que faltou bipar".
// Usado em "Itens pendentes" e no Resumo do Scanner.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import Button from './Button';
import { finalizarRodada } from '../services/api';
import { avisar, confirmar as confirmarAlerta } from '../utils/alertas';

const ORDINAL = { 1: '1ª', 2: '2ª', 3: '3ª' };

export default function FinalizarRodadaCard({ sessaoId, rodadaAtual, itensSemContagem = 0, onFinalizado }) {
  const [finalizando, setFinalizando] = useState(false);
  const rodada = rodadaAtual || 1;
  const ultima = rodada >= 3;

  const titulo = ultima
    ? 'Finalizar 3ª contagem e encerrar'
    : `Finalizar ${ORDINAL[rodada]} contagem e iniciar a ${ORDINAL[rodada + 1]}`;

  async function handleFinalizar() {
    const aviso = itensSemContagem > 0
      ? `${itensSemContagem} item(ns) sem contagem nesta rodada serao registrados como 0 (nao encontrado).\n\n`
      : '';
    const efeito = ultima
      ? 'A sessao sera encerrada e as divergencias seguem para aprovacao do ADM e do gestor.'
      : `A ${ORDINAL[rodada]} contagem fecha (ninguem mais bipa nela) e a ${ORDINAL[rodada + 1]} comeca. ` +
        'Se nao sobrar nada para recontar, a sessao ja e encerrada.';
    const ok = await confirmarAlerta(`Finalizar ${ORDINAL[rodada]} contagem`, `${aviso}${efeito}\n\nContinuar?`);
    if (!ok) return;

    setFinalizando(true);
    try {
      const r = await finalizarRodada(sessaoId);
      const zerados = r.itens_zerados ? `\n${r.itens_zerados} item(ns) registrados como 0 (nao encontrado).` : '';
      if (r.sessao_encerrada) {
        avisar('Sessao encerrada', `Contagens finalizadas e enviadas para aprovacao.${zerados}`);
      } else {
        avisar(
          `${ORDINAL[r.proxima_rodada]} contagem iniciada`,
          `${r.itens_proxima_rodada} item(ns) para a ${ORDINAL[r.proxima_rodada]} contagem.${zerados}`
        );
      }
      onFinalizado?.(r);
    } catch (err) {
      avisar('Nao foi possivel finalizar', err.message || 'Tente novamente.');
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <View style={estilos.card}>
      <Text style={estilos.rotulo}>Controle da contagem</Text>
      <Text style={estilos.texto}>
        {ORDINAL[rodada]} contagem em andamento.
        {itensSemContagem > 0
          ? ` ${itensSemContagem} item(ns) ainda sem contagem nesta rodada. Se nao ha mais nada para bipar, pode finalizar: eles entram como 0 (nao encontrado).`
          : ' Todos os itens desta rodada ja foram contados.'}
      </Text>
      <Button
        titulo={finalizando ? 'Finalizando...' : titulo}
        carregando={finalizando}
        onPress={handleFinalizar}
      />
      <Text style={estilos.dica}>
        Todos os operadores precisam ter saido do Scanner.
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  rotulo: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  texto: { fontSize: fontSize.sm, color: colors.text },
  dica: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
});

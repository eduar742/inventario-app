// Tela de selecao de loja.
// Carrega as lojas da API e mostra em lista horizontal bem formatada.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { listarLojas, pegarUsuario, logout } from '../services/api';

export default function LojasScreen({ navigation }) {
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      const u = await pegarUsuario();
      setUsuario(u);
      const dados = await listarLojas();
      setLojas(dados.filter(l => l.ativa));
    } catch (err) {
      Alert.alert('Erro', err.message || 'Nao foi possivel carregar as lojas');
    } finally {
      setCarregando(false);
    }
  }

  function selecionarLoja(loja) {
    navigation.navigate('Sessoes', { loja });
  }

  async function fazerLogout() {
    Alert.alert(
      'Sair',
      'Deseja realmente sair do app?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  }

  // Extrai o numero da loja para o badge (ex: "L01" -> "01", "L12" -> "12")
  function numeroDaLoja(codigo) {
    return codigo.replace(/\D/g, '') || codigo;
  }

  // Extrai o nome curto (tudo apos " - " ou o nome completo)
  function nomeCurto(nome) {
    const partes = nome.split(' - ');
    return partes.length > 1 ? partes.slice(1).join(' - ') : nome;
  }

  function renderLoja({ item }) {
    const numero = numeroDaLoja(item.codigo);
    const titulo = nomeCurto(item.nome);
    const cidade = item.cidade || '';

    return (
      <TouchableOpacity
        style={estilos.card}
        onPress={() => selecionarLoja(item)}
        activeOpacity={0.75}
      >
        {/* Badge azul com codigo e numero */}
        <View style={estilos.badge}>
          <Text style={estilos.badgeCodigo}>{item.codigo}</Text>
          <Text style={estilos.badgeNumero}>{numero}</Text>
        </View>

        {/* Info da loja — flex:1 garante uso do espaco restante */}
        <View style={estilos.info}>
          <Text style={estilos.titulo} numberOfLines={1} ellipsizeMode="tail">
            {titulo}
          </Text>
          {cidade ? (
            <Text style={estilos.subtitulo} numberOfLines={1} ellipsizeMode="tail">
              {cidade}
            </Text>
          ) : null}
        </View>

        {/* Seta de navegacao */}
        <Text style={estilos.seta}>›</Text>
      </TouchableOpacity>
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={estilos.containerLoading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={estilos.textoLoading}>Carregando lojas...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.container}>
      {/* Cabecalho com saudacao */}
      {usuario && (
        <View style={estilos.cabecalho}>
          <View>
            <Text style={estilos.saudacao}>Ola,</Text>
            <Text style={estilos.nomeUsuario} numberOfLines={1}>{usuario.nome}</Text>
          </View>
            {usuario?.papel === 'admin' && (
            <>
              <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={estilos.botaoDashboard}>
                <Text style={estilos.textoDashboard}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Gestores')} style={estilos.botaoGestores}>
                <Text style={estilos.textoGestores}>Usuarios</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={fazerLogout} style={estilos.botaoSair}>
            <Text style={estilos.textoSair}>Sair</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Titulo da lista */}
      <View style={estilos.tituloSecao}>
        <Text style={estilos.tituloLista}>
          {lojas.length} {lojas.length === 1 ? 'loja disponivel' : 'lojas disponiveis'}
        </Text>
        <Text style={estilos.subtituloLista}>
          Toque na loja onde voce vai trabalhar
        </Text>
      </View>

      <FlatList
        data={lojas}
        renderItem={renderLoja}
        keyExtractor={item => item.id}
        contentContainerStyle={estilos.lista}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  containerLoading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoLoading: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },

  // Cabecalho
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  saudacao: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  nomeUsuario: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    maxWidth: 220,
  },
  botaoSair: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  botaoDashboard: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
    marginRight: spacing.xs,
  },
  textoDashboard: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '600',
  },
  botaoGestores: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    marginRight: spacing.xs,
  },
  textoGestores: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  textoSair: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: '600',
  },

  // Titulo da secao
  tituloSecao: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tituloLista: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  subtituloLista: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  lista: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },

  // Card da loja
  card: {
    flexDirection: 'row',      // tudo em linha horizontal
    alignItems: 'center',      // alinha verticalmente ao centro
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },

  // Badge azul (codigo + numero)
  badge: {
    width: 52,
    height: 52,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,             // nao encolhe mesmo com nome longo
  },
  badgeCodigo: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  badgeNumero: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 22,
  },

  // Info textual (flex:1 ocupa o espaco disponivel)
  info: {
    flex: 1,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  titulo: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Seta
  seta: {
    fontSize: 24,
    color: colors.textMuted,
    flexShrink: 0,
  },
});

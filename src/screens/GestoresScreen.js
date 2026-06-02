// Tela de gerenciamento de usuarios. Apenas ADM.
// Permite listar, criar e editar gestores/operadores com suas lojas.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView, Modal, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { avisar, confirmar } from '../utils/alertas';
import Button from '../components/Button';
import Input from '../components/Input';
import { listarUsuarios, criarUsuarioAPI, atualizarUsuario, listarLojas } from '../services/api';


// Papeis disponiveis para criacao/edicao (ADM nao pode ser criado pelo gestor)
const PAPEIS = ['gestor', 'gerente', 'auditor', 'operador'];
const COR_PAPEL = {
  admin:    { bg: colors.dangerSoft,   txt: colors.danger },
  gestor:   { bg: colors.primarySoft,  txt: colors.primary },
  gerente:  { bg: '#CFFAFE',           txt: '#0891B2' },
  auditor:  { bg: '#EDE9FE',           txt: '#7C3AED' },
  operador: { bg: colors.successSoft,  txt: colors.success },
};

export default function GestoresScreen({ navigation }) {
  const [usuarios, setUsuarios] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [editando, setEditando] = useState(null); // usuario sendo editado ou null (novo)
  const [salvando, setSalvando] = useState(false);

  // Campos do formulario
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState('operador');
  const [lojaId, setLojaId] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [expandirLojas, setExpandirLojas] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    try {
      const [us, ls] = await Promise.all([listarUsuarios(), listarLojas()]);
      setUsuarios(us);
      setLojas(ls.filter(l => l.ativa));
    } catch (err) {
      avisar('Erro', err.message || 'Nao foi possivel carregar');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }

  function abrirNovo() {
    setEditando(null);
    setNome(''); setEmail(''); setSenha(''); setPapel('operador');
    setLojaId(''); setAtivo(true); setExpandirLojas(false);
    setModalVisivel(true);
  }

  function abrirEdicao(u) {
    setEditando(u);
    setNome(u.nome); setEmail(u.email); setSenha(''); setPapel(u.papel);
    setLojaId(u.loja_id || ''); setAtivo(u.ativo); setExpandirLojas(false);
    setModalVisivel(true);
  }

  async function handleSalvar() {
    if (!nome.trim()) { avisar('Atencao', 'Informe o nome'); return; }
    if (!editando && !email.trim()) { avisar('Atencao', 'Informe o email'); return; }
    if (!editando && !senha.trim()) { avisar('Atencao', 'Informe a senha'); return; }

    setSalvando(true);
    try {
      if (editando) {
        await atualizarUsuario(editando.id, {
          nome: nome.trim(),
          papel,
          lojaId: lojaId || null,
          ativo,
        });
      } else {
        await criarUsuarioAPI({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          papel,
          lojaId: lojaId || null,
        });
      }
      setModalVisivel(false);
      await carregar();
    } catch (err) {
      avisar('Erro ao salvar', err.message || 'Tente novamente');
    } finally {
      setSalvando(false);
    }
  }

  function nomeLojaById(id) {
    const l = lojas.find(lj => lj.id === id);
    return l ? `${l.codigo} — ${l.nome}` : 'Sem loja';
  }

  function renderUsuario({ item }) {
    const cor = COR_PAPEL[item.papel] || COR_PAPEL.operador;
    return (
      <TouchableOpacity style={estilos.card} onPress={() => abrirEdicao(item)} activeOpacity={0.7}>
        <View style={estilos.cardTopo}>
          <View style={{ flex: 1 }}>
            <Text style={[estilos.nomeUsuario, !item.ativo && { color: colors.textMuted }]}>
              {item.nome} {!item.ativo ? '(inativo)' : ''}
            </Text>
            <Text style={estilos.emailUsuario}>{item.email}</Text>
            {item.codigo_loja && (
              <Text style={estilos.lojaUsuario}>{item.codigo_loja} — {item.nome_loja}</Text>
            )}
          </View>
          <View style={[estilos.badge, { backgroundColor: cor.bg }]}>
            <Text style={[estilos.badgeTexto, { color: cor.txt }]}>{item.papel.toUpperCase()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={estilos.centro}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const lojaAtual = lojas.find(l => l.id === lojaId);

  return (
    <SafeAreaView style={estilos.container}>
      <FlatList
        data={usuarios}
        renderItem={renderUsuario}
        keyExtractor={u => u.id}
        contentContainerStyle={estilos.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={[colors.primary]} tintColor={colors.primary} />}
        ListHeaderComponent={
          <TouchableOpacity style={estilos.botaoNovo} onPress={abrirNovo}>
            <Text style={estilos.botaoNovoTexto}>+ Novo usuario</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <Text style={estilos.vazio}>Nenhum usuario encontrado</Text>
        }
      />

      {/* Modal criar/editar */}
      <Modal visible={modalVisivel} animationType="slide" transparent onRequestClose={() => !salvando && setModalVisivel(false)}>
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContainer}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={estilos.modalTitulo}>
                {editando ? 'Editar usuario' : 'Novo usuario'}
              </Text>

              <Text style={estilos.rotulo}>Nome *</Text>
              <TextInput style={estilos.input} value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor={colors.textMuted} />

              {!editando && (
                <>
                  <Text style={estilos.rotulo}>Email *</Text>
                  <TextInput style={estilos.input} value={email} onChangeText={setEmail} placeholder="email@empresa.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
                  <Text style={estilos.rotulo}>Senha *</Text>
                  <TextInput style={estilos.input} value={senha} onChangeText={setSenha} placeholder="Minimo 8 caracteres" placeholderTextColor={colors.textMuted} secureTextEntry />
                </>
              )}

              <Text style={estilos.rotulo}>Papel</Text>
              <View style={estilos.papelRow}>
                {PAPEIS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[estilos.chipPapel, papel === p && estilos.chipPapelAtivo]}
                    onPress={() => setPapel(p)}
                  >
                    <Text style={[estilos.chipPapelTexto, papel === p && estilos.chipPapelTextoAtivo]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={estilos.rotulo}>Loja</Text>
              <TouchableOpacity style={estilos.seletor} onPress={() => setExpandirLojas(!expandirLojas)}>
                <Text style={lojaId ? estilos.seletorTexto : estilos.seletorPlaceholder}>
                  {lojaId ? nomeLojaById(lojaId) : 'Sem loja associada (ADM/sem restricao)'}
                </Text>
                <Text style={{ color: colors.textMuted }}>{expandirLojas ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {expandirLojas && (
                <View style={estilos.dropdown}>
                  <TouchableOpacity style={estilos.dropdownItem} onPress={() => { setLojaId(''); setExpandirLojas(false); }}>
                    <Text style={estilos.dropdownTexto}>— Nenhuma loja —</Text>
                  </TouchableOpacity>
                  {lojas.map(l => (
                    <TouchableOpacity key={l.id} style={[estilos.dropdownItem, lojaId === l.id && estilos.dropdownItemAtivo]} onPress={() => { setLojaId(l.id); setExpandirLojas(false); }}>
                      <Text style={[estilos.dropdownTexto, lojaId === l.id && { color: colors.primary, fontWeight: '600' }]}>
                        {l.codigo} — {l.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {editando && (
                <>
                  <View style={{ height: spacing.sm }} />
                  <TouchableOpacity style={estilos.toggleAtivo} onPress={() => setAtivo(v => !v)}>
                    <View style={[estilos.checkbox, ativo && estilos.checkboxAtivo]}>
                      {ativo && <Text style={estilos.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={estilos.toggleTexto}>Usuario ativo</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ height: spacing.lg }} />
              <Button titulo="Salvar" onPress={handleSalvar} carregando={salvando} desabilitado={salvando} />
              <View style={{ height: spacing.sm }} />
              <Button titulo="Cancelar" variante="secondary" onPress={() => setModalVisivel(false)} desabilitado={salvando} />
              <View style={{ height: spacing.lg }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centro:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista:     { padding: spacing.md },
  botaoNovo: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  botaoNovoTexto: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
  card: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTopo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  nomeUsuario: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  emailUsuario: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  lojaUsuario: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeTexto: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  vazio: { textAlign: 'center', color: colors.textMuted, padding: spacing.xl },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, maxHeight: '90%' },
  modalTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  rotulo: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  papelRow: { flexDirection: 'row', gap: spacing.sm },
  chipPapel: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  chipPapelAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPapelTexto: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipPapelTextoAtivo: { color: colors.white },
  seletor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  seletorTexto: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  seletorPlaceholder: { fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  dropdown: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, maxHeight: 180 },
  dropdownItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownItemAtivo: { backgroundColor: colors.primarySoft },
  dropdownTexto: { fontSize: fontSize.sm, color: colors.text },
  toggleAtivo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { color: colors.white, fontWeight: '700', fontSize: 13 },
  toggleTexto: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
});

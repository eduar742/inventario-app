// Tela de gerenciamento de usuarios. Apenas ADM.
// Permite listar, criar e editar usuarios com vinculacao de multiplas lojas.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView, Modal, ScrollView,
  TouchableOpacity, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';

import { colors, spacing, fontSize, radius } from '../theme/colors';
import { avisar } from '../utils/alertas';
import Button from '../components/Button';
import { listarUsuarios, criarUsuarioAPI, atualizarUsuario, listarLojas } from '../services/api';


// Papeis disponiveis para criacao/edicao
const PAPEIS = ['gestor', 'gerente', 'auditor', 'operador'];
const COR_PAPEL = {
  admin:    { bg: colors.dangerSoft,   txt: colors.danger },
  gestor:   { bg: colors.primarySoft,  txt: colors.primary },
  gerente:  { bg: '#CFFAFE',           txt: '#0891B2' },
  auditor:  { bg: '#EDE9FE',           txt: '#7C3AED' },
  operador: { bg: colors.successSoft,  txt: colors.success },
};

// Papeis que tem acesso irrestrito de loja (ou selecionam para visibilidade)
const PAPEIS_MULTI = ['gerente', 'auditor', 'gestor'];

export default function GestoresScreen({ navigation }) {
  const [usuarios, setUsuarios] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [modalLojas, setModalLojas] = useState(false); // modal de selecao de lojas
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Campos do formulario
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState('operador');
  const [lojasSelecionadas, setLojasSelecionadas] = useState([]);
  const [ativo, setAtivo] = useState(true);
  const [novaSenha, setNovaSenha] = useState('');          // redefinicao de senha (edicao)
  const [mostrarSenha, setMostrarSenha] = useState(false); // toggle visibilidade

  useEffect(() => { carregar(); }, []);

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
    setLojasSelecionadas([]); setAtivo(true);
    setNovaSenha(''); setMostrarSenha(false);
    setModalVisivel(true);
  }

  function abrirEdicao(u) {
    setEditando(u);
    setNome(u.nome); setEmail(u.email); setSenha(''); setPapel(u.papel);
    setLojasSelecionadas(u.lojas_ids || (u.loja_id ? [u.loja_id] : []));
    setAtivo(u.ativo);
    setNovaSenha(''); setMostrarSenha(false);
    setModalVisivel(true);
  }

  async function handleSalvar() {
    if (!nome.trim()) { avisar('Atencao', 'Informe o nome'); return; }
    if (!editando && !email.trim()) { avisar('Atencao', 'Informe o email'); return; }
    if (!editando && !senha.trim()) { avisar('Atencao', 'Informe a senha'); return; }

    setSalvando(true);
    try {
      const payload = {
        nome: nome.trim(),
        papel,
        lojaId: lojasSelecionadas[0] || null,
        lojasIds: lojasSelecionadas.length > 0 ? lojasSelecionadas : [],
        ativo,
        novaSenha: novaSenha.trim() || undefined,
      };
      if (editando) {
        await atualizarUsuario(editando.id, payload);
      } else {
        await criarUsuarioAPI({ ...payload, email: email.trim().toLowerCase(), senha });
      }
      setModalVisivel(false);
      await carregar();
    } catch (err) {
      avisar('Erro ao salvar', err.message || 'Tente novamente');
    } finally {
      setSalvando(false);
    }
  }

  // ── Seletor de lojas ───────────────────────────────────────────────
  function toggleLoja(id) {
    setLojasSelecionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function selecionarTodas() {
    setLojasSelecionadas(lojas.map(l => l.id));
  }

  function limparTodas() {
    setLojasSelecionadas([]);
  }

  function labelLojas() {
    if (lojasSelecionadas.length === 0) return 'Nenhuma loja selecionada';
    if (lojasSelecionadas.length === lojas.length) return `Todas as lojas (${lojas.length})`;
    const codigos = lojasSelecionadas
      .map(id => lojas.find(l => l.id === id)?.codigo || '')
      .filter(Boolean)
      .join(', ');
    return `${lojasSelecionadas.length} loja(s): ${codigos}`;
  }

  // ── Card de usuario ────────────────────────────────────────────────
  function renderUsuario({ item }) {
    const cor = COR_PAPEL[item.papel] || COR_PAPEL.operador;
    const ids = item.lojas_ids || (item.loja_id ? [item.loja_id] : []);
    const codigos = ids.map(id => lojas.find(l => l.id === id)?.codigo || '').filter(Boolean).join(', ');
    return (
      <TouchableOpacity style={estilos.card} onPress={() => abrirEdicao(item)} activeOpacity={0.7}>
        <View style={estilos.cardTopo}>
          <View style={{ flex: 1 }}>
            <Text style={[estilos.nomeUsuario, !item.ativo && { color: colors.textMuted }]}>
              {item.nome} {!item.ativo ? '(inativo)' : ''}
            </Text>
            <Text style={estilos.emailUsuario}>{item.email}</Text>
            {codigos ? (
              <Text style={estilos.lojaUsuario}>
                {ids.length > 1 ? `${ids.length} lojas: ` : ''}{codigos}
              </Text>
            ) : null}
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
        ListEmptyComponent={<Text style={estilos.vazio}>Nenhum usuario encontrado</Text>}
      />

      {/* ── Modal criar/editar usuario ─────────────────────────────── */}
      <Modal visible={modalVisivel} animationType="slide" transparent onRequestClose={() => !salvando && setModalVisivel(false)}>
        <View style={estilos.modalOverlay}>
          <View style={estilos.modalContainer}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={estilos.modalTitulo}>{editando ? 'Editar usuario' : 'Novo usuario'}</Text>

              {/* Nome */}
              <Text style={estilos.rotulo}>Nome *</Text>
              <TextInput style={estilos.input} value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor={colors.textMuted} />

              {/* Email + Senha (apenas criacao) */}
              {!editando && (
                <>
                  <Text style={estilos.rotulo}>Email *</Text>
                  <TextInput style={estilos.input} value={email} onChangeText={setEmail} placeholder="email@empresa.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
                  <Text style={estilos.rotulo}>Senha *</Text>
                  <TextInput style={estilos.input} value={senha} onChangeText={setSenha} placeholder="Minimo 10 caracteres, mai/min/num/especial" placeholderTextColor={colors.textMuted} secureTextEntry />
                </>
              )}

              {/* Papel */}
              <Text style={estilos.rotulo}>Papel</Text>
              <View style={estilos.papelGrid}>
                {PAPEIS.map(p => {
                  const cor = COR_PAPEL[p] || COR_PAPEL.operador;
                  const ativo2 = papel === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[estilos.chipPapel, ativo2 && { backgroundColor: cor.bg, borderColor: cor.txt }]}
                      onPress={() => setPapel(p)}
                    >
                      <Text style={[estilos.chipPapelTexto, ativo2 && { color: cor.txt, fontWeight: '700' }]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Vinculo de lojas */}
              <Text style={estilos.rotulo}>Lojas vinculadas</Text>
              <Text style={estilos.rotuloSub}>
                {papel === 'operador'
                  ? 'Lojas onde o operador pode realizar inventario'
                  : papel === 'gerente' || papel === 'auditor'
                    ? 'Lojas visíveis (deixe vazio para ver todas)'
                    : 'Lojas de responsabilidade do gestor'}
              </Text>

              {/* Botao de abrir seletor */}
              <TouchableOpacity style={estilos.seletorLojas} onPress={() => setModalLojas(true)}>
                <Text style={[estilos.seletorLojasTxt, lojasSelecionadas.length === 0 && { color: colors.textMuted }]} numberOfLines={2}>
                  {labelLojas()}
                </Text>
                <Text style={estilos.seletorChevron}>›</Text>
              </TouchableOpacity>

              {/* Redefinir senha (edicao) */}
              {editando && (
                <>
                  <Text style={estilos.rotulo}>Redefinir senha (opcional)</Text>
                  <View style={estilos.senhaRow}>
                    <TextInput
                      style={[estilos.input, { flex: 1 }]}
                      value={novaSenha}
                      onChangeText={setNovaSenha}
                      placeholder="Nova senha (deixe vazio para manter)"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!mostrarSenha}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={estilos.botaoMostrar}
                      onPress={() => setMostrarSenha(v => !v)}
                    >
                      <Text style={estilos.botaoMostrarTxt}>{mostrarSenha ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={estilos.senhaAtual}>
                    Deixe em branco para manter a senha atual do usuário.
                  </Text>
                </>
              )}

              {/* Ativo */}
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

      {/* ── Modal de selecao de lojas ─────────────────────────────── */}
      <Modal visible={modalLojas} animationType="slide" transparent onRequestClose={() => setModalLojas(false)}>
        <View style={estilos.modalOverlay}>
          <View style={[estilos.modalContainer, { maxHeight: '85%' }]}>
            {/* Header do seletor */}
            <View style={estilos.seletorHeader}>
              <Text style={estilos.seletorTitulo}>Selecionar Lojas</Text>
              <Text style={estilos.seletorContador}>
                {lojasSelecionadas.length} de {lojas.length} selecionada(s)
              </Text>
            </View>

            {/* Botoes rapidos */}
            <View style={estilos.seletorAcoes}>
              <TouchableOpacity
                style={[estilos.botaoAcaoSeletor, { backgroundColor: colors.primarySoft }]}
                onPress={selecionarTodas}
              >
                <Text style={[estilos.botaoAcaoSeletorTxt, { color: colors.primary }]}>
                  Selecionar todas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[estilos.botaoAcaoSeletor, { backgroundColor: colors.backgroundSoft }]}
                onPress={limparTodas}
              >
                <Text style={[estilos.botaoAcaoSeletorTxt, { color: colors.textSecondary }]}>
                  Limpar tudo
                </Text>
              </TouchableOpacity>
            </View>

            {/* Lista de lojas com checkboxes */}
            <ScrollView style={estilos.listaLojas} showsVerticalScrollIndicator>
              {lojas.map((loja, idx) => {
                const sel = lojasSelecionadas.includes(loja.id);
                return (
                  <TouchableOpacity
                    key={loja.id}
                    style={[
                      estilos.lojaItem,
                      sel && estilos.lojaItemSelecionado,
                      idx % 2 === 0 && !sel && { backgroundColor: '#F8FAFC' },
                    ]}
                    onPress={() => toggleLoja(loja.id)}
                    activeOpacity={0.7}
                  >
                    {/* Checkbox */}
                    <View style={[estilos.checkboxLoja, sel && estilos.checkboxLojaAtivo]}>
                      {sel && <Text style={estilos.checkboxLojaTick}>✓</Text>}
                    </View>
                    {/* Info da loja */}
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={[estilos.lojaItemCodigo, sel && { color: colors.primary }]}>
                        {loja.codigo}
                      </Text>
                      <Text style={estilos.lojaItemNome} numberOfLines={1}>{loja.nome}</Text>
                      {loja.cidade ? <Text style={estilos.lojaItemCidade}>{loja.cidade}</Text> : null}
                    </View>
                    {sel && <Text style={estilos.lojaItemCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Confirmar */}
            <View style={estilos.seletorRodape}>
              <Button titulo={`Confirmar (${lojasSelecionadas.length} selecionada${lojasSelecionadas.length !== 1 ? 's' : ''})`} onPress={() => setModalLojas(false)} />
            </View>
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
  lojaUsuario: { fontSize: fontSize.xs, color: colors.primary, marginTop: 2, fontWeight: '500' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeTexto: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  vazio: { textAlign: 'center', color: colors.textMuted, padding: spacing.xl },

  // Modal principal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, maxHeight: '92%' },
  modalTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  rotulo: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs, marginTop: spacing.md },
  rotuloSub: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs, marginTop: -4 },
  input: { backgroundColor: colors.backgroundSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.md, color: colors.text },

  // Grid de papel (2 colunas)
  papelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipPapel: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.backgroundSoft },
  chipPapelTexto: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textSecondary },

  // Seletor de lojas (trigger)
  seletorLojas: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.backgroundSoft, borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.md, padding: spacing.md,
  },
  seletorLojasTxt: { flex: 1, fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  seletorChevron: { fontSize: 20, color: colors.primary, marginLeft: spacing.sm },

  // Redefinir senha
  senhaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  botaoMostrar: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundSoft },
  botaoMostrarTxt: { fontSize: 16 },
  senhaAtual: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4 },

  // Ativo toggle
  toggleAtivo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { color: colors.white, fontWeight: '700', fontSize: 13 },
  toggleTexto: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },

  // Modal de seleção de lojas
  seletorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  seletorTitulo: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  seletorContador: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  seletorAcoes: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  botaoAcaoSeletor: { flex: 1, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  botaoAcaoSeletorTxt: { fontSize: fontSize.sm, fontWeight: '700' },
  listaLojas: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  lojaItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  lojaItemSelecionado: { backgroundColor: colors.primarySoft },
  checkboxLoja: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxLojaAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLojaTick: { color: colors.white, fontWeight: '800', fontSize: 14 },
  lojaItemCodigo: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  lojaItemNome: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  lojaItemCidade: { fontSize: fontSize.xs, color: colors.textMuted },
  lojaItemCheck: { color: colors.primary, fontSize: 18, fontWeight: '700', marginLeft: spacing.sm },
  seletorRodape: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
});

// Tela de Login - primeira tela do app.
// Visual v4: foto de galpao (esquerda) + card formulario (direita), tokens BOLD.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  SafeAreaView,
  StatusBar,
  ImageBackground,
} from 'react-native';
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg';

import Button    from '../components/Button';
import LogoBold  from '../components/LogoBold';
import { colors, spacing, fontSize, radius } from '../theme/colors';
import { login } from '../services/api';

const FOTO_GALPAO = require('../../assets/bold_matriz_final.png');

// ── Icones SVG (sem dependencia externa) ──────────────────────────────────────

function IcoEmail({ size = 18, cor = colors.textHint }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="14" rx="2" stroke={cor} strokeWidth="1.8" />
      <Path d="M3 7l9 6 9-6" stroke={cor} strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

function IcoLock({ size = 18, cor = colors.textHint }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="11" width="14" height="10" rx="2" stroke={cor} strokeWidth="1.8" />
      <Path d="M8 11V7a4 4 0 018 0v4" stroke={cor} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function IcoOlho({ size = 18, cor = colors.textHint, fechado = false }) {
  if (fechado) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
          stroke={cor} strokeWidth="1.8" strokeLinecap="round"
        />
        <Line x1="1" y1="1" x2="23" y2="23" stroke={cor} strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={cor} strokeWidth="1.8" />
      <Circle cx="12" cy="12" r="3" stroke={cor} strokeWidth="1.8" />
    </Svg>
  );
}

function IcoPacote({ size = 22, cor = colors.warning }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        stroke={cor} strokeWidth="1.8" strokeLinejoin="round"
      />
      <Path d="M3.27 6.96L12 12.01l8.73-5.05" stroke={cor} strokeWidth="1.8" />
      <Line x1="12" y1="22" x2="12" y2="12" stroke={cor} strokeWidth="1.8" />
    </Svg>
  );
}

function IcoCheckbox({ marcado = false }) {
  if (marcado) {
    return (
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Rect x="0" y="0" width="16" height="16" rx="3" fill={colors.primary} />
        <Path d="M3.5 8L6.5 11L12.5 5" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Rect x="1" y="1" width="14" height="14" rx="3" stroke={colors.border} strokeWidth="1.5" fill="none" />
    </Svg>
  );
}

// ── Painel esquerdo — overlay sobre o fundo de tela (exibido apenas no desktop) ──
function PainelEsquerdo() {
  return (
    <View style={mk.fotoBox}>
      <View style={mk.overlayCard}>
        <Text style={mk.titulo}>
          {'Gestão de Inventário\ncom Força e Precisão.'}
        </Text>

        <View style={mk.innerCard}>
          <View style={mk.innerCardIconeBox}>
            <IcoPacote size={22} />
          </View>
          <Text style={mk.innerCardTexto} numberOfLines={3}>
            {'Controle rigoroso que reduz erros operacionais em até '}
            <Text style={mk.innerCardDestaque}>98%.</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {

  const [email, setEmail]           = useState('');
  const [senha, setSenha]           = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroEmail, setErroEmail]   = useState('');
  const [erroSenha, setErroSenha]   = useState('');
  const [erroGeral, setErroGeral]   = useState('');

  const [verSenha, setVerSenha]           = useState(false);
  const [focoEmail, setFocoEmail]         = useState(false);
  const [focoSenha, setFocoSenha]         = useState(false);
  const [lembrar, setLembrar]             = useState(false);
  const [modalEsqueci, setModalEsqueci]   = useState(false);

  function validarFormulario() {
    let valido = true;
    setErroEmail('');
    setErroSenha('');

    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email.trim()) {
      setErroEmail('Email obrigatorio');
      valido = false;
    } else if (!regexEmail.test(email.trim())) {
      setErroEmail('Email invalido');
      valido = false;
    }

    if (!senha) {
      setErroSenha('Senha obrigatoria');
      valido = false;
    } else if (senha.length < 8) {
      setErroSenha('Senha deve ter no minimo 8 caracteres');
      valido = false;
    }

    return valido;
  }

  async function handleLogin() {
    if (!validarFormulario()) return;
    setErroGeral('');
    setCarregando(true);
    try {
      await login(email.toLowerCase().trim(), senha);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err) {
      let mensagem = err.message || 'Tente novamente';
      if (err.status === 401)      mensagem = 'Email ou senha invalidos';
      else if (err.status === 429) mensagem = err.message;
      else if (err.status === 0)   mensagem = 'Sem conexao com o servidor. Verifique sua internet.';
      setErroGeral(mensagem);
      if (Platform.OS !== 'web') {
        Alert.alert('Erro ao fazer login', mensagem, [{ text: 'OK' }]);
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={estilos.safe}>

      {/* Modal: recuperacao de senha */}
      <Modal
        visible={modalEsqueci}
        transparent
        animationType="fade"
        onRequestClose={() => setModalEsqueci(false)}
      >
        <TouchableOpacity
          style={estilos.modalFundo}
          activeOpacity={1}
          onPress={() => setModalEsqueci(false)}
        >
          <View style={estilos.modalCard}>
            <Text style={estilos.modalTitulo}>Recuperar senha</Text>
            <Text style={estilos.modalTexto}>
              Entre em contato com seu gestor ou com o administrador do sistema para redefinir sua senha.
            </Text>
            <TouchableOpacity
              style={estilos.modalBotao}
              onPress={() => setModalEsqueci(false)}
            >
              <Text style={estilos.modalBotaoTexto}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ImageBackground source={FOTO_GALPAO} style={estilos.fundoImagem} resizeMode="cover">
        <View style={estilos.overlay}>
          <KeyboardAvoidingView
            style={estilos.flex1}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={estilos.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={estilos.formWrapper}>

                {/* Logo BOLD */}
                <View style={estilos.logoArea}>
                  <LogoBold variant="white" height={52} />
                </View>

                {/* Card formulario */}
                <View style={estilos.formCard}>

                  <Text style={estilos.tituloForm}>Sistema de Inventário</Text>

                  {/* Campo e-mail */}
                  <View style={estilos.campoArea}>
                    <Text style={estilos.campoLabel}>E-mail</Text>
                    <View style={[
                      estilos.inputBox,
                      focoEmail && estilos.inputBoxFoco,
                      erroEmail ? estilos.inputBoxErro : null,
                    ]}>
                      <View style={estilos.icoEsq}>
                        <IcoEmail cor={focoEmail ? colors.primary : colors.textHint} />
                      </View>
                      <TextInput
                        style={estilos.campoTexto}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Digite seu e-mail"
                        placeholderTextColor={colors.textHint}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setFocoEmail(true)}
                        onBlur={() => setFocoEmail(false)}
                      />
                    </View>
                    {erroEmail ? <Text style={estilos.erroTexto}>{erroEmail}</Text> : null}
                  </View>

                  {/* Campo senha */}
                  <View style={estilos.campoArea}>
                    <Text style={estilos.campoLabel}>Senha</Text>
                    <View style={[
                      estilos.inputBox,
                      focoSenha && estilos.inputBoxFoco,
                      erroSenha ? estilos.inputBoxErro : null,
                    ]}>
                      <View style={estilos.icoEsq}>
                        <IcoLock cor={focoSenha ? colors.primary : colors.textHint} />
                      </View>
                      <TextInput
                        style={estilos.campoTexto}
                        value={senha}
                        onChangeText={setSenha}
                        placeholder="Digite sua senha"
                        placeholderTextColor={colors.textHint}
                        secureTextEntry={!verSenha}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setFocoSenha(true)}
                        onBlur={() => setFocoSenha(false)}
                      />
                      <TouchableOpacity onPress={() => setVerSenha(!verSenha)} style={estilos.icoDir}>
                        <IcoOlho fechado={!verSenha} cor={focoSenha ? colors.primary : colors.textHint} />
                      </TouchableOpacity>
                    </View>
                    {erroSenha ? <Text style={estilos.erroTexto}>{erroSenha}</Text> : null}
                  </View>

                  {/* Lembrar de mim + Esqueceu a senha */}
                  <View style={estilos.linhaExtra}>
                    <TouchableOpacity
                      style={estilos.checkboxRow}
                      onPress={() => setLembrar(!lembrar)}
                      activeOpacity={0.7}
                    >
                      <IcoCheckbox marcado={lembrar} />
                      <Text style={estilos.checkboxLabel}>Lembrar de mim</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setModalEsqueci(true)}>
                      <Text style={estilos.esqueciTexto}>Esqueceu sua senha?</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Banner de erro */}
                  {erroGeral ? (
                    <View style={estilos.bannerErro}>
                      <Text style={estilos.bannerErroTexto}>{erroGeral}</Text>
                    </View>
                  ) : null}

                  {/* Botao Entrar */}
                  <Button
                    titulo="Entrar"
                    onPress={handleLogin}
                    carregando={carregando}
                    estilo={estilos.btnEntrar}
                  />

                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

// ── Estilos do painel esquerdo ────────────────────────────────────────────────
const mk = StyleSheet.create({
  fotoBox: {
    flex: 1,
    width: '100%',
    padding: 40,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  overlayCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.xl,
    padding: 28,
    maxWidth: 460,
  },
  titulo: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 42,
    marginBottom: 20,
  },
  innerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md2,
    padding: 14,
    backgroundColor: colors.surface,
  },
  innerCardIconeBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(217,119,6,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  innerCardTexto: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  innerCardDestaque: {
    color: colors.primary,
    fontWeight: '700',
  },
});

// ── Estilos da tela ───────────────────────────────────────────────────────────
const estilos = StyleSheet.create({
  safe: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  fundoImagem: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Overlay escuro suave sobre a foto para dar profundidade
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 8, 25, 0.48)',
  },
  flex1: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  // Card de login centralizado, largura fixa
  formWrapper: {
    width: '100%',
    maxWidth: 440,
  },

  logoArea: {
    marginBottom: 20,
    paddingLeft: 4,
  },

  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 36,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },

  tituloForm: {
    color: colors.primary,
    fontSize: fontSize.title,
    fontWeight: '700',
    marginBottom: 24,
  },

  campoArea: {
    marginBottom: 16,
  },
  campoLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  inputBoxFoco: { borderColor: colors.primary },
  inputBoxErro: { borderColor: colors.danger },
  icoEsq: { paddingLeft: 12, paddingRight: 6 },
  icoDir: { paddingHorizontal: 12 },
  campoTexto: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 4,
    fontSize: fontSize.md2,
    color: colors.text,
    outlineStyle: 'none',
  },
  erroTexto: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: 4,
  },

  linhaExtra: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  esqueciTexto: {
    color: colors.primaryLight,
    fontSize: fontSize.sm,
  },

  bannerErro: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  bannerErroTexto: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  btnEntrar: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: 24,
  },

  // Modal recuperacao de senha
  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitulo: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 12,
  },
  modalTexto: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalBotao: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBotaoTexto: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

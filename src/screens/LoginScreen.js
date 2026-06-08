// Tela de Login - primeira tela do app.
// Operador digita email e senha, app chama a API e guarda o token.
// Visual v3: foto de galpao (esquerda) + card formulario (direita).

import React, { useState } from 'react';
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
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
  ImageBackground,
} from 'react-native';
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg';

import Button from '../components/Button';
import { colors, spacing, fontSize } from '../theme/colors';
import { login } from '../services/api';

// Cores do design
const FORM_BLUE  = '#1E3A5F';
const BORDA      = '#D1D5DB';
const LINK_BLUE  = '#2563EB';
const BG_DIREITA = '#F0EEE9';

// Foto de galpao logistico via Unsplash (sem dependencia externa)
const FOTO_GALPAO = {
  uri: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80',
};

// =============================================================================
// Logo BOLD — SVG inline (dois paralelogramos amarelo + verde + texto)
// =============================================================================
function LogoBold({ variant = 'color', height = 52 }) {
  const markH  = height;
  const markW  = Math.round(height * 0.80);
  const corA   = variant === 'white' ? 'rgba(255,255,255,0.95)' : '#F5A623';
  const corB   = variant === 'white' ? 'rgba(255,255,255,0.65)' : '#22C55E';
  const corTxt = variant === 'white' ? '#FFFFFF' : FORM_BLUE;
  const tamTxt = Math.round(height * 0.72);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={markW} height={markH} viewBox="0 0 26 34">
        <Path d="M0 5 L20 0 L24 10 L4 15 Z" fill={corA} />
        <Path d="M2 19 L22 14 L26 24 L6 29 Z" fill={corB} />
      </Svg>
      <Text style={{ color: corTxt, fontSize: tamTxt, fontWeight: '800', letterSpacing: 1.5, marginLeft: 10 }}>
        BOLD
      </Text>
    </View>
  );
}

// ---------- Icones SVG (sem biblioteca externa) ----------

function IcoEmail({ size = 18, cor = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="14" rx="2" stroke={cor} strokeWidth="1.8" />
      <Path d="M3 7l9 6 9-6" stroke={cor} strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

function IcoLock({ size = 18, cor = '#9CA3AF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="11" width="14" height="10" rx="2" stroke={cor} strokeWidth="1.8" />
      <Path d="M8 11V7a4 4 0 018 0v4" stroke={cor} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function IcoOlho({ size = 18, cor = '#9CA3AF', fechado = false }) {
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

function IcoPacote({ size = 22, cor = '#D97706' }) {
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
        <Rect x="0" y="0" width="16" height="16" rx="3" fill={FORM_BLUE} />
        <Path d="M3.5 8L6.5 11L12.5 5" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Rect x="1" y="1" width="14" height="14" rx="3" stroke={BORDA} strokeWidth="1.5" fill="none" />
    </Svg>
  );
}

// =============================================================================
// Painel esquerdo — foto de galpao + card de conteudo
// =============================================================================
function PainelEsquerdo() {
  return (
    <ImageBackground
      source={FOTO_GALPAO}
      style={mk.fotoBox}
      resizeMode="cover"
    >
      {/* Card branco semitransparente no canto superior esquerdo */}
      <View style={mk.overlayCard}>

        <Text style={mk.titulo}>
          {'Gestão de Inventário\ncom Força e Precisão.'}
        </Text>

        {/* Card interno: icone + estatistica */}
        <View style={mk.innerCard}>
          <View style={mk.innerCardIconeBox}>
            <IcoPacote size={22} cor="#D97706" />
          </View>
          <Text style={mk.innerCardTexto} numberOfLines={3}>
            {'Controle rigoroso que reduz erros operacionais em até '}
            <Text style={mk.innerCardDestaque}>95%.</Text>
          </Text>
        </View>

      </View>
    </ImageBackground>
  );
}

// =============================================================================
// Tela principal
// =============================================================================
export default function LoginScreen({ navigation }) {

  // --- Estado (nomes preservados integralmente) ---
  const [email, setEmail]           = useState('');
  const [senha, setSenha]           = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroEmail, setErroEmail]   = useState('');
  const [erroSenha, setErroSenha]   = useState('');
  const [erroGeral, setErroGeral]   = useState('');

  // Estado visual (adicional)
  const [verSenha, setVerSenha]   = useState(false);
  const [focoEmail, setFocoEmail] = useState(false);
  const [focoSenha, setFocoSenha] = useState(false);
  const [lembrar, setLembrar]     = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // --- Logica de autenticacao (preservada integralmente) ---

  function validarFormulario() {
    let valido = true;
    setErroEmail('');
    setErroSenha('');
    if (!email.trim()) {
      setErroEmail('Email obrigatorio');
      valido = false;
    } else if (!email.includes('@')) {
      setErroEmail('Email invalido');
      valido = false;
    }
    if (!senha) {
      setErroSenha('Senha obrigatoria');
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

  // --- Render ---

  return (
    <SafeAreaView style={estilos.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG_DIREITA} />

      <View style={[estilos.pagina, isDesktop && estilos.paginaDesktop]}>

        {/* Coluna esquerda — foto + card overlay — somente desktop */}
        {isDesktop && (
          <View style={estilos.colunaEsq}>
            <PainelEsquerdo />
          </View>
        )}

        {/* Coluna direita — logo + formulario */}
        <View style={[estilos.colunaDir, !isDesktop && estilos.colunaDirFull]}>
          <KeyboardAvoidingView
            style={estilos.flex1}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={estilos.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Wrapper: logo + card, alinhados a esquerda */}
              <View style={[estilos.formWrapper, !isDesktop && estilos.formWrapperMobile]}>

                {/* Logo BOLD acima do card */}
                <View style={estilos.logoArea}>
                  <LogoBold variant="color" height={50} />
                </View>

                {/* Card do formulario */}
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
                        <IcoEmail cor={focoEmail ? FORM_BLUE : '#9CA3AF'} />
                      </View>
                      <TextInput
                        style={estilos.campoTexto}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Digite seu e-mail"
                        placeholderTextColor="#9CA3AF"
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
                        <IcoLock cor={focoSenha ? FORM_BLUE : '#9CA3AF'} />
                      </View>
                      <TextInput
                        style={estilos.campoTexto}
                        value={senha}
                        onChangeText={setSenha}
                        placeholder="Digite sua senha"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!verSenha}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setFocoSenha(true)}
                        onBlur={() => setFocoSenha(false)}
                      />
                      <TouchableOpacity
                        onPress={() => setVerSenha(!verSenha)}
                        style={estilos.icoDir}
                      >
                        <IcoOlho fechado={!verSenha} cor={focoSenha ? FORM_BLUE : '#9CA3AF'} />
                      </TouchableOpacity>
                    </View>
                    {erroSenha ? <Text style={estilos.erroTexto}>{erroSenha}</Text> : null}
                  </View>

                  {/* Linha: Lembrar de mim + Esqueceu sua senha */}
                  <View style={estilos.linhaExtra}>
                    <TouchableOpacity
                      style={estilos.checkboxRow}
                      onPress={() => setLembrar(!lembrar)}
                      activeOpacity={0.7}
                    >
                      <IcoCheckbox marcado={lembrar} />
                      <Text style={estilos.checkboxLabel}>Lembrar de mim</Text>
                    </TouchableOpacity>

                    <TouchableOpacity>
                      <Text style={estilos.esqueciTexto}>Esqueceu sua senha?</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Banner de erro geral */}
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

      </View>
    </SafeAreaView>
  );
}

// =============================================================================
// Estilos do painel esquerdo
// =============================================================================
const mk = StyleSheet.create({
  fotoBox: {
    flex: 1,
    backgroundColor: '#1a2744',   // fallback enquanto a foto carrega
    padding: 40,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  overlayCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    padding: 28,
    maxWidth: 460,
  },
  titulo: {
    color: FORM_BLUE,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 46,
    marginBottom: 20,
  },
  innerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  innerCardIconeBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(217,119,6,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  innerCardTexto: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  innerCardDestaque: {
    color: FORM_BLUE,
    fontWeight: '700',
  },
});

// =============================================================================
// Estilos da tela
// =============================================================================
const estilos = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG_DIREITA,
  },
  pagina: {
    flex: 1,
    backgroundColor: BG_DIREITA,
  },
  paginaDesktop: {
    flexDirection: 'row',
  },
  flex1: { flex: 1 },

  colunaEsq: { flex: 55 },
  colunaDir: { flex: 45, backgroundColor: BG_DIREITA },
  colunaDirFull: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  // Wrapper logo + card
  formWrapper: {
    width: '100%',
    maxWidth: 440,
  },
  formWrapperMobile: {
    maxWidth: 420,
  },

  logoArea: {
    marginBottom: 20,
    paddingLeft: 2,
  },

  // Card do formulario
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 36,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },

  tituloForm: {
    color: FORM_BLUE,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 24,
  },

  campoArea: {
    marginBottom: 16,
  },
  campoLabel: {
    fontSize: fontSize.sm,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDA,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  inputBoxFoco: { borderColor: FORM_BLUE },
  inputBoxErro: { borderColor: colors.danger },
  icoEsq: { paddingLeft: 12, paddingRight: 6 },
  icoDir: { paddingHorizontal: 12 },
  campoTexto: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 4,
    fontSize: 15,
    color: colors.text,
    outlineStyle: 'none',
  },
  erroTexto: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: 4,
  },

  // Linha checkbox + link
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
    color: '#6B7280',
  },
  esqueciTexto: {
    color: LINK_BLUE,
    fontSize: fontSize.sm,
  },

  // Banner de erro
  bannerErro: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 8,
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

  // Botao Entrar
  btnEntrar: {
    backgroundColor: FORM_BLUE,
    borderRadius: 8,
    marginTop: 24,
  },
});

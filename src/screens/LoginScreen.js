// Tela de Login - primeira tela do app.
// Operador digita email e senha, app chama a API e guarda o token.
// Visual redesenhado: layout two-column (desktop >= 768px) / single (mobile).

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
} from 'react-native';
import Svg, { Circle, Path, Rect, Line, G } from 'react-native-svg';

import Button from '../components/Button';
import { colors, spacing, fontSize } from '../theme/colors';
import { login } from '../services/api';

// Cores exclusivas do novo design
const NAV        = '#0A1628';
const NAV_CARD   = 'rgba(255,255,255,0.07)';
const NAV_BORDER = 'rgba(255,255,255,0.14)';
const GOLD       = '#F5A623';
const VRD        = '#22C55E';
const FORM_BLUE  = '#1E3A5F';
const BORDA      = '#D1D5DB';
const LINK_BLUE  = '#2563EB';

// =============================================================================
// Logo BOLD — SVG inline (sem arquivo externo)
// variant="color" para a coluna direita | variant="white" para o painel escuro
// =============================================================================
function LogoBold({ variant = 'color', height = 48 }) {
  const markW  = height * 0.78;
  const markH  = height;
  const shapeA = variant === 'white' ? 'rgba(255,255,255,0.95)' : GOLD;
  const shapeB = variant === 'white' ? 'rgba(255,255,255,0.60)' : VRD;
  const txtClr = variant === 'white' ? '#FFFFFF' : FORM_BLUE;
  const txtSz  = height * 0.60;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* Marca: dois paralelogramos sobrepostos */}
      <Svg width={markW} height={markH} viewBox="0 0 26 34">
        {/* Paralelogramo superior (ouro / branco) */}
        <Path d="M0 5 L20 0 L24 10 L4 15 Z" fill={shapeA} />
        {/* Paralelogramo inferior (verde / branco translucido) */}
        <Path d="M2 19 L22 14 L26 24 L6 29 Z" fill={shapeB} />
      </Svg>
      {/* Texto BOLD */}
      <Text style={{
        color: txtClr,
        fontSize: txtSz,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginLeft: 8,
      }}>
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

function IcoAlerta({ size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke={GOLD} strokeWidth="1.8" strokeLinejoin="round"
      />
      <Line x1="12" y1="9" x2="12" y2="13" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="12" y1="17" x2="12.01" y2="17" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

function IcoCaixa({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        stroke={GOLD} strokeWidth="1.8" strokeLinejoin="round"
      />
      <Path d="M3.27 6.96L12 12.01l8.73-5.05" stroke={GOLD} strokeWidth="1.8" />
      <Line x1="12" y1="22" x2="12" y2="12" stroke={GOLD} strokeWidth="1.8" />
    </Svg>
  );
}

function CirculoProgresso({ pct = 78, tam = 54 }) {
  const cx     = tam / 2;
  const cy     = tam / 2;
  const r      = (tam - 8) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <Svg width={tam} height={tam}>
      <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth="5" fill="none" />
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={VRD} strokeWidth="5" fill="none"
        strokeDasharray={[circ, circ]}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${cx},${cy}`}
      />
    </Svg>
  );
}

// =============================================================================
// Painel de marketing — coluna esquerda (somente desktop)
// =============================================================================
function PainelMarketing() {
  return (
    <View style={mk.container}>

      {/* Logo branco no topo esquerdo */}
      <View style={mk.logoArea}>
        <LogoBold variant="white" height={28} />
      </View>

      {/* Titulo hero */}
      <View style={mk.heroArea}>
        <View style={mk.heroRow}>
          <Text style={mk.heroBranco}>Seu </Text>
          <Text style={mk.heroOuro}>estoque</Text>
        </View>
        <Text style={mk.heroBranco}>nunca mais vai te</Text>
        <Text style={mk.heroVerde}>surpreender.</Text>
        <Text style={mk.subtitulo}>Controle total em tempo real.</Text>
      </View>

      {/* Cards de indicadores */}
      <View style={mk.cardsArea}>

        {/* Card superior esquerdo: nivel de estoque */}
        <View style={[mk.card, mk.cardTopEsq]}>
          <Text style={mk.cardTitulo}>NIVEL DE ESTOQUE</Text>
          <View style={mk.cardRow}>
            <CirculoProgresso pct={78} tam={50} />
            <Text style={mk.cardValorGrande}>78%</Text>
          </View>
        </View>

        {/* Card superior direito: alertas */}
        <View style={[mk.card, mk.cardTopDir]}>
          <Text style={mk.cardTitulo}>ALERTAS</Text>
          <View style={mk.cardRow}>
            <IcoAlerta size={26} />
            <View style={{ marginLeft: 8 }}>
              <Text style={mk.cardTexto}>3 itens com</Text>
              <Text style={mk.cardTexto}>estoque baixo</Text>
            </View>
          </View>
        </View>

        {/* Card inferior direito: movimentacoes */}
        <View style={[mk.card, mk.cardBotDir]}>
          <Text style={mk.cardTitulo}>MOVIMENTACOES HOJE</Text>
          <Text style={mk.cardValorGrande}>1.245</Text>
          <Text style={mk.cardVerde}>+18% vs ontem</Text>
        </View>

      </View>

      {/* Rodape com estatistica */}
      <View style={mk.rodapeCard}>
        <View style={mk.rodapeIcoBox}>
          <IcoCaixa size={20} />
        </View>
        <Text style={mk.rodapeTexto}>
          {'Digitalizar o estoque reduz perdas em ate '}
          <Text style={mk.rodapeOuro}>47%</Text>
        </Text>
      </View>

    </View>
  );
}

// =============================================================================
// Tela principal
// =============================================================================
export default function LoginScreen({ navigation }) {

  // --- Estado (nomes preservados) ---
  const [email, setEmail]           = useState('');
  const [senha, setSenha]           = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroEmail, setErroEmail]   = useState('');
  const [erroSenha, setErroSenha]   = useState('');
  const [erroGeral, setErroGeral]   = useState('');

  // Estado visual adicional
  const [verSenha, setVerSenha]   = useState(false);
  const [focoEmail, setFocoEmail] = useState(false);
  const [focoSenha, setFocoSenha] = useState(false);

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
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={[estilos.pagina, isDesktop && estilos.paginaDesktop]}>

        {/* Coluna esquerda — marketing — somente desktop */}
        {isDesktop && (
          <View style={estilos.colunaEsq}>
            <PainelMarketing />
          </View>
        )}

        {/* Coluna direita — formulario */}
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
              {/* Card do formulario */}
              <View style={[estilos.formCard, !isDesktop && estilos.formCardMobile]}>

                {/* Logo BOLD colorido centralizado */}
                <View style={estilos.logoArea}>
                  <LogoBold variant="color" height={44} />
                </View>

                <Text style={estilos.tituloForm}>Inventario</Text>

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
                      placeholder="seu@email.com"
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
                      placeholder="••••••••"
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

                {/* Link esqueci senha */}
                <TouchableOpacity style={estilos.esqueciBtn}>
                  <Text style={estilos.esqueciTexto}>Esqueci minha senha</Text>
                </TouchableOpacity>

                {/* Banner de erro geral */}
                {erroGeral ? (
                  <View style={estilos.bannerErro}>
                    <Text style={estilos.bannerErroTexto}>{erroGeral}</Text>
                  </View>
                ) : null}

                {/* Botao entrar */}
                <Button
                  titulo="Entrar"
                  onPress={handleLogin}
                  carregando={carregando}
                  estilo={estilos.btnEntrar}
                />

                {/* Rodape */}
                <View style={estilos.rodapeForm}>
                  <Text style={estilos.rodapeTexto}>Nao tem uma conta? </Text>
                  <TouchableOpacity>
                    <Text style={estilos.rodapeLink}>Fale com o administrador.</Text>
                  </TouchableOpacity>
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
// Estilos do painel de marketing (coluna esquerda)
// =============================================================================
const mk = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAV,
    paddingHorizontal: 44,
    paddingVertical: 40,
  },
  logoArea: {
    marginBottom: 8,
  },
  heroArea: {
    marginTop: 32,
    marginBottom: 24,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heroBranco: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 52,
  },
  heroOuro: {
    color: GOLD,
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 52,
  },
  heroVerde: {
    color: VRD,
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 52,
  },
  subtitulo: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    marginTop: 14,
    lineHeight: 22,
  },
  cardsArea: {
    position: 'relative',
    height: 248,
    marginBottom: 24,
  },
  card: {
    position: 'absolute',
    backgroundColor: NAV_CARD,
    borderWidth: 1,
    borderColor: NAV_BORDER,
    borderRadius: 12,
    padding: 14,
  },
  cardTopEsq: { top: 0, left: 0, width: '52%' },
  cardTopDir: { top: 0, right: 0, width: '44%' },
  cardBotDir: { bottom: 0, right: 0, width: '44%' },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  cardTitulo: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardValorGrande: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginLeft: 8,
  },
  cardTexto: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
  },
  cardVerde: {
    color: VRD,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  rodapeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: NAV_BORDER,
    borderRadius: 12,
    padding: 16,
  },
  rodapeIcoBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245,166,35,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rodapeTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  rodapeOuro: {
    color: GOLD,
    fontWeight: '800',
  },
});

// =============================================================================
// Estilos da tela de login
// =============================================================================
const estilos = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  pagina: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  paginaDesktop: {
    flexDirection: 'row',
  },
  flex1: { flex: 1 },

  // Coluna esquerda (55%)
  colunaEsq: {
    flex: 55,
  },
  // Coluna direita (45%)
  colunaDir: {
    flex: 45,
    backgroundColor: '#F1F5F9',
  },
  colunaDirFull: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  // Card do formulario
  formCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  formCardMobile: {
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderRadius: 12,
  },

  // Logo
  logoArea: {
    alignItems: 'center',
    marginBottom: 16,
  },

  // Titulo
  tituloForm: {
    color: FORM_BLUE,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 28,
  },

  // Campos
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
  inputBoxFoco: {
    borderColor: FORM_BLUE,
  },
  inputBoxErro: {
    borderColor: colors.danger,
  },
  icoEsq: {
    paddingLeft: 12,
    paddingRight: 6,
  },
  icoDir: {
    paddingHorizontal: 12,
  },
  campoTexto: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 4,
    fontSize: fontSize.md,
    color: colors.text,
    outlineStyle: 'none',
  },
  erroTexto: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: 4,
  },

  // Link esqueci senha
  esqueciBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 20,
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
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  bannerErroTexto: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  // Botao entrar (override de cor sobre o Button component)
  btnEntrar: {
    backgroundColor: FORM_BLUE,
    borderRadius: 8,
  },

  // Rodape
  rodapeForm: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  rodapeTexto: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  rodapeLink: {
    color: LINK_BLUE,
    fontSize: fontSize.sm,
  },
});

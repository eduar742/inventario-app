// Tela de Login - primeira tela do app.
// Operador digita email e senha, app chama a API e guarda o token.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';

import Input from '../components/Input';
import Button from '../components/Button';
import { colors, spacing, fontSize } from '../theme/colors';
import { login } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('admin@inventario.local');
  const [senha, setSenha] = useState('admin123');
  const [carregando, setCarregando] = useState(false);
  const [erroEmail, setErroEmail] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [erroGeral, setErroGeral] = useState(''); // visivel no browser (web)

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
      navigation.reset({ index: 0, routes: [{ name: 'Lojas' }] });
    } catch (err) {
      let mensagem = err.message || 'Tente novamente';
      if (err.status === 401) mensagem = 'Email ou senha invalidos';
      else if (err.status === 429) mensagem = err.message;
      else if (err.status === 0)  mensagem = 'Sem conexao com o servidor. Verifique sua internet.';

      // Mostra inline no browser (Alert pode nao funcionar em todos os browsers)
      setErroGeral(mensagem);
      if (Platform.OS !== 'web') {
        Alert.alert('Erro ao fazer login', mensagem, [{ text: 'OK' }]);
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={estilos.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={estilos.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={estilos.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={estilos.logoContainer}>
            <View style={estilos.logoBox}>
              <Text style={estilos.logoTexto}>INV</Text>
            </View>
            <Text style={estilos.titulo}>Inventario</Text>
            <Text style={estilos.subtitulo}>Acesse com suas credenciais</Text>
          </View>

          <View style={estilos.formulario}>
            <Input
              label="E-mail"
              valor={email}
              onChangeText={setEmail}
              placeholder="seu.email@empresa.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              erro={erroEmail}
            />

            <Input
              label="Senha"
              valor={senha}
              onChangeText={setSenha}
              placeholder="Sua senha"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              erro={erroSenha}
            />

            {erroGeral ? (
              <View style={estilos.bannerErro}>
                <Text style={estilos.bannerErroTexto}>{erroGeral}</Text>
              </View>
            ) : null}

            <View style={{ height: spacing.sm }} />

            <Button
              titulo="Entrar"
              onPress={handleLogin}
              carregando={carregando}
            />
          </View>

          <View style={estilos.rodape}>
            <Text style={estilos.textoRodape}>
              Sistema interno - Versao 0.1.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: colors.primary,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoTexto: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
  },
  titulo: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitulo: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  formulario: {
    width: '100%',
  },
  rodape: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  textoRodape: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  bannerErro: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  bannerErroTexto: {
    fontSize: fontSize.sm,
    color: '#DC2626',
    fontWeight: '500',
  },
});
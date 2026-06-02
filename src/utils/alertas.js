// Utilitario de alertas compativel com web e mobile.
// Na web: Alert.alert com multiplos botoes nao funciona — usa window.alert/confirm.
// No mobile: usa Alert.alert normalmente.

import { Alert, Platform } from 'react-native';

/** Exibe mensagem simples (equivalente a window.alert). */
export function avisar(titulo, mensagem) {
  const texto = mensagem ? `${titulo}\n\n${mensagem}` : titulo;
  if (Platform.OS === 'web') {
    window.alert(texto);
  } else {
    Alert.alert(titulo, mensagem);
  }
}

/** Confirmacao Sim/Nao. Retorna Promise<boolean>. */
export function confirmar(titulo, mensagem) {
  if (Platform.OS === 'web') {
    const texto = mensagem ? `${titulo}\n\n${mensagem}` : titulo;
    return Promise.resolve(window.confirm(texto));
  }
  return new Promise(resolve => {
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** Validacao inline — exibe erro e retorna false se mensagem nao vazia. */
export function validarCampo(valor, mensagem) {
  if (!valor || !String(valor).trim()) {
    avisar('Atencao', mensagem);
    return false;
  }
  return true;
}

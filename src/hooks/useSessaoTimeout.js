// Detecta inatividade por background: se o app ficar em segundo plano por mais de
// TIMEOUT_MIN minutos e o usuario voltar, a sessao e encerrada automaticamente.
// Cobre o cenario real: operador larga o dispositivo desbloqueado no deposito.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { pegarToken, logout } from '../services/api';
import { navRef } from '../navigation/navRef';

const TIMEOUT_MIN = 30;
const TIMEOUT_MS  = TIMEOUT_MIN * 60 * 1000;

export function useSessaoTimeout() {
  const backgroundEm = useRef(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (estado) => {
      if (estado === 'background' || estado === 'inactive') {
        backgroundEm.current = Date.now();
        return;
      }

      if (estado === 'active' && backgroundEm.current !== null) {
        const ausencia = Date.now() - backgroundEm.current;
        backgroundEm.current = null;

        if (ausencia >= TIMEOUT_MS) {
          const token = await pegarToken();
          if (token && navRef.isReady()) {
            await logout();
            navRef.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        }
      }
    });

    return () => subscription.remove();
  }, []);
}

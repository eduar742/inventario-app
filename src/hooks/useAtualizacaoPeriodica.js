// Atualizacao periodica (polling) que so roda enquanto alguem esta olhando:
// tela em foco na navegacao E app em primeiro plano. No navegador, AppState
// segue a visibilidade da aba, entao uma aba esquecida em segundo plano para
// de consultar a API.
// Motivo: dashboards abertos o dia todo consultando a cada 30s esgotaram a
// cota mensal de transferencia do banco (Neon, out/2026) e derrubaram o login.
//
// O hook NAO faz a carga inicial (cada tela ja faz a sua). Ao retomar depois
// de uma pausa (voltou para a tela ou para a aba), atualiza na hora para nao
// mostrar dado velho ate o proximo ciclo.

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

function _appAtivo(estado) {
  return estado !== 'background' && estado !== 'inactive';
}

export function useAtualizacaoPeriodica(
  atualizar,
  intervaloMs,
  { habilitado = true, atualizarAoRetomar = true } = {},
) {
  const focada = useIsFocused();
  const [appAtivo, setAppAtivo] = useState(_appAtivo(AppState.currentState));
  const atualizarRef = useRef(atualizar);
  const pausouRef = useRef(false);

  // Sempre chama a versao mais recente (filtros novos) sem reiniciar o timer
  atualizarRef.current = atualizar;

  useEffect(() => {
    const sub = AppState.addEventListener('change', estado => setAppAtivo(_appAtivo(estado)));
    return () => sub?.remove?.();
  }, []);

  const rodando = habilitado && focada && appAtivo;

  useEffect(() => {
    if (!rodando) {
      // So conta como pausa se ninguem esta olhando (habilitado=false e regra da tela)
      if (!focada || !appAtivo) pausouRef.current = true;
      return;
    }
    if (pausouRef.current) {
      pausouRef.current = false;
      if (atualizarAoRetomar) atualizarRef.current();
    }
    const timer = setInterval(() => atualizarRef.current(), intervaloMs);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando, intervaloMs]);
}

/**
 * Utilitarios centralizados de formatacao de data/hora.
 *
 * Problema resolvido aqui:
 *   O backend (Render.com / UTC) retorna datetimes sem indicador de timezone,
 *   ex: "2026-06-11T12:24:54.973958". Sem o 'Z', o JavaScript interpreta como
 *   hora LOCAL do dispositivo, nao como UTC. Isso causa datas 3h adiantadas
 *   em dispositivos no fuso America/Sao_Paulo (UTC-3).
 *
 *   Solucao: adicionar 'Z' a strings sem timezone antes de parsear,
 *   e sempre formatar com timeZone: 'America/Sao_Paulo' explicitamente.
 */

const TZ = 'America/Sao_Paulo';

/**
 * Parsa uma string ISO do backend garantindo interpretacao como UTC.
 * Strings sem indicador de timezone (ex: "2026-06-11T12:30:00") recebem 'Z'.
 * Retorna null para entradas invalidas ou vazias.
 */
function _parsarISO(iso) {
  if (!iso) return null;
  // Verifica se ja tem indicador de timezone (Z, +HH:MM ou -HH:MM apos o horario)
  const temTZ = iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso);
  const str = temTZ ? iso : iso + 'Z';
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formata data e hora: "12/06/2026 09:24"
 * Substitui o padrao formatarData/fmtDt/_fmtDt nas telas.
 */
export function formatarDataHora(iso) {
  const d = _parsarISO(iso);
  if (!d) return '';
  return (
    d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Formata apenas a data: "12/06/2026"
 */
export function formatarData(iso) {
  const d = _parsarISO(iso);
  if (!d) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formata apenas a hora: "09:24". Retorna '—' para valores vazios.
 * Substitui fmtHora nas telas.
 */
export function formatarHora(iso) {
  const d = _parsarISO(iso);
  if (!d) return '—';
  return d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

/**
 * Formato curto para listas: "Hoje, 09:24" ou "12/jun".
 * Substitui _fmtSync na LojasScreen.
 */
export function formatarDataCurta(iso) {
  const d = _parsarISO(iso);
  if (!d) return 'Sem dados';
  const hojeStr = new Date().toLocaleDateString('pt-BR', { timeZone: TZ });
  const dStr = d.toLocaleDateString('pt-BR', { timeZone: TZ });
  if (hojeStr === dStr) {
    return 'Hoje, ' + d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: 'short' });
}

/**
 * Hora atual formatada (para "ultima atualizacao", dashboards ao vivo).
 * Usa new Date() ja que e hora do momento — nao precisa de parse ISO.
 */
export function formatarAgora() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

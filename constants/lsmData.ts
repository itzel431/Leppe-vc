// ══════════════════════════════════════════════
//  LEPPE — Datos del Abecedario LSM
// ══════════════════════════════════════════════

export type LetraInfo = {
  emoji: string;
  desc:  string;
  tip:   string | null;
};

export const LETRAS_MOVIMIENTO = new Set<string>(['J', 'K', 'Q', 'X', 'Z', 'Ñ']);

export const ALFABETO: Record<string, LetraInfo> = {
  A:  { emoji: '✊', desc: 'Puño cerrado con el pulgar al costado.',                             tip: null },
  B:  { emoji: '✋', desc: 'Cuatro dedos extendidos juntos, pulgar doblado hacia la palma.',    tip: null },
  C:  { emoji: '🤙', desc: 'Mano curvada formando una C con todos los dedos.',                   tip: null },
  D:  { emoji: '☝️', desc: 'Índice extendido, demás dedos forman O con el pulgar.',             tip: null },
  E:  { emoji: '✊', desc: 'Dedos doblados hacia la palma, puntas apoyadas.',                    tip: null },
  F:  { emoji: '👌', desc: 'Pulgar e índice forman círculo, los demás extendidos.',              tip: null },
  G:  { emoji: '👈', desc: 'Índice y pulgar apuntan horizontalmente hacia el lado.',             tip: null },
  H:  { emoji: '✌️', desc: 'Índice y medio extendidos horizontalmente y juntos.',               tip: null },
  I:  { emoji: '🤙', desc: 'Solo el meñique extendido hacia arriba.',                           tip: null },
  J:  { emoji: '🤙', desc: 'Meñique dibuja una J en el aire: baja, curva y sube.',              tip: 'Realiza el trazo completo de forma fluida.' },
  K:  { emoji: '✌️', desc: 'Índice y medio extendidos, pulgar entre ellos — con movimiento.',  tip: 'Mueve los dedos hacia afuera una vez.' },
  L:  { emoji: '👆', desc: 'Índice apunta arriba, pulgar extendido al costado formando una L.', tip: null },
  M:  { emoji: '✊', desc: 'Tres dedos doblados sobre el pulgar.',                               tip: null },
  N:  { emoji: '✊', desc: 'Dos dedos doblados sobre el pulgar.',                                tip: null },
  Ñ:  { emoji: '🤚', desc: 'Posición N base con sacudida lateral del meñique.',                 tip: 'Haz la N y mueve el meñique rápidamente.' },
  O:  { emoji: '👌', desc: 'Todos los dedos forman un círculo/O con el pulgar.',                tip: null },
  P:  { emoji: '👇', desc: 'Mano apuntando hacia abajo con movimiento de barrido.',             tip: 'Apunta los dedos hacia abajo y barre.' },
  Q:  { emoji: '👇', desc: 'Índice y pulgar apuntan hacia abajo con movimiento circular.',      tip: 'Gira la muñeca en un pequeño círculo.' },
  R:  { emoji: '✌️', desc: 'Índice y medio cruzados y extendidos.',                             tip: null },
  S:  { emoji: '✊', desc: 'Puño cerrado con el pulgar cruzado sobre los dedos.',                tip: null },
  T:  { emoji: '👊', desc: 'Pulgar metido entre índice y medio doblados.',                      tip: null },
  U:  { emoji: '✌️', desc: 'Índice y medio extendidos juntos apuntando hacia arriba.',          tip: null },
  V:  { emoji: '✌️', desc: 'Índice y medio extendidos y separados (V de victoria).',            tip: null },
  W:  { emoji: '🖖', desc: 'Índice, medio y anular extendidos y separados.',                    tip: null },
  X:  { emoji: '☝️', desc: 'Índice en gancho con movimiento de doblez.',                       tip: 'Dobla el índice varias veces como llamando.' },
  Y:  { emoji: '🤙', desc: 'Pulgar y meñique extendidos (shaka / cuernos).',                    tip: null },
  Z:  { emoji: '☝️', desc: 'Índice traza una Z en el aire de izquierda a derecha.',             tip: 'Dibuja la Z completa con fluidez.' },
};

export const TODAS_LAS_LETRAS = Object.keys(ALFABETO);

export const CARD_COLORS = [
  { bg: '#FEE2E2', text: '#E05252', border: '#FECACA' },
  { bg: '#DBEAFE', text: '#2f80ed', border: '#BFDBFE' },
  { bg: '#FCE7F3', text: '#F472B6', border: '#FBCFE8' },
  { bg: '#D1FAE5', text: '#27AE60', border: '#A7F3D0' },
  { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  { bg: '#EDE9FE', text: '#7C3AED', border: '#DDD6FE' },
] as const;

export const getCardColor = (letra: string) =>
  CARD_COLORS[TODAS_LAS_LETRAS.indexOf(letra) % CARD_COLORS.length];

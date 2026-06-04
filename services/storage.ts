import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  historial:  'leppe_historial_v2',
  progreso:   'leppe_progreso_v1',
  racha:      'leppe_racha_v1',
  onboarding: 'leppe_onboarding_v1',
};

// ── Tipos ────────────────────────────────────────────────────────────────
export type Frase = { id: string; text: string; ts: number };
export type Progreso = Record<string, string[]>;
export type Racha   = { dias: number; ultimaFecha: string | null };

// ── Historial ────────────────────────────────────────────────────────────
export async function loadPhrases(): Promise<Frase[]> {
  try { const r = await AsyncStorage.getItem(K.historial); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
export async function savePhrase(text: string): Promise<Frase | null> {
  try {
    const cur  = await loadPhrases();
    const item: Frase = { id: Date.now().toString(), text: text.trim(), ts: Date.now() };
    await AsyncStorage.setItem(K.historial, JSON.stringify([...cur, item]));
    return item;
  } catch { return null; }
}
export async function deletePhrase(id: string): Promise<void> {
  try {
    const cur = await loadPhrases();
    await AsyncStorage.setItem(K.historial, JSON.stringify(cur.filter(f => f.id !== id)));
  } catch {}
}
export async function clearAllPhrases(): Promise<void> {
  try { await AsyncStorage.removeItem(K.historial); } catch {}
}

// ── Progreso lecciones ───────────────────────────────────────────────────
export async function loadProgreso(): Promise<Progreso> {
  try { const r = await AsyncStorage.getItem(K.progreso); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
export async function saveProgreso(lecId: string, letras: string[]): Promise<void> {
  try {
    const cur = await loadProgreso();
    await AsyncStorage.setItem(K.progreso, JSON.stringify({ ...cur, [lecId]: letras }));
  } catch {}
}

// ── Racha diaria ─────────────────────────────────────────────────────────
export async function loadRacha(): Promise<Racha> {
  try { const r = await AsyncStorage.getItem(K.racha); return r ? JSON.parse(r) : { dias: 0, ultimaFecha: null }; }
  catch { return { dias: 0, ultimaFecha: null }; }
}
export async function updateRacha(): Promise<Racha> {
  try {
    const hoy  = new Date().toDateString();
    const ayer  = new Date(Date.now() - 86400000).toDateString();
    const racha = await loadRacha();
    if (racha.ultimaFecha === hoy) return racha;
    const nueva: Racha = { dias: racha.ultimaFecha === ayer ? racha.dias + 1 : 1, ultimaFecha: hoy };
    await AsyncStorage.setItem(K.racha, JSON.stringify(nueva));
    return nueva;
  } catch { return { dias: 0, ultimaFecha: null }; }
}

// ── Onboarding ────────────────────────────────────────────────────────────
export async function hasSeenOnboarding(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(K.onboarding)) === 'true'; }
  catch { return false; }
}
export async function markOnboardingDone(): Promise<void> {
  try { await AsyncStorage.setItem(K.onboarding, 'true'); } catch {}
}

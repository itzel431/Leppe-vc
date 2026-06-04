// services/lsmApi.ts — v3
// =======================
// Envía frames usando FormData con uri local (método correcto en RN).

export const API_URL = "http://172.20.10.2:8000"; // ← cambia esto
export const SESSION_ID = `s_${Date.now()}`;

export interface PrediccionResult {
  etiqueta: string;
  traduccion: string;
  confianza: number;
  modo: "frase" | "letra" | "sin_mano";
  confirmada: boolean;
  debug?: string;
}

export async function predecirFrame(
  uri: string,
  modo: "frase" | "letra" = "frase",
): Promise<PrediccionResult | null> {
  try {
    const form = new FormData();
    // React Native requiere este formato exacto para subir archivos
    form.append("frame", {
      uri,
      name: "frame.jpg",
      type: "image/jpeg",
    } as any);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `${API_URL}/predecir?session_id=${SESSION_ID}&modo=${modo}`,
      { method: "POST", body: form, signal: controller.signal },
    );
    clearTimeout(t);

    if (!res.ok) {
      console.warn(`[LSM] HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    if (e?.name !== "AbortError") console.warn("[LSM]", e?.message);
    return null;
  }
}

export async function guardarDeteccion(
  etiqueta: string,
  traduccion: string,
  confianza: number,
  usuarioId = "anonimo",
) {
  try {
    await fetch(`${API_URL}/guardar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: SESSION_ID,
        etiqueta,
        traduccion,
        confianza,
        usuario_id: usuarioId,
      }),
    });
  } catch {}
}

export async function limpiarSesion() {
  try {
    await fetch(`${API_URL}/sesion/${SESSION_ID}`, { method: "DELETE" });
  } catch {}
}

export async function verificarServidor(): Promise<boolean> {
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 3000);
    const r = await fetch(`${API_URL}/`, { signal: c.signal });
    return r.ok;
  } catch {
    return false;
  }
}

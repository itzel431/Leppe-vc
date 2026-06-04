"""
4_capturar_frases.py
====================
Captura secuencias de landmarks para 10 frases/palabras del LSM.

FRASES A CAPTURAR:
  0 - MI_NOMBRE    → seña de "MI" + deletreo (aquí solo la seña de presentación)
  1 - HASTA_MANANA → seña compuesta de despedida
  2 - NO            → seña de negación
  3 - QUIERO        → seña de "querer/desear"
  4 - APRENDER      → seña de aprender
  5 - SI            → seña de afirmación
  6 - ENTIENDO      → seña de entender/comprender
  7 - NO_ENTIENDO   → seña de no entender
  8 - POR_FAVOR     → seña de cortesía
  9 - GRACIAS       → seña de agradecimiento
 10 - REPETIR_FAVOR → seña de "¿lo repites por favor?"

TODAS son secuencias de movimiento: se graban 20 frames por muestra.

Controles:
  N = siguiente seña
  B = seña anterior
  D = borrar últimas 20 muestras de la seña actual
  ESPACIO = empezar a grabar la seña (modo manual)
  Q = guardar y salir
"""

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import os

# ── CONFIG ────────────────────────────────────────────────────────────────
SEÑAS = [
    "MI_NOMBRE",
    "HASTA_MANANA",
    "NO",
    "QUIERO",
    "APRENDER",
    "SI",
    "ENTIENDO",
    "NO_ENTIENDO",
    "POR_FAVOR",
    "GRACIAS",
    "REPETIR_FAVOR",
]

# Descripción de cómo hacer cada seña (guía en pantalla)
DESCRIPCION = {
    "MI_NOMBRE":     "Señala tu pecho (YO) luego haz la seña de NOMBRE (manos juntas como sellando)",
    "HASTA_MANANA":  "Mano abierta al frente, bájala y luego señal de mañana (puño al frente)",
    "NO":            "Índice + medio extendidos, muévelos de lado a lado (negación)",
    "QUIERO":        "Mano en garra frente al pecho, jalando hacia ti",
    "APRENDER":      "Dedos juntos en la frente, como tomando información",
    "SI":            "Puño cerrado asintiendo hacia abajo (como cabecear con la mano)",
    "ENTIENDO":      "Índice en la sien, luego abre la mano hacia afuera",
    "NO_ENTIENDO":   "Seña NO + seña ENTIENDO en secuencia",
    "POR_FAVOR":     "Palma abierta frente al pecho, movimiento circular",
    "GRACIAS":       "Dedos juntos en la boca/mentón, mano al frente como mandar beso",
    "REPETIR_FAVOR": "Índice circular (REPETIR) + palma circular (POR FAVOR)",
}

MUESTRAS_OBJETIVO  = 300          # muestras por seña
LONGITUD_SECUENCIA = 20           # frames por seña (más largo que letras)
TOTAL_FEATURES     = 63 * LONGITUD_SECUENCIA   # 1260 features fijos

CARPETA = "datos_frases"
ARCHIVO = os.path.join(CARPETA, "dataset_frases.csv")
os.makedirs(CARPETA, exist_ok=True)

# ── MEDIAPIPE ─────────────────────────────────────────────────────────────
mp_hands = mp.solutions.hands
hands    = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.75,
    min_tracking_confidence=0.65,
)

# ── FUNCIONES ─────────────────────────────────────────────────────────────
def normalizar_frame(lm_list):
    pts = np.array([[p.x, p.y, p.z] for p in lm_list], dtype=np.float32)
    pts -= pts[0]
    escala = np.max(np.abs(pts)) + 1e-6
    pts /= escala
    return pts.flatten()   # (63,)

def secuencia_a_fila(secuencia, etiqueta):
    flat = np.concatenate(secuencia)
    if len(flat) < TOTAL_FEATURES:
        flat = np.pad(flat, (0, TOTAL_FEATURES - len(flat)))
    return [etiqueta] + flat[:TOTAL_FEATURES].tolist()

# ── CARGAR DATASET EXISTENTE ──────────────────────────────────────────────
if os.path.exists(ARCHIVO):
    df_prev = pd.read_csv(ARCHIVO, header=None)
    datos   = df_prev.values.tolist()
    print(f"✅ Dataset existente cargado: {len(datos)} muestras")
else:
    datos = []

def conteo():
    c = {s: 0 for s in SEÑAS}
    for fila in datos:
        if fila[0] in c:
            c[fila[0]] += 1
    return c

# ── CÁMARA ────────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ No se puede abrir la cámara")
    exit()

seña_idx     = 0
secuencia    = []
grabando     = False
cuenta_regresiva = 0

print("\n🔥 CAPTURA DE FRASES INICIADA")
print("ESPACIO=iniciar grabación | N=siguiente | B=anterior | D=borrar 20 | Q=guardar y salir\n")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    res   = hands.process(rgb)

    seña    = SEÑAS[seña_idx]
    cnt     = conteo()
    n_seña  = cnt[seña]
    mano_ok = False
    frame_norm = None

    if res.multi_hand_landmarks:
        lm_list    = res.multi_hand_landmarks[0].landmark
        frame_norm = normalizar_frame(lm_list)
        mano_ok    = True

        mp.solutions.drawing_utils.draw_landmarks(
            frame,
            res.multi_hand_landmarks[0],
            mp_hands.HAND_CONNECTIONS,
            mp.solutions.drawing_utils.DrawingSpec(color=(0,255,80),  thickness=2, circle_radius=4),
            mp.solutions.drawing_utils.DrawingSpec(color=(200,0,255), thickness=2),
        )

        # Grabar secuencia si está activo
        if grabando and frame_norm is not None:
            secuencia.append(frame_norm)

            if len(secuencia) >= LONGITUD_SECUENCIA:
                fila = secuencia_a_fila(secuencia[-LONGITUD_SECUENCIA:], seña)
                datos.append(fila)
                secuencia = []
                grabando  = False
                print(f"✅ '{seña}' guardada → total: {n_seña+1}")
    else:
        if grabando:
            secuencia = []
            grabando  = False

    # ── HUD ───────────────────────────────────────────────────────────────
    h, w = frame.shape[:2]

    # Fondo superior
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 160), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.60, frame, 0.40, 0, frame)

    # Nombre de la seña grande
    col_seña = (0, 255, 100) if mano_ok else (80, 80, 200)
    cv2.putText(frame, seña, (15, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 1.4, col_seña, 3)

    # Descripción cómo hacer la seña
    desc = DESCRIPCION.get(seña, "")
    # Dividir descripción en 2 líneas si es larga
    palabras = desc.split()
    linea1 = " ".join(palabras[:6])
    linea2 = " ".join(palabras[6:])
    cv2.putText(frame, linea1, (15, 85),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 100), 1)
    if linea2:
        cv2.putText(frame, linea2, (15, 105),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 100), 1)

    # Barra de progreso de muestras
    pct = min(n_seña / MUESTRAS_OBJETIVO, 1.0)
    bw  = w - 20
    cv2.rectangle(frame, (10, 115), (10 + bw, 135), (50, 50, 50), -1)
    col_bar = (0, 200, 100) if pct < 0.8 else (0, 255, 50)
    cv2.rectangle(frame, (10, 115), (10 + int(bw * pct), 135), col_bar, -1)
    cv2.putText(frame, f"{n_seña}/{MUESTRAS_OBJETIVO}  ({pct*100:.0f}%)",
                (15, 112), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

    # Estado de grabación
    if grabando:
        prog = len(secuencia) / LONGITUD_SECUENCIA
        sw   = int(prog * (w - 20))
        cv2.rectangle(frame, (10, 140), (w - 10, 158), (40, 40, 40), -1)
        cv2.rectangle(frame, (10, 140), (10 + sw, 158), (0, 200, 255), -1)
        cv2.putText(frame, f"⏺ GRABANDO {len(secuencia)}/{LONGITUD_SECUENCIA}",
                    (15, 175), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 200, 255), 2)
    else:
        instruccion = "ESPACIO = GRABAR SEÑA" if mano_ok else "Pon tu mano en cámara"
        col_inst    = (255, 200, 0) if mano_ok else (80, 80, 180)
        cv2.putText(frame, instruccion, (15, 175),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, col_inst, 2)

    # Estado de mano
    est = "MANO OK" if mano_ok else "SIN MANO"
    cv2.putText(frame, est, (w - 130, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65,
                (0, 255, 80) if mano_ok else (80, 80, 200), 2)

    # Navegación
    if seña_idx > 0:
        cv2.putText(frame, f"< {SEÑAS[seña_idx-1]}", (10, h - 55),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (140, 140, 140), 1)
    if seña_idx < len(SEÑAS) - 1:
        sig = SEÑAS[seña_idx + 1]
        cv2.putText(frame, f"{sig} >", (w - 180, h - 55),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (140, 140, 140), 1)

    # Pie
    cv2.rectangle(frame, (0, h - 35), (w, h), (0, 0, 0), -1)
    completas = sum(1 for s in SEÑAS if cnt[s] >= MUESTRAS_OBJETIVO)
    cv2.putText(frame,
        f"Total: {len(datos)} | {completas}/{len(SEÑAS)} completas | "
        f"ESPACIO=grabar  N=sig  B=ant  D=borrar  Q=guardar",
        (8, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (180, 180, 180), 1)

    # Índice de seña
    cv2.putText(frame, f"{seña_idx+1}/{len(SEÑAS)}", (w - 80, h - 55),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (120, 120, 120), 1)

    cv2.imshow("Captura Frases LSM", frame)

    key = cv2.waitKey(1) & 0xFF

    if key == ord('q'):
        break
    elif key == ord(' '):   # ESPACIO = iniciar grabación
        if mano_ok and not grabando:
            secuencia = []
            grabando  = True
    elif key in (ord('n'), 83):
        seña_idx  = min(seña_idx + 1, len(SEÑAS) - 1)
        secuencia = []; grabando = False
    elif key in (ord('b'), 81):
        seña_idx  = max(seña_idx - 1, 0)
        secuencia = []; grabando = False
    elif key == ord('d'):
        eliminados = 0
        nuevos     = []
        for fila in reversed(datos):
            if fila[0] == seña and eliminados < 20:
                eliminados += 1
            else:
                nuevos.append(fila)
        datos = list(reversed(nuevos))
        print(f"🗑️  Eliminadas {eliminados} muestras de '{seña}'")

cap.release()
cv2.destroyAllWindows()

# ── GUARDAR ───────────────────────────────────────────────────────────────
if datos:
    df = pd.DataFrame(datos)
    df.to_csv(ARCHIVO, index=False, header=False)
    print(f"\n✅ Dataset guardado: {ARCHIVO}")
    print(f"   Total muestras: {len(df)}")
    cnt = conteo()
    print("\n📊 Muestras por seña:")
    for s in SEÑAS:
        n   = cnt[s]
        bar = "█" * (n // 10) + "░" * max(0, (MUESTRAS_OBJETIVO - n) // 10)
        print(f"  {s:<18}: {n:4d}/{MUESTRAS_OBJETIVO}  {bar}")
    print(f"\n▶ Siguiente: python 5_entrenar_frases.py")
else:
    print("No se grabaron datos.")

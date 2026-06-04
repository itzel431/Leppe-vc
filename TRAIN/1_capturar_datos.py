"""
1_capturar_datos.py
===================
Captura landmarks de mano para las 27 letras del LSM.

Letras con movimiento (K, Q, Z, J, X, Ñ):
  → guarda SECUENCIA de 15 frames = 15 * 63 = 945 features

Letras estáticas (el resto):
  → guarda 1 frame = 63 features (rellenado con ceros hasta 945)

Así TODOS los renglones tienen el mismo ancho en el CSV.

Controles:
  N = siguiente letra
  B = letra anterior
  D = borrar últimas 20 muestras de la letra actual
  Q = guardar y salir
"""

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import os

# ── CONFIG ──────────────────────────────────────────────────────────────
LETRAS             = list("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ")
MOVIMIENTO         = {'K', 'Q', 'Z', 'J', 'X', 'Ñ'}
MUESTRAS_OBJETIVO  = 500          # muestras a capturar por letra
LONGITUD_SECUENCIA = 15           # frames por seña de movimiento
FRAMES_ESTABLES    = 6            # frames quietos antes de grabar estática
TOTAL_FEATURES     = 63 * LONGITUD_SECUENCIA   # 945 — ancho fijo de cada fila

CARPETA   = "datos_capturados"
ARCHIVO   = os.path.join(CARPETA, "dataset_landmarks.csv")

os.makedirs(CARPETA, exist_ok=True)

# ── MEDIAPIPE ────────────────────────────────────────────────────────────
mp_hands = mp.solutions.hands
hands    = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.75,
    min_tracking_confidence=0.65,
)

# ── FUNCIONES ────────────────────────────────────────────────────────────
def extraer_landmarks(lm_list):
    """Devuelve array (21,3) de coordenadas crudas."""
    pts = np.array([[p.x, p.y, p.z] for p in lm_list], dtype=np.float32)
    return pts

def normalizar(pts):
    """
    Centra en muñeca (punto 0) y escala por la distancia máxima.
    Devuelve vector plano de 63 valores.
    """
    pts = pts - pts[0]
    escala = np.max(np.abs(pts)) + 1e-6
    pts /= escala
    return pts.flatten()   # (63,)

def secuencia_a_fila(secuencia, letra):
    """
    Convierte una lista de frames normalizados (cada uno de 63 valores)
    en una fila de ancho fijo TOTAL_FEATURES.
    Si hay menos frames del esperado, rellena con ceros al final.
    """
    flat = np.concatenate(secuencia)                 # len = n_frames * 63
    if len(flat) < TOTAL_FEATURES:
        flat = np.pad(flat, (0, TOTAL_FEATURES - len(flat)))
    return [letra] + flat.tolist()

def frame_estatico_a_fila(frame_norm, letra):
    """
    Un solo frame de 63 valores, rellenado con ceros hasta TOTAL_FEATURES.
    """
    padded = np.pad(frame_norm, (0, TOTAL_FEATURES - len(frame_norm)))
    return [letra] + padded.tolist()

# ── CARGAR DATASET EXISTENTE ─────────────────────────────────────────────
if os.path.exists(ARCHIVO):
    df_prev = pd.read_csv(ARCHIVO, header=None)
    datos   = df_prev.values.tolist()
    print(f"✅ Dataset existente cargado: {len(datos)} muestras")
else:
    datos = []

def conteo():
    c = {l: 0 for l in LETRAS}
    for fila in datos:
        if fila[0] in c:
            c[fila[0]] += 1
    return c

# ── CÁMARA ───────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ No se puede abrir la cámara")
    exit()

letra_idx        = 0
secuencia_mov    = []      # buffer frames para letras de movimiento
historial_est    = []      # buffer frames para detectar estabilidad

print("\n🔥 CAPTURA INICIADA")
print("N=siguiente | B=anterior | D=borrar últimas 20 | Q=guardar y salir\n")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    res   = hands.process(rgb)

    letra   = LETRAS[letra_idx]
    cnt     = conteo()
    n_letra = cnt[letra]

    mano_ok   = False
    frame_norm = None

    if res.multi_hand_landmarks:
        lm_list    = res.multi_hand_landmarks[0].landmark
        pts        = extraer_landmarks(lm_list)
        frame_norm = normalizar(pts)
        mano_ok    = True

        # Dibujar
        mp.solutions.drawing_utils.draw_landmarks(
            frame,
            res.multi_hand_landmarks[0],
            mp_hands.HAND_CONNECTIONS,
            mp.solutions.drawing_utils.DrawingSpec(color=(0,255,80),  thickness=2, circle_radius=4),
            mp.solutions.drawing_utils.DrawingSpec(color=(200,0,255), thickness=2),
        )

        # ── LETRAS CON MOVIMIENTO ─────────────────────────────────────
        if letra in MOVIMIENTO:
            secuencia_mov.append(frame_norm)

            # Barra de progreso de la secuencia
            prog_seq = len(secuencia_mov) / LONGITUD_SECUENCIA

            if len(secuencia_mov) >= LONGITUD_SECUENCIA:
                fila = secuencia_a_fila(secuencia_mov[-LONGITUD_SECUENCIA:], letra)
                datos.append(fila)
                secuencia_mov = []
                print(f"🎥 {letra} secuencia guardada → total {letra}: {n_letra+1}")

        # ── LETRAS ESTÁTICAS ──────────────────────────────────────────
        else:
            historial_est.append(frame_norm)
            if len(historial_est) > FRAMES_ESTABLES:
                historial_est.pop(0)

            if len(historial_est) == FRAMES_ESTABLES:
                dif = np.mean(np.abs(np.array(historial_est) - historial_est[-1]))
                if dif < 0.012:
                    fila = frame_estatico_a_fila(frame_norm, letra)
                    datos.append(fila)
                    historial_est = []
                    print(f"📸 {letra} guardada → total {letra}: {n_letra+1}")

    else:
        secuencia_mov = []
        historial_est = []

    # ── HUD ──────────────────────────────────────────────────────────────
    h, w = frame.shape[:2]

    # Fondo superior
    overlay = frame.copy()
    cv2.rectangle(overlay, (0,0), (w, 130), (0,0,0), -1)
    cv2.addWeighted(overlay, 0.55, frame, 0.45, 0, frame)

    # Letra grande
    col_letra = (0,255,100) if mano_ok else (60,60,200)
    cv2.putText(frame, letra, (15, 110), cv2.FONT_HERSHEY_SIMPLEX, 4.0, col_letra, 6)

    # Tipo
    tipo = "MOVIMIENTO" if letra in MOVIMIENTO else "ESTATICA"
    col_tipo = (0,220,255) if letra in MOVIMIENTO else (255,200,0)
    cv2.putText(frame, tipo, (200, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.9, col_tipo, 2)

    # Progreso de muestras
    pct = min(n_letra / MUESTRAS_OBJETIVO, 1.0)
    bw  = w - 210
    cv2.rectangle(frame, (200, 60), (200+bw, 85), (50,50,50), -1)
    col_bar = (0,200,100) if pct < 0.8 else (0,255,50)
    cv2.rectangle(frame, (200, 60), (200+int(bw*pct), 85), col_bar, -1)
    cv2.putText(frame, f"{n_letra}/{MUESTRAS_OBJETIVO}", (200, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255,255,255), 2)

    # Progreso secuencia (solo movimiento)
    if letra in MOVIMIENTO and mano_ok:
        p = len(secuencia_mov) / LONGITUD_SECUENCIA
        sw = int(p * 200)
        cv2.rectangle(frame, (200, 90), (400, 108), (40,40,40), -1)
        cv2.rectangle(frame, (200, 90), (200+sw, 108), (0,200,255), -1)
        cv2.putText(frame, f"SEQ {len(secuencia_mov)}/{LONGITUD_SECUENCIA}",
                    (405, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,200,255), 1)

    # Mano estado
    est = "MANO OK" if mano_ok else "SIN MANO"
    cv2.putText(frame, est, (200, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.75,
                (0,255,80) if mano_ok else (60,60,200), 2)

    # Navegación
    if letra_idx > 0:
        cv2.putText(frame, f"< {LETRAS[letra_idx-1]}", (10, h-55),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (140,140,140), 2)
    if letra_idx < len(LETRAS)-1:
        cv2.putText(frame, f"{LETRAS[letra_idx+1]} >", (w-90, h-55),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (140,140,140), 2)

    # Pie
    cv2.rectangle(frame, (0, h-35), (w, h), (0,0,0), -1)
    letras_ok = sum(1 for l in LETRAS if cnt[l] >= MUESTRAS_OBJETIVO)
    cv2.putText(frame,
        f"Total: {len(datos)} | {letras_ok}/{len(LETRAS)} completas | N=sig B=ant D=borrar Q=guardar",
        (8, h-10), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180,180,180), 1)

    cv2.imshow("Captura LSM", frame)

    key = cv2.waitKey(1) & 0xFF

    if key == ord('q'):
        break
    elif key in (ord('n'), 83):   # N o flecha derecha
        letra_idx = min(letra_idx+1, len(LETRAS)-1)
        secuencia_mov = []; historial_est = []
    elif key in (ord('b'), 81):   # B o flecha izquierda
        letra_idx = max(letra_idx-1, 0)
        secuencia_mov = []; historial_est = []
    elif key == ord('d'):
        antes = len(datos)
        eliminados = 0
        nuevos = []
        for fila in reversed(datos):
            if fila[0] == letra and eliminados < 20:
                eliminados += 1
            else:
                nuevos.append(fila)
        datos = list(reversed(nuevos))
        print(f"🗑️  Eliminadas {eliminados} muestras de '{letra}'")

cap.release()
cv2.destroyAllWindows()

# ── GUARDAR ──────────────────────────────────────────────────────────────
if datos:
    df = pd.DataFrame(datos)
    df.to_csv(ARCHIVO, index=False, header=False)
    print(f"\n✅ Dataset guardado: {ARCHIVO}")
    print(f"   Total muestras: {len(df)}")
    cnt = conteo()
    print("\n📊 Muestras por letra:")
    for l in LETRAS:
        n   = cnt[l]
        bar = "█" * (n//10) + "░" * max(0,(MUESTRAS_OBJETIVO-n)//10)
        mov = " 🎥" if l in MOVIMIENTO else ""
        print(f"  {l}{mov}: {n:4d}/{MUESTRAS_OBJETIVO}  {bar}")
    print(f"\n▶ Siguiente: python 2_entrenar_modelo.py")
else:
    print("No se grabaron datos.")

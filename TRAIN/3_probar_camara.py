"""
3_probar_camara.py
==================
Detecta señas del LSM en tiempo real con la cámara.

Letras con movimiento (K, Q, Z, J, X, Ñ):
  → acumula 15 frames, extrae las mismas features que en entrenamiento,
    y predice la secuencia completa.

Letras estáticas:
  → usa el frame actual con suavizado de ventana deslizante.

Controles:
  Q         = salir
  C         = limpiar texto
  ESPACIO   = agregar espacio al texto
  BACKSPACE = borrar último carácter
"""

import cv2
import mediapipe as mp
import numpy as np
import pickle
from collections import deque, Counter

# ── ARCHIVOS ─────────────────────────────────────────────────────────────
MODEL_FILE = "modelo_rf.pkl"
ENC_FILE   = "label_encoder.pkl"

# ── CONFIG ───────────────────────────────────────────────────────────────
MOVIMIENTO         = {'K', 'Q', 'Z', 'J', 'X', 'Ñ'}
LONGITUD_SECUENCIA = 15
FEATURES_FRAME     = 63

CONF_MINIMA        = 0.50   # confianza mínima para mostrar letra
CONF_CONFIRMAR     = 0.62   # confianza para agregar al texto
FRAMES_CONFIRMAR   = 20     # frames estables para confirmar letra estática
VENTANA_SUAVIZADO  = 8      # ventana del filtro de moda

# ── CARGAR MODELO ────────────────────────────────────────────────────────
with open(MODEL_FILE, "rb") as f:
    modelo = pickle.load(f)
with open(ENC_FILE, "rb") as f:
    le = pickle.load(f)

print(f"✅ Modelo cargado. Letras disponibles: {list(le.classes_)}")

# ── MEDIAPIPE ────────────────────────────────────────────────────────────
mp_hands   = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.75,
    min_tracking_confidence=0.65,
)

# ── EXTRACCIÓN DE FEATURES (igual que entrenamiento) ─────────────────────
def extraer_features_estatico(row63):
    coords = row63.reshape(21, 3)
    coords -= coords[0]
    escala  = np.max(np.abs(coords)) + 1e-6
    coords /= escala

    pares = [
        (0,4,8),  (0,4,12), (0,4,16), (0,4,20),
        (0,8,12), (0,8,16), (0,8,20),
        (0,12,16),(0,12,20),(0,16,20),
        (5,6,7),  (9,10,11),(13,14,15),(17,18,19),
        (1,2,3),  (2,3,4),
        (5,9,13), (9,13,17),
        (0,5,9),  (0,17,13),
    ]
    angulos = []
    for a, b, c in pares:
        v1 = coords[a] - coords[b]
        v2 = coords[c] - coords[b]
        cos = np.dot(v1, v2) / (np.linalg.norm(v1)*np.linalg.norm(v2) + 1e-6)
        angulos.append(np.arccos(np.clip(cos, -1, 1)))

    yemas = [4, 8, 12, 16, 20]
    dists = []
    for i in range(len(yemas)):
        for j in range(i+1, len(yemas)):
            dists.append(np.linalg.norm(coords[yemas[i]] - coords[yemas[j]]))

    return np.concatenate([coords.flatten(), angulos, dists])   # 93


def extraer_features_movimiento(frames_list):
    """frames_list: lista de arrays de 63 valores (ya normalizados en bruto)."""
    frames_norm = []
    for f in frames_list:
        coords = f.reshape(21, 3)
        coords -= coords[0]
        escala  = np.max(np.abs(coords)) + 1e-6
        coords /= escala
        frames_norm.append(coords.flatten())
    frames_norm = np.array(frames_norm)   # (15,63)

    n      = len(frames_norm)
    first  = frames_norm[0]
    mid    = frames_norm[n // 2]
    last   = frames_norm[-1]
    delta  = last - first
    velocidad = np.mean(np.abs(np.diff(frames_norm, axis=0)), axis=0)

    tray_muneca = frames_norm[:, 0:3]
    tray_indice = frames_norm[:, 24:27]

    def traj_stats(tray):
        return np.concatenate([tray.mean(0), tray.std(0), tray.max(0)-tray.min(0)])

    return np.concatenate([
        first, mid, last, delta, velocidad,
        traj_stats(tray_muneca),
        traj_stats(tray_indice),
    ])


def normalizar_frame(lm_list):
    pts = np.array([[p.x, p.y, p.z] for p in lm_list], dtype=np.float32)
    pts -= pts[0]
    escala = np.max(np.abs(pts)) + 1e-6
    pts /= escala
    return pts.flatten()   # (63,)


def predecir_estatico(frame_norm):
    feat   = extraer_features_estatico(frame_norm)
    feat_p = np.pad(feat, (0, max(0, 333 - len(feat)))).reshape(1, -1)
    proba  = modelo.predict_proba(feat_p)[0]
    idx    = np.argmax(proba)
    return le.classes_[idx], proba[idx], proba


def predecir_movimiento(frames_list):
    feat   = extraer_features_movimiento(frames_list)
    feat_p = np.pad(feat, (0, max(0, 333 - len(feat)))).reshape(1, -1)
    proba  = modelo.predict_proba(feat_p)[0]
    idx    = np.argmax(proba)
    return le.classes_[idx], proba[idx], proba


# ── ESTADO ───────────────────────────────────────────────────────────────
buffer_frames   = deque(maxlen=LONGITUD_SECUENCIA)   # para movimiento
buffer_suavizado = deque(maxlen=VENTANA_SUAVIZADO)   # para estáticas
estable_cnt     = 0
ultima_letra    = ""
texto           = ""

# ── CÁMARA ───────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH,  900)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 600)

import time
fps_t  = time.time()
fps    = 0
cnt_fps = 0

print("🎥 Detector iniciado. Q=salir | C=limpiar | ESPACIO=espacio | BKSP=borrar")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    res   = hands.process(rgb)

    letra_pred = ""
    conf_pred  = 0.0
    mano_ok    = False
    progreso   = 0
    modo_mov   = False

    if res.multi_hand_landmarks:
        lm = res.multi_hand_landmarks[0].landmark
        mp_drawing.draw_landmarks(
            frame, res.multi_hand_landmarks[0], mp_hands.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(0,255,80),  thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(200,0,255), thickness=2),
        )
        mano_ok    = True
        frame_norm = normalizar_frame(lm)
        buffer_frames.append(frame_norm)

        # ── Predicción rápida para mostrar en pantalla ────────────────
        letra_pred, conf_pred, _ = predecir_estatico(frame_norm)
        buffer_suavizado.append(letra_pred)
        if len(buffer_suavizado) >= 3:
            letra_pred = Counter(buffer_suavizado).most_common(1)[0][0]

        # ── Detección de letras con movimiento ────────────────────────
        # Solo intentamos predecir cuando hay suficientes frames
        if len(buffer_frames) == LONGITUD_SECUENCIA:
            letra_mov, conf_mov, _ = predecir_movimiento(list(buffer_frames))
            if letra_mov in MOVIMIENTO and conf_mov > conf_pred:
                letra_pred = letra_mov
                conf_pred  = conf_mov
                modo_mov   = True

        # ── Lógica de confirmación ────────────────────────────────────
        if letra_pred == ultima_letra and conf_pred >= CONF_CONFIRMAR:
            estable_cnt += 1
        else:
            estable_cnt = 0
            ultima_letra = letra_pred

        progreso = estable_cnt

        if estable_cnt >= FRAMES_CONFIRMAR and conf_pred >= CONF_CONFIRMAR:
            texto        += letra_pred
            estable_cnt   = 0
            ultima_letra  = ""
            buffer_suavizado.clear()
            buffer_frames.clear()
            print(f"  ✅ Confirmada: {letra_pred}  → '{texto}'")
    else:
        buffer_frames.clear()
        buffer_suavizado.clear()
        estable_cnt  = 0
        ultima_letra = ""

    # ── FPS ──────────────────────────────────────────────────────────────
    cnt_fps += 1
    if cnt_fps % 30 == 0:
        fps   = 30 / (time.time() - fps_t + 1e-6)
        fps_t = time.time()

    # ── HUD ──────────────────────────────────────────────────────────────
    h, w = frame.shape[:2]

    # Panel superior
    overlay = frame.copy()
    cv2.rectangle(overlay, (0,0), (w, 120), (15,15,15), -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

    if mano_ok and conf_pred >= CONF_MINIMA:
        if conf_pred >= 0.80:   col = (0,255,100)
        elif conf_pred >= 0.60: col = (0,220,255)
        else:                   col = (0,140,255)

        # Letra grande
        cv2.putText(frame, letra_pred, (15,105),
                    cv2.FONT_HERSHEY_DUPLEX, 4.0, col, 6)

        # Confianza
        cv2.putText(frame, f"{conf_pred*100:.0f}%", (200, 55),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.4, col, 2)

        # Barra de confianza
        bw = int(conf_pred * 230)
        cv2.rectangle(frame, (200, 65), (430, 82), (50,50,50), -1)
        cv2.rectangle(frame, (200, 65), (200+bw, 82), col, -1)

        # Barra de progreso para confirmar
        prog_w = int((min(estable_cnt, FRAMES_CONFIRMAR) / FRAMES_CONFIRMAR) * (w - 40))
        cv2.rectangle(frame, (20, 105), (w-20, 115), (40,40,40), -1)
        cv2.rectangle(frame, (20, 105), (20+prog_w, 115), (0,255,255), -1)

        # Etiqueta modo
        if modo_mov:
            cv2.putText(frame, "MOVIMIENTO", (w-170, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,220,255), 2)
        else:
            cv2.putText(frame, "ESTATICA", (w-140, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,200,0), 2)

    else:
        msg = "Pon tu mano frente a la camara" if not mano_ok else "Confianza baja..."
        cv2.putText(frame, msg, (15, 65),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (80,80,80), 2)

    # Panel inferior
    cv2.rectangle(frame, (0, h-90), (w, h), (15,15,15), -1)

    cv2.putText(frame, "TEXTO:", (12, h-58),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (120,120,120), 1)
    mostrar = texto[-30:] if len(texto) > 30 else texto
    cv2.putText(frame, mostrar if mostrar else "_",
                (100, h-58), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255,255,80), 2)

    cv2.putText(frame,
        "Q=salir   C=limpiar   ESPACIO=espacio   BKSP=borrar",
        (12, h-18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (90,90,90), 1)

    cv2.putText(frame, f"FPS {fps:.0f}", (w-80, h-18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (80,80,80), 1)

    cv2.imshow("LSM Detector", frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('c'):
        texto = ""
        print("  Texto limpiado.")
    elif key == ord(' '):
        texto += " "
    elif key == 8:   # backspace
        texto = texto[:-1]

cap.release()
cv2.destroyAllWindows()
print(f"\nTexto final: '{texto}'")

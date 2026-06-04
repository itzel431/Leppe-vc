"""
6_detector_frases.py
====================
Detecta las 11 frases/palabras del LSM en tiempo real.

Lógica:
  - Acumula 20 frames continuos cuando detecta una mano
  - Cada 20 frames hace una predicción
  - Usa ventana deslizante de votación para suavizar resultados
  - Confirma la frase cuando hay estabilidad suficiente

Para "MI_NOMBRE": detecta la seña y luego automáticamente
  activa el modo deletreo (si tienes el modelo de letras).

Controles:
  Q         = salir
  C         = limpiar texto acumulado
  ESPACIO   = agregar espacio al texto
  BACKSPACE = borrar última palabra
  M         = alternar modo (FRASES / LETRAS si tienes el modelo)
"""

import cv2
import mediapipe as mp
import numpy as np
import pickle
import os
from collections import deque, Counter

# ── ARCHIVOS ──────────────────────────────────────────────────────────────
MODEL_FRASES = "modelo_frases.pkl"
ENC_FRASES   = "encoder_frases.pkl"

# Modelo de letras (opcional, para deletreo después de MI_NOMBRE)
MODEL_LETRAS = "modelo_rf.pkl"
ENC_LETRAS   = "label_encoder.pkl"

# ── CONFIG ────────────────────────────────────────────────────────────────
LONGITUD_SECUENCIA = 20
FEATURES_FRAME     = 63

CONF_MINIMA    = 0.45   # confianza mínima para mostrar predicción
CONF_CONFIRMAR = 0.58   # confianza para agregar al texto
FRAMES_ESTABLES = 25    # frames estables para confirmar una seña
VENTANA_VOTO    = 6     # tamaño de ventana de votación

# Traducción de etiquetas a texto legible
TRADUCCION = {
    "MI_NOMBRE":     "Mi nombre es...",
    "HASTA_MANANA":  "Hasta mañana",
    "NO":            "No",
    "QUIERO":        "Quiero",
    "APRENDER":      "Aprender",
    "SI":            "Sí",
    "ENTIENDO":      "Entiendo",
    "NO_ENTIENDO":   "No entiendo",
    "POR_FAVOR":     "Por favor",
    "GRACIAS":       "Gracias",
    "REPETIR_FAVOR": "¿Lo repites por favor?",
}

# Color por categoría
COLOR_SEÑA = {
    "NO":         (60, 60, 220),   # Rojo-azul (negación)
    "NO_ENTIENDO":(60, 60, 220),
    "SI":         (0, 220, 80),    # Verde (afirmación)
    "ENTIENDO":   (0, 220, 80),
    "GRACIAS":    (0, 200, 255),   # Cian (cortesía)
    "POR_FAVOR":  (0, 200, 255),
    "REPETIR_FAVOR": (200, 150, 0),
}

def color_seña(etiqueta):
    return COLOR_SEÑA.get(etiqueta, (255, 200, 0))

# ── CARGAR MODELOS ────────────────────────────────────────────────────────
print("📂 Cargando modelo de frases...")
with open(MODEL_FRASES, "rb") as f:
    modelo_frases = pickle.load(f)
with open(ENC_FRASES, "rb") as f:
    le_frases = pickle.load(f)

print(f"✅ Frases disponibles: {list(le_frases.classes_)}")

tiene_letras = False
modelo_letras = None
le_letras     = None
if os.path.exists(MODEL_LETRAS) and os.path.exists(ENC_LETRAS):
    with open(MODEL_LETRAS, "rb") as f:
        modelo_letras = pickle.load(f)
    with open(ENC_LETRAS, "rb") as f:
        le_letras = pickle.load(f)
    tiene_letras = True
    print(f"✅ Modelo de letras también cargado (modo deletreo disponible)")

# ── MEDIAPIPE ─────────────────────────────────────────────────────────────
mp_hands   = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.75,
    min_tracking_confidence=0.65,
)

# ── EXTRACCIÓN DE FEATURES (igual que entrenamiento) ─────────────────────
def extraer_features(frames_list):
    frames_norm = []
    for f in frames_list:
        coords = f.reshape(21, 3)
        coords -= coords[0]
        escala  = np.max(np.abs(coords)) + 1e-6
        coords /= escala
        frames_norm.append(coords.flatten())
    frames_norm = np.array(frames_norm, dtype=np.float32)

    n = len(frames_norm)
    f0   = frames_norm[0]
    f25  = frames_norm[n // 4]
    f50  = frames_norm[n // 2]
    f75  = frames_norm[3 * n // 4]
    f100 = frames_norm[-1]

    delta     = f100 - f0
    velocidad = np.mean(np.abs(np.diff(frames_norm, axis=0)), axis=0)

    tray_muneca = frames_norm[:, 0:3]
    tray_pulgar = frames_norm[:, 12:15]
    tray_indice = frames_norm[:, 24:27]
    tray_medio  = frames_norm[:, 36:39]

    def traj_stats(tray):
        return np.concatenate([
            tray.mean(0), tray.std(0),
            tray.max(0) - tray.min(0),
            tray[-1] - tray[0],
        ])

    diffs = np.diff(frames_norm, axis=0)
    seg   = max(1, n // 4)
    energia = np.array([
        np.mean(diffs[:seg]     ** 2),
        np.mean(diffs[seg:2*seg]** 2),
        np.mean(diffs[2*seg:3*seg]**2),
        np.mean(diffs[3*seg:]   ** 2),
    ])

    def angulos_frame(fv):
        coords = fv.reshape(21, 3)
        pares  = [(0,4,8),(0,8,12),(0,12,16),(0,16,20),(5,6,7),(9,10,11),(13,14,15)]
        angs   = []
        for a, b, c in pares:
            v1  = coords[a] - coords[b]
            v2  = coords[c] - coords[b]
            cos = np.dot(v1, v2) / (np.linalg.norm(v1)*np.linalg.norm(v2) + 1e-6)
            angs.append(np.arccos(np.clip(cos, -1, 1)))
        return np.array(angs)

    return np.concatenate([
        f0, f25, f50, f75, f100,
        delta, velocidad,
        traj_stats(tray_muneca), traj_stats(tray_pulgar),
        traj_stats(tray_indice), traj_stats(tray_medio),
        energia,
        angulos_frame(f0), angulos_frame(f50), angulos_frame(f100),
    ])


def normalizar_frame(lm_list):
    pts = np.array([[p.x, p.y, p.z] for p in lm_list], dtype=np.float32)
    pts -= pts[0]
    escala = np.max(np.abs(pts)) + 1e-6
    pts /= escala
    return pts.flatten()


def predecir_frase(frames_list):
    feat = extraer_features(frames_list)
    feat_p = np.pad(feat, (0, max(0, 514 - len(feat)))).reshape(1, -1)
    proba = modelo_frases.predict_proba(feat_p)[0]
    idx   = np.argmax(proba)
    return le_frases.classes_[idx], proba[idx]


def predecir_letra_estatica(frame_norm):
    if not tiene_letras:
        return "", 0.0
    coords = frame_norm.reshape(21, 3)
    coords -= coords[0]
    escala  = np.max(np.abs(coords)) + 1e-6
    coords /= escala

    pares = [
        (0,4,8),(0,4,12),(0,4,16),(0,4,20),
        (0,8,12),(0,8,16),(0,8,20),
        (0,12,16),(0,12,20),(0,16,20),
        (5,6,7),(9,10,11),(13,14,15),(17,18,19),
        (1,2,3),(2,3,4),(5,9,13),(9,13,17),(0,5,9),(0,17,13),
    ]
    angulos = []
    for a, b, c in pares:
        v1  = coords[a] - coords[b]
        v2  = coords[c] - coords[b]
        cos = np.dot(v1, v2) / (np.linalg.norm(v1)*np.linalg.norm(v2) + 1e-6)
        angulos.append(np.arccos(np.clip(cos, -1, 1)))
    yemas = [4, 8, 12, 16, 20]
    dists = [np.linalg.norm(coords[yemas[i]] - coords[yemas[j]])
             for i in range(len(yemas)) for j in range(i+1, len(yemas))]
    feat  = np.concatenate([coords.flatten(), angulos, dists])
    feat_p = np.pad(feat, (0, max(0, 333 - len(feat)))).reshape(1, -1)
    proba = modelo_letras.predict_proba(feat_p)[0]
    idx   = np.argmax(proba)
    return le_letras.classes_[idx], proba[idx]


# ── ESTADO ────────────────────────────────────────────────────────────────
buffer_frames   = deque(maxlen=LONGITUD_SECUENCIA)
buffer_voto     = deque(maxlen=VENTANA_VOTO)
estable_cnt     = 0
ultima_pred     = ""
texto_acum      = []    # lista de frases confirmadas
modo_deletreo   = False  # True = esperando deletreo del nombre
buffer_letras   = deque(maxlen=8)
estable_letra   = 0
ultima_letra    = ""
MODO            = "FRASES"   # "FRASES" o "LETRAS"

import time
fps_t   = time.time()
fps     = 0
cnt_fps = 0

# ── CÁMARA ────────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH,  960)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 640)

print("🎥 Detector de frases iniciado.")
print("   Q=salir  C=limpiar  ESPACIO=agregar espacio  BKSP=borrar  M=cambiar modo")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    res   = hands.process(rgb)

    pred_actual  = ""
    conf_actual  = 0.0
    mano_ok      = False
    progreso     = 0

    h, w = frame.shape[:2]

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

        if MODO == "FRASES":
            # ── Predicción cada frame con la ventana actual ───────────
            if len(buffer_frames) == LONGITUD_SECUENCIA:
                pred_actual, conf_actual = predecir_frase(list(buffer_frames))
                buffer_voto.append(pred_actual)

                # Votación suavizada
                if len(buffer_voto) >= 3:
                    pred_actual = Counter(buffer_voto).most_common(1)[0][0]

                # Confirmación
                if pred_actual == ultima_pred and conf_actual >= CONF_CONFIRMAR:
                    estable_cnt += 1
                else:
                    estable_cnt  = 0
                    ultima_pred  = pred_actual

                progreso = estable_cnt

                if estable_cnt >= FRAMES_ESTABLES and conf_actual >= CONF_CONFIRMAR:
                    texto_str = TRADUCCION.get(pred_actual, pred_actual)
                    texto_acum.append(texto_str)
                    estable_cnt  = 0
                    ultima_pred  = ""
                    buffer_voto.clear()
                    buffer_frames.clear()
                    print(f"  ✅ Confirmada: {pred_actual} → '{texto_str}'")

                    # Si es MI_NOMBRE, activar modo deletreo automáticamente
                    if pred_actual == "MI_NOMBRE" and tiene_letras:
                        modo_deletreo = True
                        MODO = "LETRAS"
                        print("  📝 Modo deletreo activado — escribe tu nombre")

        elif MODO == "LETRAS":
            # ── Modo deletreo de nombre ───────────────────────────────
            letra_pred, conf_letra = predecir_letra_estatica(frame_norm)
            buffer_letras.append(letra_pred)
            if len(buffer_letras) >= 3:
                letra_pred = Counter(buffer_letras).most_common(1)[0][0]
            pred_actual  = letra_pred
            conf_actual  = conf_letra

            if letra_pred == ultima_letra and conf_letra >= 0.60:
                estable_letra += 1
            else:
                estable_letra = 0
                ultima_letra  = letra_pred

            progreso = estable_letra

            if estable_letra >= 20 and conf_letra >= 0.60:
                texto_acum.append(letra_pred)
                estable_letra = 0
                ultima_letra  = ""
                buffer_letras.clear()
                print(f"  📝 Letra: {letra_pred}")

    else:
        buffer_frames.clear()
        estable_cnt  = 0
        ultima_pred  = ""
        if MODO == "LETRAS":
            estable_letra = 0
            ultima_letra  = ""
            buffer_letras.clear()

    # ── FPS ───────────────────────────────────────────────────────────────
    cnt_fps += 1
    if cnt_fps % 30 == 0:
        fps   = 30 / (time.time() - fps_t + 1e-6)
        fps_t = time.time()

    # ── HUD ───────────────────────────────────────────────────────────────
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 130), (12, 12, 12), -1)
    cv2.addWeighted(overlay, 0.72, frame, 0.28, 0, frame)

    if mano_ok and pred_actual and conf_actual >= CONF_MINIMA:
        col = color_seña(pred_actual)
        if conf_actual >= 0.80:   col = (0, 255, 100)
        elif conf_actual >= 0.60: pass  # mantener color de seña
        else:                     col = (0, 140, 255)

        # Texto de predicción
        texto_pred = TRADUCCION.get(pred_actual, pred_actual)
        fuente_scale = 1.0 if len(texto_pred) < 15 else 0.75
        cv2.putText(frame, texto_pred, (15, 60),
                    cv2.FONT_HERSHEY_DUPLEX, fuente_scale, col, 2)

        # Confianza
        cv2.putText(frame, f"{conf_actual*100:.0f}%", (w - 110, 55),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, col, 2)

        # Barra de confianza
        bw_conf = int(conf_actual * 200)
        cv2.rectangle(frame, (15, 70), (215, 85), (50, 50, 50), -1)
        cv2.rectangle(frame, (15, 70), (15 + bw_conf, 85), col, -1)

        # Barra de progreso para confirmar
        frames_conf = 20 if MODO == "LETRAS" else FRAMES_ESTABLES
        prog_w = int((min(progreso, frames_conf) / frames_conf) * (w - 30))
        cv2.rectangle(frame, (15, 92), (w - 15, 105), (40, 40, 40), -1)
        cv2.rectangle(frame, (15, 92), (15 + prog_w, 105), (0, 255, 255), -1)

    else:
        msg = "Haz una seña frente a la cámara" if not mano_ok else "Confianza baja..."
        cv2.putText(frame, msg, (15, 65),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (70, 70, 70), 2)

    # Modo actual
    col_modo = (0, 220, 255) if MODO == "FRASES" else (255, 200, 0)
    cv2.putText(frame, f"MODO: {MODO}", (15, 120),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, col_modo, 2)

    # Panel inferior
    cv2.rectangle(frame, (0, h - 100), (w, h), (12, 12, 12), -1)

    # Texto acumulado
    cv2.putText(frame, "TEXTO:", (12, h - 70),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (120, 120, 120), 1)
    texto_mostrar = " ".join(texto_acum)
    if len(texto_mostrar) > 40:
        texto_mostrar = "..." + texto_mostrar[-40:]
    cv2.putText(frame, texto_mostrar if texto_mostrar else "_",
                (90, h - 70), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 80), 2)

    # Buffer de señas recientes (mini historial)
    recientes = " | ".join(texto_acum[-4:]) if texto_acum else ""
    cv2.putText(frame, recientes, (12, h - 42),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 150, 180), 1)

    cv2.putText(frame,
        "Q=salir   C=limpiar   ESPACIO=espacio   BKSP=borrar   M=modo letras/frases",
        (12, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (80, 80, 80), 1)

    cv2.putText(frame, f"FPS {fps:.0f}", (w - 80, h - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (70, 70, 70), 1)

    cv2.imshow("LSM - Detector de Frases", frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('c'):
        texto_acum = []
        print("  Texto limpiado.")
    elif key == ord(' '):
        texto_acum.append(" ")
    elif key == 8:   # backspace
        if texto_acum:
            texto_acum.pop()
    elif key == ord('m'):
        MODO = "LETRAS" if MODO == "FRASES" else "FRASES"
        buffer_frames.clear(); buffer_voto.clear()
        buffer_letras.clear(); estable_cnt = 0; estable_letra = 0
        print(f"  Modo cambiado a: {MODO}")

cap.release()
cv2.destroyAllWindows()
print(f"\nTexto final: '{' '.join(texto_acum)}'")

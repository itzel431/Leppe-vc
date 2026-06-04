"""
5_entrenar_frases.py
====================
Entrena el modelo para reconocer las 11 frases/palabras del LSM.

Cada fila del CSV tiene:
  col 0      = etiqueta (nombre de la seña)
  cols 1..N  = features (ancho fijo = 63 * 20 = 1260)

Pipeline:
  1. Carga y limpieza
  2. Extrae features de movimiento rico (igual que entrenamiento de letras)
  3. Aumentación de datos agresiva
  4. Entrena RandomForest con StandardScaler
  5. Evalúa y guarda
"""

import os
import sys
import numpy as np
import pandas as pd
import pickle
from collections import Counter

from sklearn.ensemble        import RandomForestClassifier
from sklearn.preprocessing   import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics         import classification_report
from sklearn.pipeline        import Pipeline

# ── CONFIG ────────────────────────────────────────────────────────────────
CSV_PATH   = "datos_frases/dataset_frases.csv"
MODEL_FILE = "modelo_frases.pkl"
ENC_FILE   = "encoder_frases.pkl"

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

LONGITUD_SECUENCIA = 20
FEATURES_FRAME     = 63
TOTAL_FEATURES     = FEATURES_FRAME * LONGITUD_SECUENCIA   # 1260

# ── CARGA ─────────────────────────────────────────────────────────────────
if not os.path.exists(CSV_PATH):
    print(f"❌ No se encontró {CSV_PATH}")
    print("   Corre primero:  python 4_capturar_frases.py")
    sys.exit(1)

print("📂 Cargando dataset de frases...")
df = pd.read_csv(CSV_PATH, header=None)
df = df[df.iloc[:, 0].isin(SEÑAS)]
print(f"✅ Muestras válidas: {len(df)}")

print("\n📊 Muestras por seña:")
conteo = df.iloc[:, 0].value_counts().sort_index()
print(conteo.to_string())

# Verificar ancho
n_feat = df.shape[1] - 1
if n_feat != TOTAL_FEATURES:
    print(f"\n⚠️  Ancho del dataset: {n_feat} features (esperado: {TOTAL_FEATURES})")
    print("   Recaptura con 4_capturar_frases.py")
    sys.exit(1)

labels = df.iloc[:, 0].values
raw    = df.iloc[:, 1:].values.astype(np.float32)   # (N, 1260)


# ── EXTRACCIÓN DE FEATURES ────────────────────────────────────────────────
def extraer_features(row1260):
    """
    Extrae features ricas de una secuencia de 20 frames.
    Captura:
      - primer frame, frame 1/4, frame 1/2, frame 3/4, último frame
      - delta total (movimiento neto)
      - velocidad media por landmark
      - trayectorias de muñeca, índice y pulgar (con estadísticas)
      - energía cinética por segmento
    """
    frames = row1260.reshape(LONGITUD_SECUENCIA, FEATURES_FRAME)  # (20, 63)

    # Normalizar cada frame
    frames_norm = []
    for f in frames:
        coords = f.reshape(21, 3)
        coords -= coords[0]
        escala  = np.max(np.abs(coords)) + 1e-6
        coords /= escala
        frames_norm.append(coords.flatten())
    frames_norm = np.array(frames_norm, dtype=np.float32)   # (20, 63)

    n = LONGITUD_SECUENCIA
    f0   = frames_norm[0]
    f25  = frames_norm[n // 4]
    f50  = frames_norm[n // 2]
    f75  = frames_norm[3 * n // 4]
    f100 = frames_norm[-1]

    delta     = f100 - f0
    velocidad = np.mean(np.abs(np.diff(frames_norm, axis=0)), axis=0)

    # Trayectoria de puntos clave
    tray_muneca = frames_norm[:, 0:3]    # punto 0 (muñeca)
    tray_pulgar = frames_norm[:, 12:15]  # punto 4 (punta pulgar)
    tray_indice = frames_norm[:, 24:27]  # punto 8 (punta índice)
    tray_medio  = frames_norm[:, 36:39]  # punto 12 (punta medio)

    def traj_stats(tray):
        return np.concatenate([
            tray.mean(0),
            tray.std(0),
            tray.max(0) - tray.min(0),   # rango de movimiento
            tray[-1] - tray[0],          # desplazamiento neto
        ])  # 4 * 3 = 12 valores

    # Energía cinética (velocidad al cuadrado) en 4 segmentos
    diffs = np.diff(frames_norm, axis=0)   # (19, 63)
    seg   = n // 4
    energia = np.array([
        np.mean(diffs[:seg]  ** 2),
        np.mean(diffs[seg:2*seg]  ** 2),
        np.mean(diffs[2*seg:3*seg] ** 2),
        np.mean(diffs[3*seg:] ** 2),
    ])

    # Ángulos en frame inicial, medio y final
    def angulos_frame(fv):
        coords = fv.reshape(21, 3)
        pares = [(0,4,8),(0,8,12),(0,12,16),(0,16,20),(5,6,7),(9,10,11),(13,14,15)]
        angs = []
        for a, b, c in pares:
            v1 = coords[a] - coords[b]
            v2 = coords[c] - coords[b]
            cos = np.dot(v1, v2) / (np.linalg.norm(v1)*np.linalg.norm(v2) + 1e-6)
            angs.append(np.arccos(np.clip(cos, -1, 1)))
        return np.array(angs)  # 7 valores

    ang_ini = angulos_frame(f0)
    ang_med = angulos_frame(f50)
    ang_fin = angulos_frame(f100)

    return np.concatenate([
        f0, f25, f50, f75, f100,     # 5 * 63 = 315
        delta,                         # 63
        velocidad,                     # 63
        traj_stats(tray_muneca),       # 12
        traj_stats(tray_pulgar),       # 12
        traj_stats(tray_indice),       # 12
        traj_stats(tray_medio),        # 12
        energia,                       # 4
        ang_ini, ang_med, ang_fin,     # 3 * 7 = 21
    ])   # Total ≈ 514 features


# ── CONSTRUIR X, y ────────────────────────────────────────────────────────
print("\n🔧 Extrayendo features...")
X_list = [extraer_features(raw[i]) for i in range(len(labels))]
max_len = max(len(x) for x in X_list)
X = np.array([np.pad(x, (0, max_len - len(x))) for x in X_list], dtype=np.float32)
y = np.array(labels)
print(f"✅ Features shape: {X.shape}")

# ── LIMPIEZA DE OUTLIERS ──────────────────────────────────────────────────
mask = np.max(np.abs(X), axis=1) > 0.005
X, y = X[mask], y[mask]
print(f"🧹 Después de limpiar outliers: {len(X)}")

# ── AUMENTACIÓN ───────────────────────────────────────────────────────────
print("\n📈 Aumentando datos...")
X_aug = [X.copy()]
y_aug = [y.copy()]

# Ruido gaussiano en varios niveles
for std in [0.005, 0.010, 0.015, 0.020, 0.025]:
    X_aug.append(X + np.random.normal(0, std, X.shape).astype(np.float32))
    y_aug.append(y)

# Escalado aleatorio
for _ in range(5):
    escala = np.random.uniform(0.85, 1.15, (len(X), 1)).astype(np.float32)
    X_aug.append(X * escala)
    y_aug.append(y)

# Rotación pequeña en XY
for angulo_deg in [-10, -5, 5, 10]:
    ang  = np.radians(angulo_deg)
    c, s = np.cos(ang), np.sin(ang)
    X_rot = X.copy()
    for k in range(0, min(63, X.shape[1] - 1), 3):
        xo = X[:, k].copy()
        yo = X[:, k + 1].copy()
        X_rot[:, k]     = c * xo - s * yo
        X_rot[:, k + 1] = s * xo + c * yo
    X_aug.append(X_rot)
    y_aug.append(y)

# Inversión temporal (reproducir la seña al revés) — útil para distinguir
# señas similares en dirección opuesta
for i in range(len(raw)):
    frames = raw[i].reshape(LONGITUD_SECUENCIA, FEATURES_FRAME)
    frames_inv = frames[::-1].flatten()
    # Solo como ruido, NO como etiqueta diferente
    feat_inv = extraer_features(np.pad(frames_inv, (0, TOTAL_FEATURES - len(frames_inv))))
    feat_inv_pad = np.pad(feat_inv, (0, max_len - len(feat_inv)))
    X_aug.append(feat_inv_pad.reshape(1, -1))
    y_aug.append(np.array([y[i]]))

X_final = np.vstack(X_aug)
y_final = np.concatenate(y_aug)
print(f"✅ Dataset aumentado: {X_final.shape}")

# ── LABEL ENCODING ────────────────────────────────────────────────────────
le    = LabelEncoder()
y_enc = le.fit_transform(y_final)
print(f"🏷️  Clases: {list(le.classes_)}")

# ── SPLIT ─────────────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X_final, y_enc, test_size=0.15, stratify=y_enc, random_state=42
)
print(f"\n📦 Train: {len(X_train)}  |  Test: {len(X_test)}")

# ── MODELO ────────────────────────────────────────────────────────────────
print("\n🌲 Entrenando RandomForest para frases...")
rf = RandomForestClassifier(
    n_estimators=2000,
    max_depth=None,
    min_samples_leaf=1,
    min_samples_split=2,
    max_features="sqrt",
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)

pipe = Pipeline([
    ("scaler", StandardScaler()),
    ("model",  rf),
])

pipe.fit(X_train, y_train)

acc_train = pipe.score(X_train, y_train)
acc_test  = pipe.score(X_test,  y_test)
print(f"   Train acc: {acc_train*100:.2f}%")
print(f"   Test  acc: {acc_test*100:.2f}%")

y_pred = pipe.predict(X_test)
print("\n📋 Reporte por seña:")
print(classification_report(y_test, y_pred, target_names=le.classes_, zero_division=0))

# ── GUARDAR ───────────────────────────────────────────────────────────────
with open(MODEL_FILE, "wb") as f:
    pickle.dump(pipe, f)
with open(ENC_FILE, "wb") as f:
    pickle.dump(le, f)

print(f"\n✅ Modelo guardado: {MODEL_FILE}")
print(f"✅ Encoder guardado: {ENC_FILE}")
print(f"\n▶ Siguiente: python 6_detector_frases.py")

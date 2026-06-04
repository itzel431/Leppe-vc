"""
2_entrenar_modelo.py
====================
Entrena el modelo LSM con el dataset capturado.

Cada fila del CSV tiene:
  col 0      = letra (label)
  cols 1..N  = features (ancho fijo = 63 * 15 = 945)

Letras con movimiento (K, Q, Z, J, X, Ñ):
  Sus 945 features contienen 15 frames reales.

Letras estáticas:
  Sus 945 features = 63 reales + 882 ceros de relleno.
  Al normalizar, solo usamos los primeros 63.

Pipeline:
  1. Carga y limpieza
  2. Extrae features apropiadas por tipo de letra
  3. Aumentación de datos agresiva
  4. Entrena RandomForest + GradientBoosting (ensemble)
  5. Evalúa y guarda
"""

import os
import sys
import numpy as np
import pandas as pd
import pickle
from collections import Counter

from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    VotingClassifier,
)
from sklearn.preprocessing  import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics         import classification_report
from sklearn.pipeline        import Pipeline

# ── CONFIG ───────────────────────────────────────────────────────────────
CSV_PATH   = "datos_capturados/dataset_landmarks.csv"
MODEL_FILE = "modelo_rf.pkl"
ENC_FILE   = "label_encoder.pkl"

LETRAS     = list("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ")
MOVIMIENTO = {'K', 'Q', 'Z', 'J', 'X', 'Ñ'}

LONGITUD_SECUENCIA = 15
FEATURES_FRAME     = 63
TOTAL_FEATURES     = FEATURES_FRAME * LONGITUD_SECUENCIA   # 945

# ── CARGA ────────────────────────────────────────────────────────────────
if not os.path.exists(CSV_PATH):
    print(f"❌ No se encontró {CSV_PATH}")
    print("   Corre primero:  python 1_capturar_datos.py")
    sys.exit(1)

print("📂 Cargando dataset...")
df = pd.read_csv(CSV_PATH, header=None)

# Limpiar filas con label inválido
df = df[df.iloc[:,0].isin(LETRAS)]
print(f"✅ Muestras válidas: {len(df)}")

print("\n📊 Muestras por letra:")
conteo = df.iloc[:,0].value_counts().sort_index()
print(conteo.to_string())

# ── VERIFICACIÓN DE ANCHO ────────────────────────────────────────────────
n_feat = df.shape[1] - 1   # sin la columna de label
if n_feat != TOTAL_FEATURES:
    print(f"\n⚠️  Ancho del dataset: {n_feat} features")
    print(f"   Esperado: {TOTAL_FEATURES}  (63 * {LONGITUD_SECUENCIA})")
    print("   Parece un dataset viejo. Recaptura con el nuevo 1_capturar_datos.py")
    sys.exit(1)

labels = df.iloc[:,0].values
raw    = df.iloc[:,1:].values.astype(np.float32)   # (N, 945)

# ── EXTRACCIÓN DE FEATURES ───────────────────────────────────────────────
def extraer_features_estatico(row945):
    """
    Para letra estática: solo usamos el primer frame (63 features).
    Calculamos también 20 ángulos entre pares de dedos para
    distinguir mejor letras parecidas.
    """
    coords = row945[:63].reshape(21, 3)

    # Normalizar de nuevo (por si acaso)
    coords -= coords[0]
    escala  = np.max(np.abs(coords)) + 1e-6
    coords /= escala

    # Ángulos entre vectores de dedos (más discriminativos)
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
        cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        angulos.append(np.arccos(np.clip(cos, -1, 1)))

    # Distancias entre yemas (muy discriminativas)
    yemas = [4, 8, 12, 16, 20]
    dists = []
    for i in range(len(yemas)):
        for j in range(i+1, len(yemas)):
            dists.append(np.linalg.norm(coords[yemas[i]] - coords[yemas[j]]))

    return np.concatenate([coords.flatten(), angulos, dists])   # 63+20+10 = 93


def extraer_features_movimiento(row945):
    """
    Para letra con movimiento: usamos los 15 frames.
    Extraemos: primer frame, frame medio, último frame, y el DELTA
    (diferencia entre último y primer frame = información de movimiento).
    Además calculamos la velocidad media (movimiento total por frame).
    """
    frames = row945.reshape(LONGITUD_SECUENCIA, FEATURES_FRAME)  # (15,63)

    frames_norm = []
    for f in frames:
        coords = f.reshape(21, 3)
        coords -= coords[0]
        escala  = np.max(np.abs(coords)) + 1e-6
        coords /= escala
        frames_norm.append(coords.flatten())
    frames_norm = np.array(frames_norm)   # (15, 63)

    first  = frames_norm[0]
    mid    = frames_norm[LONGITUD_SECUENCIA // 2]
    last   = frames_norm[-1]
    delta  = last - first
    velocidad = np.mean(np.abs(np.diff(frames_norm, axis=0)), axis=0)

    # Trayectoria de la muñeca (punto 0 * 3 = cols 0,1,2)
    # y de la yema del índice (punto 8 * 3 = cols 24,25,26)
    tray_muneca = frames_norm[:, 0:3]    # (15,3)
    tray_indice = frames_norm[:, 24:27]  # (15,3)

    # Resumir trayectoria con estadísticas
    def traj_stats(tray):
        return np.concatenate([
            tray.mean(0), tray.std(0),
            tray.max(0) - tray.min(0),   # rango
        ])

    return np.concatenate([
        first, mid, last, delta, velocidad,
        traj_stats(tray_muneca),
        traj_stats(tray_indice),
    ])   # 63+63+63+63+63 + 9+9 = 333


# Construir X, y
print("\n🔧 Extrayendo features...")
X_list = []
y_list = []

for i in range(len(labels)):
    letra = labels[i]
    row   = raw[i]
    if letra in MOVIMIENTO:
        feat = extraer_features_movimiento(row)
    else:
        feat = extraer_features_estatico(row)
    X_list.append(feat)
    y_list.append(letra)

# Padding a ancho uniforme
max_len = max(len(x) for x in X_list)
X = np.array([np.pad(x, (0, max_len - len(x))) for x in X_list], dtype=np.float32)
y = np.array(y_list)

print(f"✅ Features shape: {X.shape}")

# ── LIMPIEZA DE OUTLIERS ─────────────────────────────────────────────────
mask = np.max(np.abs(X), axis=1) > 0.005
X    = X[mask]
y    = y[mask]
print(f"🧹 Después de limpiar outliers: {len(X)}")

# ── AUMENTACIÓN DE DATOS ─────────────────────────────────────────────────
print("\n📈 Aumentando datos...")

X_aug = [X.copy()]
y_aug = [y.copy()]

# 1. Ruido gaussiano suave
for std in [0.005, 0.010, 0.015, 0.020]:
    ruido = np.random.normal(0, std, X.shape).astype(np.float32)
    X_aug.append(X + ruido)
    y_aug.append(y)

# 2. Escalado aleatorio (simula mano cerca/lejos)
for _ in range(4):
    escala = np.random.uniform(0.88, 1.12, (len(X), 1)).astype(np.float32)
    X_aug.append(X * escala)
    y_aug.append(y)

# 3. Rotación pequeña en XY (simula rotación de cámara)
for angulo_deg in [-8, -4, 4, 8]:
    ang = np.radians(angulo_deg)
    c, s = np.cos(ang), np.sin(ang)
    X_rot = X.copy()
    # Rotar todos los pares (x,y) de cada landmark
    for k in range(0, min(63, X.shape[1]-1), 3):
        x_orig = X[:, k].copy()
        y_orig = X[:, k+1].copy()
        X_rot[:, k]   = c*x_orig - s*y_orig
        X_rot[:, k+1] = s*x_orig + c*y_orig
    X_aug.append(X_rot)
    y_aug.append(y)

X_final = np.vstack(X_aug)
y_final = np.concatenate(y_aug)

print(f"✅ Dataset aumentado: {X_final.shape}")

# ── LABEL ENCODING ───────────────────────────────────────────────────────
le    = LabelEncoder()
y_enc = le.fit_transform(y_final)
print(f"🏷️  Clases: {list(le.classes_)}")

# ── SPLIT ────────────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X_final, y_enc, test_size=0.15, stratify=y_enc, random_state=42
)
print(f"\n📦 Train: {len(X_train)}  |  Test: {len(X_test)}")

# ── MODELOS ──────────────────────────────────────────────────────────────
print("\n🌲 Entrenando RandomForest...")
rf = RandomForestClassifier(
    n_estimators=1500,
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
print("\n📋 Reporte por letra:")
print(classification_report(y_test, y_pred, target_names=le.classes_, zero_division=0))

# ── GUARDAR ──────────────────────────────────────────────────────────────
with open(MODEL_FILE, "wb") as f:
    pickle.dump(pipe, f)
with open(ENC_FILE, "wb") as f:
    pickle.dump(le, f)

print(f"\n✅ Modelo guardado: {MODEL_FILE}")
print(f"✅ Encoder guardado: {ENC_FILE}")
print(f"\n▶ Siguiente: python 3_probar_camara.py")

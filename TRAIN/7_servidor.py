"""
7_servidor.py — FIX ESPEJO + RECAPTURA DESDE CELULAR
======================================================
Problemas resueltos:
  1. Cámara frontal manda imagen ESPEJADA → se voltea horizontalmente
  2. Prueba todas las orientaciones incluyendo versiones espejadas
  3. Endpoint /capturar para grabar nuevas muestras directamente
     desde el celular (sin necesidad de la PC con cámara)

Flujo de recaptura desde celular:
  - GET  /capturar/estado        → cuántas muestras hay por seña/letra
  - POST /capturar/frame         → guardar un frame como muestra
  - POST /capturar/entrenar      → reentrenar el modelo con nuevos datos
"""

import base64
import os
import pickle
import csv
import threading
from collections import deque
from datetime import datetime

import cv2
import mediapipe as mp
import numpy as np
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pymongo import MongoClient
from pydantic import BaseModel

# ── CONFIG ────────────────────────────────────────────────────────────────
MONGO_URI    = "mongodb+srv://fanylizcano376_db_user:LEdd1gDaVIjWvvuk@cluster0.khejvbq.mongodb.net/?appName=Cluster0"
MODEL_FRASES = "modelo_frases.pkl"
ENC_FRASES   = "encoder_frases.pkl"
MODEL_LETRAS = "modelo_rf.pkl"
ENC_LETRAS   = "label_encoder.pkl"
DEBUG_IMG    = "debug_ultimo_frame.jpg"

# Carpetas para datos recapturados desde celular
CARPETA_CEL_LETRAS  = "datos_celular/letras"
CARPETA_CEL_FRASES  = "datos_celular/frases"
CSV_CEL_LETRAS      = "datos_celular/letras.csv"
CSV_CEL_FRASES      = "datos_celular/frases.csv"
os.makedirs(CARPETA_CEL_LETRAS, exist_ok=True)
os.makedirs(CARPETA_CEL_FRASES, exist_ok=True)

LONGITUD_SECUENCIA = 20
FEATURES_FRAME     = 63
FRAMES_LETRA       = 15   # frames para letras de movimiento

SEÑAS_ACTIVAS = ["MI_NOMBRE","NO","QUIERO","APRENDER","SI","POR_FAVOR","REPETIR_FAVOR"]
LETRAS_LSM    = list("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ")
MOVIMIENTO    = {'K','Q','Z','J','X','Ñ'}

TRADUCCION = {
    "MI_NOMBRE":"Mi nombre es...","NO":"No","QUIERO":"Quiero",
    "APRENDER":"Aprender","SI":"Sí","POR_FAVOR":"Por favor",
    "REPETIR_FAVOR":"¿Lo repites por favor?",
}

# ── CARGAR MODELOS ────────────────────────────────────────────────────────
print("📂 Cargando modelos...")
with open(MODEL_FRASES,"rb") as f: modelo_frases = pickle.load(f)
with open(ENC_FRASES,  "rb") as f: le_frases     = pickle.load(f)
modelo_letras = None; le_letras = None
if os.path.exists(MODEL_LETRAS):
    with open(MODEL_LETRAS,"rb") as f: modelo_letras = pickle.load(f)
    with open(ENC_LETRAS,  "rb") as f: le_letras     = pickle.load(f)
    print("✅ Modelo letras cargado")
print("✅ Modelos listos")

# ── MONGODB ───────────────────────────────────────────────────────────────
try:
    mc = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    mc.server_info()
    db = mc["lsm_app"]; col_det = db["detecciones"]
    MONGO_OK = True; print("✅ MongoDB conectado")
except Exception as e:
    MONGO_OK = False; print(f"⚠️  MongoDB: {e}")

# ── MEDIAPIPE ─────────────────────────────────────────────────────────────
mp_hands = mp.solutions.hands
hands_detector = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

sesion_buffers: dict[str, deque] = {}
# Buffer para recaptura de frases (secuencias)
captura_buffers: dict[str, list] = {}

# ── DECODE + DETECT ───────────────────────────────────────────────────────
def decodificar_imagen(raw_bytes: bytes) -> np.ndarray | None:
    try:
        texto = raw_bytes.decode("utf-8").strip()
        if texto.startswith("data:"): texto = texto.split(",",1)[1]
        decoded = base64.b64decode(texto)
        arr = np.frombuffer(decoded, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None: return img
    except: pass
    arr = np.frombuffer(raw_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def detectar_mano(img_bgr: np.ndarray):
    """
    Prueba 8 orientaciones: 4 normales + 4 espejadas.
    La cámara frontal del celular manda imagen espejada,
    por eso necesitamos probar el flip horizontal.
    """
    h, w = img_bgr.shape[:2]
    if w > 720:
        img_bgr = cv2.resize(img_bgr, (720, int(h*720/w)))

    # Generar variantes: original + espejada horizontalmente
    espejada = cv2.flip(img_bgr, 1)   # flip horizontal = desespeja cámara frontal

    candidatos = [
        ("0°",          img_bgr),
        ("0°-espejo",   espejada),
        ("90°",         cv2.rotate(img_bgr,  cv2.ROTATE_90_CLOCKWISE)),
        ("90°-espejo",  cv2.rotate(espejada, cv2.ROTATE_90_CLOCKWISE)),
        ("270°",        cv2.rotate(img_bgr,  cv2.ROTATE_90_COUNTERCLOCKWISE)),
        ("270°-espejo", cv2.rotate(espejada, cv2.ROTATE_90_COUNTERCLOCKWISE)),
        ("180°",        cv2.rotate(img_bgr,  cv2.ROTATE_180)),
        ("180°-espejo", cv2.rotate(espejada, cv2.ROTATE_180)),
    ]

    for nombre, img_rot in candidatos:
        rgb = cv2.cvtColor(img_rot, cv2.COLOR_BGR2RGB)
        res = hands_detector.process(rgb)
        if res.multi_hand_landmarks:
            print(f"      ✅ Mano detectada: {nombre}")
            return res.multi_hand_landmarks[0].landmark, nombre
    return None, None


def normalizar_frame(lm):
    pts = np.array([[p.x,p.y,p.z] for p in lm], dtype=np.float32)
    pts -= pts[0]; pts /= np.max(np.abs(pts))+1e-6
    return pts.flatten()

# ── FEATURES ──────────────────────────────────────────────────────────────
def extraer_features_frases(frames_list):
    fn = []
    for f in frames_list:
        c = f.reshape(21,3); c -= c[0]; c /= np.max(np.abs(c))+1e-6
        fn.append(c.flatten())
    fn = np.array(fn, dtype=np.float32)
    n  = len(fn)
    f0,f25,f50,f75,f100 = fn[0],fn[n//4],fn[n//2],fn[3*n//4],fn[-1]
    delta = f100-f0
    vel   = np.mean(np.abs(np.diff(fn,axis=0)),axis=0)
    def ts(t): return np.concatenate([t.mean(0),t.std(0),t.max(0)-t.min(0),t[-1]-t[0]])
    diffs = np.diff(fn,axis=0); seg = max(1,n//4)
    en = np.array([np.mean(diffs[:seg]**2),np.mean(diffs[seg:2*seg]**2),
                   np.mean(diffs[2*seg:3*seg]**2),np.mean(diffs[3*seg:]**2)])
    def af(fv):
        c=fv.reshape(21,3)
        angs=[]
        for a_,b_,c_ in [(0,4,8),(0,8,12),(0,12,16),(0,16,20),(5,6,7),(9,10,11),(13,14,15)]:
            v1=c[a_]-c[b_]; v2=c[c_]-c[b_]
            angs.append(np.arccos(np.clip(np.dot(v1,v2)/(np.linalg.norm(v1)*np.linalg.norm(v2)+1e-6),-1,1)))
        return np.array(angs)
    return np.concatenate([f0,f25,f50,f75,f100,delta,vel,
        ts(fn[:,0:3]),ts(fn[:,12:15]),ts(fn[:,24:27]),ts(fn[:,36:39]),
        en,af(f0),af(f50),af(f100)])

def extraer_features_letra(frame_norm):
    c = frame_norm.reshape(21,3); c -= c[0]; c /= np.max(np.abs(c))+1e-6
    pares=[(0,4,8),(0,4,12),(0,4,16),(0,4,20),(0,8,12),(0,8,16),(0,8,20),
           (0,12,16),(0,12,20),(0,16,20),(5,6,7),(9,10,11),(13,14,15),(17,18,19),
           (1,2,3),(2,3,4),(5,9,13),(9,13,17),(0,5,9),(0,17,13)]
    angs=[]
    for a,b,cc in pares:
        v1=c[a]-c[b]; v2=c[cc]-c[b]
        angs.append(np.arccos(np.clip(np.dot(v1,v2)/(np.linalg.norm(v1)*np.linalg.norm(v2)+1e-6),-1,1)))
    yemas=[4,8,12,16,20]
    dists=[np.linalg.norm(c[yemas[i]]-c[yemas[j]])
           for i in range(len(yemas)) for j in range(i+1,len(yemas))]
    return np.concatenate([c.flatten(),angs,dists])

# ── APP ───────────────────────────────────────────────────────────────────
app = FastAPI(title="LSM API", version="4.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])

class PrediccionResponse(BaseModel):
    etiqueta:str; traduccion:str; confianza:float
    modo:str; confirmada:bool; debug:str=""

class GuardarRequest(BaseModel):
    session_id:str; etiqueta:str; traduccion:str
    confianza:float; usuario_id:str="anonimo"

class CapturaRequest(BaseModel):
    etiqueta: str          # letra o nombre de seña
    tipo:     str = "letra"  # "letra" | "frase"

# ── PREDICCIÓN ────────────────────────────────────────────────────────────
@app.get("/")
def health():
    return {"status":"ok","version":"4.0",
            "frases":list(le_frases.classes_),
            "letras":list(le_letras.classes_) if le_letras else [],
            "mongo":MONGO_OK}

@app.get("/ultimo_frame")
def ver_frame():
    if os.path.exists(DEBUG_IMG): return FileResponse(DEBUG_IMG,media_type="image/jpeg")
    return HTMLResponse("<h2>Sin frames todavía</h2>")

@app.post("/predecir", response_model=PrediccionResponse)
async def predecir(
    frame:      UploadFile = File(...),
    session_id: str = "default",
    modo:       str = "frase",
):
    contenido = await frame.read()
    img = decodificar_imagen(contenido)
    if img is None: raise HTTPException(400,"Imagen inválida")

    print(f"\n📷 {img.shape[1]}x{img.shape[0]} | sesión={session_id[:8]} | modo={modo}")
    cv2.imwrite(DEBUG_IMG, img)

    lm, orientacion = detectar_mano(img)
    if lm is None:
        print("   ⚠️  Sin mano")
        if session_id in sesion_buffers: sesion_buffers[session_id].clear()
        return PrediccionResponse(etiqueta="",traduccion="Sin mano detectada",
                                  confianza=0.0,modo="sin_mano",confirmada=False,debug="no_hand")

    frame_norm = normalizar_frame(lm)

    if modo == "letra" and modelo_letras:
        feat   = extraer_features_letra(frame_norm)
        feat_p = np.pad(feat,(0,max(0,333-len(feat)))).reshape(1,-1)
        proba  = modelo_letras.predict_proba(feat_p)[0]
        idx    = np.argmax(proba); letra = le_letras.classes_[idx]; conf = float(proba[idx])
        print(f"   🔤 {letra} {conf:.0%}")
        return PrediccionResponse(etiqueta=letra,traduccion=letra,confianza=conf,
                                  modo="letra",confirmada=conf>=0.62,debug=orientacion or "")

    if session_id not in sesion_buffers:
        sesion_buffers[session_id] = deque(maxlen=LONGITUD_SECUENCIA)
    buf = sesion_buffers[session_id]
    buf.append(frame_norm)

    if len(buf) < 8:
        return PrediccionResponse(etiqueta="",traduccion="Cargando...",
                                  confianza=0.0,modo="frase",confirmada=False,
                                  debug=f"buf={len(buf)}/8")

    frames_list = list(buf)
    while len(frames_list) < LONGITUD_SECUENCIA: frames_list.append(frames_list[-1])

    feat   = extraer_features_frases(frames_list)
    feat_p = np.pad(feat,(0,max(0,514-len(feat)))).reshape(1,-1)
    proba  = modelo_frases.predict_proba(feat_p)[0]

    res_final=""; conf_final=0.0
    for i,clase in enumerate(le_frases.classes_):
        if clase in SEÑAS_ACTIVAS and proba[i]>conf_final:
            conf_final=float(proba[i]); res_final=clase
    if not res_final:
        idx=np.argmax(proba); res_final=le_frases.classes_[idx]; conf_final=float(proba[idx])

    print(f"   🤟 {res_final} {conf_final:.0%} buf={len(buf)}")
    return PrediccionResponse(
        etiqueta=res_final,
        traduccion=TRADUCCION.get(res_final,res_final),
        confianza=conf_final, modo="frase",
        confirmada=conf_final>=0.55 and len(buf)>=LONGITUD_SECUENCIA,
        debug=f"{orientacion} buf={len(buf)}"
    )

# ── RECAPTURA DESDE CELULAR ───────────────────────────────────────────────
def contar_muestras_letras():
    if not os.path.exists(CSV_CEL_LETRAS): return {l:0 for l in LETRAS_LSM}
    conteo = {l:0 for l in LETRAS_LSM}
    with open(CSV_CEL_LETRAS) as f:
        for row in csv.reader(f):
            if row and row[0] in conteo: conteo[row[0]] += 1
    return conteo

def contar_muestras_frases():
    if not os.path.exists(CSV_CEL_FRASES): return {s:0 for s in SEÑAS_ACTIVAS}
    conteo = {s:0 for s in SEÑAS_ACTIVAS}
    with open(CSV_CEL_FRASES) as f:
        for row in csv.reader(f):
            if row and row[0] in conteo: conteo[row[0]] += 1
    return conteo

@app.get("/capturar/estado")
def estado_captura():
    """Cuántas muestras hay capturadas desde el celular."""
    return {
        "letras": contar_muestras_letras(),
        "frases": contar_muestras_frases(),
        "objetivo_letras": 100,
        "objetivo_frases": 80,
    }

@app.post("/capturar/frame")
async def capturar_frame(
    frame:     UploadFile = File(...),
    etiqueta:  str = "",
    tipo:      str = "letra",      # "letra" | "frase"
    session_id:str = "cap_default",
):
    """
    Guarda un frame como muestra de entrenamiento.
    Para frases: acumula 20 frames y guarda la secuencia completa.
    Para letras: guarda el frame individual.
    """
    if not etiqueta:
        raise HTTPException(400, "Falta etiqueta")

    contenido = await frame.read()
    img = decodificar_imagen(contenido)
    if img is None: raise HTTPException(400,"Imagen inválida")

    lm, orientacion = detectar_mano(img)
    if lm is None:
        return {"ok":False, "msg":"Sin mano detectada", "frames_buf":0}

    frame_norm = normalizar_frame(lm)

    # ── LETRA ──────────────────────────────────────────────────────────
    if tipo == "letra":
        TOTAL_FEAT_LETRAS = 63 * FRAMES_LETRA  # 945
        padded = np.pad(frame_norm, (0, TOTAL_FEAT_LETRAS - len(frame_norm)))
        fila   = [etiqueta] + padded.tolist()
        with open(CSV_CEL_LETRAS, "a", newline="") as f:
            csv.writer(f).writerow(fila)
        conteo = contar_muestras_letras()
        print(f"   💾 Letra '{etiqueta}' guardada → total: {conteo[etiqueta]}")
        return {"ok":True, "tipo":"letra", "etiqueta":etiqueta,
                "total":conteo.get(etiqueta,0), "frames_buf":1}

    # ── FRASE (secuencia) ───────────────────────────────────────────────
    clave = f"{session_id}_{etiqueta}"
    if clave not in captura_buffers: captura_buffers[clave] = []
    captura_buffers[clave].append(frame_norm)

    n_frames = len(captura_buffers[clave])

    if n_frames >= LONGITUD_SECUENCIA:
        secuencia = captura_buffers[clave][-LONGITUD_SECUENCIA:]
        flat = np.concatenate(secuencia)
        TOTAL_FEAT_FRASES = 63 * LONGITUD_SECUENCIA  # 1260
        if len(flat) < TOTAL_FEAT_FRASES:
            flat = np.pad(flat, (0, TOTAL_FEAT_FRASES - len(flat)))
        fila = [etiqueta] + flat[:TOTAL_FEAT_FRASES].tolist()
        with open(CSV_CEL_FRASES, "a", newline="") as f:
            csv.writer(f).writerow(fila)
        captura_buffers[clave] = []
        conteo = contar_muestras_frases()
        print(f"   💾 Frase '{etiqueta}' guardada → total: {conteo.get(etiqueta,0)}")
        return {"ok":True, "tipo":"frase", "etiqueta":etiqueta,
                "total":conteo.get(etiqueta,0), "frames_buf":0, "guardada":True}

    return {"ok":True, "tipo":"frase", "etiqueta":etiqueta,
            "total":0, "frames_buf":n_frames, "guardada":False}


@app.post("/capturar/entrenar")
def reentrenar(tipo: str = "ambos"):
    """
    Mezcla los datos originales con los nuevos del celular y reentrena.
    Corre en background para no bloquear el servidor.
    """
    def _entrenar():
        import subprocess, sys
        if tipo in ("letra","ambos") and os.path.exists(CSV_CEL_LETRAS):
            # Mezclar con datos originales
            _mezclar_csvs(
                "datos_capturados/dataset_landmarks.csv",
                CSV_CEL_LETRAS,
                "datos_capturados/dataset_landmarks_merged.csv"
            )
            print("🔄 Reentrenando letras...")
            subprocess.run([sys.executable, "2_entrenar_modelo.py"], check=False)

        if tipo in ("frase","ambos") and os.path.exists(CSV_CEL_FRASES):
            _mezclar_csvs(
                "datos_frases/dataset_frases.csv",
                CSV_CEL_FRASES,
                "datos_frases/dataset_frases_merged.csv"
            )
            print("Reentrenando frases...")
            subprocess.run([sys.executable, "5_entrenar_frases.py"], check=False)

        print("Reentrenamiento completado")

    threading.Thread(target=_entrenar, daemon=True).start()
    return {"ok":True, "msg":"Reentrenando en background..."}


def _mezclar_csvs(original: str, nuevo: str, salida: str):
    """Mezcla dos CSVs y guarda el resultado."""
    filas = []
    for ruta in [original, nuevo]:
        if os.path.exists(ruta):
            with open(ruta) as f:
                filas.extend(list(csv.reader(f)))
    with open(salida, "w", newline="") as f:
        csv.writer(f).writerows(filas)
    print(f"   Mezclados {len(filas)} filas → {salida}")


# ── GUARDAR / HISTORIAL ───────────────────────────────────────────────────
@app.post("/guardar")
async def guardar(req: GuardarRequest):
    if not MONGO_OK: return {"ok":False}
    col_det.insert_one({"session_id":req.session_id,"usuario_id":req.usuario_id,
        "etiqueta":req.etiqueta,"traduccion":req.traduccion,
        "confianza":req.confianza,"timestamp":datetime.utcnow()})
    return {"ok":True}

@app.get("/historial/{usuario_id}")
def historial(usuario_id: str, limite: int = 50):
    if not MONGO_OK: return {"detecciones":[],"mongo":False}
    docs = list(col_det.find({"usuario_id":usuario_id},{"_id":0})
                .sort("timestamp",-1).limit(limite))
    for d in docs:
        if "timestamp" in d: d["timestamp"] = d["timestamp"].isoformat()
    return {"detecciones":docs}

@app.delete("/sesion/{session_id}")
def limpiar(session_id: str):
    if session_id in sesion_buffers: sesion_buffers[session_id].clear()
    return {"ok":True}

# ── MAIN ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8",80)); ip = s.getsockname()[0]; s.close()
    except: ip = "127.0.0.1"

    print(f"\n{'='*55}")
    print(f"LSM Servidor v4.0")
    print(f"   http://{ip}:8000   ← lsmApi.ts")
    print(f"\nVer último frame:  http://{ip}:8000/ultimo_frame")
    print(f"Estado captura:    http://{ip}:8000/capturar/estado")
    print(f"{'='*55}\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)
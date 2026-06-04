// app/(tabs)/camera.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Speech from "expo-speech";

import { COLORS } from "@/constants/theme";
import {
  guardarDeteccion,
  limpiarSesion,
  predecirFrame,
  verificarServidor,
  type PrediccionResult,
} from "@/services/lsmApi";

const { height: H } = Dimensions.get("window");

type Modo = "frase" | "letra";
type EstadoServer = "verificando" | "ok" | "error";

interface HistorialItem {
  texto: string;
  confianza: number;
  ts: number;
}

// Intervalo más largo = menos fotos = menos sonido
const INTERVALO_MS = 400; // 1 foto cada 400ms (~2.5 fps)
const FRAMES_CONF = 10; // menos frames para confirmar más rápido
const CONF_CONFIRMAR = 0.55;

const VOZ: Speech.SpeechOptions = { language: "es-MX", pitch: 1.0, rate: 0.92 };

const colorConf = (c: number) =>
  c >= 0.8 ? "#00FF88" : c >= 0.55 ? "#00CFFF" : "#FF9500";

function hablar(seña: string, oracion: string[]) {
  Speech.stop().then(() => {
    Speech.speak(seña, {
      ...VOZ,
      onDone: () => {
        if (oracion.length > 1) {
          Speech.speak(
            oracion
              .join(" ")
              .replace(/\.\.\./g, "")
              .trim(),
            VOZ,
          );
        }
      },
    });
  });
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [modo, setModo] = useState<Modo>("frase");
  const [activo, setActivo] = useState(false);
  const [estadoServer, setEstadoServer] = useState<EstadoServer>("verificando");
  const [silencio, setSilencio] = useState(false);
  const [prediccion, setPrediccion] = useState<PrediccionResult | null>(null);
  const [estableCnt, setEstableCnt] = useState(0);
  const [oracion, setOracion] = useState<string[]>([]);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);

  // Animaciones
  const pulsoAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const oracionAnim = useRef(new Animated.Value(1)).current;

  // Refs
  const cameraRef = useRef<CameraView>(null);
  const activoRef = useRef(false);
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estableRef = useRef(0);
  const ultimaRef = useRef("");
  const oracionRef = useRef<string[]>([]);
  const silencioRef = useRef(false);
  const enviandoRef = useRef(false);
  const modoRef = useRef<Modo>("frase");

  useEffect(() => {
    silencioRef.current = silencio;
  }, [silencio]);
  useEffect(() => {
    modoRef.current = modo;
  }, [modo]);

  useEffect(() => {
    verificarServidor().then((ok) => setEstadoServer(ok ? "ok" : "error"));
  }, []);

  useEffect(
    () => () => {
      Speech.stop();
    },
    [],
  );

  // Pulso animado en el marco
  useEffect(() => {
    if (activo) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulsoAnim, {
            toValue: 1.06,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulsoAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulsoAnim.stopAnimation();
      pulsoAnim.setValue(1);
    }
  }, [activo, pulsoAnim]);

  const animarFlash = useCallback(() => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [flashAnim]);

  const confirmarSeña = useCallback(
    (res: PrediccionResult) => {
      const nueva = [...oracionRef.current, res.traduccion];
      oracionRef.current = nueva;
      setOracion(nueva);
      setHistorial((h) =>
        [
          { texto: res.traduccion, confianza: res.confianza, ts: Date.now() },
          ...h,
        ].slice(0, 20),
      );
      animarFlash();
      oracionAnim.setValue(0.6);
      Animated.spring(oracionAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
      }).start();
      if (!silencioRef.current) hablar(res.traduccion, nueva);
      guardarDeteccion(res.etiqueta, res.traduccion, res.confianza);
      estableRef.current = 0;
      ultimaRef.current = "";
      setEstableCnt(0);
    },
    [animarFlash, oracionAnim],
  );

  const enviarFrame = useCallback(async () => {
    if (!activoRef.current || !cameraRef.current) return;
    if (enviandoRef.current) return;
    enviandoRef.current = true;

    try {
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.25, // calidad baja = más rápido
        base64: false,
        skipProcessing: true,
        exif: false,
      });

      if (!foto?.uri) return;

      const res = await predecirFrame(foto.uri, modoRef.current);
      if (!res) return;

      setPrediccion(res);

      if (res.modo === "sin_mano") {
        estableRef.current = 0;
        ultimaRef.current = "";
        setEstableCnt(0);
        return;
      }

      if (
        res.etiqueta === ultimaRef.current &&
        res.confianza >= CONF_CONFIRMAR
      ) {
        estableRef.current += 1;
        setEstableCnt(estableRef.current);
      } else {
        estableRef.current = 0;
        ultimaRef.current = res.etiqueta;
        setEstableCnt(0);
      }

      if (
        estableRef.current >= FRAMES_CONF &&
        res.confianza >= CONF_CONFIRMAR
      ) {
        confirmarSeña(res);
      }
    } catch {
      // ignorar errores de frame individuales
    } finally {
      enviandoRef.current = false;
    }
  }, [confirmarSeña]);

  const iniciarLoop = useCallback(() => {
    const tick = async () => {
      if (!activoRef.current) return;
      await enviarFrame();
      if (activoRef.current) loopRef.current = setTimeout(tick, INTERVALO_MS);
    };
    tick();
  }, [enviarFrame]);

  const toggleDeteccion = useCallback(() => {
    const next = !activoRef.current;
    activoRef.current = next;
    setActivo(next);
    if (next) {
      iniciarLoop();
    } else {
      if (loopRef.current) clearTimeout(loopRef.current);
      limpiarSesion();
      estableRef.current = 0;
      ultimaRef.current = "";
      enviandoRef.current = false;
      setEstableCnt(0);
      setPrediccion(null);
      Speech.stop();
    }
  }, [iniciarLoop]);

  const limpiarTodo = useCallback(() => {
    oracionRef.current = [];
    setOracion([]);
    setHistorial([]);
    Speech.stop();
  }, []);

  useEffect(
    () => () => {
      activoRef.current = false;
      enviandoRef.current = false;
      if (loopRef.current) clearTimeout(loopRef.current);
      limpiarSesion();
      Speech.stop();
    },
    [],
  );

  // ── PERMISOS ─────────────────────────────────────────────────────────
  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <View style={s.permRoot}>
        <View style={s.permIcon}>
          <Ionicons name="camera" size={40} color={COLORS.primary} />
        </View>
        <Text style={s.permTitle}>Permiso de cámara</Text>
        <Text style={s.permDesc}>
          Necesitamos acceso para detectar señas en tiempo real.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={s.permBtn}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryLight]}
            style={s.permBtnInner}
          >
            <Text style={s.permBtnTxt}>Permitir cámara</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const conf = prediccion?.confianza ?? 0;
  const col = colorConf(conf);
  const hayMano = prediccion?.modo !== "sin_mano" && prediccion !== null;
  const progPct = Math.min(estableCnt / FRAMES_CONF, 1);

  return (
    <View style={s.root}>
      {/* ══ CÁMARA ═══════════════════════════════════════════════════ */}
      <View style={s.camWrap}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />

        {/* Marco animado */}
        <Animated.View
          style={[s.marcoWrap, { transform: [{ scale: pulsoAnim }] }]}
        >
          <View style={[s.marco, activo && { borderColor: col }]} />

          {/* Solo texto de estado, sin porcentajes */}
          <Text
            style={[
              s.marcoTxt,
              { color: activo && hayMano ? col : "rgba(255,255,255,0.4)" },
            ]}
          >
            {!activo
              ? "Presiona iniciar"
              : hayMano
                ? (prediccion?.traduccion ?? "Detectando...")
                : "Coloca tu mano aquí"}
          </Text>

          {/* Barra de progreso de confirmación debajo del texto */}
          {activo && hayMano && progPct > 0 ? (
            <View style={s.progWrap}>
              <View style={s.progBg}>
                <Animated.View
                  style={[
                    s.progFill,
                    { width: `${progPct * 100}%` as any, backgroundColor: col },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </Animated.View>

        {/* Flash verde al confirmar */}
        <Animated.View
          style={[s.flash, { opacity: flashAnim }]}
          pointerEvents="none"
        />
      </View>

      {/* ══ HEADER ═══════════════════════════════════════════════════ */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            activoRef.current = false;
            Speech.stop();
            router.replace("/(tabs)");
          }}
          style={s.hBtn}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>

        <View style={s.hCenter}>
          <Text style={s.hTitle}>Detector LSM</Text>
          <View style={s.badge}>
            <View
              style={[
                s.dot,
                estadoServer === "ok" && { backgroundColor: "#00FF88" },
                estadoServer === "error" && { backgroundColor: "#FF3B30" },
                estadoServer === "verificando" && {
                  backgroundColor: "#FF9500",
                },
              ]}
            />
            <Text style={s.dotTxt}>
              {estadoServer === "ok"
                ? "Servidor OK"
                : estadoServer === "error"
                  ? "Sin servidor"
                  : "Conectando..."}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setSilencio((v) => !v);
              Speech.stop();
            }}
            style={s.hBtn}
          >
            <Ionicons
              name={silencio ? "volume-mute" : "volume-high"}
              size={18}
              color={silencio ? "#FF3B30" : "#fff"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
            style={s.hBtn}
          >
            <Ionicons name="camera-reverse" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ PANEL INFERIOR ═══════════════════════════════════════════ */}
      <View style={s.panel}>
        {/* ORACIÓN ACUMULADA */}
        <View style={s.oracionCard}>
          <View style={s.oracionHead}>
            <Text style={s.oracionLbl}>ORACIÓN</Text>
            <View style={{ flexDirection: "row", gap: 14 }}>
              {oracion.length > 0 && (
                <TouchableOpacity
                  onPress={() =>
                    !silencio && hablar(oracion[oracion.length - 1], oracion)
                  }
                >
                  <Ionicons
                    name="play-circle-outline"
                    size={20}
                    color="#00CFFF"
                  />
                </TouchableOpacity>
              )}
              {oracion.length > 0 && (
                <TouchableOpacity onPress={limpiarTodo}>
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color="rgba(255,255,255,0.28)"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Animated.Text
            numberOfLines={3}
            style={[s.oracionTxt, { opacity: oracionAnim }]}
          >
            {oracion.length > 0
              ? oracion.join("  ·  ")
              : "Haz una seña para comenzar..."}
          </Animated.Text>
        </View>

        {/* SELECTOR DE MODO */}
        <View style={s.modoRow}>
          {(["frase", "letra"] as Modo[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => {
                setModo(m);
                estableRef.current = 0;
                setPrediccion(null);
              }}
              style={[s.modoBtn, modo === m && s.modoBtnOn]}
            >
              <Text style={[s.modoTxt, modo === m && s.modoTxtOn]}>
                {m === "frase" ? "🤟 Frases" : "🔤 Letras"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* BOTÓN PRINCIPAL */}
        <TouchableOpacity
          onPress={toggleDeteccion}
          disabled={estadoServer === "error"}
          style={[s.mainBtn, estadoServer === "error" && { opacity: 0.4 }]}
        >
          <LinearGradient
            colors={
              activo
                ? ["#FF3B30", "#FF6060"]
                : [COLORS.primary, COLORS.primaryLight]
            }
            style={s.mainInner}
          >
            <Ionicons
              name={activo ? "stop-circle" : "scan"}
              size={22}
              color="#fff"
            />
            <Text style={s.mainTxt}>
              {activo ? "Detener" : "Iniciar detección"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {estadoServer === "error" && (
          <Text style={s.errTxt}>⚠️ Inicia: python 7_servidor.py</Text>
        )}

        {/* CHIPS — toca para releer en voz alta */}
        {historial.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.chips}
          >
            {historial.map((item, i) => (
              <TouchableOpacity
                key={item.ts}
                style={[s.chip, i === 0 && s.chipNew]}
                onPress={() => !silencio && Speech.speak(item.texto, VOZ)}
              >
                <Text style={s.chipTxt}>{item.texto}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── ESTILOS ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0F" },

  camWrap: { height: H * 0.52, position: "relative" },
  marcoWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  marco: {
    width: 230,
    height: 230,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 26,
  },
  marcoTxt: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,255,136,0.15)",
  },

  progWrap: { marginTop: 12, width: 200 },
  progBg: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progFill: { height: "100%", borderRadius: 2 },

  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 36,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  hBtn: {
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  hCenter: { alignItems: "center" },
  hTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#555" },
  dotTxt: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "600" },

  panel: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    gap: 11,
  },

  oracionCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  oracionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  oracionLbl: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  oracionTxt: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 26,
  },

  modoRow: { flexDirection: "row", gap: 10 },
  modoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  modoBtnOn: {
    backgroundColor: "rgba(255,255,255,0.11)",
    borderColor: "rgba(255,255,255,0.3)",
  },
  modoTxt: { color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: "600" },
  modoTxtOn: { color: "#fff" },

  mainBtn: { borderRadius: 18, overflow: "hidden" },
  mainInner: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 18,
  },
  mainTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  errTxt: { color: "#FF9500", fontSize: 11, textAlign: "center" },

  chips: { flexGrow: 0 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipNew: {
    backgroundColor: "rgba(0,207,255,0.13)",
    borderColor: "rgba(0,207,255,0.32)",
  },
  chipTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },

  permRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 36,
    backgroundColor: "#0A0A0F",
  },
  permIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  permTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 10,
  },
  permDesc: {
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 28,
    lineHeight: 20,
  },
  permBtn: { width: "80%", borderRadius: 16, overflow: "hidden" },
  permBtnInner: { paddingVertical: 16, alignItems: "center", borderRadius: 16 },
  permBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

// app/(tabs)/learn.tsx

import { COLORS, SHADOW } from "@/constants/theme";
import { loadProgreso, loadRacha, saveProgreso } from "@/services/storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Leccion = {
  id: string;
  titulo: string;
  desc: string;
  letras: string[];
  icon: React.ComponentProps<typeof Ionicons>["name"];
  gradA: string;
  gradB: string;
  nivel: string;
  durMin: number;
};

const LECCIONES: Leccion[] = [
  {
    id: "1",
    titulo: "Vocales",
    desc: "A, E, I, O, U — las 5 vocales del LSM",
    letras: ["A", "E", "I", "O", "U"],
    icon: "school",
    gradA: COLORS.coralD,
    gradB: COLORS.coral,
    nivel: "Básico",
    durMin: 5,
  },
  {
    id: "2",
    titulo: "Consonantes fáciles",
    desc: "B, C, D, F, G, H, L, M, N",
    letras: ["B", "C", "D", "F", "G", "H", "L", "M", "N"],
    icon: "hand-right",
    gradA: COLORS.navy,
    gradB: COLORS.blue,
    nivel: "Básico",
    durMin: 10,
  },
  {
    id: "3",
    titulo: "Señas con movimiento",
    desc: "K, Q, Z, J, X, Ñ — gestos dinámicos",
    letras: ["K", "Q", "Z", "J", "X", "Ñ"],
    icon: "swap-horizontal",
    gradA: COLORS.pink,
    gradB: COLORS.pinkL,
    nivel: "Intermedio",
    durMin: 12,
  },
  {
    id: "4",
    titulo: "Consonantes avanzadas",
    desc: "O, P, R, S, T, U, V, W, Y, Z",
    letras: ["O", "P", "R", "S", "T", "U", "V", "W", "Y", "Z"],
    icon: "trophy",
    gradA: COLORS.warning,
    gradB: "#FBB060",
    nivel: "Intermedio",
    durMin: 15,
  },
  {
    id: "5",
    titulo: "Abecedario completo",
    desc: "Las 27 letras del abecedario LSM",
    letras: "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split(""),
    icon: "grid",
    gradA: COLORS.success,
    gradB: "#52D68A",
    nivel: "Avanzado",
    durMin: 25,
  },
];

const CERTS = [
  { nivel: "A1", nombre: "Básico", color: COLORS.success, req: 10 },
  { nivel: "B1", nombre: "Intermedio", color: COLORS.blue, req: 18 },
  { nivel: "C1", nombre: "Avanzado", color: COLORS.coralD, req: 27 },
];

export default function LearnScreen() {
  const [progreso, setProgreso] = useState<Record<string, string[]>>({});
  const [racha, setRacha] = useState(0);
  const [lecActiva, setLecActiva] = useState<Leccion | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(500)).current;

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
      (async () => {
        setProgreso(await loadProgreso());
        const r = await loadRacha();
        setRacha(r.dias);
      })();
      return () => fadeAnim.setValue(0);
    }, [fadeAnim]),
  );

  const totalLetras = Object.values(progreso).reduce(
    (a, arr) => a + (arr?.length ?? 0),
    0,
  );
  const pctGlobal = Math.round((totalLetras / 27) * 100);

  const abrirLeccion = (lec: Leccion) => {
    setLecActiva(lec);
    sheetAnim.setValue(500);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 9,
    }).start();
  };

  const cerrarLeccion = () => {
    Animated.timing(sheetAnim, {
      toValue: 500,
      duration: 240,
      useNativeDriver: true,
    }).start(() => setLecActiva(null));
  };

  const marcarLetra = async (letra: string) => {
    if (!lecActiva) return;
    const actual = progreso[lecActiva.id] ?? [];
    const nueva = actual.includes(letra)
      ? actual.filter((l) => l !== letra)
      : [...actual, letra];
    const nuevo = { ...progreso, [lecActiva.id]: nueva };
    setProgreso(nuevo);
    await saveProgreso(lecActiva.id, nueva);
  };

  const getProg = (id: string) => progreso[id]?.length ?? 0;
  const isCompleta = (lec: Leccion) => getProg(lec.id) >= lec.letras.length;

  return (
    <Animated.View style={[s.root, { opacity: fadeAnim }]}>
      {/* ── HEADER — mismo estilo que index ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)")}
          style={s.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.textDark} />
        </TouchableOpacity>

        <View style={s.headerText}>
          <Text style={s.headerSub}>Módulo educativo</Text>
          <Text style={s.headerTitle}>Aprende LSM</Text>
        </View>

        {/* Stats de racha y progreso */}
        <View style={s.headerBadges}>
          <View style={s.hBadge}>
            <Ionicons name="flame" size={13} color={COLORS.coralD} />
            <Text style={[s.hBadgeTxt, { color: COLORS.coralD }]}>
              {racha}d
            </Text>
          </View>
          <View style={[s.hBadge, { backgroundColor: COLORS.success + "15" }]}>
            <Ionicons
              name="checkmark-circle"
              size={13}
              color={COLORS.success}
            />
            <Text style={[s.hBadgeTxt, { color: COLORS.success }]}>
              {totalLetras}/27
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── PROGRESO GLOBAL — como el stats del index ── */}
        <View style={s.statsRow}>
          {[
            { val: `${pctGlobal}%`, label: "Completado", color: COLORS.coralD },
            { val: `${totalLetras}`, label: "Letras", color: COLORS.blue },
            {
              val: `${27 - totalLetras}`,
              label: "Pendientes",
              color: COLORS.warning,
            },
          ].map((item, i) => (
            <View key={i} style={s.stat}>
              <Text style={[s.statVal, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statLbl}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Barra de progreso global */}
        <View style={s.globalCard}>
          <View style={s.globalTop}>
            <Text style={s.globalTitle}>Progreso total</Text>
            <Text style={[s.globalPct, { color: COLORS.coralD }]}>
              {pctGlobal}%
            </Text>
          </View>
          <View style={s.globalBar}>
            <View style={[s.globalFill, { width: `${pctGlobal}%` as any }]} />
          </View>
          <Text style={s.globalSub}>{totalLetras} de 27 letras dominadas</Text>
        </View>

        {/* ── LECCIONES ── */}
        <Text style={s.section}>LECCIONES</Text>

        {LECCIONES.map((lec) => {
          const prog = getProg(lec.id);
          const total = lec.letras.length;
          const pct = prog / total;
          const completa = isCompleta(lec);

          return (
            <Pressable
              key={lec.id}
              onPress={() => abrirLeccion(lec)}
              style={({ pressed }) => [
                s.lecCard,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              {/* Ícono con gradiente suave */}
              <LinearGradient
                colors={[lec.gradA + "25", lec.gradB + "10"]}
                style={s.lecIcon}
              >
                <Ionicons
                  name={completa ? "checkmark-circle" : lec.icon}
                  size={24}
                  color={completa ? COLORS.success : lec.gradA}
                />
              </LinearGradient>

              <View style={s.lecInfo}>
                <View style={s.lecTitleRow}>
                  <Text style={s.lecTitulo}>{lec.titulo}</Text>
                  <View
                    style={[
                      s.nivelBadge,
                      {
                        backgroundColor: lec.gradA + "18",
                        borderColor: lec.gradA + "40",
                      },
                    ]}
                  >
                    <Text style={[s.nivelTxt, { color: lec.gradA }]}>
                      {lec.nivel}
                    </Text>
                  </View>
                </View>

                <Text style={s.lecDesc}>{lec.desc}</Text>

                <View style={s.lecMeta}>
                  <Ionicons
                    name="time-outline"
                    size={11}
                    color={COLORS.textLight}
                  />
                  <Text style={s.lecDur}>{lec.durMin} min</Text>
                  <Text style={s.lecProgTxt}>
                    {prog}/{total} letras
                  </Text>
                </View>

                <View style={s.lecBar}>
                  <View
                    style={[
                      s.lecFill,
                      {
                        width: `${pct * 100}%` as any,
                        backgroundColor: completa ? COLORS.success : lec.gradA,
                      },
                    ]}
                  />
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </Pressable>
          );
        })}

        {/* ── CERTIFICACIONES ── */}
        <Text style={[s.section, { marginTop: 8 }]}>CERTIFICACIONES</Text>

        <View style={s.certsRow}>
          {CERTS.map((cert) => {
            const unlocked = totalLetras >= cert.req;
            return (
              <View
                key={cert.nivel}
                style={[
                  s.certCard,
                  { borderColor: unlocked ? cert.color : "#E8ECF0" },
                ]}
              >
                <View
                  style={[
                    s.certIconWrap,
                    {
                      backgroundColor: unlocked ? cert.color + "18" : "#F1F5F9",
                    },
                  ]}
                >
                  <Ionicons
                    name={unlocked ? "ribbon" : "lock-closed"}
                    size={24}
                    color={unlocked ? cert.color : "#ccc"}
                  />
                </View>
                <Text
                  style={[
                    s.certNivel,
                    { color: unlocked ? cert.color : "#ccc" },
                  ]}
                >
                  {cert.nivel}
                </Text>
                <Text style={s.certNombre}>{cert.nombre}</Text>
                {unlocked && (
                  <View style={[s.certTag, { backgroundColor: cert.color }]}>
                    <Text style={s.certTagTxt}>Obtenido ✓</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── SHEET DE LECCIÓN ── */}
      {lecActiva && (
        <View style={s.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={cerrarLeccion}
            activeOpacity={1}
          />
          <Animated.View
            style={[s.sheet, { transform: [{ translateY: sheetAnim }] }]}
          >
            <View style={s.handle} />

            {/* Header del sheet con gradiente */}
            <LinearGradient
              colors={[lecActiva.gradA, lecActiva.gradB]}
              style={s.sheetHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitulo}>{lecActiva.titulo}</Text>
                <Text style={s.sheetDesc}>{lecActiva.desc}</Text>
              </View>
              <TouchableOpacity
                onPress={cerrarLeccion}
                style={s.sheetClose}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView
              contentContainerStyle={s.sheetBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.sheetInstruct}>
                Toca las letras que ya dominas:
              </Text>

              <View style={s.sheetGrid}>
                {lecActiva.letras.map((l) => {
                  const dom = (progreso[lecActiva.id] ?? []).includes(l);
                  return (
                    <TouchableOpacity
                      key={l}
                      onPress={() => marcarLetra(l)}
                      activeOpacity={0.78}
                      style={[
                        s.sheetLetra,
                        dom && {
                          backgroundColor: lecActiva.gradA,
                          borderColor: lecActiva.gradA,
                        },
                      ]}
                    >
                      <Text style={[s.sheetLetraTxt, dom && { color: "#fff" }]}>
                        {l}
                      </Text>
                      {dom && (
                        <Ionicons
                          name="checkmark"
                          size={10}
                          color="#fff"
                          style={{ position: "absolute", top: 3, right: 3 }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Botón practicar — igual al del index */}
              <Pressable
                style={({ pressed }) => [
                  s.practicaBtn,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => {
                  cerrarLeccion();
                  router.push("/(tabs)/camera");
                }}
              >
                <LinearGradient
                  colors={[lecActiva.gradA, lecActiva.gradB]}
                  style={s.practicaGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={s.practicaTxt}>Practicar con la cámara</Text>
                </LinearGradient>
              </Pressable>

              <View style={{ height: 20 }} />
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </Animated.View>
  );
}

// ── ESTILOS ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F9FC" },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  // Header — mismo patrón que index y alphabet
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: "#F7F9FC",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOW.sm,
  },
  headerText: { flex: 1 },
  headerSub: {
    fontSize: 10,
    color: "#999",
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#111" },
  headerBadges: { flexDirection: "row", gap: 6 },
  hBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.coralD + "15",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  hBadgeTxt: { fontSize: 12, fontWeight: "800" },

  // Stats — idéntico al index
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    justifyContent: "space-around",
    marginBottom: 16,
    ...SHADOW.sm,
  },
  stat: { alignItems: "center" },
  statVal: { fontWeight: "900", fontSize: 16 },
  statLbl: { fontSize: 11, color: "#888" },

  // Progreso global
  globalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    ...SHADOW.sm,
  },
  globalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  globalTitle: { fontSize: 15, fontWeight: "800", color: "#111" },
  globalPct: { fontSize: 15, fontWeight: "900" },
  globalBar: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  globalFill: {
    height: "100%",
    backgroundColor: COLORS.coralD,
    borderRadius: 4,
  },
  globalSub: { fontSize: 12, color: "#888" },

  // Sección label — mismo que index
  section: {
    fontSize: 11,
    color: "#999",
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.5,
  },

  // Cards de lección — igual al card del index
  lecCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    ...SHADOW.sm,
  },
  lecIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  lecInfo: { flex: 1 },
  lecTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  lecTitulo: { fontSize: 14, fontWeight: "800", color: "#111", flex: 1 },
  nivelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  nivelTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  lecDesc: { fontSize: 12, color: "#888", marginBottom: 6 },
  lecMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  lecDur: { fontSize: 10, color: "#aaa", fontWeight: "600", marginRight: 6 },
  lecProgTxt: { fontSize: 10, color: "#aaa", fontWeight: "600" },
  lecBar: {
    height: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 2,
    overflow: "hidden",
  },
  lecFill: { height: "100%", borderRadius: 2 },

  // Certificaciones
  certsRow: { flexDirection: "row", gap: 10 },
  certCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 5,
    borderWidth: 2,
    ...SHADOW.sm,
  },
  certIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  certNivel: { fontSize: 22, fontWeight: "900" },
  certNombre: { fontSize: 11, fontWeight: "800", color: "#555" },
  certTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  certTagTxt: { fontSize: 9, color: "#fff", fontWeight: "800" },

  // Sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    overflow: "hidden",
    ...SHADOW.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E8ECF0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: { padding: 20, flexDirection: "row", alignItems: "center" },
  sheetTitulo: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 3,
  },
  sheetDesc: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetBody: { padding: 20 },
  sheetInstruct: {
    fontSize: 13,
    color: "#888",
    fontWeight: "600",
    marginBottom: 14,
  },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  sheetLetra: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F7F9FC",
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    position: "relative",
  },
  sheetLetraTxt: { fontSize: 20, fontWeight: "900", color: "#111" },

  practicaBtn: { borderRadius: 16, overflow: "hidden" },
  practicaGrad: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  practicaTxt: { fontSize: 15, fontWeight: "800", color: "#fff" },
});

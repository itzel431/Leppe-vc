// app/(tabs)/alphabet.tsx

import {
  ALFABETO,
  LETRAS_MOVIMIENTO,
  TODAS_LAS_LETRAS,
  getCardColor,
} from "@/constants/lsmData";
import { COLORS, SHADOW } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - 48 - 10 * 2) / 3; // 3 columnas como el index

type Filtro = "todas" | "estatica" | "movimiento";

export default function AlphabetScreen() {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.92)).current;
  const modalFade = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
      return () => fadeAnim.setValue(0);
    }, [fadeAnim]),
  );

  const abrirDetalle = (l: string) => {
    setSel(l);
    modalScale.setValue(0.92);
    modalFade.setValue(0);
    Animated.parallel([
      Animated.spring(modalScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(modalFade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const cerrar = () => {
    Animated.timing(modalFade, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => setSel(null));
  };

  const letras = TODAS_LAS_LETRAS.filter((l) => {
    if (busqueda) return l.toLowerCase().includes(busqueda.toLowerCase());
    if (filtro === "estatica") return !LETRAS_MOVIMIENTO.has(l);
    if (filtro === "movimiento") return LETRAS_MOVIMIENTO.has(l);
    return true;
  });

  const selInfo = sel ? ALFABETO[sel] : null;
  const selColor = sel ? getCardColor(sel) : null;
  const selIdx = sel ? TODAS_LAS_LETRAS.indexOf(sel) : -1;
  const esMov = sel ? LETRAS_MOVIMIENTO.has(sel) : false;

  return (
    <Animated.View style={[s.root, { opacity: fadeAnim }]}>
      {/* ── HEADER — mismo estilo que index ── */}
      <View style={s.header}>
        {/* Botón regresar */}
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)")}
          style={s.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.textDark} />
        </TouchableOpacity>

        <View style={s.headerText}>
          <Text style={s.headerSub}>Lenguaje de Señas Mexicano</Text>
          <Text style={s.headerTitle}>Abecedario LSM</Text>
        </View>

        {/* Badge de conteo */}
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeN}>{letras.length}</Text>
          <Text style={s.headerBadgeLbl}>letras</Text>
        </View>
      </View>

      {/* ── STATS — igual que index ── */}
      <View style={s.stats}>
        {[
          { val: "27", label: "Letras" },
          { val: "6", label: "Movimiento" },
          { val: "21", label: "Estáticas" },
        ].map((item, i) => (
          <View key={i} style={s.stat}>
            <Text style={s.statVal}>{item.val}</Text>
            <Text style={s.statLbl}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* ── BUSCADOR ── */}
      <View style={s.searchWrap}>
        <Ionicons
          name="search"
          size={16}
          color={COLORS.textLight}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar letra..."
          placeholderTextColor={COLORS.textLight}
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="characters"
          maxLength={2}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda("")} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── FILTROS — igual que las quick actions del index ── */}
      <Text style={s.section}>FILTRAR POR TIPO</Text>
      <View style={s.filtrosRow}>
        {(
          [
            { key: "todas", label: "Todas", icon: "apps" },
            { key: "estatica", label: "Estáticas", icon: "hand-right" },
            { key: "movimiento", label: "Movimiento", icon: "swap-horizontal" },
          ] as {
            key: Filtro;
            label: string;
            icon: React.ComponentProps<typeof Ionicons>["name"];
          }[]
        ).map(({ key, label, icon }) => {
          const active = filtro === key && !busqueda;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setFiltro(key);
                setBusqueda("");
              }}
              style={({ pressed }) => [
                s.filtroBtn,
                active && s.filtroBtnActive,
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <Ionicons
                name={icon}
                size={14}
                color={active ? "#fff" : COLORS.textLight}
              />
              <Text style={[s.filtroTxt, active && { color: "#fff" }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── GRID DE LETRAS ── */}
      <Text style={s.section}>
        {busqueda ? `RESULTADOS PARA "${busqueda}"` : "TODAS LAS LETRAS"}
      </Text>

      <ScrollView
        contentContainerStyle={s.grid}
        showsVerticalScrollIndicator={false}
      >
        {letras.map((l) => {
          const col = getCardColor(l);
          const mov = LETRAS_MOVIMIENTO.has(l);
          return (
            <Pressable
              key={l}
              style={({ pressed }) => [
                { width: CARD_W },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
              onPress={() => abrirDetalle(l)}
            >
              <View
                style={[
                  s.card,
                  { backgroundColor: col.bg, borderColor: col.border },
                ]}
              >
                {/* Dot de tipo */}
                <View
                  style={[
                    s.typeDot,
                    { backgroundColor: mov ? COLORS.coral2 : COLORS.success },
                  ]}
                />

                <Text style={[s.cardLetter, { color: col.text }]}>{l}</Text>
                <Text style={s.cardEmoji}>{ALFABETO[l].emoji}</Text>

                {/* Badge de movimiento */}
                {mov && (
                  <View style={s.movBadge}>
                    <Ionicons
                      name="swap-horizontal"
                      size={9}
                      color={COLORS.blue}
                    />
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}

        {letras.length === 0 && (
          <View style={s.empty}>
            <Ionicons
              name="search-outline"
              size={32}
              color={COLORS.textLight}
            />
            <Text style={s.emptyTxt}>Sin resultados para "{busqueda}"</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── LEYENDA ── */}
      <View style={s.leyenda}>
        {[
          { color: COLORS.success, label: "Estática" },
          { color: COLORS.coral2, label: "Con movimiento" },
        ].map(({ color, label }) => (
          <View key={label} style={s.leyItem}>
            <View style={[s.leyDot, { backgroundColor: color }]} />
            <Text style={s.leyTxt}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── MODAL DETALLE ── */}
      {sel && selInfo && selColor && (
        <Animated.View style={[s.modalOverlay, { opacity: modalFade }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={cerrar}
            activeOpacity={1}
          />

          <Animated.View
            style={[s.modalCard, { transform: [{ scale: modalScale }] }]}
          >
            {/* Top colorido */}
            <View style={[s.modalTop, { backgroundColor: selColor.bg }]}>
              <Text style={[s.modalLetter, { color: selColor.text }]}>
                {sel}
              </Text>
              <Text style={s.modalEmoji}>{selInfo.emoji}</Text>
              <TouchableOpacity
                style={s.modalClose}
                onPress={cerrar}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color={selColor.text} />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              {/* Badge tipo */}
              <View
                style={[
                  s.typeBadge,
                  {
                    backgroundColor: esMov ? "#FEE2E2" : "#DCFCE7",
                    borderColor: esMov ? "#EF4444" : "#22C55E",
                  },
                ]}
              >
                <Ionicons
                  name={esMov ? "swap-horizontal" : "hand-right"}
                  size={13}
                  color={esMov ? "#EF4444" : "#22C55E"}
                />
                <Text
                  style={[s.typeTxt, { color: esMov ? "#EF4444" : "#22C55E" }]}
                >
                  {esMov ? "Seña con movimiento" : "Seña estática"}
                </Text>
              </View>

              <Text style={s.modalDesc}>{selInfo.desc}</Text>

              {selInfo.tip && (
                <View style={s.tipBox}>
                  <Ionicons name="bulb-outline" size={16} color="#2F80ED" />
                  <Text style={s.tipTxt}>{selInfo.tip}</Text>
                </View>
              )}

              {/* Botón practicar — igual al card del index */}
              <Pressable
                style={({ pressed }) => [
                  s.practicaBtn,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => {
                  cerrar();
                  router.push("/(tabs)/camera");
                }}
              >
                <LinearGradient
                  colors={[
                    COLORS.primary,
                    COLORS.primaryLight ?? COLORS.primary,
                  ]}
                  style={s.practicaGrad}
                >
                  <Ionicons name="camera" size={17} color="#fff" />
                  <Text style={s.practicaTxt}>Practicar con cámara</Text>
                </LinearGradient>
              </Pressable>

              {/* Navegación anterior / siguiente */}
              <View style={s.navRow}>
                <TouchableOpacity
                  style={[s.navBtn, selIdx === 0 && s.navDisabled]}
                  onPress={() =>
                    selIdx > 0 && abrirDetalle(TODAS_LAS_LETRAS[selIdx - 1])
                  }
                  disabled={selIdx === 0}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={selIdx === 0 ? COLORS.textLight : COLORS.primary}
                  />
                  <Text
                    style={[
                      s.navTxt,
                      selIdx === 0 && { color: COLORS.textLight },
                    ]}
                  >
                    Anterior
                  </Text>
                </TouchableOpacity>

                <Text style={s.navPos}>
                  {selIdx + 1} / {TODAS_LAS_LETRAS.length}
                </Text>

                <TouchableOpacity
                  style={[
                    s.navBtn,
                    s.navBtnR,
                    selIdx === TODAS_LAS_LETRAS.length - 1 && s.navDisabled,
                  ]}
                  onPress={() =>
                    selIdx < TODAS_LAS_LETRAS.length - 1 &&
                    abrirDetalle(TODAS_LAS_LETRAS[selIdx + 1])
                  }
                  disabled={selIdx === TODAS_LAS_LETRAS.length - 1}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      s.navTxt,
                      selIdx === TODAS_LAS_LETRAS.length - 1 && {
                        color: COLORS.textLight,
                      },
                    ]}
                  >
                    Siguiente
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      selIdx === TODAS_LAS_LETRAS.length - 1
                        ? COLORS.textLight
                        : COLORS.primary
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ── ESTILOS ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F9FC" }, // mismo fondo que index

  // Header — mismo patrón que index
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 12,
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
  headerBadge: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  headerBadgeN: { fontSize: 18, fontWeight: "900", color: COLORS.primary },
  headerBadgeLbl: {
    fontSize: 9,
    color: COLORS.primary,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Stats — idéntico al index
  stats: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    justifyContent: "space-around",
    marginHorizontal: 20,
    marginBottom: 16,
    ...SHADOW.sm,
  },
  stat: { alignItems: "center" },
  statVal: { fontWeight: "900", fontSize: 16, color: COLORS.primary },
  statLbl: { fontSize: 11, color: "#888" },

  // Sección label
  section: {
    fontSize: 11,
    color: "#999",
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  // Buscador
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    ...SHADOW.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111",
    fontWeight: "600",
    padding: 0,
  },

  // Filtros — igual a quickItem del index
  filtrosRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  filtroBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    ...SHADOW.sm,
  },
  filtroBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filtroTxt: { fontSize: 11, color: "#888", fontWeight: "700" },

  // Grid
  grid: {
    paddingHorizontal: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1.5,
    position: "relative",
    overflow: "hidden",
    ...SHADOW.sm,
  },
  typeDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cardLetter: { fontSize: 30, fontWeight: "900", lineHeight: 36 },
  cardEmoji: { fontSize: 15, marginTop: 2 },
  movBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "#EBF4FF",
    borderRadius: 6,
    padding: 3,
  },

  // Vacío
  empty: { width: "100%", alignItems: "center", paddingTop: 40, gap: 10 },
  emptyTxt: { fontSize: 14, color: "#999", fontWeight: "600" },

  // Leyenda
  leyenda: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E8ECF0",
    backgroundColor: "#fff",
  },
  leyItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  leyDot: { width: 8, height: 8, borderRadius: 4 },
  leyTxt: { fontSize: 11, color: "#888", fontWeight: "600" },

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fff",
    ...SHADOW.lg,
  },
  modalTop: {
    padding: 28,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    position: "relative",
  },
  modalLetter: { fontSize: 72, fontWeight: "900" },
  modalEmoji: { fontSize: 44 },
  modalClose: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: { padding: 20, gap: 14 },

  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    alignSelf: "flex-start",
  },
  typeTxt: { fontSize: 12, fontWeight: "700" },
  modalDesc: { fontSize: 15, color: "#555", lineHeight: 24 },

  tipBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#EBF4FF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    alignItems: "flex-start",
  },
  tipTxt: { flex: 1, fontSize: 13, color: "#2F80ED", lineHeight: 20 },

  // Botón practicar — igual al card del index
  practicaBtn: { borderRadius: 16, overflow: "hidden" },
  practicaGrad: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  practicaTxt: { fontSize: 15, fontWeight: "800", color: "#fff" },

  // Navegación
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary + "12",
    flex: 1,
  },
  navBtnR: { justifyContent: "flex-end" },
  navDisabled: { backgroundColor: "#F1F5F9" },
  navTxt: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  navPos: { fontSize: 13, color: "#888", fontWeight: "600" },
});

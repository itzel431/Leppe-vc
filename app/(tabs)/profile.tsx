// app/(tabs)/profile.tsx

import { COLORS, SHADOW } from "@/constants/theme";
import {
  clearAllPhrases,
  deletePhrase,
  Frase,
  loadPhrases,
} from "@/services/storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const STRIP_COLORS = [
  ["#FF6B6B", "#FF8E53"],
  ["#4FACFE", "#00F2FE"],
  ["#43E97B", "#38F9D7"],
  ["#F093FB", "#F5576C"],
  ["#FFA726", "#FB8C00"],
];

// ── CARD DE FRASE ──────────────────────────────────────────────────────────
type CardProps = {
  item: Frase;
  index: number;
  onDelete: (id: string) => void;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
  onShare: (text: string) => void;
};

function FraseCard({
  item,
  index,
  onDelete,
  onCopy,
  onSpeak,
  onShare,
}: CardProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  const [c1, c2] = STRIP_COLORS[index % STRIP_COLORS.length];

  // Animación de entrada corregida
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: Math.min(index * 50, 300),
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        delay: Math.min(index * 50, 300),
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
    ]).start();
  }, []);

  const fecha = new Date(item.ts);

  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ translateY: slide }] }}
    >
      <View style={s.card}>
        {/* Barra de color lateral */}
        <LinearGradient colors={[c1, c2]} style={s.cardStrip} />

        <View style={s.cardBody}>
          {/* Meta — fecha y longitud */}
          <View style={s.cardMeta}>
            <Ionicons name="time-outline" size={11} color="#aaa" />
            <Text style={s.cardMetaTxt}>
              {fecha.toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "short",
              })}
              {" · "}
              {fecha.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <View style={s.lenBadge}>
              <Text style={s.lenTxt}>{item.text.length} car.</Text>
            </View>
          </View>

          {/* Texto de la frase */}
          <Text style={s.cardText} numberOfLines={4}>
            {item.text}
          </Text>

          {/* Botones de acción */}
          <View style={s.cardActions}>
            {[
              {
                icon: "volume-high" as const,
                lbl: "Hablar",
                fn: () => onSpeak(item.text),
                c: c1,
              },
              {
                icon: "copy" as const,
                lbl: "Copiar",
                fn: () => onCopy(item.text),
                c: COLORS.blue,
              },
              {
                icon: "share-social" as const,
                lbl: "Compartir",
                fn: () => onShare(item.text),
                c: COLORS.success,
              },
              {
                icon: "trash" as const,
                lbl: "",
                fn: () => onDelete(item.id),
                c: "#EF4444",
              },
            ].map(({ icon, lbl, fn, c }) => (
              <TouchableOpacity
                key={icon}
                style={[
                  s.cBtn,
                  { borderColor: c + "30", backgroundColor: c + "10" },
                ]}
                onPress={fn}
                activeOpacity={0.75}
              >
                <Ionicons name={icon} size={14} color={c} />
                {lbl ? (
                  <Text style={[s.cBtnTxt, { color: c }]}>{lbl}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ── PANTALLA PRINCIPAL ─────────────────────────────────────────────────────
export default function ProfileScreen() {
  const [frases, setFrases] = useState<Frase[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
      loadPhrases().then((d) => setFrases(d.slice().reverse()));
      return () => fadeAnim.setValue(0);
    }, [fadeAnim]),
  );

  const handleDelete = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deletePhrase(id);
    setFrases((p) => p.filter((f) => f.id !== id));
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSpeak = (text: string) =>
    Speech.speak(text, { language: "es-MX", rate: 0.9 });

  const handleShare = async (text: string) => {
    try {
      await Share.share({ message: text });
    } catch {}
  };

  const handleClearAll = () =>
    Alert.alert(
      "Borrar todo el historial",
      "¿Estás seguro? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar todo",
          style: "destructive",
          onPress: async () => {
            await clearAllPhrases();
            setFrases([]);
          },
        },
      ],
    );

  const totalLetras = frases.reduce(
    (a, f) => a + f.text.replace(/ /g, "").length,
    0,
  );
  const totalPalabras = frases.reduce(
    (a, f) => a + f.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );

  return (
    <Animated.View style={[s.root, { opacity: fadeAnim }]}>
      {/* ── HEADER — mismo estilo que index ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)")}
          style={s.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={18} color="#111" />
        </TouchableOpacity>

        <View style={s.headerText}>
          <Text style={s.headerSub}>Comunicaciones guardadas</Text>
          <Text style={s.headerTitle}>Historial</Text>
        </View>

        {frases.length > 0 && (
          <TouchableOpacity
            style={s.clearBtn}
            onPress={handleClearAll}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── STATS — idéntico al index ── */}
      {frases.length > 0 && (
        <View style={s.statsRow}>
          {[
            { val: frases.length, lbl: "frases", color: COLORS.coralD },
            { val: totalLetras, lbl: "letras", color: COLORS.blue },
            { val: totalPalabras, lbl: "palabras", color: COLORS.success },
          ].map((item, i) => (
            <View key={i} style={s.stat}>
              <Text style={[s.statVal, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statLbl}>{item.lbl}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── LISTA / VACÍO ── */}
      {frases.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="bookmark-outline" size={40} color={COLORS.coralD} />
          </View>
          <Text style={s.emptyTitle}>Sin frases guardadas</Text>
          <Text style={s.emptySub}>
            Detecta señas en el Detector — las frases confirmadas aparecerán
            aquí.
          </Text>
          <Pressable
            style={({ pressed }) => [
              s.emptyBtn,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => router.push("/(tabs)/camera")}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryLight ?? COLORS.primary]}
              style={s.emptyBtnGrad}
            >
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={s.emptyBtnTxt}>Ir al Detector</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={frases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, index }) => (
            <FraseCard
              item={item}
              index={index}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onSpeak={handleSpeak}
              onShare={handleShare}
            />
          )}
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      )}
    </Animated.View>
  );
}

// ── ESTILOS ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F9FC" },

  // Header — mismo patrón que index, alphabet y learn
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#F7F9FC",
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
  clearBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },

  // Stats — idéntico al index
  statsRow: {
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
  statVal: { fontWeight: "900", fontSize: 22 },
  statLbl: { fontSize: 11, color: "#888" },

  list: { paddingHorizontal: 20 },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E8ECF0",
    ...SHADOW.sm,
  },
  cardStrip: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  cardMetaTxt: { fontSize: 10, color: "#aaa", fontWeight: "600", flex: 1 },
  lenBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  lenTxt: { fontSize: 9, color: "#888", fontWeight: "700" },
  cardText: {
    fontSize: 17,
    color: "#111",
    fontWeight: "600",
    lineHeight: 26,
    marginBottom: 12,
  },
  cardActions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  cBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  cBtnTxt: { fontSize: 11, fontWeight: "700" },

  // Estado vacío
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: COLORS.coralD + "10",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.coralD + "20",
  },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#111" },
  emptySub: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyBtn: { borderRadius: 16, overflow: "hidden", marginTop: 8, width: 180 },
  emptyBtnGrad: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyBtnTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

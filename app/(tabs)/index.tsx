import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import icon from "@/assets/icon.png";
import { COLORS, SHADOW } from "@/constants/theme";

const { width: W } = Dimensions.get("window");

export default function HomeScreen() {
  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ paddingBottom: 30 }}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoCircle}>
            <Image source={icon} style={s.logoImg} />
          </View>

          <View>
            <Text style={s.brand}>Leppe</Text>
            <Text style={s.tagline}>Comunicación sin barreras</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          style={({ pressed }) => [
            s.profile,
            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
          ]}
        >
          <Ionicons name="person" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* HERO */}
      <View style={s.hero}>
        <Text style={s.heroTitle}>
          Comunícate{"\n"}
          <Text style={{ color: COLORS.primary }}>sin límites.</Text>
        </Text>

        <Text style={s.heroSub}>
          IA que traduce Lengua de Señas Mexicana en tiempo real, directamente
          desde tu cámara.
        </Text>
      </View>

      {/* STATS */}
      <View style={s.stats}>
        {[
          { val: "2.3M", label: "Personas" },
          { val: "90%+", label: "Precisión" },
          { val: "<700ms", label: "Latencia" },
        ].map((item, i) => (
          <View key={i} style={s.stat}>
            <Text style={s.statVal}>{item.val}</Text>
            <Text style={s.statLbl}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* FUNCIONES */}
      <Text style={s.section}>FUNCIONES PRINCIPALES</Text>

      <Pressable
        onPress={() => router.push("/(tabs)/camera")}
        style={({ pressed }) => [s.card, pressed && s.pressed]}
      >
        <View style={[s.iconBox, { backgroundColor: "#FFE4E4" }]}>
          <Ionicons name="camera" size={22} color={COLORS.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Traducir con cámara</Text>
          <Text style={s.cardSub}>LSM → Texto y voz en tiempo real</Text>
        </View>

        <Text style={s.badge}>90%+ precisión</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(tabs)/learn")}
        style={({ pressed }) => [s.card, pressed && s.pressed]}
      >
        <View style={[s.iconBox, { backgroundColor: "#E6F4EA" }]}>
          <Ionicons name="school" size={22} color="#27AE60" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Aprender LSM</Text>
          <Text style={s.cardSub}>Lecciones gamificadas con IA</Text>
        </View>

        <Text style={s.badgeSoft}>A1–C1</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(tabs)/alphabet")}
        style={({ pressed }) => [s.card, pressed && s.pressed]}
      >
        <View style={[s.iconBox, { backgroundColor: "#E8F0FF" }]}>
          <Ionicons name="grid" size={22} color="#2F80ED" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Explorar alfabeto</Text>
          <Text style={s.cardSub}>Aprende cada letra visualmente</Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#aaa" />
      </Pressable>

      {/* QUICK ACCESS */}
      <Text style={s.section}>ACCESO RÁPIDO</Text>

      <View style={s.quick}>
        {[
          { icon: "pulse", label: "Salud" },
          { icon: "business", label: "Gobierno" },
          { icon: "cart", label: "Comercio" },
          { icon: "briefcase", label: "Legal" },
        ].map((q, i) => (
          <Pressable key={i} style={s.quickItem}>
            <Ionicons name={q.icon} size={18} color={COLORS.primary} />
            <Text style={s.quickText}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* 🔥 PRIVACIDAD CORREGIDA */}
      <LinearGradient colors={["#111827", "#1F2937"]} style={s.privacy}>
        <View style={{ flex: 1 }}>
          <Text style={s.privacyTitle}>Privacidad garantizada</Text>
          <Text style={s.privacySub}>
            El video nunca sale de tu dispositivo. Procesamiento 100% local.
          </Text>
        </View>

        <View style={s.badgeGreen}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Seguro</Text>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    paddingHorizontal: 20,
    paddingTop: 60,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  headerLeft: {
    flexDirection: "row",
    gap: 10,
  },

  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOW.sm,
  },

  logoImg: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },

  brand: { fontSize: 18, fontWeight: "800" },
  tagline: { fontSize: 11, color: "#888" },

  profile: {
    backgroundColor: COLORS.primary,
    padding: 10,
    borderRadius: 20,
    ...SHADOW.sm,
  },

  hero: { marginBottom: 20 },

  heroTitle: {
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 36,
  },

  heroSub: {
    marginTop: 10,
    color: "#666",
    fontSize: 14,
  },

  stats: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    justifyContent: "space-around",
    marginBottom: 20,
    ...SHADOW.sm,
  },

  stat: { alignItems: "center" },

  statVal: {
    fontWeight: "900",
    fontSize: 16,
    color: COLORS.primary,
  },

  statLbl: { fontSize: 11, color: "#888" },

  section: {
    fontSize: 11,
    color: "#999",
    marginBottom: 10,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
    ...SHADOW.sm,
  },

  pressed: {
    transform: [{ scale: 0.97 }],
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  cardTitle: {
    fontWeight: "800",
    fontSize: 14,
  },

  cardSub: {
    fontSize: 12,
    color: "#666",
  },

  badge: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "700",
  },

  badgeSoft: {
    fontSize: 11,
    color: "#27AE60",
    fontWeight: "700",
  },

  quick: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  quickItem: {
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    width: (W - 60) / 4,
    ...SHADOW.sm,
  },

  quickText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "600",
  },

  privacy: {
    padding: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },

  privacyTitle: {
    color: "#fff",
    fontWeight: "800",
  },

  privacySub: {
    color: "#ccc",
    fontSize: 12,
  },

  badgeGreen: {
    backgroundColor: "#27AE60",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
});

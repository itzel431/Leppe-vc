import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '@/constants/theme';
import { markOnboardingDone } from '@/services/storage';

const { width: W } = Dimensions.get('window');

type Slide = {
  id:    string;
  emoji: string;
  titulo:string;
  sub:   string;
  desc:  string;
  gradA: string;
  gradB: string;
  stats?: { val: string; lbl: string }[];
};

const SLIDES: Slide[] = [
  {
    id: '1', emoji: '👋',
    titulo: 'Bienvenido a LEPPE',
    sub:    'Comunicación sin barreras',
    desc:   'Plataforma de inteligencia artificial que traduce la Lengua de Señas Mexicana a voz en tiempo real, usando solo la cámara de tu celular.',
    gradA: COLORS.coralD, gradB: COLORS.coral,
  },
  {
    id: '2', emoji: '📷',
    titulo: 'Apunta y comunícate',
    sub:    'Cámara → Señas → Voz',
    desc:   'Coloca tu mano frente a la cámara. LEPPE detecta tu seña en menos de 700ms y habla por ti — sin internet, sin dispositivos extras.',
    gradA: COLORS.navy,   gradB: COLORS.blue,
  },
  {
    id: '3', emoji: '🏆',
    titulo: 'Aprende LSM',
    sub:    'Módulo educativo interactivo',
    desc:   'Practica las 27 letras con lecciones y feedback en tiempo real. Obtén tu certificado digital A1, B1 o C1.',
    gradA: COLORS.success, gradB: '#52D68A',
    stats: [
      { val: '2.3M',   lbl: 'Personas\nbeneficiadas' },
      { val: '90%+',   lbl: 'Precisión\nen condiciones óptimas' },
      { val: '<700ms', lbl: 'Cámara\na voz' },
    ],
  },
];

export default function OnboardingScreen() {
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setIdx(next);
  };

  const finish = async () => {
    await markOnboardingDone();
    router.replace('/(tabs)/');
  };

  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <LinearGradient colors={[slide.gradA, slide.gradB]} style={s.root}>

      {/* Skip */}
      <TouchableOpacity style={s.skip} onPress={finish} activeOpacity={0.75}>
        <Text style={s.skipTxt}>Omitir</Text>
      </TouchableOpacity>

      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        {/* Círculo emoji */}
        <View style={s.circle}>
          <Text style={s.emoji}>{slide.emoji}</Text>
        </View>

        <Text style={s.brand}>LEPPE</Text>
        <Text style={s.sub}>{slide.sub}</Text>
        <Text style={s.titulo}>{slide.titulo}</Text>
        <Text style={s.desc}>{slide.desc}</Text>

        {/* Stats último slide */}
        {slide.stats && (
          <View style={s.statsRow}>
            {slide.stats.map(({ val, lbl }) => (
              <View key={val} style={s.statItem}>
                <Text style={s.statVal}>{val}</Text>
                <Text style={s.statLbl}>{lbl}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Dots */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)} activeOpacity={0.7}>
            <View style={[s.dot, i === idx && s.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Botón */}
      <TouchableOpacity
        onPress={isLast ? finish : () => goTo(idx + 1)}
        activeOpacity={0.88}
        style={s.btnWrap}
      >
        <View style={s.btn}>
          <Text style={[s.btnTxt, { color: slide.gradA }]}>
            {isLast ? '¡Comenzar!' : 'Siguiente'}
          </Text>
          <Ionicons
            name={isLast ? 'checkmark' : 'arrow-forward'}
            size={20} color={slide.gradA}
          />
        </View>
      </TouchableOpacity>

    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  skip:     { position: 'absolute', top: 56, right: 24, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6 },
  skipTxt:  { color: '#fff', fontSize: 13, fontWeight: '600' },

  content:  { alignItems: 'center', width: '100%' },
  circle:   { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emoji:    { fontSize: 52 },
  brand:    { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 2, marginBottom: 4 },
  sub:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.5, marginBottom: 20 },
  titulo:   { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 14, lineHeight: 34 },
  desc:     { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24, maxWidth: 320 },

  statsRow: { flexDirection: 'row', gap: 20, marginTop: 24 },
  statItem: { alignItems: 'center' },
  statVal:  { fontSize: 20, fontWeight: '900', color: '#fff' },
  statLbl:  { fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 80, marginTop: 2 },

  dotsRow:  { flexDirection: 'row', gap: 8, marginTop: 36, marginBottom: 16 },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive:{ width: 24, backgroundColor: '#fff' },

  btnWrap:  { width: '100%', marginTop: 8 },
  btn:      { backgroundColor: '#fff', borderRadius: RADIUS.lg, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnTxt:   { fontSize: 17, fontWeight: '800' },
});

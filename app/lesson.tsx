import { useLocalSearchParams, router } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '@/constants/theme';
import { ALFABETO, LETRAS_MOVIMIENTO, getCardColor } from '@/constants/lsmData';

const { height: H } = Dimensions.get('window');

export default function LessonScreen() {
  const { letra } = useLocalSearchParams<{ letra: string }>();
  const l = letra ?? 'A';

  const info   = ALFABETO[l];
  const color  = getCardColor(l);
  const esMov  = LETRAS_MOVIMIENTO.has(l);

  if (!info) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: COLORS.textDark, fontSize: 18 }}>Letra no encontrada</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: COLORS.coralD, fontWeight: '700' }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Overlay para cerrar */}
      <TouchableOpacity style={s.overlay} onPress={() => router.back()} activeOpacity={1} />

      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Top colorido */}
        <View style={[s.top, { backgroundColor: color.bg }]}>
          <Text style={[s.bigLetter, { color: color.text }]}>{l}</Text>
          <Text style={s.bigEmoji}>{info.emoji}</Text>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="close" size={20} color={color.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

          {/* Tipo */}
          <View style={[s.typeBadge, {
            backgroundColor: esMov ? COLORS.errorL  : COLORS.successL,
            borderColor:     esMov ? COLORS.error    : COLORS.success,
          }]}>
            <Ionicons name={esMov ? 'swap-horizontal' : 'hand-right'} size={13} color={esMov ? COLORS.error : COLORS.success} />
            <Text style={[s.typeTxt, { color: esMov ? COLORS.error : COLORS.success }]}>
              {esMov ? 'Seña con movimiento' : 'Seña estática'}
            </Text>
          </View>

          {/* Descripción */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>¿Cómo hacer la seña?</Text>
            <Text style={s.desc}>{info.desc}</Text>
          </View>

          {/* Tip */}
          {info.tip && (
            <View style={s.tipBox}>
              <View style={s.tipIconWrap}>
                <Ionicons name="bulb" size={20} color={COLORS.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>Consejo</Text>
                <Text style={s.tipTxt}>{info.tip}</Text>
              </View>
            </View>
          )}

          {/* Alerta movimiento */}
          {esMov && (
            <View style={s.movAlert}>
              <Ionicons name="information-circle" size={16} color={COLORS.error} />
              <Text style={s.movAlertTxt}>
                Esta seña requiere movimiento. Realiza el gesto completo frente a la cámara para una detección correcta.
              </Text>
            </View>
          )}

          {/* Practicar */}
          <TouchableOpacity
            style={s.practicaBtn}
            onPress={() => { router.back(); router.push('/(tabs)/camera'); }}
            activeOpacity={0.88}
          >
            <LinearGradient colors={[COLORS.coralD, COLORS.coral]} style={s.practicaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={s.practicaTxt}>Practicar con la cámara</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bgWhite,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: H * 0.88, overflow: 'hidden',
    ...SHADOW.lg,
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.bgGray, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  top:      { padding: 28, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 20, position: 'relative' },
  bigLetter:{ fontSize: 80, fontWeight: '900', lineHeight: 88 },
  bigEmoji: { fontSize: 52 },
  closeBtn: { position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.08)', justifyContent: 'center', alignItems: 'center' },

  body:        { padding: 20, gap: 16 },
  typeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5, alignSelf: 'flex-start' },
  typeTxt:     { fontSize: 12, fontWeight: '700' },
  section:     {},
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: COLORS.textGray, letterSpacing: 0.5, marginBottom: 6 },
  desc:        { fontSize: 16, color: COLORS.textDark, lineHeight: 26 },

  tipBox:    { flexDirection: 'row', gap: 12, backgroundColor: COLORS.blue + '10', borderRadius: RADIUS.lg, padding: 14, borderWidth: 1.5, borderColor: COLORS.blue + '30' },
  tipIconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.blue + '20', justifyContent: 'center', alignItems: 'center' },
  tipTitle:  { fontSize: 12, fontWeight: '800', color: COLORS.blue, marginBottom: 3 },
  tipTxt:    { fontSize: 13, color: COLORS.blue + 'CC', lineHeight: 20 },

  movAlert:   { flexDirection: 'row', gap: 10, backgroundColor: COLORS.errorL, borderRadius: RADIUS.lg, padding: 12, borderWidth: 1, borderColor: COLORS.error + '30' },
  movAlertTxt:{ flex: 1, fontSize: 13, color: COLORS.error, lineHeight: 20 },

  practicaBtn:  { borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.md },
  practicaGrad: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: RADIUS.lg },
  practicaTxt:  { fontSize: 16, fontWeight: '800', color: '#fff' },
});

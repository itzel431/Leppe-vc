import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { COLORS, RADIUS } from '@/constants/theme';

export default function ReverseScreen() {
  return (
    <View style={s.root}>
      <LinearGradient colors={[COLORS.navy, COLORS.navyD]} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Próximamente</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={s.body}>
        <View style={s.iconWrap}>
          <Ionicons name="construct" size={48} color={COLORS.coralD} />
        </View>
        <Text style={s.titulo}>Función en desarrollo</Text>
        <Text style={s.desc}>
          Esta pantalla estará disponible en una próxima versión de LEPPE.
        </Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
          <LinearGradient colors={[COLORS.coralD, COLORS.coral]} style={s.btn}>
            <Text style={s.btnTxt}>Volver</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  body:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  iconWrap: { width: 96, height: 96, borderRadius: 28, backgroundColor: COLORS.coralD + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 2, borderColor: COLORS.coralD + '25' },
  titulo:   { fontSize: 22, fontWeight: '900', color: COLORS.textDark, marginBottom: 10 },
  desc:     { fontSize: 15, color: COLORS.textGray, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  btn:      { paddingHorizontal: 40, paddingVertical: 16, borderRadius: RADIUS.lg },
  btnTxt:   { fontSize: 16, fontWeight: '800', color: '#fff' },
});

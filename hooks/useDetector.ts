import { useState, useRef, useCallback, useEffect } from 'react';
import { Animated } from 'react-native';

export type DetectionResult = {
  letra: string;
  conf:  number;
};

// Simulación — reemplazar con modelo TFLite real
const simular = (): DetectionResult => {
  const ls = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
  return {
    letra: ls[Math.floor(Math.random() * ls.length)],
    conf:  0.60 + Math.random() * 0.38,
  };
};

export function useDetector() {
  const [activo,  setActivo]  = useState(false);
  const [letra,   setLetra]   = useState('');
  const [conf,    setConf]    = useState(0);
  const [texto,   setTexto]   = useState('');

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const letterAnim   = useRef(new Animated.Value(0)).current;
  const confAnim     = useRef(new Animated.Value(0)).current;
  const scanAnim     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activo) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 900, useNativeDriver: true }),
      ])).start();
      Animated.loop(
        Animated.timing(scanAnim, { toValue: 1, duration: 2200, useNativeDriver: true })
      ).start();
    } else {
      pulseAnim.stopAnimation(); pulseAnim.setValue(1);
      scanAnim.stopAnimation();  scanAnim.setValue(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activo]);

  const animarLetra = useCallback((c: number) => {
    letterAnim.setValue(0);
    confAnim.setValue(0);
    Animated.parallel([
      Animated.spring(letterAnim, { toValue: 1, useNativeDriver: true, tension: 90, friction: 6 }),
      Animated.timing(confAnim, { toValue: c, duration: 450, useNativeDriver: false }),
    ]).start();
  }, []);

  const iniciar = useCallback(() => {
    setActivo(true);
    intervalRef.current = setInterval(() => {
      const { letra: l, conf: c } = simular();
      setLetra(l);
      setConf(c);
      animarLetra(c);
    }, 950);
  }, [animarLetra]);

  const detener = useCallback(() => {
    setActivo(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLetra('');
    setConf(0);
  }, []);

  const agregarLetra  = useCallback(() => letra && setTexto(p => p + letra),  [letra]);
  const agregarEspacio= useCallback(() => setTexto(p => p + ' '), []);
  const borrarUltima  = useCallback(() => setTexto(p => p.slice(0, -1)),       []);
  const limpiarTexto  = useCallback(() => setTexto(''),                         []);

  return {
    activo, letra, conf, texto,
    iniciar, detener,
    agregarLetra, agregarEspacio, borrarUltima, limpiarTexto,
    pulseAnim, letterAnim, confAnim, scanAnim,
  };
}

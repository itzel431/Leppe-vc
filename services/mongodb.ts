/**
 * MongoDB Atlas Service — LEPPE v3
 * REST Data API works in React Native (no native driver needed)
 * DB: leppe_db
 * Collections: user_progress | lessons | translation_sessions | media_resources | leaderboard
 *
 * SETUP:
 * 1. Go to cloud.mongodb.com → Data API → Enable
 * 2. Create API Key
 * 3. Paste API key in ATLAS_API_KEY below
 * 4. Make sure App ID matches (find it under Data API tab)
 */

// ── Connection ──────────────────────────────────────────────
const ATLAS_APP_ID    = 'data-akflf';  // Update with your actual App ID
const ATLAS_API_KEY   = '';            // Paste Atlas Data API key here
const ATLAS_BASE      = `https://data.mongodb-api.com/app/${ATLAS_APP_ID}/endpoint/data/v1`;
const DB_NAME         = 'leppe_db';
const CLUSTER         = 'Cluster0';

// ── Types ───────────────────────────────────────────────────

export interface UserProgress {
  _id?: string;
  userId: string;
  displayName: string;
  avatarEmoji: string;
  level: 'A1' | 'B1' | 'C1';
  xp: number;
  streak: number;
  maxStreak: number;
  lastActive: string;
  completedLessons: string[];
  translationCount: number;
  avgAccuracy: number;
  badges: string[];
  createdAt: string;
  studyMinutes: number;
  favoriteSign: string;
  country: string;
  bio: string;
  weeklyXP: number[];  // [Mon-Sun]
  totalSigns: number;
}

export interface Lesson {
  _id?: string;
  id: string;
  level: 'A1' | 'B1' | 'C1';
  title: string;
  subtitle: string;
  sign: string;
  signEmoji: string;
  description: string;
  longDescription: string;
  difficulty: number;         // 1-5
  category: string;
  order: number;
  videoUrl: string;
  thumbnailUrl: string;
  gifUrl: string;
  tips: string[];
  relatedSigns: string[];
  xpReward: number;
  estimatedMinutes: number;
  quizQuestions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  signEmoji: string;
  explanation: string;
}

export interface TranslationSession {
  _id?: string;
  userId: string;
  text: string;
  letters: string[];
  duration: number;
  avgConfidence: number;
  timestamp: string;
  mode: 'api' | 'simulation';
  topSigns: { sign: string; count: number }[];
}

export interface MediaResource {
  _id?: string;
  signLetter: string;
  videoUrl: string;
  thumbnailUrl: string;
  gifUrl: string;
  description: string;
  handShape: string;
  movement: string;
  location: string;
  tips: string[];
  source: string;
  difficulty: number;
  relatedLetters: string[];
  views: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  xp: number;
  level: string;
  streak: number;
  badges: string[];
  country: string;
  rank: number;
}

// ── Mock Signs media data ────────────────────────────────────
export const SIGN_MEDIA: Record<string, Omit<MediaResource, '_id'>> = {
  A: { signLetter:'A', videoUrl:'', thumbnailUrl:'', gifUrl:'',
       description:'La letra A es un puño cerrado con el pulgar al costado.',
       handShape:'Puño cerrado', movement:'Estático', location:'Espacio neutro',
       tips:['El pulgar NO va encima del puño','Los 4 dedos se cierran completamente'],
       source:'LSM', difficulty:1, relatedLetters:['S','E','N'], views:0 },
  B: { signLetter:'B', videoUrl:'', thumbnailUrl:'', gifUrl:'',
       description:'La letra B usa la mano abierta con todos los dedos juntos apuntando hacia arriba.',
       handShape:'Mano plana', movement:'Estático', location:'Espacio neutro',
       tips:['Los 4 dedos van completamente juntos','El pulgar se dobla hacia la palma'],
       source:'LSM', difficulty:1, relatedLetters:['N','R','U'], views:0 },
  C: { signLetter:'C', videoUrl:'', thumbnailUrl:'', gifUrl:'',
       description:'Mano curva formando la letra C con todos los dedos.',
       handShape:'Curva', movement:'Estático', location:'Espacio neutro',
       tips:['Dedos curvos pero NO cerrados del todo','Visualiza sostener una taza'],
       source:'LSM', difficulty:1, relatedLetters:['G','O'], views:0 },
};

// Fill remaining signs
'DEFGHIJKLMNOPQRSTUVWXYZ Ñ'.split('').filter(c=>c.trim()).forEach(letter => {
  if (!SIGN_MEDIA[letter]) {
    SIGN_MEDIA[letter] = {
      signLetter: letter, videoUrl:'', thumbnailUrl:'', gifUrl:'',
      description: `Seña LSM para la letra ${letter}.`,
      handShape: 'Varía', movement: 'Estático', location: 'Espacio neutro',
      tips: ['Mantén la muñeca relajada', 'El movimiento debe ser fluido'],
      source:'LSM', difficulty:2, relatedLetters:[], views:0,
    };
  }
});

// ── Mock Lessons ─────────────────────────────────────────────
export const MOCK_LESSONS: Lesson[] = [
  {
    id:'a1-1', level:'A1', title:'Hola y Adiós', subtitle:'Saludos básicos', sign:'H', signEmoji:'👋',
    description:'Las señas de saludo más usadas en LSM todos los días.',
    longDescription:'Aprender a saludar abre puertas. "Hola" y "Adiós" son las primeras señas que debes dominar. En LSM los saludos se acompañan de expresión facial y contacto visual, que son parte fundamental del mensaje.',
    difficulty:1, category:'Saludos', order:1, xpReward:25, estimatedMinutes:5,
    videoUrl:'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl:'https://picsum.photos/seed/lsm-hola/400/225',
    gifUrl:'',
    tips:['Mueve toda la mano al saludar','Mantén contacto visual','La expresión facial completa el mensaje'],
    relatedSigns:['A','B'],
    quizQuestions:[
      { id:'q1', question:'¿Cuántos dedos se extienden en la seña "Hola"?', options:['Solo el índice','Todos los dedos','Solo pulgar','Tres dedos'], correct:1, signEmoji:'✋', explanation:'En "Hola" se extienden todos los dedos en la mano abierta.' },
      { id:'q2', question:'¿Qué movimiento tiene la seña "Adiós"?', options:['Circular','Lineal arriba-abajo','Ondular los dedos','Sin movimiento'], correct:2, signEmoji:'👋', explanation:'La mano se mueve ondulando los dedos hacia adelante.' },
    ],
  },
  {
    id:'a1-2', level:'A1', title:'Abecedario A–E', subtitle:'Primeras 5 letras', sign:'A', signEmoji:'✊',
    description:'Aprende las primeras 5 letras del abecedario LSM.',
    longDescription:'El alfabeto dactilológico LSM (deletreo con los dedos) te permite comunicar cualquier nombre o palabra. Dominar A-E es el punto de partida.',
    difficulty:1, category:'Abecedario', order:2, xpReward:30, estimatedMinutes:8,
    videoUrl:'https://www.w3schools.com/html/mov_bbb.mp4',
    thumbnailUrl:'https://picsum.photos/seed/lsm-abc/400/225',
    gifUrl:'',
    tips:['La A es un puño con el pulgar al costado','La B son dedos abiertos y juntos','C forma una curva'],
    relatedSigns:['F','G'],
    quizQuestions:[
      { id:'q1', question:'¿Cómo se hace la letra A en LSM?', options:['Mano abierta','Puño con pulgar al costado','Dedos cruzados','Solo el índice'], correct:1, signEmoji:'✊', explanation:'La A es un puño cerrado con el pulgar al lado, no encima.' },
      { id:'q2', question:'¿Cuántos dedos se usan en la B?', options:['2','3','4','5 — todos'], correct:3, signEmoji:'🖐️', explanation:'La B usa los 4 dedos extendidos juntos (el pulgar se dobla).' },
    ],
  },
  {
    id:'a1-3', level:'A1', title:'Abecedario F–J', subtitle:'Letras F hasta J', sign:'F', signEmoji:'👌',
    description:'Continúa el alfabeto con F, G, H, I y J.',
    longDescription:'Estas 5 letras incluyen algunas con movimiento (J) que son más desafiantes pero esenciales.',
    difficulty:1, category:'Abecedario', order:3, xpReward:30, estimatedMinutes:8,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-fj/400/225', gifUrl:'',
    tips:['F — índice y pulgar forman un círculo','J — traza la letra en el aire','I — solo el meñique'],
    relatedSigns:['A','K'],
    quizQuestions:[
      { id:'q1', question:'¿La J es una seña estática o con movimiento?', options:['Estática','Con movimiento'], correct:1, signEmoji:'🤙', explanation:'La J traza la forma de la letra J en el aire con el meñique.' },
    ],
  },
  {
    id:'a1-4', level:'A1', title:'Abecedario K–O', subtitle:'Letras K hasta O', sign:'L', signEmoji:'🤟',
    description:'K, L, M, N, O — letras muy frecuentes en español.',
    longDescription:'La L es especialmente útil — se usa en muchas palabras. La M y N se diferencian por el número de dedos sobre el pulgar.',
    difficulty:2, category:'Abecedario', order:4, xpReward:35, estimatedMinutes:10,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-ko/400/225', gifUrl:'',
    tips:['L — pulgar e índice forman una L','M — 3 dedos cubren el pulgar','N — 2 dedos cubren el pulgar'],
    relatedSigns:['P','Q'],
    quizQuestions:[
      { id:'q1', question:'¿Cuántos dedos cubren el pulgar en la M?', options:['1','2','3','4'], correct:2, signEmoji:'✊', explanation:'En la M tres dedos (índice, medio y anular) cubren el pulgar.' },
    ],
  },
  {
    id:'a1-5', level:'A1', title:'Abecedario P–Z y Ñ', subtitle:'Alfabeto completo', sign:'V', signEmoji:'✌️',
    description:'Las últimas letras incluyendo la Ñ mexicana.',
    longDescription:'¡Completar el abecedario es un gran logro! La Ñ es única del LSM mexicano y se hace con movimiento ondulado.',
    difficulty:2, category:'Abecedario', order:5, xpReward:40, estimatedMinutes:12,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-pz/400/225', gifUrl:'',
    tips:['La Ñ es la N con movimiento ondulado','La Z traza la letra en el aire','W usa 3 dedos separados'],
    relatedSigns:['A','B'],
    quizQuestions:[
      { id:'q1', question:'¿La Ñ tiene movimiento?', options:['Sí, ondulado','No, es estática'], correct:0, signEmoji:'🤞', explanation:'La Ñ se hace como la N pero con un pequeño movimiento lateral ondulado.' },
    ],
  },
  {
    id:'a1-6', level:'A1', title:'Números 1–10', subtitle:'Conteo básico', sign:'☝️', signEmoji:'☝️',
    description:'Aprende a contar del 1 al 10 en Lengua de Señas Mexicana.',
    longDescription:'Los números son esenciales para fechas, precios, horas y más. En LSM los números 1-5 usan una mano y 6-10 tienen señas específicas.',
    difficulty:1, category:'Números', order:6, xpReward:25, estimatedMinutes:7,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-nums/400/225', gifUrl:'',
    tips:['El 1 es solo el índice extendido','El 5 es la mano abierta','El 10 es el pulgar levantado'],
    relatedSigns:[],
    quizQuestions:[
      { id:'q1', question:'¿Cómo se hace el número 5?', options:['Los 5 dedos extendidos','Solo el pulgar','Puño cerrado','Índice y meñique'], correct:0, signEmoji:'🖐️', explanation:'El 5 usa los 5 dedos completamente extendidos y separados.' },
    ],
  },
  {
    id:'b1-1', level:'B1', title:'La Familia', subtitle:'Vocabulario familiar', sign:'F', signEmoji:'👨‍👩‍👧',
    description:'Mamá, papá, hermano, hermana, abuelos — vocabulario familiar completo.',
    longDescription:'Las señas de familia en LSM generalmente se realizan cerca del rostro o el cuerpo. "Mamá" y "papá" tienen señas icónicas reconocibles.',
    difficulty:3, category:'Familia', order:1, xpReward:40, estimatedMinutes:10,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-fam/400/225', gifUrl:'',
    tips:['Las señas de familia empiezan cerca del corazón','Mamá — pulgar en mejilla','Papá — pulgar en frente'],
    relatedSigns:[],
    quizQuestions:[],
  },
  {
    id:'b1-2', level:'B1', title:'Vocabulario Médico', subtitle:'Emergencias y salud', sign:'H', signEmoji:'🏥',
    description:'Dolor, medicina, doctor, emergencia — vocabulario vital de salud.',
    longDescription:'Comunicar necesidades médicas puede salvar vidas. Este módulo cubre vocabulario crítico para situaciones de emergencia.',
    difficulty:3, category:'Salud', order:2, xpReward:50, estimatedMinutes:15,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-med/400/225', gifUrl:'',
    tips:['Dolor — expresión facial es clave','Emergencia — movimiento rápido e intenso'],
    relatedSigns:[],
    quizQuestions:[],
  },
  {
    id:'b1-3', level:'B1', title:'En el Trabajo', subtitle:'Entorno laboral', sign:'T', signEmoji:'💼',
    description:'Reunión, proyecto, ayuda, gracias, por favor — comunicación profesional.',
    longDescription:'El LSM en entornos de trabajo permite a personas sordas participar plenamente en el ámbito profesional.',
    difficulty:3, category:'Trabajo', order:3, xpReward:45, estimatedMinutes:12,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-work/400/225', gifUrl:'',
    tips:['Por favor y gracias son señas corteses esenciales','Reunión — manos juntas alternando'],
    relatedSigns:[],
    quizQuestions:[],
  },
  {
    id:'b1-4', level:'B1', title:'Emociones', subtitle:'Sentimientos y estados', sign:'E', signEmoji:'😊',
    description:'Feliz, triste, enojado, sorprendido, asustado — vocabulario emocional.',
    longDescription:'Las emociones en LSM combinan señas manuales con expresión facial intensa. La cara es esencial en LSM.',
    difficulty:2, category:'Emociones', order:4, xpReward:35, estimatedMinutes:8,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-emo/400/225', gifUrl:'',
    tips:['La expresión facial amplifica la emoción','Feliz — círculos en el pecho','Triste — dedos hacia abajo'],
    relatedSigns:[],
    quizQuestions:[],
  },
  {
    id:'c1-1', level:'C1', title:'Conversación Fluida', subtitle:'Diálogos completos', sign:'C', signEmoji:'💬',
    description:'Construye y comprende oraciones completas en LSM.',
    longDescription:'El nivel C1 integra vocabulario, gramática LSM y expresión facial para lograr comunicación fluida y natural.',
    difficulty:5, category:'Avanzado', order:1, xpReward:75, estimatedMinutes:20,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-conv/400/225', gifUrl:'',
    tips:['La gramática LSM difiere del español','El orden es: Tiempo - Sujeto - Objeto - Verbo','La negación va al final con movimiento de cabeza'],
    relatedSigns:[],
    quizQuestions:[],
  },
  {
    id:'c1-2', level:'C1', title:'Expresiones Regionales', subtitle:'Variantes mexicanas', sign:'M', signEmoji:'🇲🇽',
    description:'Variantes regionales del LSM — Ciudad de México, Guadalajara, Monterrey.',
    longDescription:'El LSM tiene variantes regionales fascinantes. Conocerlas te hace un comunicador más versátil y culturalmente consciente.',
    difficulty:5, category:'Cultura', order:2, xpReward:60, estimatedMinutes:15,
    videoUrl:'', thumbnailUrl:'https://picsum.photos/seed/lsm-mx/400/225', gifUrl:'',
    tips:['Pregunta siempre la variante local','Las señas de colores varían por región','Sé flexible al encontrar diferencias'],
    relatedSigns:[],
    quizQuestions:[],
  },
];

// ── Local state (in-memory fallback) ─────────────────────────
const DEFAULT_PROGRESS: UserProgress = {
  userId:'local-user', displayName:'Estudiante LSM', avatarEmoji:'🧑‍🎓',
  level:'A1', xp:0, streak:0, maxStreak:0,
  lastActive: new Date().toISOString(), completedLessons:[],
  translationCount:0, avgAccuracy:0, badges:[],
  createdAt: new Date().toISOString(), studyMinutes:0,
  favoriteSign:'A', country:'México', bio:'Aprendiendo LSM con LEPPE',
  weeklyXP:[0,0,0,0,0,0,0], totalSigns:0,
};

let _progress: UserProgress = { ...DEFAULT_PROGRESS };
let _sessions: TranslationSession[] = [];
let _connected = false;

// ── REST calls ───────────────────────────────────────────────
async function mongoFetch(action: string, body: object): Promise<any> {
  if (!ATLAS_API_KEY) return null;
  try {
    const res = await fetch(`${ATLAS_BASE}/action/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': ATLAS_API_KEY,
      },
      body: JSON.stringify({
        dataSource: CLUSTER,
        database: DB_NAME,
        ...body,
      }),
    });
    if (!res.ok) {
      console.warn('[MongoDB] HTTP error:', res.status);
      return null;
    }
    return res.json();
  } catch (e) {
    console.warn('[MongoDB] Fetch error:', e);
    return null;
  }
}

// ── Connection check ─────────────────────────────────────────
export async function checkConnection(): Promise<boolean> {
  if (!ATLAS_API_KEY) { _connected = false; return false; }
  const r = await mongoFetch('find', { collection:'user_progress', filter:{}, limit:1 });
  _connected = r !== null;
  return _connected;
}

export function isConnected() { return _connected; }

// ── Seed DB with lessons on first connect ────────────────────
export async function seedLessonsIfEmpty(): Promise<void> {
  if (!_connected) return;
  const r = await mongoFetch('find', { collection:'lessons', filter:{}, limit:1 });
  if (r?.documents?.length) return; // already seeded
  // Insert all mock lessons
  await mongoFetch('insertMany', { collection:'lessons', documents: MOCK_LESSONS });
  console.log('[MongoDB] Lessons seeded');
}

// ── User Progress ─────────────────────────────────────────────
export async function getUserProgress(userId = 'local-user'): Promise<UserProgress> {
  if (_connected) {
    const r = await mongoFetch('findOne', { collection:'user_progress', filter:{ userId } });
    if (r?.document) { _progress = r.document; return r.document; }
    // New user — insert default
    const doc = { ...DEFAULT_PROGRESS, userId };
    await mongoFetch('insertOne', { collection:'user_progress', document: doc });
    return doc;
  }
  return _progress;
}

export async function updateUserProgress(update: Partial<UserProgress>): Promise<void> {
  _progress = { ..._progress, ...update, lastActive: new Date().toISOString() };
  if (_connected) {
    await mongoFetch('updateOne', {
      collection:'user_progress',
      filter:{ userId: _progress.userId },
      update:{ $set: { ...update, lastActive: new Date().toISOString() } },
      upsert: true,
    });
  }
}

export async function addXP(amount: number): Promise<number> {
  const today = new Date().getDay(); // 0=Sun..6=Sat
  const dayIndex = today === 0 ? 6 : today - 1; // Mon=0..Sun=6
  const weekly = [...(_progress.weeklyXP || [0,0,0,0,0,0,0])];
  weekly[dayIndex] = (weekly[dayIndex] || 0) + amount;
  const newXP = (_progress.xp || 0) + amount;
  await updateUserProgress({ xp: newXP, weeklyXP: weekly });
  return newXP;
}

export async function completeLesson(lessonId: string, xpReward = 25): Promise<void> {
  const completed = [...(_progress.completedLessons || [])];
  if (!completed.includes(lessonId)) {
    completed.push(lessonId);
    await updateUserProgress({
      completedLessons: completed,
      studyMinutes: (_progress.studyMinutes || 0) + 8,
    });
    await addXP(xpReward);
    await checkAndAwardBadges();
  }
}

export async function updateStreak(): Promise<number> {
  const last = new Date(_progress.lastActive);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  let streak = _progress.streak || 0;
  if (diffDays === 1) {
    streak += 1;
  } else if (diffDays === 0) {
    // Same day — no change
  } else {
    streak = 1;
  }
  const maxStreak = Math.max(streak, _progress.maxStreak || 0);
  await updateUserProgress({ streak, maxStreak });
  return streak;
}

// ── Lessons ───────────────────────────────────────────────────
export async function getLessons(level?: string): Promise<Lesson[]> {
  if (_connected) {
    const filter = level ? { level } : {};
    const r = await mongoFetch('find', { collection:'lessons', filter, sort:{ order:1 } });
    if (r?.documents?.length) return r.documents;
  }
  return level ? MOCK_LESSONS.filter(l => l.level === level) : MOCK_LESSONS;
}

export async function getLessonById(id: string): Promise<Lesson | null> {
  if (_connected) {
    const r = await mongoFetch('findOne', { collection:'lessons', filter:{ id } });
    if (r?.document) return r.document;
  }
  return MOCK_LESSONS.find(l => l.id === id) || null;
}

// ── Translation Sessions ─────────────────────────────────────
export async function saveTranslationSession(session: Omit<TranslationSession, '_id'>): Promise<void> {
  _sessions.push({ ...session, _id: Date.now().toString() });
  const count = (_progress.translationCount || 0) + 1;
  const avgAcc = ((_progress.avgAccuracy || 0) * (_progress.translationCount || 0) + (session.avgConfidence || 0)) / count;
  await updateUserProgress({
    translationCount: count,
    avgAccuracy: Math.round(avgAcc * 100) / 100,
    totalSigns: (_progress.totalSigns || 0) + (session.letters?.length || 0),
  });
  if (_connected) {
    await mongoFetch('insertOne', {
      collection:'translation_sessions',
      document: { ...session, timestamp: new Date().toISOString() },
    });
  }
}

export async function getTranslationHistory(limit = 20): Promise<TranslationSession[]> {
  if (_connected) {
    const r = await mongoFetch('find', {
      collection:'translation_sessions',
      filter:{ userId: _progress.userId },
      sort:{ timestamp:-1 },
      limit,
    });
    if (r?.documents?.length) return r.documents;
  }
  return [..._sessions].reverse().slice(0, limit);
}

// ── Media Resources ───────────────────────────────────────────
export async function getMediaForSign(letter: string): Promise<MediaResource | null> {
  if (_connected) {
    const r = await mongoFetch('findOne', { collection:'media_resources', filter:{ signLetter: letter } });
    if (r?.document) return r.document;
  }
  return (SIGN_MEDIA[letter] as MediaResource) || null;
}

export async function incrementSignView(letter: string): Promise<void> {
  if (_connected) {
    await mongoFetch('updateOne', {
      collection:'media_resources',
      filter:{ signLetter: letter },
      update:{ $inc:{ views:1 } },
    });
  }
}

// ── Leaderboard ────────────────────────────────────────────────
export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  if (_connected) {
    const r = await mongoFetch('find', {
      collection:'user_progress',
      filter:{},
      sort:{ xp:-1 },
      limit,
    });
    if (r?.documents?.length) {
      return r.documents.map((u: UserProgress, i: number) => ({ ...u, rank: i + 1 }));
    }
  }
  return [{ ..._progress, rank: 1 }];
}

// ── Badges ────────────────────────────────────────────────────
export async function awardBadge(badgeId: string): Promise<boolean> {
  const badges = [...(_progress.badges || [])];
  if (badges.includes(badgeId)) return false;
  await updateUserProgress({ badges: [...badges, badgeId] });
  return true;
}

async function checkAndAwardBadges(): Promise<void> {
  const p = _progress;
  const completed = p.completedLessons?.length || 0;
  if (completed >= 1) await awardBadge('first_sign');
  if ((p.streak || 0) >= 3) await awardBadge('streak_3');
  if ((p.streak || 0) >= 7) await awardBadge('streak_7');
  if ((p.xp || 0) >= 100) await awardBadge('xp_100');
  if ((p.xp || 0) >= 500) await awardBadge('xp_500');
  if (completed >= 6) await awardBadge('alphabet');
  if ((p.translationCount || 0) >= 10) await awardBadge('translator_10');
  if (completed >= 10) await awardBadge('level_b1');
}

// ── Badge definitions ─────────────────────────────────────────
export const BADGES = [
  { id:'first_sign',    icon:'🌱', label:'Primera Seña',   desc:'Completa tu primera lección',             color:'#00E5A0' },
  { id:'streak_3',      icon:'🔥', label:'3 Días',          desc:'3 días de práctica seguidos',              color:'#FFB84D' },
  { id:'streak_7',      icon:'⚡', label:'Semana completa', desc:'7 días de racha perfecta',                 color:'#FFB84D' },
  { id:'xp_100',        icon:'⭐', label:'100 XP',           desc:'Acumula 100 puntos de experiencia',        color:'#FFB84D' },
  { id:'xp_500',        icon:'💫', label:'500 XP',           desc:'Acumula 500 puntos de experiencia',        color:'#A78BFA' },
  { id:'alphabet',      icon:'🅰️', label:'Alfabeto LSM',    desc:'Completa todo el abecedario A1',           color:'#4D9FFF' },
  { id:'translator_10', icon:'🚀', label:'Traductor',        desc:'Realiza 10 traducciones en tiempo real',   color:'#FF3B6B' },
  { id:'level_b1',      icon:'🏆', label:'Nivel B1',         desc:'Alcanza el nivel intermedio',              color:'#A78BFA' },
  { id:'perfect_quiz',  icon:'💯', label:'Quiz Perfecto',   desc:'100% en cualquier evaluación',             color:'#00E5A0' },
  { id:'community',     icon:'🤝', label:'Comunidad',        desc:'Entra al top 10 del leaderboard',          color:'#FF6B4A' },
];

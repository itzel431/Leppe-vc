/**
 * LEPPE v3 — ML Service
 * Bridges the React Native app with the FastAPI server running modelo_rf.pkl
 *
 * LOCAL DEV:
 *   1. pip install fastapi uvicorn scikit-learn numpy
 *   2. python leppe_api.py
 *   3. Set ML_API_URL to your local machine IP (not localhost on physical device)
 *      e.g. 'http://192.168.1.100:8000'
 *
 * PRODUCTION:
 *   Deploy leppe_api.py to Railway / Render / Fly.io and update ML_API_URL
 */

const ML_API_URL = 'http://localhost:8000'; // ← Update with your server IP

export const SIGN_LABELS = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','Ñ','O','P','Q','R','S','T','U','V','W','X','Y','Z'
];

export interface PredictionResult {
  letter: string;
  confidence: number;
  topK: Array<{ letter: string; confidence: number }>;
  isSimulation: boolean;
  processingMs: number;
}

let _apiAvailable = false;
let _lastCheck = 0;
const CHECK_INTERVAL_MS = 10_000;

// ── Health check ──────────────────────────────────────────────
export async function checkMLAPI(): Promise<boolean> {
  const now = Date.now();
  if (now - _lastCheck < CHECK_INTERVAL_MS) return _apiAvailable;
  _lastCheck = now;
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${ML_API_URL}/health`, { signal: ctrl.signal });
    clearTimeout(id);
    _apiAvailable = res.ok;
  } catch {
    _apiAvailable = false;
  }
  return _apiAvailable;
}

export function isMLAPIAvailable() { return _apiAvailable; }

// ── Normalization (mirrors Python training script) ────────────
export function normalizeLandmarks(rawLandmarks: number[]): number[] {
  // rawLandmarks: flat array of 63 values [x0,y0,z0, x1,y1,z1, ...]
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 21; i++) {
    pts.push([rawLandmarks[i*3], rawLandmarks[i*3+1], rawLandmarks[i*3+2]]);
  }
  // Center at landmark 0
  const cx = pts[0][0], cy = pts[0][1], cz = pts[0][2];
  const centered = pts.map(([x,y,z]) => [x-cx, y-cy, z-cz]);
  // Scale by max absolute
  let maxAbs = 1e-8;
  for (const p of centered) for (const v of p) if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
  return centered.flat().map(v => v / maxAbs);
}

// ── Real prediction via API ───────────────────────────────────
export async function predictFromLandmarks(normalizedFeatures: number[]): Promise<PredictionResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${ML_API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features: normalizedFeatures }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      letter: data.letter,
      confidence: data.confidence,
      topK: data.top_k || [],
      isSimulation: false,
      processingMs: Date.now() - t0,
    };
  } catch (e) {
    _apiAvailable = false;
    return simulatePrediction();
  }
}

// ── Simulation mode (demo when no API) ───────────────────────
const DEMO_CYCLE = ['H','O','L','A',' ','L','S','M',' ','B','I','E','N'];
let _demoIdx = 0;

export function simulatePrediction(forceSign?: string): PredictionResult {
  const letter = forceSign || DEMO_CYCLE[_demoIdx % DEMO_CYCLE.length];
  _demoIdx++;
  const confidence = 0.82 + Math.random() * 0.17;
  const others = SIGN_LABELS
    .filter(s => s !== letter)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(s => ({ letter: s, confidence: Math.random() * 0.15 }));
  return {
    letter,
    confidence,
    topK: [{ letter, confidence }, ...others].sort((a,b) => b.confidence - a.confidence),
    isSimulation: true,
    processingMs: 12 + Math.floor(Math.random() * 20),
  };
}

// ── Sliding-window smoother (for real-time camera) ────────────
export class PredictionSmoother {
  private window: PredictionResult[] = [];
  private windowSize: number;
  private minConfidence: number;
  private stableFrames: number;
  private stableCount = 0;
  private currentStable: string | null = null;

  constructor(opts: { windowSize?: number; minConfidence?: number; stableFrames?: number } = {}) {
    this.windowSize    = opts.windowSize    ?? 10;
    this.minConfidence = opts.minConfidence ?? 0.60;
    this.stableFrames  = opts.stableFrames  ?? 8;
  }

  add(prediction: PredictionResult): { letter: string; confidence: number; isStable: boolean } | null {
    this.window.push(prediction);
    if (this.window.length > this.windowSize) this.window.shift();
    if (this.window.length < 3) return null;

    // Average confidence per letter
    const scores: Record<string, number> = {};
    for (const p of this.window) {
      for (const k of p.topK) {
        scores[k.letter] = (scores[k.letter] || 0) + k.confidence;
      }
    }
    const best = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];
    if (!best) return null;

    const avgConf = best[1] / this.window.length;
    if (avgConf < this.minConfidence) {
      this.stableCount = 0;
      this.currentStable = null;
      return null;
    }

    const letter = best[0];
    if (letter === this.currentStable) {
      this.stableCount++;
    } else {
      this.currentStable = letter;
      this.stableCount = 1;
    }

    return {
      letter,
      confidence: avgConf,
      isStable: this.stableCount >= this.stableFrames,
    };
  }

  reset() {
    this.window = [];
    this.stableCount = 0;
    this.currentStable = null;
  }
}

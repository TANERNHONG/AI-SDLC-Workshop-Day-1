'use client';

import { useState, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageEntry {
  id: string;
  name: string;
  url: string;           // object-URL (upload) or proxied URL (csv)
  colors: Record<string, number> | null;  // hex → proportion
  selectedColors: Set<string>;             // hex codes selected for comparison
}

interface MatchResult {
  aIdx: number;
  bIdx: number;
  score: number;
}

type CompareMode = 'matrix' | 'closest-color';

interface ClosestColorMatch {
  aIdx: number;
  bIdx: number;
  overallScore: number;
  colorPairs: {
    hexA: string;
    hexB: string;
    deltaE: number;
    similarity: number;
  }[];
}

// ─── Neutral / earth tone detection ──────────────────────────────────────────

function isNeutralOrBrown(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = max === 0 ? 0 : (max - min) / max;

  // Black / very dark
  if (lum < 45) return true;
  // White / very light
  if (lum > 200 && sat < 0.20) return true;
  // Grey — low saturation at any brightness, or slightly tinted greys
  if (sat < 0.25) return true;

  // Brown detection via HSV hue + low-ish saturation + medium brightness
  const h = (() => {
    if (max === min) return 0;
    const d = max - min;
    let hue = 0;
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = Math.round(hue * 60);
    return hue < 0 ? hue + 360 : hue;
  })();
  // Brown: warm hue (0-40°), moderate saturation, not too bright
  if (h >= 0 && h <= 40 && sat >= 0.15 && sat <= 0.75 && lum >= 30 && lum <= 160) return true;

  return false;
}

// ─── Colour-science helpers ───────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** sRGB → CIE-L*a*b* (D65) */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rr = r / 255, gg = g / 255, bb = b / 255;
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;
  let x = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047;
  let y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750;
  let z = (rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 ΔE */
function labDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Quantise a pixel to a reduced palette (step controls coarseness). */
function quantize(r: number, g: number, b: number, step = 32): string {
  const q = (v: number) => Math.min(255, Math.round(v / step) * step);
  return rgbToHex(q(r), q(g), q(b));
}

// ─── Colour extraction ───────────────────────────────────────────────────────

async function extractColorsFromImage(src: string): Promise<Record<string, number>> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 150;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No 2d context')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const counts: Record<string, number> = {};
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;           // skip transparent
        const hex = quantize(data[i], data[i + 1], data[i + 2]);
        counts[hex] = (counts[hex] || 0) + 1;
        total++;
      }
      if (total === 0) { resolve({}); return; }
      const sorted = Object.entries(counts)
        .map(([hex, n]) => ({ hex, p: n / total }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 20);
      const result: Record<string, number> = {};
      for (const { hex, p } of sorted) result[hex] = p;
      resolve(result);
    };
    img.onerror = () => reject(new Error(`Failed to load: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

// ─── Similarity (bidirectional weighted LAB nearest-neighbour) ────────────────

const DE_THRESHOLD = 100;   // ΔE beyond this → similarity = 0

function colorProfileSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
  penaltyPerColor = 0.05,
): number {
  const toLabEntries = (m: Record<string, number>) =>
    Object.entries(m).map(([hex, p]) => ({ lab: rgbToLab(...hexToRgb(hex)), p }));
  const labA = toLabEntries(a);
  const labB = toLabEntries(b);
  if (labA.length === 0 || labB.length === 0) return 0;
  const directed = (src: typeof labA, tgt: typeof labA) => {
    let s = 0;
    for (const c of src) {
      let best = 0;
      for (const t of tgt) {
        const sim = Math.max(0, 1 - labDistance(c.lab, t.lab) / DE_THRESHOLD);
        if (sim > best) best = sim;
      }
      s += c.p * best;
    }
    return s;
  };
  const raw = (directed(labA, labB) + directed(labB, labA)) / 2;

  // Penalty when palette sizes differ
  const sizeDiff = Math.abs(labA.length - labB.length);
  const penalty = Math.max(1 - 4 * penaltyPerColor, 1 - penaltyPerColor * sizeDiff);
  return raw * Math.max(0, penalty);
}

// ─── CSV parser (single "image_url" column) ──────────────────────────────────

function parseImageCsv(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, '').toLowerCase());
  const idx = header.findIndex(c => ['image_url', 'imageurl', 'url', 'image'].includes(c));
  if (idx === -1) return [];
  return lines
    .slice(1)
    .map(l => {
      const cols = l.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      return cols[idx] ?? '';
    })
    .filter(Boolean);
}

// ─── Unique ID helper ─────────────────────────────────────────────────────────

let _seq = 0;
function uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${++_seq}`;
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function Card({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Swatch({ hex, proportion, selected, onClick }: { hex: string; proportion: number; selected?: boolean; onClick?: () => void }) {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const isClickable = onClick !== undefined;
  const isSelected = selected ?? true;
  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-lg text-[10px] font-mono leading-tight${isClickable ? ' cursor-pointer' : ''}${!isSelected ? ' opacity-30 ring-1 ring-gray-400 dark:ring-gray-600' : ''}${isSelected && isClickable ? ' ring-2 ring-blue-500' : ''}`}
      style={{ background: hex, color: lum > 128 ? '#000' : '#fff', width: 56, height: 44, padding: 2 }}
      title={`${hex}  ${(proportion * 100).toFixed(1)}%${isClickable ? (isSelected ? ' (click to deselect)' : ' (click to select)') : ''}`}
      onClick={onClick}
    >
      <span>{hex}</span>
      <span>{(proportion * 100).toFixed(1)}%</span>
    </div>
  );
}

function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="w-full">
      {label && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>}
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-0.5 text-right">{value}/{max}</p>
    </div>
  );
}

// ─── Similarity-score colour mapping ──────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 0.8) return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200';
  if (score >= 0.6) return 'bg-lime-100 dark:bg-lime-900/40 text-lime-800 dark:text-lime-200';
  if (score >= 0.4) return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200';
  if (score >= 0.2) return 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200';
  return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200';
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── Main page ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

export default function MarketResearchPage() {
  // ── state ──
  const [setA, setSetA] = useState<ImageEntry[]>([]);
  const [setB, setSetB] = useState<ImageEntry[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ done: 0, total: 0 });
  const [similarityMatrix, setSimilarityMatrix] = useState<number[][] | null>(null);
  const [bestMatches, setBestMatches] = useState<MatchResult[]>([]);
  const [compareMode, setCompareMode] = useState<CompareMode>('matrix');
  const [closestColorMatches, setClosestColorMatches] = useState<ClosestColorMatch[]>([]);
  const [poolSelectedA, setPoolSelectedA] = useState<Set<string>>(new Set());
  const [poolSelectedB, setPoolSelectedB] = useState<Set<string>>(new Set());
  const [minImageCountA, setMinImageCountA] = useState(1);
  const [minImageCountB, setMinImageCountB] = useState(1);
  const [hideNeutralsA, setHideNeutralsA] = useState(false);
  const [hideNeutralsB, setHideNeutralsB] = useState(false);
  const [varietyPenalty, setVarietyPenalty] = useState(5);  // % per colour difference
  const [error, setError] = useState('');
  const [photoDbFolders, setPhotoDbFolders] = useState<string[]>([]);
  const [photoDbLoading, setPhotoDbLoading] = useState<'A' | 'B' | null>(null);
  const csvRefA = useRef<HTMLInputElement>(null);
  const csvRefB = useRef<HTMLInputElement>(null);
  const imgRefA = useRef<HTMLInputElement>(null);
  const imgRefB = useRef<HTMLInputElement>(null);

  // Fetch photo_db folders on mount
  useEffect(() => {
    fetch('/api/stock/market-analysis/photo-db')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.folders) setPhotoDbFolders(data.folders); })
      .catch(() => {});
  }, []);

  // ── helpers ──

  const clearResults = () => { setSimilarityMatrix(null); setBestMatches([]); setClosestColorMatches([]); };

  // ── collective pool helpers ──

  const buildPool = (entries: ImageEntry[]): Map<string, { proportion: number; images: string[] }> => {
    const pool = new Map<string, { totalP: number; count: number; images: string[] }>();
    for (const e of entries) {
      if (!e.colors) continue;
      for (const [hex, p] of Object.entries(e.colors)) {
        const existing = pool.get(hex);
        if (existing) {
          existing.totalP += p;
          existing.count++;
          if (!existing.images.includes(e.name)) existing.images.push(e.name);
        } else {
          pool.set(hex, { totalP: p, count: 1, images: [e.name] });
        }
      }
    }
    const result = new Map<string, { proportion: number; images: string[] }>();
    for (const [hex, { totalP, count, images }] of pool) {
      result.set(hex, { proportion: totalP / count, images });
    }
    return result;
  };

  const poolA = buildPool(setA);
  const poolB = buildPool(setB);

  const syncPoolToImages = (poolSelected: Set<string>, target: 'A' | 'B') => {
    const updater = (prev: ImageEntry[]) =>
      prev.map(e => {
        if (!e.colors) return e;
        const next = new Set<string>();
        for (const hex of Object.keys(e.colors)) {
          if (poolSelected.has(hex)) next.add(hex);
        }
        return { ...e, selectedColors: next };
      });
    if (target === 'A') setSetA(updater); else setSetB(updater);
  };

  const togglePoolColor = (target: 'A' | 'B', hex: string) => {
    clearResults();
    const setter = target === 'A' ? setPoolSelectedA : setPoolSelectedB;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(hex)) next.delete(hex); else next.add(hex);
      syncPoolToImages(next, target);
      return next;
    });
  };

  const selectAllPool = (target: 'A' | 'B') => {
    clearResults();
    const pool = target === 'A' ? poolA : poolB;
    const all = new Set(pool.keys());
    if (target === 'A') setPoolSelectedA(all); else setPoolSelectedB(all);
    syncPoolToImages(all, target);
  };

  const deselectAllPool = (target: 'A' | 'B') => {
    clearResults();
    const empty = new Set<string>();
    if (target === 'A') setPoolSelectedA(empty); else setPoolSelectedB(empty);
    syncPoolToImages(empty, target);
  };

  const addFromCsv = (file: File, target: 'A' | 'B') => {
    setError('');
    clearResults();
    const reader = new FileReader();
    reader.onload = () => {
      const urls = parseImageCsv(reader.result as string);
      if (urls.length === 0) { setError('CSV must have an "image_url" column with at least one row.'); return; }
      const entries: ImageEntry[] = urls.map((url, i) => ({
        id: uid(),
        name: `Image ${i + 1}`,
        url: `/api/stock/market-analysis/image-proxy?url=${encodeURIComponent(url)}`,
        colors: null,
        selectedColors: new Set<string>(),
      }));
      if (target === 'A') setSetA(prev => [...prev, ...entries]);
      else setSetB(prev => [...prev, ...entries]);
    };
    reader.readAsText(file);
  };

  const addFromFiles = (files: FileList, target: 'A' | 'B') => {
    setError('');
    clearResults();
    const entries: ImageEntry[] = Array.from(files).map(f => ({
      id: uid(),
      name: f.name,
      url: URL.createObjectURL(f),
      colors: null,
      selectedColors: new Set<string>(),
    }));
    if (target === 'A') setSetA(prev => [...prev, ...entries]);
    else setSetB(prev => [...prev, ...entries]);
  };

  const loadFromPhotoDb = async (folder: string, target: 'A' | 'B') => {
    setError('');
    clearResults();
    setPhotoDbLoading(target);
    try {
      const res = await fetch(`/api/stock/market-analysis/photo-db?folder=${encodeURIComponent(folder)}`);
      if (!res.ok) throw new Error('Failed to list photos');
      const data = await res.json();
      const files: string[] = data.files ?? [];
      if (files.length === 0) { setError(`No images found in photo_db/${folder}`); return; }
      const entries: ImageEntry[] = files.map(f => ({
        id: uid(),
        name: f,
        url: `/api/stock/market-analysis/photo-db/image?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(f)}`,
        colors: null,
        selectedColors: new Set<string>(),
      }));
      if (target === 'A') setSetA(prev => [...prev, ...entries]);
      else setSetB(prev => [...prev, ...entries]);
    } catch {
      setError(`Failed to load images from photo_db/${folder}`);
    } finally {
      setPhotoDbLoading(null);
    }
  };

  const removeEntry = (target: 'A' | 'B', id: string) => {
    clearResults();
    if (target === 'A') setSetA(prev => prev.filter(e => e.id !== id));
    else setSetB(prev => prev.filter(e => e.id !== id));
  };

  // ── colour extraction ──

  const handleExtract = async () => {
    setError('');
    clearResults();
    const all = [...setA, ...setB];
    if (all.length === 0) { setError('Add images to both sets first.'); return; }
    setExtracting(true);
    setExtractProgress({ done: 0, total: all.length });
    let done = 0;
    const process = async (entries: ImageEntry[]): Promise<ImageEntry[]> => {
      const out: ImageEntry[] = [];
      for (const entry of entries) {
        try {
          const colors = await extractColorsFromImage(entry.url);
          out.push({ ...entry, colors, selectedColors: new Set(Object.keys(colors)) });
        } catch {
          out.push({ ...entry, colors: {}, selectedColors: new Set<string>() });
        }
        done++;
        setExtractProgress({ done, total: all.length });
      }
      return out;
    };
    const [newA, newB] = await Promise.all([process([...setA]), process([...setB])]);
    setSetA(newA);
    setSetB(newB);
    // Initialize pool selections with all extracted colors
    const allColorsA = new Set<string>();
    for (const e of newA) if (e.colors) for (const hex of Object.keys(e.colors)) allColorsA.add(hex);
    setPoolSelectedA(allColorsA);
    const allColorsB = new Set<string>();
    for (const e of newB) if (e.colors) for (const hex of Object.keys(e.colors)) allColorsB.add(hex);
    setPoolSelectedB(allColorsB);
    setExtracting(false);
  };

  // ── comparison ──

  const filterSelected = (entry: ImageEntry): Record<string, number> => {
    const sel = entry.selectedColors;
    const raw: Record<string, number> = {};
    let total = 0;
    for (const [hex, p] of Object.entries(entry.colors!)) {
      if (sel.has(hex)) { raw[hex] = p; total += p; }
    }
    if (total === 0) return raw;
    const out: Record<string, number> = {};
    for (const [hex, p] of Object.entries(raw)) out[hex] = p / total;
    return out;
  };

  const handleCompareMatrix = () => {
    setError('');
    if (setA.length === 0 || setB.length === 0) { setError('Both sets need at least one image.'); return; }
    if (setA.some(e => !e.colors) || setB.some(e => !e.colors)) {
      setError('Extract colours first.');
      return;
    }
    const matrix: number[][] = [];
    for (let i = 0; i < setA.length; i++) {
      const row: number[] = [];
      const colorsA = filterSelected(setA[i]);
      for (let j = 0; j < setB.length; j++) {
        const colorsB = filterSelected(setB[j]);
        row.push(colorProfileSimilarity(colorsA, colorsB, varietyPenalty / 100));
      }
      matrix.push(row);
    }
    setSimilarityMatrix(matrix);

    const usedB = new Set<number>();
    const matches: MatchResult[] = [];
    const pairs: { a: number; b: number; s: number }[] = [];
    for (let i = 0; i < matrix.length; i++)
      for (let j = 0; j < matrix[i].length; j++)
        pairs.push({ a: i, b: j, s: matrix[i][j] });
    pairs.sort((x, y) => y.s - x.s);
    const usedA = new Set<number>();
    for (const p of pairs) {
      if (usedA.has(p.a) || usedB.has(p.b)) continue;
      matches.push({ aIdx: p.a, bIdx: p.b, score: p.s });
      usedA.add(p.a);
      usedB.add(p.b);
    }
    matches.sort((a, b) => b.score - a.score);
    setBestMatches(matches);
  };

  const handleCompareClosestColor = () => {
    setError('');
    if (setA.length === 0 || setB.length === 0) { setError('Both sets need at least one image.'); return; }
    if (setA.some(e => !e.colors) || setB.some(e => !e.colors)) {
      setError('Extract colours first.');
      return;
    }

    // For each card in A, find the best card in B by average closest-color ΔE
    const results: ClosestColorMatch[] = [];
    for (let i = 0; i < setA.length; i++) {
      const selA = [...setA[i].selectedColors].filter(h => setA[i].colors![h] !== undefined);
      if (selA.length === 0) continue;

      let bestJ = -1;
      let bestScore = -1;
      let bestPairs: ClosestColorMatch['colorPairs'] = [];

      for (let j = 0; j < setB.length; j++) {
        const selB = [...setB[j].selectedColors].filter(h => setB[j].colors![h] !== undefined);
        if (selB.length === 0) continue;

        const labsB = selB.map(h => ({ hex: h, lab: rgbToLab(...hexToRgb(h)) }));
        const pairs: ClosestColorMatch['colorPairs'] = [];
        let scoreSum = 0;

        for (const hexA of selA) {
          const labA = rgbToLab(...hexToRgb(hexA));
          let closestHex = labsB[0].hex;
          let closestDE = Infinity;
          for (const lb of labsB) {
            const de = labDistance(labA, lb.lab);
            if (de < closestDE) { closestDE = de; closestHex = lb.hex; }
          }
          const sim = Math.max(0, 1 - closestDE / DE_THRESHOLD);
          pairs.push({ hexA, hexB: closestHex, deltaE: closestDE, similarity: sim });
          scoreSum += sim;
        }

        const avgScore = scoreSum / selA.length;
        // Palette-size penalty
        const sizePenalty = Math.max(1 - 4 * (varietyPenalty / 100), 1 - (varietyPenalty / 100) * Math.abs(selA.length - selB.length));
        const penalised = avgScore * Math.max(0, sizePenalty);
        if (penalised > bestScore) {
          bestScore = penalised;
          bestJ = j;
          bestPairs = pairs;
        }
      }

      if (bestJ >= 0) {
        bestPairs.sort((a, b) => a.deltaE - b.deltaE);
        results.push({ aIdx: i, bIdx: bestJ, overallScore: bestScore, colorPairs: bestPairs });
      }
    }
    results.sort((a, b) => b.overallScore - a.overallScore);
    setClosestColorMatches(results);
  };

  const handleCompare = () => {
    clearResults();
    if (compareMode === 'matrix') handleCompareMatrix();
    else handleCompareClosestColor();
  };

  // ── clear all ──
  const clearAll = () => { setSetA([]); setSetB([]); clearResults(); setError(''); setPoolSelectedA(new Set()); setPoolSelectedB(new Set()); };

  const toggleColor = (target: 'A' | 'B', entryId: string, hex: string) => {
    clearResults();
    const updater = (prev: ImageEntry[]) =>
      prev.map(e => {
        if (e.id !== entryId) return e;
        const next = new Set(e.selectedColors);
        if (next.has(hex)) next.delete(hex); else next.add(hex);
        return { ...e, selectedColors: next };
      });
    if (target === 'A') setSetA(updater); else setSetB(updater);
  };

  const selectAllColors = (target: 'A' | 'B', entryId: string) => {
    clearResults();
    const updater = (prev: ImageEntry[]) =>
      prev.map(e => e.id !== entryId ? e : { ...e, selectedColors: new Set(Object.keys(e.colors ?? {})) });
    if (target === 'A') setSetA(updater); else setSetB(updater);
  };

  const deselectAllColors = (target: 'A' | 'B', entryId: string) => {
    clearResults();
    const updater = (prev: ImageEntry[]) =>
      prev.map(e => e.id !== entryId ? e : { ...e, selectedColors: new Set<string>() });
    if (target === 'A') setSetA(updater); else setSetB(updater);
  };

  const colorsExtracted = setA.length > 0 && setB.length > 0 && setA.every(e => e.colors) && setB.every(e => e.colors);

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">
          Market Research (Color Comparison)
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Upload two sets of product images, extract dominant colours, and find the best colour-profile matches between them.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ───── Upload panels ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(['A', 'B'] as const).map(target => {
          const entries = target === 'A' ? setA : setB;
          const csvRef = target === 'A' ? csvRefA : csvRefB;
          const imgRef = target === 'A' ? imgRefA : imgRefB;
          return (
            <Card key={target} icon={target === 'A' ? '📁' : '📂'} title={`Set ${target}`}>
              {/* CSV upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Upload CSV (with &quot;image_url&quot; column)
                </label>
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) addFromCsv(e.target.files[0], target); e.target.value = ''; }}
                />
                <button
                  onClick={() => csvRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-3 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition"
                >
                  Click to upload CSV
                </button>
              </div>

              {/* Image file upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Or upload images directly
                </label>
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files?.length) addFromFiles(e.target.files, target); e.target.value = ''; }}
                />
                <button
                  onClick={() => imgRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-3 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition"
                >
                  Click to upload images
                </button>
              </div>

              {/* Load from photo_db */}
              {photoDbFolders.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Or load from photo_db
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {photoDbFolders.map(folder => (
                      <button
                        key={folder}
                        disabled={photoDbLoading !== null}
                        onClick={() => loadFromPhotoDb(folder, target)}
                        className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-blue-400 hover:text-blue-500 disabled:opacity-40 transition"
                      >
                        {photoDbLoading === target ? 'Loading…' : `📂 ${folder}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Entry list */}
              {entries.length > 0 && (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {entries.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.url}
                        alt={entry.name}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{entry.name}</p>
                        {entry.colors && Object.keys(entry.colors).length > 0 && (
                          <>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-gray-400">{entry.selectedColors.size}/{Object.keys(entry.colors).length} selected</span>
                              <button onClick={() => selectAllColors(target, entry.id)} className="text-[10px] text-blue-500 hover:underline">All</button>
                              <button onClick={() => deselectAllColors(target, entry.id)} className="text-[10px] text-blue-500 hover:underline">None</button>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(entry.colors).map(([hex, p]) => (
                                <Swatch
                                  key={hex}
                                  hex={hex}
                                  proportion={p}
                                  selected={entry.selectedColors.has(hex)}
                                  onClick={() => toggleColor(target, entry.id, hex)}
                                />
                              ))}
                            </div>
                          </>
                        )}
                        {entry.colors && Object.keys(entry.colors).length === 0 && (
                          <p className="text-xs text-gray-400 mt-1">No colours extracted</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeEntry(target, entry.id)}
                        className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {entries.length === 0 && (
                <p className="text-xs text-gray-400 italic">No images loaded yet.</p>
              )}
              <p className="text-xs text-gray-400 text-right">{entries.length} image{entries.length !== 1 ? 's' : ''}</p>
            </Card>
          );
        })}
      </div>

      {/* ───── Collective colour pool ─────────────────────────────── */}
      {colorsExtracted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(['A', 'B'] as const).map(target => {
            const pool = target === 'A' ? poolA : poolB;
            const selected = target === 'A' ? poolSelectedA : poolSelectedB;
            const minCount = target === 'A' ? minImageCountA : minImageCountB;
            const setMinCount = target === 'A' ? setMinImageCountA : setMinImageCountB;
            const hideNeutrals = target === 'A' ? hideNeutralsA : hideNeutralsB;
            const setHideNeutrals = target === 'A' ? setHideNeutralsA : setHideNeutralsB;
            const sorted = [...pool.entries()]
              .filter(([hex, info]) => info.images.length >= minCount && (!hideNeutrals || !isNeutralOrBrown(hex)))
              .sort((a, b) => b[1].proportion - a[1].proportion);
            const totalPool = pool.size;
            return (
              <Card key={target} icon="🎨" title={`Set ${target} — Colour Pool (${sorted.length}/${totalPool} colours)`}>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-xs text-gray-400">{selected.size}/{totalPool} selected</span>
                  <button onClick={() => selectAllPool(target)} className="text-xs text-blue-500 hover:underline">All</button>
                  <button onClick={() => deselectAllPool(target)} className="text-xs text-blue-500 hover:underline">None</button>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => {
                        const next = !hideNeutrals;
                        setHideNeutrals(next);
                        if (next) {
                          // Deselect neutral colours from pool selection
                          const setter = target === 'A' ? setPoolSelectedA : setPoolSelectedB;
                          setter(prev => {
                            const copy = new Set(prev);
                            for (const hex of copy) { if (isNeutralOrBrown(hex)) copy.delete(hex); }
                            return copy;
                          });
                        }
                        clearResults();
                      }}
                      className={`px-2 py-1 text-[10px] font-semibold rounded-lg border transition ${
                        hideNeutrals
                          ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {hideNeutrals ? 'Neutrals hidden' : 'Hide neutrals'}
                    </button>
                    <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Min images</label>
                    <input
                      type="number"
                      min={1}
                      value={minCount}
                      onChange={e => { const v = Math.max(1, parseInt(e.target.value) || 1); setMinCount(v); }}
                      className="w-14 px-1.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-center"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {sorted.map(([hex, info]) => (
                    <div key={hex} className="flex flex-col items-center gap-0.5">
                      <Swatch
                        hex={hex}
                        proportion={info.proportion}
                        selected={selected.has(hex)}
                        onClick={() => togglePoolColor(target, hex)}
                      />
                      <span className="text-[8px] text-gray-400 max-w-[56px] truncate text-center" title={info.images.join(', ')}>
                        {info.images.length} img{info.images.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ───── Mode toggle + action buttons ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={extracting || (setA.length === 0 && setB.length === 0)}
          onClick={handleExtract}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition"
        >
          {extracting ? 'Extracting…' : '🎨 Extract Colours'}
        </button>

        {colorsExtracted && (
          <div className="flex rounded-xl border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => { setCompareMode('matrix'); clearResults(); }}
              className={`px-4 py-2 text-sm font-semibold transition ${
                compareMode === 'matrix'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Pairwise Matrix
            </button>
            <button
              onClick={() => { setCompareMode('closest-color'); clearResults(); }}
              className={`px-4 py-2 text-sm font-semibold transition border-l border-gray-300 dark:border-gray-600 ${
                compareMode === 'closest-color'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Closest Color Match
            </button>
          </div>
        )}

        <button
          disabled={!colorsExtracted}
          onClick={handleCompare}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition"
        >
          🔍 Compare
        </button>
        <button
          onClick={clearAll}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          Clear All
        </button>

        {/* Variety penalty control */}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Variety penalty</label>
          <input
            type="range"
            min={0}
            max={25}
            step={1}
            value={varietyPenalty}
            onChange={e => { setVarietyPenalty(Number(e.target.value)); clearResults(); }}
            className="w-24 accent-emerald-500"
          />
          <span className="text-xs font-mono text-gray-600 dark:text-gray-300 w-10 text-right">{varietyPenalty}%</span>
        </div>
      </div>

      {extracting && (
        <ProgressBar value={extractProgress.done} max={extractProgress.total} label="Extracting colours…" />
      )}

      {/* ───── Similarity matrix ─────────────────────────────────────── */}
      {similarityMatrix && (
        <Card icon="📊" title="Pairwise Similarity Matrix">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Each cell shows the colour-profile similarity (0 – 1) between a Set A image (row) and a Set B image (column).
            Scores use bidirectional CIE-L*a*b* nearest-neighbour matching.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-gray-500 dark:text-gray-400 font-semibold sticky left-0 bg-white dark:bg-gray-900 z-10">
                    A ↓ / B →
                  </th>
                  {setB.map((b, j) => (
                    <th key={b.id} className="p-2 text-center font-medium text-gray-700 dark:text-gray-300 min-w-[80px]">
                      <span className="block truncate max-w-[80px]" title={b.name}>B{j + 1}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {setA.map((a, i) => (
                  <tr key={a.id}>
                    <td className="p-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-900 z-10">
                      <span className="block truncate max-w-[100px]" title={a.name}>A{i + 1}</span>
                    </td>
                    {similarityMatrix[i].map((score, j) => (
                      <td key={j} className={`p-2 text-center font-mono rounded ${scoreColor(score)}`}>
                        {score.toFixed(3)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ───── Best matches (matrix mode) ────────────────────────────── */}
      {bestMatches.length > 0 && compareMode === 'matrix' && (
        <Card icon="🏆" title="Best Matches">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Greedy one-to-one matching ranked by similarity score.
          </p>
          <div className="space-y-4">
            {bestMatches.map((m, idx) => {
              const a = setA[m.aIdx];
              const b = setB[m.bIdx];
              return (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4"
                >
                  {/* Set A image */}
                  <div className="flex flex-col items-center gap-1 w-32 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.name} className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">A{m.aIdx + 1}: {a.name}</span>
                    {a.colors && (
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {Object.entries(a.colors).slice(0, 5).map(([hex, p]) => (
                          <Swatch key={hex} hex={hex} proportion={p} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score badge */}
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-xl font-extrabold px-4 py-2 rounded-full ${scoreColor(m.score)}`}>
                      {(m.score * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-gray-400">similarity</span>
                  </div>

                  {/* Set B image */}
                  <div className="flex flex-col items-center gap-1 w-32 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.url} alt={b.name} className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">B{m.bIdx + 1}: {b.name}</span>
                    {b.colors && (
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        {Object.entries(b.colors).slice(0, 5).map(([hex, p]) => (
                          <Swatch key={hex} hex={hex} proportion={p} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ───── Closest colour matches ─────────────────────────────────── */}
      {closestColorMatches.length > 0 && compareMode === 'closest-color' && (
        <Card icon="🎯" title="Closest Colour Matches (Per Card)">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            For each card in Set A, the best matching card in Set B based on per-colour closest CIE-L*a*b* matches. Ranked by overall similarity.
          </p>
          <div className="space-y-6">
            {closestColorMatches.map((m, idx) => {
              const a = setA[m.aIdx];
              const b = setB[m.bIdx];
              return (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-5 space-y-4">
                  {/* Card header: A image ↔ B image + overall score */}
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex flex-col items-center gap-1 w-32 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.name} className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={a.name}>
                        A{m.aIdx + 1}: {a.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xl font-extrabold px-4 py-2 rounded-full ${scoreColor(m.overallScore)}`}>
                        {(m.overallScore * 100).toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-gray-400">overall match</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-32 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.url} alt={b.name} className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={b.name}>
                        B{m.bIdx + 1}: {b.name}
                      </span>
                    </div>
                  </div>

                  {/* Colour-pair detail table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="p-2 text-left font-semibold text-gray-500 dark:text-gray-400">{a.name} Colour</th>
                          <th className="p-2 text-center font-semibold text-gray-500 dark:text-gray-400">→</th>
                          <th className="p-2 text-left font-semibold text-gray-500 dark:text-gray-400">{b.name} Closest</th>
                          <th className="p-2 text-center font-semibold text-gray-500 dark:text-gray-400">ΔE</th>
                          <th className="p-2 text-center font-semibold text-gray-500 dark:text-gray-400">Similarity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.colorPairs.map((cp, cpIdx) => (
                          <tr key={cpIdx} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0" style={{ background: cp.hexA }} />
                                <span className="font-mono text-gray-700 dark:text-gray-300">{cp.hexA}</span>
                              </div>
                            </td>
                            <td className="p-2 text-center text-gray-400">→</td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0" style={{ background: cp.hexB }} />
                                <span className="font-mono text-gray-700 dark:text-gray-300">{cp.hexB}</span>
                              </div>
                            </td>
                            <td className="p-2 text-center font-mono text-gray-600 dark:text-gray-400">
                              {cp.deltaE.toFixed(1)}
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${scoreColor(cp.similarity)}`}>
                                {(cp.similarity * 100).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export report button */}
          <button
            onClick={() => exportStockReport(closestColorMatches)}
            className="mt-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            📋 Export Stock-Up Report
          </button>
        </Card>
      )}
    </div>
  );

  // ── export helper (inside component to access setA/setB) ──

  function exportStockReport(matches: ClosestColorMatch[]) {
    // Aggregate: for each Set B card, how many Set A cards need it
    const demand = new Map<number, { name: string; url: string; demandCards: string[]; totalScore: number }>();
    for (const m of matches) {
      const b = setB[m.bIdx];
      const a = setA[m.aIdx];
      const existing = demand.get(m.bIdx);
      if (existing) {
        existing.demandCards.push(a.name);
        existing.totalScore += m.overallScore;
      } else {
        demand.set(m.bIdx, {
          name: b.name,
          url: b.url,
          demandCards: [a.name],
          totalScore: m.overallScore,
        });
      }
    }

    // Build CSV
    const rows: string[] = [];
    rows.push('Stock-Up Report — Market Research (Color Comparison)');
    rows.push(`Generated: ${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);
    rows.push(`Total demand cards (Set A): ${setA.length}`);
    rows.push(`Available supply cards (Set B): ${setB.length}`);
    rows.push('');
    rows.push('Purchase Recommendation');
    rows.push('──────────────────────────────────────────');
    rows.push('');
    rows.push('Card (Set B),Quantity Needed,Avg Match %,Matched To (Set A)');

    const sorted = [...demand.entries()].sort((a, b) => b[1].demandCards.length - a[1].demandCards.length);
    for (const [, info] of sorted) {
      const avgScore = ((info.totalScore / info.demandCards.length) * 100).toFixed(1);
      const escaped = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      rows.push(
        `${escaped(info.name)},${info.demandCards.length},${avgScore}%,${escaped(info.demandCards.join('; '))}`
      );
    }

    rows.push('');
    rows.push('Summary');
    rows.push('──────────────────────────────────────────');
    rows.push(`Unique cards to purchase: ${demand.size}`);
    rows.push(`Total units to purchase: ${matches.length}`);

    // Unmatched Set A cards (if any)
    const matchedAIndices = new Set(matches.map(m => m.aIdx));
    const unmatched = setA.filter((_, i) => !matchedAIndices.has(i));
    if (unmatched.length > 0) {
      rows.push('');
      rows.push('Unmatched Demand Cards (Set A) — no suitable match found');
      rows.push('──────────────────────────────────────────');
      for (const u of unmatched) rows.push(u.name);
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-up-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

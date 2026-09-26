/**
 * PCR 场景（v6.1 切换安静版，方案 .proposals/2026-09-26-003-pcr-v6-animation-quiet.html 已批准）。
 *
 * 模型（示取舍登记 .superpowers/sdd/progress.md）：
 * - 布局模型 = 单容器恒定基座 + 元素级垂直微排（完全按 pcr_v6_demo.html）：
 *   基座 BASE_Y=250 永不拆行、不行位置跳变；分子数 1→2→4→8 靠行内元素微排实现。
 *   安静三阈值（测试强制）：延伸/结果幕 0 位移、变性幕 ≤14px、新轮微排 ≤28px；8 条模板 30px 均匀步进。
 * - 反平行语义（v6 延续）：引物 5′ 端贴模板 3′ 端内侧 24px、3′ 端朝内为延伸起点；
 *   新链 = 橙引物段（5′，原位停驻）+ 蓝合成段（3′）一条带；蓝段从引物 3′ 端锚点向模板 5′ 端配满全长
 *   （width 锚点生长，几何等价 demo 的 scaleX；L 锚 272 右伸、R 锚 568 左伸）。
 * - 合成单元（14 个固定池）= A′/B′（第 1 轮）+ r2×4（第 2 轮：A²/A″/B²/B″）+ r3×8（第 3 轮）。
 *   每单元 = 橙段 cap（5′ 端）+ 蓝段 band（3′ 端）+ 退火 5′ 标注 + 成链方向标注；激活幕由 ann/ext 声明。
 * - 去 Taq、方向标注随链真实朝向（贴链端 11px）、目标产物绿虚线框 + 徽标（仅 s9/s10）。
 */
import type { SceneComponent } from "../../core/types";
import type { PcrState } from "./data";

const NS = "http://www.w3.org/2000/svg";
const VB_W = 860;
const VB_H = 500;
const BASE_Y = 250;                          // 场景基座（恒定，永不拆行）

// ---------- 几何常量（demo 定稿，改动前先重算层位净距） ----------
const BAND_X = 224;                          // 全长链左缘
const BAND_W = 392;                          // 全长链跨 224..616
const BAND_H = 14;
const PRIMER_W = 24;                         // 反平行引物宽（5′ 端贴模板 3′ 端内侧 24px）
const PRIMER_H = 10;                         // 橙段高（退火引物/成链 5′ 端同一元素，恒 10px，忠实 demo 9px 近似）
const PRIMER_L_X = 248;                      // 248..272：L 引物（5′ 端 248）
const PRIMER_R_X = 568;                      // 568..592：R 引物（5′ 端 592）
const NEW_H = 12;                            // 合成段蓝段高
const DIR_OFF = 11;                          // 方向标注文本中心距链端 11px
const P5_OFF = 4;                            // 退火引物 5′ 标注中心距引物 5′ 端 4px
const TM_X = 240;                            // 目标产物绿虚线框：240..600 包住靶区 248..592
const TM_W = 360;

const GRAY = "#64748b";    // 母链（旧链/模板）
const BLUE = "#2563eb";    // 合成段（新链 3′ 端）
const ORANGE = "#f59e0b";  // 引物段（新链 5′ 端，原位停驻）
const GREEN = "#22c55e";   // 目标产物标识（绿虚线框）

// ---------- 反平行链模型（v6 沿用） ----------
/** 单链规格：three=3′ 端侧别；kind=original 是灰母链全长 224..616；synth 是合成链（橙段 5′ 端 + 蓝段 3′ 端） */
interface StrandSpec {
  kind: "original" | "synth";
  three: "left" | "right";
  /** synth 链自身蓝段 [from,to]（from<to），即链的 3′ 端段 */
  blue?: [number, number];
}

/** 8 种链形态（模板/新链几何复用：|A′|≡|A²|、|B′|≡|B²|） */
const A_SPEC: StrandSpec = { kind: "original", three: "right" };                  // A：灰 224..616，5′ 224 / 3′ 616
const B_SPEC: StrandSpec = { kind: "original", three: "left" };                   // B：灰 224..616，3′ 224 / 5′ 616
const AP_SPEC: StrandSpec = { kind: "synth", three: "left", blue: [224, 568] };   // A′/A²：橙 568..592 + 蓝 224..568
const AS_SPEC: StrandSpec = { kind: "synth", three: "right", blue: [272, 592] };  // A″：橙 248..272 + 蓝 272..592
const BP_SPEC: StrandSpec = { kind: "synth", three: "right", blue: [272, 616] };  // B′/B²：橙 248..272 + 蓝 272..616
const BS_SPEC: StrandSpec = { kind: "synth", three: "left", blue: [248, 568] };   // B″：橙 568..592 + 蓝 248..568

/** 链 5′ 端坐标：母链 A=224/B=616；合成链 = 自身橙段外侧端（three 左→592、three 右→248） */
function fiveOf(s: StrandSpec): number {
  if (s.kind === "original") return s.three === "right" ? BAND_X : BAND_X + BAND_W;
  return s.three === "left" ? PRIMER_R_X + PRIMER_W : PRIMER_L_X;
}

/** 链 3′ 端坐标：母链 A=616/B=224；合成链 = 自身蓝段远端 */
function threeOf(s: StrandSpec): number {
  if (s.kind === "original") return s.three === "right" ? BAND_X + BAND_W : BAND_X;
  return s.three === "left" ? s.blue![0] : s.blue![1];
}

/** 合成链自身橙段（5′ 端）起始 x：three 左 → 568（右侧）、three 右 → 248（左侧） */
function capXOf(s: StrandSpec): number {
  return s.three === "left" ? PRIMER_R_X : PRIMER_L_X;
}

/** 合成链蓝段锚点 x（引物 3′ 端，延伸起点）：three 左 → 568（左伸）、three 右 → 272（右伸） */
function anchorOf(s: StrandSpec): number {
  return s.three === "left" ? PRIMER_R_X : PRIMER_L_X + PRIMER_W;
}

// ---------- 合成单元（固定池 14 个） ----------
interface SynthUnit {
  key: string;
  spec: StrandSpec;         // 成链后的链 spec（决定橙段/蓝段/五三端标注）
  ann: number;              // 引物（橙段 cap）可见的最小 stage index
  ext: number;              // 蓝段 band 生长/可见的最小 stage index
  g: SVGGElement;
  cap: SVGRectElement;      // 橙段（退火 = 引物；成链后 = 5′ 端）
  band: SVGRectElement;     // 蓝合成段（3′ 端，锚点生长）
  p5: SVGTextElement;       // 退火引物 5′ 标注（仅退火态 ann ≤ idx < ext）
  d1: SVGTextElement;       // 成链方向标注（贴 five/three 端各 11px）
  d2: SVGTextElement;
  full: number;             // 蓝段全长
  anchor: number;           // 蓝段锚点 x
}

/** 14 个合成单元的激活幕：newA/newB=第 1 轮(s2 引物/s3 延伸)、r2×4=第 2 轮(s5/s6)、r3×8=第 3 轮(s8/s9) */
function unitSpecs(): Array<{ key: string; spec: StrandSpec; ann: number; ext: number }> {
  return [
    { key: "newA", spec: AP_SPEC, ann: 2, ext: 3 },
    { key: "newB", spec: BP_SPEC, ann: 2, ext: 3 },
    { key: "r2-0", spec: AP_SPEC, ann: 5, ext: 6 },   // A²（模板 A 上合成）
    { key: "r2-1", spec: AS_SPEC, ann: 5, ext: 6 },   // A″（模板 A′ 上合成，正确长度）
    { key: "r2-2", spec: BP_SPEC, ann: 5, ext: 6 },   // B²（模板 B 上合成）
    { key: "r2-3", spec: BS_SPEC, ann: 5, ext: 6 },   // B″（模板 B′ 上合成，正确长度）
    { key: "r3-0", spec: AP_SPEC, ann: 8, ext: 9 },   // 模板 A
    { key: "r3-1", spec: AS_SPEC, ann: 8, ext: 9 },   // 模板 A²（≡A′）
    { key: "r3-2", spec: AS_SPEC, ann: 8, ext: 9 },   // 模板 A′
    { key: "r3-3", spec: BS_SPEC, ann: 8, ext: 9 },   // 模板 A″
    { key: "r3-4", spec: BP_SPEC, ann: 8, ext: 9 },   // 模板 B
    { key: "r3-5", spec: BS_SPEC, ann: 8, ext: 9 },   // 模板 B²（≡B′）
    { key: "r3-6", spec: BS_SPEC, ann: 8, ext: 9 },   // 模板 B′
    { key: "r3-7", spec: AS_SPEC, ann: 8, ext: 9 },   // 模板 B″
  ];
}

// ---------- 逐幕层位表（y 相对基座 BASE_Y；数值 = demo STAGES 逐字段搬运） ----------
interface ChainSlot { chainA: number; chainB: number; units: number[]; }
/** units 顺序 = unitSpecs 顺序（newA/newB/r2×4/r3×8）；未激活单元填占位 0（不渲染） */
const LAYOUT: Record<string, ChainSlot> = {
  "s0-template":   { chainA: -10, chainB: 10, units: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  "s1-denature-1": { chainA: -44, chainB: 44, units: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  "s2-anneal-1":   { chainA: -44, chainB: 44, units: [-30, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  "s3-extend-1":   { chainA: -44, chainB: 44, units: [-30, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  "s4-denature-2": { chainA: -58, chainB: 34, units: [-18, 68, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  "s5-anneal-2":   { chainA: -84, chainB: 42, units: [-12, 96, -70, 2, 56, 110, 0, 0, 0, 0, 0, 0, 0, 0] },
  "s6-extend-2":   { chainA: -84, chainB: 42, units: [-12, 96, -70, 2, 56, 110, 0, 0, 0, 0, 0, 0, 0, 0] },
  "s7-denature-3": { chainA: -92, chainB: 34, units: [-20, 88, -62, 10, 64, 118, 0, 0, 0, 0, 0, 0, 0, 0] },
  "s8-anneal-3":   { chainA: -92, chainB: 28, units: [-32, 88, -62, -2, 58, 118, -78, -48, -18, 12, 42, 72, 102, 132] },
  "s9-extend-3":   { chainA: -92, chainB: 28, units: [-32, 88, -62, -2, 58, 118, -78, -48, -18, 12, 42, 72, 102, 132] },
  "s10-result":    { chainA: -92, chainB: 28, units: [-32, 88, -62, -2, 58, 118, -78, -48, -18, 12, 42, 72, 102, 132] },
};

/** stage id → 幕序号（s0=0 … s10=10） */
const STAGE_INDEX: Record<string, number> = {
  "s0-template": 0, "s1-denature-1": 1, "s2-anneal-1": 2, "s3-extend-1": 3, "s4-denature-2": 4,
  "s5-anneal-2": 5, "s6-extend-2": 6, "s7-denature-3": 7, "s8-anneal-3": 8, "s9-extend-3": 9, "s10-result": 10,
};

const TEMP_MAP: Record<string, "95" | "55" | "72" | null> = {
  "s0-template": null, "s1-denature-1": "95", "s2-anneal-1": "55", "s3-extend-1": "72",
  "s4-denature-2": "95", "s5-anneal-2": "55", "s6-extend-2": "72",
  "s7-denature-3": "95", "s8-anneal-3": "55", "s9-extend-3": "72", "s10-result": null,
};

/** 计数徽章只在延伸完成/结果帧现身（s3/s6/s9/s10），文案 目标产物 2ⁿ−2n */
const BADGE_ROUND: Record<string, number> = {
  "s3-extend-1": 1, "s6-extend-2": 2, "s9-extend-3": 3, "s10-result": 3,
};
const SUP = ["", "¹", "²", "³", "⁴", "⁵"];

// 目标产物绿虚线框（demo 几何：包「目标模板层 + 其上第 3 轮新链层」）
const TM1_Y = -13;   // 包 A″ 层(−2) 与其上 r3-3 层(+12)：−13..19
const TM1_H = 32;
const TM2_Y = 110;   // 包 B″ 层(+118) 与其上 r3-7 层(+132)：110..144
const TM2_H = 34;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function makeTempTab(temp: "95" | "55" | "72"): SVGGElement {
  const idx = temp === "95" ? 0 : temp === "55" ? 1 : 2;
  const x = 60 + idx * 90;
  const g = el("g", { class: "temp-tab", "data-temp": temp });
  g.appendChild(el("rect", { x: String(x), y: "16", width: "78", height: "20", rx: "10", fill: "#94a3b8" }));
  const t = el("text", { x: String(x + 39), y: "30", fill: "#fff", "font-size": "12", "text-anchor": "middle" });
  t.textContent = `${temp}°C`;
  g.appendChild(t);
  return g;
}

export function createPcrScene(): SceneComponent {
  const root = {
    base: null as SVGGElement | null,
    chainA: null as SVGGElement | null,
    chainB: null as SVGGElement | null,
    chainDirs: [] as SVGTextElement[],   // chainA 2 枚 + chainB 2 枚
    units: [] as SynthUnit[],
    tm: [] as SVGGElement[],
    temps: [] as SVGGElement[],
    clear: null as HTMLElement | null,
  };

  const setO = (e: ElementCSSInlineStyle, on: boolean): void => {
    e.style.opacity = on ? "1" : "0";
  };

  /** 带写入：x/width 同步到属性与 style（CSS 几何通道可过渡），fill 只写属性 */
  function setBand(e: SVGRectElement, x: number, w: number, color: string): void {
    e.setAttribute("x", String(x));
    e.setAttribute("width", String(w));
    e.style.setProperty("x", `${x}px`);
    e.style.width = `${w}px`;
    e.setAttribute("fill", color);
  }

  /**
   * 方向标注：dirFive = 标注 5′ 端的那枚、dirThree = 标注 3′ 端的那枚。
   * left/right 由 five/three 大小决定；每枚 x = 对应端 ± 11px（y 由所在 g 的整体位移承担）。
   */
  function setDirPair(dirFive: SVGTextElement, dirThree: SVGTextElement, five: number, three: number): void {
    const left = Math.min(five, three);
    const right = Math.max(five, three);
    dirFive.textContent = "5′";
    dirThree.textContent = "3′";
    dirFive.setAttribute("x", String((five === left ? left : right) + (five === left ? DIR_OFF : -DIR_OFF)));
    dirThree.setAttribute("x", String((three === left ? left : right) + (three === left ? DIR_OFF : -DIR_OFF)));
  }

  /** 母链（灰全长）+ 两枚方向标注 */
  function makeChain(key: string, spec: StrandSpec): { g: SVGGElement; band: SVGRectElement; dirs: SVGTextElement[] } {
    const g = el("g", { class: `pcr-chain pcr-chain-${key}` });
    const band = el("rect", { class: "pcr-band", x: String(BAND_X), y: "0", width: String(BAND_W), height: String(BAND_H), rx: String(BAND_H / 2), fill: GRAY });
    const d1 = el("text", { class: "pcr-dir", x: "0", y: "4", fill: "#334155", "font-size": "12", "text-anchor": "middle" });
    const d2 = el("text", { class: "pcr-dir", x: "0", y: "4", fill: "#334155", "font-size": "12", "text-anchor": "middle" });
    d1.textContent = "";
    d2.textContent = "";
    setDirPair(d1, d2, fiveOf(spec), threeOf(spec));
    g.append(band, d1, d2);
    return { g, band, dirs: [d1, d2] };
  }

  /** 合成单元：橙段 cap + 蓝段 band + 退火 5′ 标注 + 成链方向标注 */
  function makeUnit(u: { key: string; spec: StrandSpec; ann: number; ext: number }): SynthUnit {
    const g = el("g", { class: `pcr-unit pcr-unit-${u.key}` });
    const cap = el("rect", { class: "pcr-cap", x: String(capXOf(u.spec)), y: "0", width: String(PRIMER_W), height: String(PRIMER_H), rx: String(PRIMER_H / 2), fill: ORANGE });
    const anchor = anchorOf(u.spec);
    const [bf, bt] = u.spec.blue!;
    const band = el("rect", { class: "pcr-new", x: String(anchor), y: "0", width: "0", height: String(NEW_H), rx: String(NEW_H / 2), fill: BLUE });
    const p5 = el("text", {
      class: "pcr-p5",
      x: String(capXOf(u.spec) === PRIMER_L_X ? PRIMER_L_X + P5_OFF : PRIMER_R_X + PRIMER_W - P5_OFF),
      y: "4", fill: "#fff", "font-size": "9", "font-weight": "700", "text-anchor": "middle",
    });
    p5.textContent = "5′";
    const d1 = el("text", { class: "pcr-dir", x: "0", y: "4", fill: "#334155", "font-size": "12", "text-anchor": "middle" });
    const d2 = el("text", { class: "pcr-dir", x: "0", y: "4", fill: "#334155", "font-size": "12", "text-anchor": "middle" });
    d1.textContent = "";
    d2.textContent = "";
    setDirPair(d1, d2, fiveOf(u.spec), threeOf(u.spec));
    g.append(cap, band, p5, d1, d2);
    return { ...u, g, cap, band, p5, d1, d2, full: bt - bf, anchor };
  }

  /** 目标产物绿虚线框（仅 s9/s10 淡入） */
  function makeTarget(tmY: number, tmH: number): SVGGElement {
    const g = el("g", { class: "pcr-target" });
    g.appendChild(el("rect", { x: String(TM_X), y: String(tmY), width: String(TM_W), height: String(tmH), rx: "9", fill: "rgba(34,197,94,.07)", stroke: GREEN, "stroke-width": "2", "stroke-dasharray": "7 4" }));
    const t = el("text", { x: String(TM_X - 6), y: String(tmY + 19), fill: "#15803d", "font-size": "11", "font-weight": "700", "text-anchor": "end" });
    t.textContent = "目标产物";
    g.appendChild(t);
    return g;
  }

  function render(state: PcrState): void {
    const s = state as PcrState;
    const stageId = String(s.stage ?? "");
    const idx = STAGE_INDEX[stageId] ?? 0;
    const layout = LAYOUT[stageId];
    const p = Number(s.extensionProgress) || 0;
    const activeTemp = TEMP_MAP[stageId] ?? null;

    if (!root.base || !layout) return;

    // 基座恒定 + 母链
    root.base.style.transform = `translate(0,${BASE_Y}px)`;
    if (root.chainA && root.chainB && root.chainDirs.length === 4) {
      root.chainA.style.transform = `translateY(${layout.chainA}px)`;
      root.chainB.style.transform = `translateY(${layout.chainB}px)`;
      // 母链带恒可见 + 方向标注常驻可见
      const bandA = root.chainA.querySelector<SVGRectElement>(".pcr-band");
      const bandB = root.chainB.querySelector<SVGRectElement>(".pcr-band");
      if (bandA) setO(bandA, true);
      if (bandB) setO(bandB, true);
      root.chainDirs.forEach((d) => setO(d, true));
    }

    // 合成单元：退火态（ann ≤ idx < ext）只显示橙段引物 + 5′ 标注；成链后（idx ≥ ext）橙段+蓝段+方向标注
    root.units.forEach((u, i) => {
      const y = layout.units[i];
      u.g.style.transform = `translateY(${y}px)`;
      const active = idx >= u.ann;
      const synth = idx >= u.ext;
      const w = idx === u.ext ? Math.max(0, Math.round(u.full * p)) : u.full;
      if (!active) {
        setO(u.cap, false); setO(u.band, false); setO(u.p5, false); setO(u.d1, false); setO(u.d2, false);
        return;
      }
      setO(u.cap, true);
      // 蓝段：锚点固定，向模板 5′ 端方向展开（three 左 → 锚 568 左伸；three 右 → 锚 272 右伸）
      if (synth) {
        const x = u.spec.three === "left" ? u.anchor - w : Math.min(u.anchor, u.anchor + w);
        setBand(u.band, x, w, BLUE);
        setO(u.band, true);
        setO(u.d1, true); setO(u.d2, true);
        setO(u.p5, false);
      } else {
        setBand(u.band, u.anchor, 0, BLUE);
        setO(u.band, false);
        setO(u.p5, true);
        setO(u.d1, false); setO(u.d2, false);
      }
    });

    // 目标产物：仅第 3 轮延伸完成（s9/s10）淡入
    const targetOn = stageId === "s9-extend-3" || stageId === "s10-result";
    root.tm.forEach((t) => setO(t, targetOn));

    // 温度牌与徽章
    root.temps.forEach((t) => {
      setO(t, t.getAttribute("data-temp") === activeTemp);
    });
    const round = BADGE_ROUND[stageId];
    if (root.clear) {
      if (round) {
        root.clear.style.display = "";
        const count = 2 ** round - 2 * round;
        root.clear.textContent = `目标产物 ${count}（2${SUP[round]}−2×${round}）`;
      } else {
        root.clear.style.display = "none";
      }
    }
  }

  function mount(container: HTMLElement): void {
    const wrap = document.createElement("div");
    wrap.className = "pcr-scene";
    const svg = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}`, role: "img" });

    const base = el("g", { class: "pcr-base" });
    root.base = base;

    // 两条母链（灰）+ 方向标注 4 枚
    const a = makeChain("A", A_SPEC);
    const b = makeChain("B", B_SPEC);
    root.chainA = a.g; root.chainB = b.g;
    root.chainDirs = [...a.dirs, ...b.dirs];
    base.appendChild(a.g);
    base.appendChild(b.g);

    // 14 个合成单元
    root.units = unitSpecs().map((d) => makeUnit(d));
    root.units.forEach((u) => base.appendChild(u.g));

    // 目标产物绿虚线框（2 个，仅 s9/s10 显示）
    root.tm = [makeTarget(TM1_Y, TM1_H), makeTarget(TM2_Y, TM2_H)];
    root.tm.forEach((t) => base.appendChild(t));

    svg.appendChild(base);
    for (const t of ["95", "55", "72"] as const) root.temps.push(makeTempTab(t));
    root.temps.forEach((t) => svg.appendChild(t));

    const clear = document.createElement("div");
    clear.className = "pcr-clear-badge";
    clear.textContent = "";
    wrap.appendChild(svg);
    wrap.appendChild(clear);
    root.clear = clear;
    container.appendChild(wrap);
  }

  return {
    mount,
    render,
    legend: [
      { color: GRAY, label: "母链（旧链/模板）" },
      { color: ORANGE, label: "引物段（新链 5′ 端，原位停驻）" },
      { color: BLUE, label: "合成段（新链 3′ 端）" },
      { color: GREEN, label: "目标产物（2ⁿ−2n）" },
    ],
  };
}
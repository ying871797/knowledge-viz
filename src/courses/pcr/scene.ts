/**
 * PCR 场景（v6 反平行语义版，方案 .proposals/2026-09-26-002-pcr-v6-rebuild.html，已批准）。
 *
 * 模型（示意取舍登记 .superpowers/sdd/progress.md）：
 * - 一行 = 一条单链模板的延伸行 / 或泳道行（双链两条模板分开）；8 行固定元素池 + ROW_MAP 槽位表
 *   （沿用 v5「统一行模型」骨架：泳道 ±45、模板 −8 / 新链 +18；行数 1→2→4→8 如实翻倍）。
 * - 反平行语义（本版核心）：引物 5′ 端靠近旧链(模板) 3′ 端、3′ 端朝内为延伸起点；
 *   新链从引物 3′ 端向模板 5′ 端方向配满全长，新链 3′ 端与旧链 5′ 端同侧。
 * - 引物减短反平行（用户定稿）：PRIMER_W=24，L 248..272 / R 568..592——5′ 端恰好贴各自模板 3′ 端
 *   （A 类模板 3′ 端 616 → 引物 5′ 端 592；B 类模板 3′ 端 224 → 引物 5′ 端 248，各内缩 24px）。
 * - 新链 = 橙引物段（5′，原位停驻）+ 蓝合成段（3′）一条带；合成链作下轮模板时 = 自身橙段 + 蓝段
 *   （橙段守恒：链的 5′ 端橙段由当初的引物原地留下，永不消失）。
 * - 去 Taq（用户舍弃）：删 taq1/taq2 元素与图例紫色第 5 项。
 * - 目标产物：第 2 轮在 A′/B′（第 1 轮产物链）上合成出的第一条正确长度链 A″/B″，
 *   第 3 轮以它们为模板复制出互补链 → 2 个目标双链（绿虚线框 + 徽标「目标产物 2（2³−2×3）」）。
 * - 颜色：母链灰 / 合成段蓝 / 引物橙 / 目标绿（仅作虚线框标识，不作链色），色相 ≤4。
 * - 方向标注随链真实朝向（沿用 v5 裁决④）：四枚 aL/aR/bL/bR 贴各自链端，全程不省略。
 */
import type { SceneComponent } from "../../core/types";

const NS = "http://www.w3.org/2000/svg";
const VB_W = 860;
const VB_H = 500;

// ---------- 几何常量（改动前先重算层位净距；反平行几何 = pcr_v6_demo.html 定稿） ----------
const BAND_X = 224;                          // 全长链左缘
const BAND_W = 392;                          // 全长链跨 224..616（demo 定稿）
const BAND_H = 14;
const PRIMER_W = 24;                         // 反平行引物宽（用户定稿；5′ 端贴模板 3′ 端内侧 24px）
const PRIMER_H = 10;
const PRIMER_L_X = 248;                      // 248..272：B 类模板（3′ 端 224）引物，5′ 端 248、3′ 端 272
const PRIMER_R_X = 568;                      // 568..592：A 类模板（3′ 端 616）引物，3′ 端 568、5′ 端 592
const PRIMER_OFF = 14;                       // 退火泳道：引物贴链下方错开（不叠链带）
const SS_OFF = 45;                           // 泳道两条链上下分离振幅（±45，净距 124−2×52=20）
const EX_OFF = 8;                            // 模板/配对链贴拢（±8）
const CHAIN_OFF = 18;                        // 新链层（模板下方；8 行档净距 52−41.5=10.5…下行顶 → ≥6）
const NEW_H = 12;                            // 合成段高
const CAP_H = 14;                            // 合成链橙段（5′ 端）与链带同高
const MARK_X = 240;                          // 目标产物绿虚线框：240..600 包住靶区 248..592
const MARK_W = 360;
const MARK_Y = -16;                          // 框住模板(−8)与新链(+18)两层：−16..25，不跨 8 行档行界
const MARK_H = 41;

const GRAY = "#64748b";    // 母链（旧链/模板）
const BLUE = "#2563eb";    // 合成段（新链 3′ 端）
const ORANGE = "#f59e0b";  // 引物段（新链 5′ 端，原位停驻）
const GREEN = "#22c55e";   // 目标产物标识（绿虚线框）

/** 行数 → 各行列中心 y。4 行档位行距 124（泳道净距 = 124 − 2×(45+7) = 20 ≥ 20 断言） */
const ROW_YS: Record<number, number[]> = {
  1: [250],
  2: [170, 330],
  4: [52, 176, 300, 424],
  8: [52, 104, 156, 208, 260, 312, 364, 416],
};

// ---------- 反平行链模型 ----------
/**
 * 单链规格：three=3′ 端侧别（决定引物/锚点/橙段与标注，不决定槽位）；
 * kind=original 是灰母链全长 224..616；synth 是合成链（橙段 5′ 端 + 蓝段 3′ 端，blue=[蓝段起,止]）。
 * 母链：A=5′左3′右（3′ 端 616）、B=5′右3′左（3′ 端 224），两者反平行。
 * 合成链 5′ 端永远 = 当初引物留下来的橙段外侧（A′/A²：592；A″/B′/B²：248；B″：592）。
 */
interface StrandSpec {
  kind: "original" | "synth";
  three: "left" | "right";
  /** synth 链自身蓝段 [from,to]（from<to），即链的 3′ 端段 */
  blue?: [number, number];
}

/** 8 种链形态（行模板本体，|A′|≡|A²|、|B′|≡|B²| 几何复用） */
const A_SPEC: StrandSpec = { kind: "original", three: "right" };                       // A：灰 224..616，5′ 224 / 3′ 616
const B_SPEC: StrandSpec = { kind: "original", three: "left" };                        // B：灰 224..616，3′ 224 / 5′ 616
const AP_SPEC: StrandSpec = { kind: "synth", three: "left", blue: [224, 568] };        // A′/A²：橙 568..592 + 蓝 224..568
const AS_SPEC: StrandSpec = { kind: "synth", three: "right", blue: [272, 592] };       // A″：橙 248..272 + 蓝 272..592
const BP_SPEC: StrandSpec = { kind: "synth", three: "right", blue: [272, 616] };       // B′/B²：橙 248..272 + 蓝 272..616
const BS_SPEC: StrandSpec = { kind: "synth", three: "left", blue: [248, 568] };        // B″：橙 568..592 + 蓝 248..568

/** 链 5′ 端坐标：母链 A=224/B=616；合成链 = 自身橙段外侧端（3′ 左→592、3′ 右→248） */
function fiveOf(s: StrandSpec): number {
  if (s.kind === "original") return s.three === "right" ? BAND_X : BAND_X + BAND_W;
  return s.three === "left" ? PRIMER_R_X + PRIMER_W : PRIMER_L_X;
}

/** 链 3′ 端坐标：母链 A=616/B=224；合成链 = 自身蓝段远端 */
function threeOf(s: StrandSpec): number {
  if (s.kind === "original") return s.three === "right" ? BAND_X + BAND_W : BAND_X;
  return s.three === "left" ? s.blue![0] : s.blue![1];
}

/** 模板本轮引物侧别：3′ 端在左 → L(248..272)、在右 → R(568..592)（5′ 端贴模板 3′ 端内侧） */
function primerOf(s: StrandSpec): "L" | "R" {
  return s.three === "left" ? "L" : "R";
}

/** 本轮新链合成段（蓝段）span [from,to]：从引物 3′ 端向模板 5′ 端配满全长 */
function synthSpan(s: StrandSpec): [number, number] {
  const five = fiveOf(s);
  return s.three === "left" ? [PRIMER_L_X + PRIMER_W, five] : [five, PRIMER_R_X];
}

/** 合成链（作模板时）自身橙段 5′ 端位置：3′ 左 → 568（右侧）、3′ 右 → 248（左侧） */
function capXOf(s: StrandSpec): number {
  return s.three === "left" ? PRIMER_R_X : PRIMER_L_X;
}

interface PairCfg { tag: "pair" }
interface LaneCfg {
  tag: "lane";
  up: StrandSpec;
  down: StrandSpec;
  /** 退火阶段给每条链挂 1 支引物（贴各自 3′ 端内侧下方） */
  anneal: boolean;
}
interface ExtendCfg {
  tag: "extend";
  /** 模板链（恒在 bandT 上槽 −8） */
  temp: StrandSpec;
  /** 目标产物行（A″/B″ 谱系，s9/s10 绿虚线框标注） */
  target?: boolean;
}
type RowCfg = PairCfg | LaneCfg | ExtendCfg;

/** 合法槽位表：stage id → 各行形态（layout 内无 stage 分支，按 tag 分支即模型）。
 *  行数逐幕 1→1→1→2→2→2→4→4→4→8→8；目标产物位于第 3 轮行 4（A″）与行 8（B″）。 */
const ROW_MAP: Record<string, RowCfg[]> = {
  "s0-template": [{ tag: "pair" }],
  "s1-denature-1": [
    // 1 行泳道：双链两条母链打开、原位上下位移分开（都是模板，无新旧之分）
    { tag: "lane", up: A_SPEC, down: B_SPEC, anneal: false },
  ],
  "s2-anneal-1": [
    { tag: "lane", up: A_SPEC, down: B_SPEC, anneal: true },
  ],
  "s3-extend-1": [
    // 第 1 轮：两条母链各成行 → 各自长出第 1 条新链 A′/B′（长母链 → 中链）
    { tag: "extend", temp: A_SPEC },
    { tag: "extend", temp: B_SPEC },
  ],
  "s4-denature-2": [
    // 第 2 轮变性：2 行泳道，每行 = 上轮产物双链的两条（A/A′、B/B′）
    { tag: "lane", up: A_SPEC, down: AP_SPEC, anneal: false },
    { tag: "lane", up: B_SPEC, down: BP_SPEC, anneal: false },
  ],
  "s5-anneal-2": [
    { tag: "lane", up: A_SPEC, down: AP_SPEC, anneal: true },
    { tag: "lane", up: B_SPEC, down: BP_SPEC, anneal: true },
  ],
  "s6-extend-2": [
    // 第 2 轮：A→A²、A′→A″（首条正确长度链）、B→B²、B′→B″
    { tag: "extend", temp: A_SPEC },
    { tag: "extend", temp: AP_SPEC },
    { tag: "extend", temp: B_SPEC },
    { tag: "extend", temp: BP_SPEC },
  ],
  "s7-denature-3": [
    // 第 3 轮变性：4 行泳道（A/A²）、（A′/A″）、（B/B²）、（B′/B″）
    { tag: "lane", up: A_SPEC, down: AP_SPEC, anneal: false },
    { tag: "lane", up: AP_SPEC, down: AS_SPEC, anneal: false },
    { tag: "lane", up: B_SPEC, down: BP_SPEC, anneal: false },
    { tag: "lane", up: BP_SPEC, down: BS_SPEC, anneal: false },
  ],
  "s8-anneal-3": [
    { tag: "lane", up: A_SPEC, down: AP_SPEC, anneal: true },
    { tag: "lane", up: AP_SPEC, down: AS_SPEC, anneal: true },
    { tag: "lane", up: B_SPEC, down: BP_SPEC, anneal: true },
    { tag: "lane", up: BP_SPEC, down: BS_SPEC, anneal: true },
  ],
  "s9-extend-3": [
    // 第 3 轮：8 条单链各成行；行 4(A″)/行 8(B″) 为目标产物（绿虚线框）
    { tag: "extend", temp: A_SPEC },
    { tag: "extend", temp: AP_SPEC },
    { tag: "extend", temp: AP_SPEC },
    { tag: "extend", temp: AS_SPEC, target: true },
    { tag: "extend", temp: B_SPEC },
    { tag: "extend", temp: BP_SPEC },
    { tag: "extend", temp: BP_SPEC },
    { tag: "extend", temp: BS_SPEC, target: true },
  ],
  "s10-result": [
    { tag: "extend", temp: A_SPEC },
    { tag: "extend", temp: AP_SPEC },
    { tag: "extend", temp: AP_SPEC },
    { tag: "extend", temp: AS_SPEC, target: true },
    { tag: "extend", temp: B_SPEC },
    { tag: "extend", temp: BP_SPEC },
    { tag: "extend", temp: BP_SPEC },
    { tag: "extend", temp: BS_SPEC, target: true },
  ],
};

const TEMP_MAP: Record<string, "95" | "55" | "72" | null> = {
  "s0-template": null,
  "s1-denature-1": "95",
  "s2-anneal-1": "55",
  "s3-extend-1": "72",
  "s4-denature-2": "95",
  "s5-anneal-2": "55",
  "s6-extend-2": "72",
  "s7-denature-3": "95",
  "s8-anneal-3": "55",
  "s9-extend-3": "72",
  "s10-result": null,
};

/** 计数徽章只在延伸完成/结果帧现身（s3/s6/s9/s10），文案 目标产物 2ⁿ−2n */
const BADGE_ROUND: Record<string, number> = {
  "s3-extend-1": 1,
  "s6-extend-2": 2,
  "s9-extend-3": 3,
  "s10-result": 3,
};
const SUP = ["", "¹", "²", "³", "⁴", "⁵"];

interface RowEls {
  g: SVGGElement;
  bandT: SVGRectElement;
  bandTp: SVGRectElement;
  bandB: SVGRectElement;
  bandBp: SVGRectElement;
  newEl: SVGRectElement;
  primerL: SVGRectElement;
  primerR: SVGRectElement;
  marker: SVGGElement;
  dirs: SVGTextElement[];
  p5s: SVGTextElement[];
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function makeRow(): RowEls {
  const g = el("g", { class: "pcr-row" });
  const bandT = el("rect", { class: "pcr-band", x: String(BAND_X), y: "0", width: String(BAND_W), height: String(BAND_H), rx: String(BAND_H / 2), fill: GRAY });
  const bandTp = el("rect", { class: "pcr-cap", x: String(PRIMER_L_X), y: "0", width: String(PRIMER_W), height: String(CAP_H), rx: String(CAP_H / 2), fill: ORANGE });
  const bandB = el("rect", { class: "pcr-band", x: String(BAND_X), y: "0", width: String(BAND_W), height: String(BAND_H), rx: String(BAND_H / 2), fill: GRAY });
  const bandBp = el("rect", { class: "pcr-cap", x: String(PRIMER_L_X), y: "0", width: String(PRIMER_W), height: String(CAP_H), rx: String(CAP_H / 2), fill: ORANGE });
  const newEl = el("rect", { class: "pcr-new", x: "0", y: "0", width: "0", height: String(NEW_H), rx: String(NEW_H / 2), fill: BLUE });
  const primerL = el("rect", { class: "pcr-primer-L", x: String(PRIMER_L_X), y: "0", width: String(PRIMER_W), height: String(PRIMER_H), rx: String(PRIMER_H / 2), fill: ORANGE, stroke: "#b45309" });
  const primerR = el("rect", { class: "pcr-primer-R", x: String(PRIMER_R_X), y: "0", width: String(PRIMER_W), height: String(PRIMER_H), rx: String(PRIMER_H / 2), fill: ORANGE, stroke: "#b45309" });

  // 目标产物绿虚线框：包住模板(−8)与新链(+18)两层（rectangle 常驻，g 显隐）
  const marker = el("g", { class: "pcr-target-mark" });
  marker.appendChild(el("rect", { x: String(MARK_X), y: String(MARK_Y), width: String(MARK_W), height: String(MARK_H), rx: "9", fill: "rgba(34,197,94,.07)", stroke: GREEN, "stroke-width": "2", "stroke-dasharray": "7 4" }));
  const markText = el("text", { x: String(MARK_X - 6), y: "4", fill: "#15803d", "font-size": "11", "font-weight": "700", "text-anchor": "end" });
  markText.textContent = "目标产物";
  marker.appendChild(markText);

  // 5′/3′ 方向标注（四枚）：aL/aR 贴上链(模板)链端、bL/bR 贴下链或新链链端；x 随链几何动态写入
  const dirDefs = ["aL", "aR", "bL", "bR"];
  const dirs = dirDefs.map((side) => {
    const t = el("text", { class: "pcr-dir", "data-side": side, x: "0", y: "4", fill: "#334155", "font-size": "12", "text-anchor": "middle" });
    t.textContent = "";
    return t;
  });

  // 退火引物 5′ 标注（反平行：贴引物 5′ 端；延伸并入新链后由 bL/bR 承担，此处隐藏）
  const p5L = el("text", { class: "pcr-p5-L", x: String(PRIMER_L_X + 4), y: "4", fill: "#fff", "font-size": "9", "font-weight": "700", "text-anchor": "middle" });
  p5L.textContent = "5′";
  const p5R = el("text", { class: "pcr-p5-R", x: String(PRIMER_R_X + PRIMER_W - 4), y: "4", fill: "#fff", "font-size": "9", "font-weight": "700", "text-anchor": "middle" });
  p5R.textContent = "5′";

  g.append(bandT, bandTp, bandB, bandBp, newEl, primerL, primerR, marker, ...dirs, p5L, p5R);
  return { g, bandT, bandTp, bandB, bandBp, newEl, primerL, primerR, marker, dirs, p5s: [p5L, p5R] };
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

type PcrState = Record<string, unknown>;

export function createPcrScene(): SceneComponent {
  const root = {
    rows: [] as RowEls[],
    temps: [] as SVGGElement[],
    clear: null as HTMLElement | null,
  };

  const setO = (e: ElementCSSInlineStyle, on: boolean, onVal = "1"): void => {
    e.style.opacity = on ? onVal : "0";
  };

  function rowOff(r: RowEls): void {
    for (const sel of [r.bandT, r.bandTp, r.bandB, r.bandBp, r.newEl, r.primerL, r.primerR]) setO(sel, false);
    setO(r.marker, false);
    r.dirs.forEach((d) => setO(d, false));
    r.p5s.forEach((d) => setO(d, false));
  }

  /** 带写入：x/width/fill 同步到属性与 style（CSS 几何通道可过渡），新链跨宽用 width 过渡 */
  function setBand(e: SVGRectElement, x: number, w: number, color: string): void {
    e.setAttribute("x", String(x));
    e.setAttribute("width", String(w));
    e.style.setProperty("x", `${x}px`);
    e.style.width = `${w}px`;
    e.setAttribute("fill", color);
  }

  /** 单条链带写入：original=灰全长 224..616（橙段隐藏）；synth=蓝段 + 橙段 5′ 端 */
  function setStrandBand(band: SVGRectElement, cap: SVGRectElement, s: StrandSpec, y: number): void {
    if (s.kind === "original") {
      setBand(band, BAND_X, BAND_W, GRAY);
      setO(cap, false);
    } else {
      const [bf, bt] = s.blue!;
      setBand(band, bf, bt - bf, BLUE);
      setBand(cap, capXOf(s), PRIMER_W, ORANGE);
      setO(cap, true);
    }
    band.style.transform = `translateY(${y}px)`;
    cap.style.transform = `translateY(${y}px)`;
    setO(band, true);
  }

  /** 5′/3′ 方向标注（随链真实朝向与链端几何）：五=左端坐标、三=右端坐标决定文本与位置 */
  function setDirEnds(dirL: SVGTextElement, dirR: SVGTextElement, five: number, three: number, y: number): void {
    const left = Math.min(five, three);
    const right = Math.max(five, three);
    dirL.textContent = five === left ? "5′" : "3′";
    dirR.textContent = five === left ? "3′" : "5′";
    dirL.setAttribute("x", String(left + 11));
    dirR.setAttribute("x", String(right - 11));
    dirL.style.transform = `translateY(${y}px)`;
    dirR.style.transform = `translateY(${y}px)`;
    setO(dirL, true);
    setO(dirR, true);
  }

  function layoutRow(r: RowEls, cfg: RowCfg, p: number, targetOn: boolean): void {
    rowOff(r);

    switch (cfg.tag) {
      case "pair": {
        // s0：两条母链（灰A 5′ 左 / 灰B 5′ 右）±8 贴拢，无引物无新链
        setStrandBand(r.bandT, r.bandTp, A_SPEC, -EX_OFF);
        setStrandBand(r.bandB, r.bandBp, B_SPEC, EX_OFF);
        setDirEnds(r.dirs[0], r.dirs[1], fiveOf(A_SPEC), threeOf(A_SPEC), -EX_OFF);
        setDirEnds(r.dirs[2], r.dirs[3], fiveOf(B_SPEC), threeOf(B_SPEC), EX_OFF);
        break;
      }
      case "lane": {
        // 泳道：双链两条（都是父链/模板）±45 原位纯垂直位移分开；退火贴各链 3′ 端下方 1 支引物
        setStrandBand(r.bandT, r.bandTp, cfg.up, -SS_OFF);
        setStrandBand(r.bandB, r.bandBp, cfg.down, SS_OFF);
        setDirEnds(r.dirs[0], r.dirs[1], fiveOf(cfg.up), threeOf(cfg.up), -SS_OFF);
        setDirEnds(r.dirs[2], r.dirs[3], fiveOf(cfg.down), threeOf(cfg.down), SS_OFF);
        if (cfg.anneal) {
          const upP = primerOf(cfg.up);
          const dnP = primerOf(cfg.down);
          const upEl = upP === "L" ? r.primerL : r.primerR;
          const dnEl = dnP === "L" ? r.primerL : r.primerR;
          setO(upEl, true);
          upEl.style.transform = `translateY(${-SS_OFF + PRIMER_OFF}px)`;
          setO(dnEl, true);
          dnEl.style.transform = `translateY(${SS_OFF + PRIMER_OFF}px)`;
          // 引物 5′ 标注（反平行：贴各自 5′ 端）——仅退火泳道展示
          const up5 = upP === "L" ? r.p5s[0] : r.p5s[1];
          const dn5 = dnP === "L" ? r.p5s[0] : r.p5s[1];
          setO(up5, true);
          up5.style.transform = `translateY(${-SS_OFF + PRIMER_OFF}px)`;
          setO(dn5, true);
          dn5.style.transform = `translateY(${SS_OFF + PRIMER_OFF}px)`;
        }
        break;
      }
      case "extend": {
        // 延伸：模板恒在 bandT(−8)、新链（橙引物段 + 蓝合成段）恒在下(+18)
        const temp = cfg.temp;
        setStrandBand(r.bandT, r.bandTp, temp, -EX_OFF);
        setDirEnds(r.dirs[0], r.dirs[1], fiveOf(temp), threeOf(temp), -EX_OFF);
        // 本轮引物：5′ 端贴模板 3′ 端（反平行）、3′ 端朝内 = 延伸起点
        const pSide = primerOf(temp);
        const pEl = pSide === "L" ? r.primerL : r.primerR;
        setO(pEl, true);
        pEl.style.transform = `translateY(${CHAIN_OFF}px)`;
        // 合成段：从引物 3′ 端（锚点）向模板 5′ 端配满全长——L 锚 272 右伸、R 锚 568 左伸
        const [sFrom, sTo] = synthSpan(temp);
        const full = sTo - sFrom;
        const w = Math.max(0, Math.round(full * p));
        const x = pSide === "L" ? sFrom : PRIMER_R_X - w;
        setBand(r.newEl, x, w, BLUE);
        r.newEl.style.transform = `translateY(${CHAIN_OFF}px)`;
        setO(r.newEl, true);
        // 新链 5′/3′ 标注（反平行：新链 5′ = 引物 5′ 端、新链 3′ = 模板 5′ 端同侧）
        const nFive = pSide === "L" ? PRIMER_L_X : PRIMER_R_X + PRIMER_W;
        setDirEnds(r.dirs[2], r.dirs[3], nFive, fiveOf(temp), CHAIN_OFF);
        if (cfg.target && targetOn) setO(r.marker, true);
        break;
      }
    }
  }

  function render(state: PcrState): void {
    const s = state as PcrState & { stage?: string; extensionProgress?: number };
    const stageId = String(s.stage ?? "");
    const cfgs = ROW_MAP[stageId] ?? [];
    const ys = ROW_YS[cfgs.length] ?? ROW_YS[1]!;
    const p = Number(s.extensionProgress) || 0;
    const targetOn = stageId === "s9-extend-3" || stageId === "s10-result";
    const activeTemp = TEMP_MAP[stageId] ?? null;

    root.rows.forEach((r, i) => {
      const cfg = cfgs[i];
      if (!cfg) {
        r.g.style.opacity = "0";
        rowOff(r);
        return;
      }
      r.g.style.opacity = "1";
      r.g.style.transform = `translateY(${ys[i] ?? 250}px)`;
      layoutRow(r, cfg, p, targetOn);
    });

    root.temps.forEach((t) => {
      t.style.opacity = t.getAttribute("data-temp") === activeTemp ? "1" : "0.25";
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
    const rowsG = el("g", { class: "pcr-rows" });
    for (let i = 0; i < 8; i++) {
      const row = makeRow();
      root.rows.push(row);
      rowsG.appendChild(row.g);
    }
    svg.appendChild(rowsG);
    for (const t of ["95", "55", "72"] as const) {
      const tab = makeTempTab(t);
      root.temps.push(tab);
      svg.appendChild(tab);
    }

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
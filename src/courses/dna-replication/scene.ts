import type { SceneComponent } from "../../core/types";
import { SEQ_BOT, SEQ_TOP } from "./data";

// ============ 画布几何 ============
const NS = "http://www.w3.org/2000/svg";
const VB_W = 800, VB_H = 400;
const X0 = 180, STEP = 40;          // 12 个碱基位：x = 180 + i×40（180~620）
const Y_TOP = 150, Y_BOT = 250;     // 双链带基础纵坐标
const BAND_H = 24;                  // 链带高度
const X_ANGLE = 11;                 // 复制态 X 形张角（度）——本场景未用，预留
const PAIR_GAP = 13;                // 并排染色体/单体对的半间距
const POLE_X = Math.round(76 * 0.7);
const POLE_Y = Math.round(76 * 0.5);
const SPLIT_H = 61;
const SPREAD = Math.round(76 * 0.75);
// 螺旋视图（方案 B）参数
const HELIX_AMP = 45;               // 螺旋振幅
const HELIX_PHASE = 1.05;           // 每碱基位相位步进（弧度）
const SEP_TOP = 110, SEP_BOT = 290; // 解旋后两链分离纵坐标
const ORIGIN_X = 400;               // 复制起点（画布中心）
// 子链条带基础纵坐标（y 属性恒为此值；终态收拢位移经 style.transform 施加，属性不动以保既有断言）
const STRIP_TOP_BASE = 82, STRIP_BOT_BASE = 304;
// 子链顶行归属：显式声明集合——不可用键名后缀猜测（r1/r2 等数字结尾键会被误判到底行）
const TOP_ROW = new Set(["da-lt", "da-r1", "da-r2", "da-r3"]);

// ============ 阶段几何状态（声明式状态表） ============
interface DnaGeom {
  topY: number;
  botY: number;
  hbond: boolean[];                  // 12 个氢键是否可见（false = 已解旋）
  helicase: [number, number] | null; // 解旋酶位置（左右叉）
  markers?: boolean;                 // 引物切除阶段：缺口虚线标记
  pairTicks?: boolean;               // 终态：母链-新链配对刻度 ×24 显隐
  labels?: boolean;                  // 终态：「母链/新链」成分标注显隐
  stripTopY?: number;                // 终态上行子链条带目标 y（缺省回退 STRIP_TOP_BASE）
  stripBotY?: number;                // 终态下行子链条带目标 y（缺省回退 STRIP_BOT_BASE）
  bars: Record<string, ElBar>;
  enzymes: Record<string, { x: number; y: number; o: number }>;
}
interface ElBar { x: number; w: number; o: number }
const HIDE = (o: number): ElBar => ({ x: 0, w: o, o: 0 });
const ALL_TRUE = Array.from({ length: 12 }, () => true);
const ALL_OPEN = Array.from({ length: 12 }, () => false);
const NO_BARS: Record<string, ElBar> = {
  "da-rb": HIDE(0), "da-r1": HIDE(0), "da-r2": HIDE(0), "da-r3": HIDE(0),
  "da-lt": HIDE(0), "da-l1": HIDE(0), "da-l2": HIDE(0), "da-l3": HIDE(0),
};
const NO_ENZ: Record<string, { x: number; y: number; o: number }> = {
  primase: { x: 0, y: 0, o: 0 }, "pol-lead": { x: 0, y: 0, o: 0 },
  "pol-lag1": { x: 0, y: 0, o: 0 }, "pol-lag2": { x: 0, y: 0, o: 0 }, "pol-lag3": { x: 0, y: 0, o: 0 },
  "primase-L": { x: 0, y: 0, o: 0 }, "pol-lead-L": { x: 0, y: 0, o: 0 },
  "pol-lag-L1": { x: 0, y: 0, o: 0 }, "pol-lag-L2": { x: 0, y: 0, o: 0 }, "pol-lag-L3": { x: 0, y: 0, o: 0 },
  ligase: { x: 0, y: 0, o: 0 }, "ligase-L": { x: 0, y: 0, o: 0 },
};

/** 逐阶段几何状态表；未实现阶段回退到解旋态占位 */
const GEOM: Record<string, DnaGeom> = {
  helix: {
    topY: Y_TOP, botY: Y_BOT, hbond: [...ALL_TRUE], helicase: null,
    bars: { ...NO_BARS }, enzymes: { ...NO_ENZ },
  },
  unwind: {
    topY: 110, botY: 290,
    hbond: [true, true, true, false, false, false, false, false, false, true, true, true],
    helicase: [290, 530],
    bars: { ...NO_BARS }, enzymes: { ...NO_ENZ },
  },
  priming: {
    topY: 110, botY: 290, hbond: [...ALL_OPEN], helicase: [290, 530],
    // 引物以文字叙述承载，画面仅出现引物酶图标（引物红条已移除）
    bars: { ...NO_BARS },
    // 引物酶分置两叉旁，避开解旋酶（r18+20 需圆心距 >38）
    enzymes: { ...NO_ENZ, primase: { x: 575, y: 170, o: 1 }, "primase-L": { x: 230, y: 170, o: 1 } },
  },
  leading: {
    topY: 110, botY: 290, hbond: [...ALL_OPEN], helicase: [190, 610],
    // 前导链自起点（400）向两叉生长（左 190~372、右 430~610）；
    // 后随链已起始 r3（404~454）与 r2（480~530）——r1 最近叉口、此帧未起始
    bars: {
      ...NO_BARS,
      "pr-rb": { x: 400, w: 28, o: 1 }, "pr-lt": { x: 374, w: 24, o: 1 },
      "da-rb": { x: 430, w: 180, o: 1 }, "da-lt": { x: 190, w: 182, o: 1 },
      "da-r3": { x: 404, w: 50, o: 1 }, "da-r2": { x: 480, w: 50, o: 1 },
    },
    enzymes: {
      ...NO_ENZ,
      "pol-lead": { x: 620, y: 255, o: 1 }, "pol-lag1": { x: 515, y: 150, o: 1 },
      "pol-lead-L": { x: 230, y: 48, o: 1 }, "pol-lag-L1": { x: 300, y: 336, o: 1 },
    },
  },
  lagging: {
    topY: 110, botY: 290, hbond: [...ALL_OPEN], helicase: [170, 630],
    // 半区归属（起点=400）：上链 = 左半前导（170~372）+ 右半冈崎 ×3（404/480/556）；
    // 下链 = 左半冈崎 ×3（180/252/324）+ 右半前导（430~630）。每条链半绿半橙
    bars: {
      ...NO_BARS,
      "pr-rb": { x: 400, w: 28, o: 1 }, "pr-lt": { x: 374, w: 24, o: 1 },
      "pr-rt": { x: 608, w: 22, o: 1 }, "pr-r2": { x: 532, w: 22, o: 1 }, "pr-r3": { x: 456, w: 22, o: 1 },
      "pr-lb": { x: 228, w: 22, o: 1 }, "pr-l2": { x: 300, w: 22, o: 1 }, "pr-l3": { x: 372, w: 22, o: 1 },
      "da-rb": { x: 430, w: 200, o: 1 }, "da-lt": { x: 170, w: 202, o: 1 },
      "da-r1": { x: 556, w: 50, o: 1 }, "da-r2": { x: 480, w: 50, o: 1 }, "da-r3": { x: 404, w: 50, o: 1 },
      "da-l1": { x: 180, w: 46, o: 1 }, "da-l2": { x: 252, w: 46, o: 1 }, "da-l3": { x: 324, w: 46, o: 1 },
    },
    enzymes: {
      ...NO_ENZ,
      "pol-lead": { x: 635, y: 255, o: 1 }, "pol-lag1": { x: 515, y: 150, o: 1 }, "pol-lag2": { x: 435, y: 150, o: 1 }, "pol-lag3": { x: 581, y: 150, o: 1 },
      "pol-lead-L": { x: 220, y: 48, o: 1 }, "pol-lag-L1": { x: 205, y: 336, o: 1 }, "pol-lag-L2": { x: 277, y: 336, o: 1 }, "pol-lag-L3": { x: 349, y: 336, o: 1 },
    },
  },
  removal: {
    // 引物切除：引物不可见（已从元素模型移除），以缺口虚线标记标示切除位置；片段位置不变
    topY: 110, botY: 290, hbond: [...ALL_OPEN], helicase: [170, 630], markers: true,
    bars: {
      ...NO_BARS,
      "da-rb": { x: 430, w: 200, o: 1 }, "da-lt": { x: 170, w: 202, o: 1 },
      "da-r1": { x: 556, w: 50, o: 1 }, "da-r2": { x: 480, w: 50, o: 1 }, "da-r3": { x: 404, w: 50, o: 1 },
      "da-l1": { x: 180, w: 46, o: 1 }, "da-l2": { x: 252, w: 46, o: 1 }, "da-l3": { x: 324, w: 46, o: 1 },
    },
    enzymes: {
      ...NO_ENZ,
      "pol-lead": { x: 635, y: 255, o: 1 }, "pol-lag1": { x: 515, y: 150, o: 1 }, "pol-lag2": { x: 435, y: 150, o: 1 },
      "pol-lead-L": { x: 170, y: 45, o: 1 }, "pol-lag-L1": { x: 205, y: 345, o: 1 }, "pol-lag-L2": { x: 277, y: 345, o: 1 }, "pol-lag-L3": { x: 349, y: 345, o: 1 },
    },
  },
  filling: {
    // 缺口填补：相邻带延伸封闭缺口；前导引物缺口以绿色填补（延伸至起点 400）
    topY: 110, botY: 290, hbond: [...ALL_OPEN], helicase: [170, 630],
    bars: {
      ...NO_BARS,
      "da-rb": { x: 400, w: 230, o: 1 }, "da-lt": { x: 170, w: 230, o: 1 },
      "da-r1": { x: 530, w: 76, o: 1 }, "da-r2": { x: 454, w: 76, o: 1 }, "da-r3": { x: 404, w: 50, o: 1 },
      "da-l1": { x: 180, w: 72, o: 1 }, "da-l2": { x: 252, w: 72, o: 1 }, "da-l3": { x: 324, w: 72, o: 1 },
    },
    enzymes: {
      ...NO_ENZ,
      "pol-lead": { x: 615, y: 255, o: 1 }, "pol-lag1": { x: 492, y: 150, o: 1 }, "pol-lag2": { x: 429, y: 150, o: 1 },
      "pol-lead-L": { x: 185, y: 45, o: 1 }, "pol-lag-L1": { x: 216, y: 345, o: 1 }, "pol-lag-L2": { x: 288, y: 345, o: 1 }, "pol-lag-L3": { x: 360, y: 345, o: 1 },
    },
  },
  ligation: {
    // 连接：三段合拢为连续链（404|480|556|630 与 180|256|332|400），双连接酶封合两行接缝
    topY: 110, botY: 290, hbond: [...ALL_OPEN], helicase: [170, 630],
    bars: {
      ...NO_BARS,
      "da-rb": { x: 400, w: 230, o: 1 }, "da-lt": { x: 170, w: 230, o: 1 },
      "da-r1": { x: 556, w: 74, o: 1 }, "da-r2": { x: 480, w: 76, o: 1 }, "da-r3": { x: 404, w: 76, o: 1 },
      "da-l1": { x: 180, w: 76, o: 1 }, "da-l2": { x: 256, w: 76, o: 1 }, "da-l3": { x: 332, w: 68, o: 1 },
    },
    enzymes: { ...NO_ENZ, ligase: { x: 480, y: 89, o: 1 }, "ligase-L": { x: 332, y: 336, o: 1 } },
  },
  done: {
    // 完成：两对「母链带+新链条」各自贴紧成双链体、彼此远离——接近性分组直观呈现半保留。
    // 几何核算：上带缘 76~100、上新链条 56~70（组内净距 6）；下带缘 286~310、下新链条 316~330（净距 6）；
    // 两分子净空 = 286 − 100 = 186px（断言下限 100）。组内净距内浮现配对刻度，成分由「母链/新链」标注说破。
    topY: 88, botY: 298,
    hbond: [...ALL_OPEN], helicase: null,
    pairTicks: true, labels: true,
    stripTopY: 56, stripBotY: 316,
    bars: {
      ...NO_BARS,
      "da-rb": { x: 400, w: 230, o: 1 }, "da-lt": { x: 170, w: 230, o: 1 },
      "da-r1": { x: 556, w: 74, o: 1 }, "da-r2": { x: 480, w: 76, o: 1 }, "da-r3": { x: 404, w: 76, o: 1 },
      "da-l1": { x: 180, w: 76, o: 1 }, "da-l2": { x: 256, w: 76, o: 1 }, "da-l3": { x: 332, w: 68, o: 1 },
    },
    enzymes: { ...NO_ENZ },
  },
};
const FALLBACK = GEOM.unwind;

// ============ 工具 ============
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

// ============ 场景组件 ============
export function createDnaReplicationScene(): SceneComponent & { destroy(): void } {
  let root: SVGSVGElement | null = null;
  let wrap: HTMLDivElement | null = null;
  let bandTop: SVGGElement;
  let bandBot: SVGGElement;
  let helicaseGroup: SVGGElement;
  let flatLayer: SVGGElement;
  let helixLayer: SVGGElement;
  let extBadge: HTMLDivElement;
  let bubble: HTMLDivElement;
  const hbonds: SVGLineElement[] = [];
  const daughters = new Map<string, SVGRectElement>();
  const enzymes = new Map<string, SVGGElement>();
  const gapMarkers: SVGRectElement[] = [];
  const pairTicks: SVGLineElement[] = [];   // 终态配对刻度（索引 i=上双链体、12+i=下双链体）
  const duplexLabels: SVGTextElement[] = []; // 终态「母链/新链」成分标注
  // 双视图：flat（方案 A 过程细节）/ helix（方案 B 分子结构概览）
  const helixStrands: SVGPathElement[] = [];
  const helixRungs: SVGLineElement[] = [];
  const helixTopLetters: SVGTextElement[] = [];
  const helixBotLetters: SVGTextElement[] = [];
  let view: "flat" | "helix" = "flat";
  const EXT_STAGES = new Set(["priming", "lagging", "removal"]);
  let comboAlt = false;
  let showGenes = false;
  let lastState: Record<string, unknown> | null = null;

  /** 视图切换：平面层/螺旋层 opacity 互斥淡入淡出（display 不可过渡，故走 opacity 通道） */
  function setView(): void {
    const flat = view === "flat";
    flatLayer.style.opacity = flat ? "1" : "0";
    helixLayer.style.opacity = flat ? "0" : "1";
    flatLayer.style.pointerEvents = flat ? "auto" : "none";
    helixLayer.style.pointerEvents = flat ? "none" : "auto";
  }

  /** 方案 B：参数化双螺旋（解旋进度由氢键状态驱动，中段先解旋） */
  function renderHelix(geom: DnaGeom): void {
    const wAt = (u: number): number => {
      const i0 = Math.max(0, Math.min(11, Math.floor(u)));
      const i1 = Math.min(11, i0 + 1);
      const f = u - i0;
      const w0 = geom.hbond[i0] ? 0 : 1;
      const w1 = geom.hbond[i1] ? 0 : 1;
      return w0 * (1 - f) + w1 * f;
    };
    const yTopAt = (u: number): number =>
      (200 + HELIX_AMP * Math.sin(u * HELIX_PHASE)) * (1 - wAt(u)) + SEP_TOP * wAt(u);
    const yBotAt = (u: number): number =>
      (200 - HELIX_AMP * Math.sin(u * HELIX_PHASE)) * (1 - wAt(u)) + SEP_BOT * wAt(u);
    const topPts: string[] = [];
    const botPts: string[] = [];
    for (let u = -0.5; u <= 11.5; u += 0.2) {
      const x = (X0 + u * STEP).toFixed(1);
      topPts.push(`${x},${yTopAt(u).toFixed(1)}`);
      botPts.push(`${x},${yBotAt(u).toFixed(1)}`);
    }
    helixStrands[0].setAttribute("d", `M ${topPts.join(" L ")}`);
    helixStrands[1].setAttribute("d", `M ${botPts.join(" L ")}`);
    SEQ_TOP.forEach((_, i) => {
      const x = X0 + i * STEP;
      const rung = helixRungs[i];
      rung.setAttribute("y1", yTopAt(i).toFixed(1));
      rung.setAttribute("y2", yBotAt(i).toFixed(1));
      rung.style.opacity = geom.hbond[i] ? "1" : "0";
      helixTopLetters[i].setAttribute("y", (yTopAt(i) + 5).toFixed(1));
      helixBotLetters[i].setAttribute("y", (yBotAt(i) + 5).toFixed(1));
    });
  }

  function layout(s: Record<string, unknown>): void {
    if (!root) return;
    const geom = GEOM[String(s.stage)] ?? FALLBACK;
    // 链带分离：上下平移
    bandTop.style.transform = `translate(0px, ${geom.topY - Y_TOP}px)`;
    bandBot.style.transform = `translate(0px, ${geom.botY - Y_BOT}px)`;
    // 氢键：固定基础几何位置，纵向偏移走 translateY（可被 CSS transition 补间），断开则淡出
    hbonds.forEach((line, i) => {
      const dy = geom.topY - Y_TOP;
      line.style.transform = `translateY(${dy}px)`;
      line.style.opacity = geom.hbond[i] ? "1" : "0";
    });
    // 子链带：查表设位置/宽度/透明度（w=0 即不可见）；终态竖移走 transform 通道（y 属性保持基础值，可插值）
    daughters.forEach((rect, key) => {
      const st = geom.bars[key] ?? HIDE(0);
      rect.setAttribute("x", String(st.x));
      rect.setAttribute("width", String(st.w));
      rect.style.opacity = String(st.o);
      const base = TOP_ROW.has(key) ? STRIP_TOP_BASE : STRIP_BOT_BASE;
      const target = TOP_ROW.has(key) ? (geom.stripTopY ?? base) : (geom.stripBotY ?? base);
      rect.style.transform = `translate(0px, ${target - base}px)`;
    });
    // 终态配对刻度与成分标注：仅 done 阶段经布尔通道显示（同 markers 通道模式）
    pairTicks.forEach((t) => { t.style.opacity = geom.pairTicks ? "1" : "0"; });
    duplexLabels.forEach((t) => { t.style.opacity = geom.labels ? "1" : "0"; });
    // 酶：查表设位置/透明度（style.transform 走 CSS transition 通道）
    enzymes.forEach((g, key) => {
      const st = geom.enzymes[key] ?? NO_ENZ[key] ?? { x: 0, y: 0, o: 0 };
      g.style.transform = `translate(${st.x}px, ${st.y}px)`;
      g.style.opacity = String(st.o);
    });
    // 缺口虚线标记：仅引物切除阶段显示
    gapMarkers.forEach((m) => {
      m.style.opacity = geom.markers ? "1" : "0";
    });
    // 解旋酶：显示于两叉位置（style.transform 走 CSS transition 通道）
    helicaseGroup.style.opacity = geom.helicase ? "1" : "0";
    if (geom.helicase) {
      const [hx1, hx2] = geom.helicase;
      const icons = helicaseGroup.querySelectorAll<SVGGElement>(".helicase-icon");
      icons[0].style.transform = `translate(${hx1}px, 200px)`;
      icons[1].style.transform = `translate(${hx2}px, 200px)`;
    }
    // 拓展角标 + 螺旋视图渲染（方案 B）
    extBadge.style.display = EXT_STAGES.has(String(s.stage)) ? "block" : "none";
    if (view === "helix") renderHelix(geom);
  }

  return {
    /** 挂载：创建固定元素池（双图层 + 全部部件）。可重入：先清空闭包数组防止跨挂载累积 */
    mount(container: HTMLElement) {
      hbonds.length = 0;
      pairTicks.length = 0;
      duplexLabels.length = 0;
      wrap = document.createElement("div");
      wrap.className = "dna-scene";
      const svgRoot = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}`, width: "100%" });
      root = svgRoot;
      // 双图层：flat（方案 A 过程细节）/ helix（方案 B 分子结构概览），互斥显示
      flatLayer = el("g", { class: "flat-layer" });
      helixLayer = el("g", { class: "helix-layer" });
      svgRoot.append(flatLayer, helixLayer);
      wrap.appendChild(svgRoot);
      // 螺旋层：两条链曲线 + 横档 + 碱基字母（renderHelix 逐帧更新形状）
      const strandTop = el("path", { class: "helix-strand", fill: "none", stroke: "#64748b", "stroke-width": 8, "stroke-linecap": "round" });
      const strandBot = el("path", { class: "helix-strand", fill: "none", stroke: "#94a3b8", "stroke-width": 8, "stroke-linecap": "round" });
      helixStrands.length = 0;
      helixStrands.push(strandTop, strandBot);
      helixLayer.append(strandTop, strandBot);
      helixRungs.length = 0;
      helixTopLetters.length = 0;
      helixBotLetters.length = 0;
      SEQ_TOP.forEach((base, i) => {
        const rung = el("line", { class: "helix-rung", x1: X0 + i * STEP, y1: 200, x2: X0 + i * STEP, y2: 200, stroke: "#94a3b8", "stroke-width": 3 });
        helixRungs.push(rung);
        helixLayer.appendChild(rung);
      });
      SEQ_TOP.forEach((base, i) => {
        const t = el("text", { class: "helix-base-top", x: X0 + i * STEP, y: 200, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#ffffff" });
        t.textContent = base;
        helixTopLetters.push(t);
        helixLayer.appendChild(t);
      });
      SEQ_BOT.forEach((base, i) => {
        const t = el("text", { class: "helix-base-bot", x: X0 + i * STEP, y: 200, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#ffffff" });
        t.textContent = base;
        helixBotLetters.push(t);
        helixLayer.appendChild(t);
      });
      // 拓展角标：超纲知识点帧（引物/冈崎/切除）显示
      extBadge = document.createElement("div");
      extBadge.className = "ext-badge";
      extBadge.textContent = "拓展知识点";
      wrap.appendChild(extBadge);

      // —— 上链带（含碱基字母与 5′/3′ 端标注） ——
      bandTop = el("g", { class: "band-top" });
      bandTop.appendChild(el("rect", { x: X0 - 30, y: Y_TOP - BAND_H / 2, width: 11 * STEP + 60, height: BAND_H, rx: 8, fill: "#64748b" }));
      SEQ_TOP.forEach((base, i) => {
        const t = el("text", { x: X0 + i * STEP, y: Y_TOP + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#ffffff" });
        t.textContent = base;
        bandTop.appendChild(t);
      });
      const tl = el("text", { x: X0 - 42, y: Y_TOP + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#334155" });
      tl.textContent = "5′";
      const tr = el("text", { x: X0 + 11 * STEP + 42, y: Y_TOP + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#334155" });
      tr.textContent = "3′";
      bandTop.append(tl, tr);

      // —— 下链带 ——
      bandBot = el("g", { class: "band-bot" });
      bandBot.appendChild(el("rect", { x: X0 - 30, y: Y_BOT - BAND_H / 2, width: 11 * STEP + 60, height: BAND_H, rx: 8, fill: "#64748b" }));
      SEQ_BOT.forEach((base, i) => {
        const t = el("text", { x: X0 + i * STEP, y: Y_BOT + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#ffffff" });
        t.textContent = base;
        bandBot.appendChild(t);
      });
      const bl = el("text", { x: X0 - 42, y: Y_BOT + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#334155" });
      bl.textContent = "3′";
      const br = el("text", { x: X0 + 11 * STEP + 42, y: Y_BOT + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#334155" });
      br.textContent = "5′";
      bandBot.append(bl, br);
      flatLayer.append(bandTop, bandBot);

      // —— 氢键横杆（A-T 细 / C-G 粗，对应氢键数差异） ——
      SEQ_TOP.forEach((top, i) => {
        const pairAT = (top === "A" && SEQ_BOT[i] === "T") || (top === "T" && SEQ_BOT[i] === "A");
        const line = el("line", {
          class: "hbond",
          x1: X0 + i * STEP, y1: Y_TOP + BAND_H / 2,
          x2: X0 + i * STEP, y2: Y_BOT - BAND_H / 2,
          stroke: "#94a3b8", "stroke-width": pairAT ? 2 : 3.5,
        });
        hbonds.push(line);
        flatLayer.appendChild(line);
      });

      // —— 解旋酶 ×2（默认隐藏；显隐经 style.opacity，测试/布局同通道）——
      // 每个图标带移动方向箭头（左叉←、右叉→）：双向复制的可视化关键
      helicaseGroup = el("g", { class: "helicase-group", opacity: 0 });
      [0, 1].forEach((idx) => {
        const icon = el("g", { class: "helicase-icon" });
        icon.appendChild(el("circle", { r: 18, fill: "#f59e0b", stroke: "#b45309", "stroke-width": 2 }));
        const t = el("text", { y: 5, "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#ffffff" });
        t.textContent = "解旋酶";
        icon.appendChild(t);
        const arrow = el("text", { class: "helicase-arrow", x: idx === 0 ? -36 : 36, y: 5, "text-anchor": "middle", "font-size": 22, "font-weight": "bold", fill: "#b45309" });
        arrow.textContent = idx === 0 ? "←" : "→";
        icon.appendChild(arrow);
        helicaseGroup.appendChild(icon);
      });
      flatLayer.appendChild(helicaseGroup);

      // —— 缺口虚线标记 ×4（引物切除阶段的注释层；默认隐藏） ——
      const MARKER_POS: [number, number, number][] = [
        [452, 78, 32], [528, 78, 32],     // 顶行缺口（右叉冈崎片段之间）
        [226, 300, 28], [298, 300, 28],   // 底行缺口（左叉冈崎片段之间）
      ];
      MARKER_POS.forEach(([x, y, w]) => {
        const m = el("rect", { class: "gap-marker", x, y, width: w, height: 22, fill: "none", stroke: "#ef4444", "stroke-width": 1.5, "stroke-dasharray": "4 3", opacity: 0 });
        gapMarkers.push(m);
        flatLayer.appendChild(m);
      });

      // —— 子链带 ×8：前导链绿色（连续合成）、冈崎片段橙色（分段合成·拓展）；默认宽度 0 ——
      const LAGGING = new Set(["da-r1", "da-r2", "da-r3", "da-l1", "da-l2", "da-l3"]);
      const DAUGHTER_KEYS = ["da-rb", "da-r1", "da-r2", "da-r3", "da-lt", "da-l1", "da-l2", "da-l3"];
      DAUGHTER_KEYS.forEach((key) => {
        const isLag = LAGGING.has(key);
        const r = el("rect", {
          class: `daughter daughter-${key}`, height: 14, rx: 4,
          fill: isLag ? "#f59e0b" : "#10b981",
          stroke: isLag ? "#b45309" : "#059669",
          "stroke-width": 1, y: 0, x: 0, width: 0,
        });
        daughters.set(key, r);
        flatLayer.appendChild(r);
      });

      // —— 酶图标：双叉对称全套（引物酶×2 / 聚合酶×6 / 连接酶×2） ——
      const ENZ_DEFS: [string, string, string][] = [
        ["primase", "引物酶", "#8b5cf6"],
        ["pol-lead", "聚合酶", "#14b8a6"],
        ["pol-lag1", "聚合酶", "#14b8a6"],
        ["pol-lag2", "聚合酶", "#14b8a6"],
        ["pol-lag3", "聚合酶", "#14b8a6"],
        ["primase-L", "引物酶", "#8b5cf6"],
        ["pol-lead-L", "聚合酶", "#14b8a6"],
        ["pol-lag-L1", "聚合酶", "#14b8a6"],
        ["pol-lag-L2", "聚合酶", "#14b8a6"],
        ["pol-lag-L3", "聚合酶", "#14b8a6"],
        ["ligase", "连接酶", "#f97316"],
        ["ligase-L", "连接酶", "#f97316"],
      ];
      ENZ_DEFS.forEach(([key, name, color]) => {
        const icon = el("g", { class: `enzyme enzyme-${key}`, opacity: 0 });
        icon.appendChild(el("circle", { r: 20, fill: color, stroke: "#1f2937", "stroke-width": 1.5 }));
        const t = el("text", { y: 5, "text-anchor": "middle", "font-size": 11, "font-weight": "bold", fill: "#ffffff" });
        t.textContent = name;
        icon.appendChild(t);
        enzymes.set(key, icon);
        flatLayer.appendChild(icon);
      });

      // 子链带的纵向位置：行归属见模块级 TOP_ROW（显式声明防误判）；y 属性恒为基础值，终态位移走 transform
      daughters.forEach((r, key) => {
        r.setAttribute("y", TOP_ROW.has(key) ? String(STRIP_TOP_BASE) : String(STRIP_BOT_BASE));
      });
      // 图例由 app.ts 渲染为 HTML 覆盖层，不在 SVG 内绘制

      // —— 终态配对刻度 ×24：done 阶段在母链与新链 6px 净距内浮现的短横线，粗细沿用氢键语义 ——
      // 分组布局（两趟循环保证索引稳定）：索引 i=上双链体（新链条底 70 → 带顶 76）、索引 12+i=下双链体（带底 310 → 新链条顶 316）
      const mkTick = (i: number, y1: number, y2: number, pairAT: boolean): void => {
        const tick = el("line", {
          class: "pair-tick", x1: X0 + i * STEP, y1, x2: X0 + i * STEP, y2,
          stroke: "#94a3b8", "stroke-width": pairAT ? 2 : 3.5, opacity: 0,
        });
        pairTicks.push(tick);
        flatLayer.appendChild(tick);
      };
      SEQ_TOP.forEach((top, i) => {
        const pairAT = (top === "A" && SEQ_BOT[i] === "T") || (top === "T" && SEQ_BOT[i] === "A");
        mkTick(i, 70, 76, pairAT);
      });
      SEQ_TOP.forEach((top, i) => {
        const pairAT = (top === "A" && SEQ_BOT[i] === "T") || (top === "T" && SEQ_BOT[i] === "A");
        mkTick(i, 310, 316, pairAT);
      });

      // —— 终态成分标注 ×4：「母链/新链」小字标（x=92 左缘区，避开带体与 5′/3′ 端标）——
      const LABEL_DEFS: [string, number][] = [
        ["新链", 67],   // 上双链体新链条中心 y≈63
        ["母链", 92],   // 上双链体母链带中心 y=88
        ["母链", 302],  // 下双链体母链带中心 y=298
        ["新链", 327],  // 下双链体新链条中心 y≈323
      ];
      LABEL_DEFS.forEach(([txt, ly]) => {
        const t = el("text", {
          class: "duplex-label", x: 92, y: ly, "text-anchor": "middle",
          "font-size": 12, fill: "#334155", opacity: 0,
        });
        t.textContent = txt;
        duplexLabels.push(t);
        flatLayer.appendChild(t);
      });

      // —— 控制栏：DNA 专属控件（碱基字母开关 + 视图切换）——
      // 不复用减数分裂控制栏模板（自由组合/模式切换为减数分裂专属）
      const bar = document.createElement("div");
      bar.className = "scene-controls";
      const geneToggle = document.createElement("label");
      geneToggle.innerHTML = `<input type="checkbox" /> 显示碱基字母`;
      geneToggle.querySelector("input")!.addEventListener("change", (e) => {
        showGenes = (e.target as HTMLInputElement).checked;
        if (lastState) layout(lastState);
      });
      // 视图切换：平面（过程细节）⟷ 螺旋（分子结构概览）
      const viewBtn = document.createElement("button");
      viewBtn.className = "view-switch";
      viewBtn.textContent = "⟷ 螺旋视图";
      viewBtn.addEventListener("click", () => {
        view = view === "flat" ? "helix" : "flat";
        viewBtn.textContent = view === "helix" ? "⟷ 平面视图" : "⟷ 螺旋视图";
        setView();
        if (lastState) layout(lastState);
      });
      bar.append(geneToggle, viewBtn);
      wrap.appendChild(bar);

      // 气泡（预留：点击元素显示讲解）
      bubble = document.createElement("div");
      bubble.className = "chromo-bubble";
      bubble.style.display = "none";
      wrap.append(bubble);
      setView();   // 初始显隐统一经 style 通道（螺旋层初始隐藏）
      container.appendChild(wrap);
    },

    /** 渲染指定状态 */
    render(state: Record<string, unknown>) {
      lastState = state;
      layout(state);
    },

    /** 销毁 */
    destroy() {
      wrap?.remove();
    },

    legend: [
      { color: "#10b981", label: "前导链——连续合成" },
      { color: "#f59e0b", label: "冈崎片段——分段合成（拓展）" },
      { color: "#64748b", label: "灰色长带——亲代母链" },
    ],
  };
}

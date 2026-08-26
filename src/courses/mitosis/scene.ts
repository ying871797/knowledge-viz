import type { SceneComponent } from "../../core/types";

// ============ 画布几何 ============
const NS = "http://www.w3.org/2000/svg";
const VB_W = 800, VB_H = 400;
const X_ANGLE = 11;                 // 复制态 X 形张角（度）
const PAIR_GAP = 13;                // 并排半间距
const CELL = { x: 200, y: 40, w: 400, h: 320 };  // 植物细胞轮廓（方形圆角·细胞壁）
const PLATE_Y = 200;                // 细胞板/赤道板纵坐标
const POLE_TOP: [number, number] = [400, 60];    // 纺锤体上极
const POLE_BOT: [number, number] = [400, 340];  // 纺锤体下极

// ============ 染色体库存（与减数分裂同构：4 条染色体 × 2 姐妹单体） ============
interface ChromatidSpec {
  key: string;      // "A1a"：染色体 A1 的单体 a
  chrom: string;
  gene: string;
  color: string;
  len: number;
}
const CHROMATIDS: ChromatidSpec[] = [
  { key: "A1a", chrom: "A1", gene: "A", color: "#dc2626", len: 120 },
  { key: "A1b", chrom: "A1", gene: "A", color: "#dc2626", len: 120 },
  { key: "A2a", chrom: "A2", gene: "a", color: "#fca5a5", len: 120 },
  { key: "A2b", chrom: "A2", gene: "a", color: "#fca5a5", len: 120 },
  { key: "B1a", chrom: "B1", gene: "B", color: "#2563eb", len: 70 },
  { key: "B1b", chrom: "B1", gene: "B", color: "#2563eb", len: 70 },
  { key: "B2a", chrom: "B2", gene: "b", color: "#93c5fd", len: 70 },
  { key: "B2b", chrom: "B2", gene: "b", color: "#93c5fd", len: 70 },
];
const CHROM_INFO: Record<string, { gene: string; long: boolean }> = {
  A1: { gene: "A", long: true }, A2: { gene: "a", long: true },
  B1: { gene: "B", long: true }, B2: { gene: "b", long: false },
};

// ============ 槽位：每阶段 → 每单体 {x, y, a}（相对细胞中心 400,200） ============
export interface Slot { x: number; y: number; a: number }
export type Slots = Record<string, Slot>;

/** 复制态（X 形）：姐妹两杆同位反向旋转 */
function xpair(S: Slots, k: string, x: number, y: number): void {
  S[`${k}a`] = { x, y, a: -X_ANGLE };
  S[`${k}b`] = { x, y, a: X_ANGLE };
}
/** 未复制（重叠杆） */
function rod(S: Slots, k: string, x: number, y: number): void {
  S[`${k}a`] = { x, y, a: 0 };
  S[`${k}b`] = { x, y, a: 0 };
}
/** 着丝点已分裂：姐妹两杆分居两点 */
function split(S: Slots, k: string, x1: number, y1: number, x2: number, y2: number): void {
  S[`${k}a`] = { x: x1, y: y1, a: 0 };
  S[`${k}b`] = { x: x2, y: y2, a: 0 };
}

/** 有丝分裂逐阶段槽位表（纯声明数据） */
function mitosisSlots(id: string): Slots {
  const S: Slots = {};
  switch (id) {
    case "interphase": {
      // 间期（复制完成）：四象限 X 形
      xpair(S, "A1", -40, 40);
      xpair(S, "A2", 40, 40);
      xpair(S, "B1", -40, -40);
      xpair(S, "B2", 40, -40);
      break;
    }
    case "prophase": {
      // 前期：X 形散乱分布（不联会——区别于减数分裂）
      xpair(S, "A1", -60, -40);
      xpair(S, "A2", 50, -45);
      xpair(S, "B1", -40, 40);
      xpair(S, "B2", 55, 35);
      break;
    }
    case "metaphase": {
      // 中期：4 个 X 着丝点排列赤道板（横排 y=200，间距 80）
      xpair(S, "A1", -120, 0);
      xpair(S, "A2", -40, 0);
      xpair(S, "B1", 40, 0);
      xpair(S, "B2", 120, 0);
      break;
    }
    case "anaphase": {
      // 后期：着丝点分裂——姐妹单体分赴上下两极（每极 4 条：2 长 2 短）
      split(S, "A1", -120, -75, -120, 75);
      split(S, "A2", -40, -75, -40, 75);
      split(S, "B1", 40, -75, 40, 75);
      split(S, "B2", 120, -75, 120, 75);
      break;
    }
    case "telophase": {
      // 末期：两极染色体团（渐变染色质），核膜重现、细胞板形成
      split(S, "A1", -120, -90, -120, 90);
      split(S, "A2", -40, -90, -40, 90);
      split(S, "B1", 40, -90, 40, 90);
      split(S, "B2", 120, -90, 120, 90);
      break;
    }
    case "daughter": {
      // 子细胞：两个子细胞各 4 条染色体（2n 恢复）
      split(S, "A1", -120, -90, -120, 90);
      split(S, "A2", -40, -90, -40, 90);
      split(S, "B1", 40, -90, 40, 90);
      split(S, "B2", 120, -90, 120, 90);
      break;
    }
  }
  return S;
}

// ============ 背景元素状态（声明式） ============
interface NucEllipse { cx: number; cy: number; rx: number; ry: number; o: number }
interface MitoBg {
  nuc1: NucEllipse;                  // 核膜 1（间期主核 / 末期上核）
  nuc2: NucEllipse;                  // 核膜 2（末期下核）
  plate: number | null;              // 细胞板 y（null 隐藏）
  spindle: [number, number][] | null; // 纺锤丝 ×8：着丝点端坐标（极点端固定）
}
const NUC_HIDDEN: NucEllipse = { cx: 0, cy: 0, rx: 0, ry: 0, o: 0 };
const NO_SPINDLE: [number, number][] | null = null;

/** 逐阶段背景状态表 */
const BG: Record<string, MitoBg> = {
  interphase: {
    // 间期：核膜完整（细胞核内染色质态），无纺锤体
    nuc1: { cx: 400, cy: 200, rx: 130, ry: 100, o: 1 },
    nuc2: { ...NUC_HIDDEN },
    plate: null,
    spindle: NO_SPINDLE,
  },
  prophase: {
    // 前期：核膜消失（两消），纺锤丝出现（两现）
    nuc1: { ...NUC_HIDDEN },
    nuc2: { ...NUC_HIDDEN },
    plate: null,
    // 纺锤丝连两极↔散乱 X 中心
    spindle: [
      [340, 160], [450, 155], [360, 240], [455, 235],
      [340, 160], [450, 155], [360, 240], [455, 235],
    ],
  },
};
const BG_FALLBACK = BG.interphase;

// ============ 工具 ============
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** 气泡文案：有丝分裂语境 */
function describe(s: Record<string, unknown>, chrom: string): string {
  const info = CHROM_INFO[chrom];
  const replicated = String(s.stage) !== "interphase" || true; // 间期帧即复制完成态
  return `${info.long ? "长" : "短"}染色体（${chrom}，基因 ${info.gene}）：` +
    `当前${replicated ? "含 2 条姐妹染色单体" : "无染色单体"}；` +
    `有丝分裂全程存在同源染色体，但不发生联会`;
}

// ============ 场景组件 ============
export function createMitosisScene(): SceneComponent & { destroy(): void } {
  let root: SVGSVGElement | null = null;
  let wrap: HTMLDivElement | null = null;
  let bubble: HTMLDivElement | null = null;
  let comboHint: HTMLDivElement | null = null;
  let showGenes = false;
  let lastState: Record<string, unknown> | null = null;
  const groups = new Map<string, SVGGElement>();
  const spindleLines: SVGLineElement[] = [];
  const nuclearMembranes: SVGEllipseElement[] = [];
  let cellPlate: SVGLineElement | null = null;

  /** 核心：查槽位表 + 背景状态 → 渲染（唯一渲染路径） */
  function layout(s: Record<string, unknown>): void {
    if (!root) return;
    const slots = mitosisSlots(String(s.stage));
    const bg = BG[String(s.stage)] ?? BG_FALLBACK;

    // 背景元素：细胞轮廓（方形·植物壁）+ 核膜 + 细胞板
    root.querySelectorAll(".cell-wall, .nuclear-membrane, .cell-plate").forEach((n) => n.remove());
    root.appendChild(el("rect", { class: "cell-wall", x: CELL.x, y: CELL.y, width: CELL.w, height: CELL.h, rx: 24, fill: "#f8fafc66", stroke: "#94a3b8", "stroke-width": 3 }));
    for (const nuc of [bg.nuc1, bg.nuc2]) {
      if (nuc.o > 0) {
        root.appendChild(el("ellipse", { class: "nuclear-membrane", cx: nuc.cx, cy: nuc.cy, rx: nuc.rx, ry: nuc.ry, fill: "none", stroke: "#94a3b8", "stroke-width": 2, "stroke-dasharray": "6 4", opacity: nuc.o }));
      }
    }
    if (bg.plate !== null) {
      root.appendChild(el("line", { class: "cell-plate", x1: CELL.x + 40, y1: bg.plate, x2: CELL.x + CELL.w - 40, y2: bg.plate, stroke: "#059669", "stroke-width": 4 }));
    }
    // 纺锤丝 ×8：从两极到各染色体着丝点（前期/中期/后期可见）
    if (bg.spindle) {
      bg.spindle.forEach(([tx, ty], i) => {
        const pole = i % 2 === 0 ? POLE_TOP : POLE_BOT;
        root!.appendChild(el("line", { class: "spindle-line", x1: pole[0], y1: pole[1], x2: tx, y2: ty, stroke: "#d4a574", "stroke-width": 1.5 }));
      });
    }

    // 染色体：查槽位设 translate+rotate
    CHROMATIDS.forEach((spec) => {
      const g = groups.get(spec.key)!;
      const slot = slots[spec.key];
      g.style.transform = `translate(${400 + slot.x}px, ${200 + slot.y}px) rotate(${slot.a}deg)`;
      const lbl = g.querySelector("text")!;
      lbl.setAttribute("transform", `rotate(${-slot.a})`);
      lbl.setAttribute("visibility", showGenes ? "visible" : "hidden");
    });
  }

  function hideBubble(): void {
    if (bubble) bubble.style.display = "none";
  }

  return {
    /** 挂载：创建 SVG、8 个单体组、背景元素与交互控件。可重入：清空闭包数组 */
    mount(container: HTMLElement) {
      spindleLines.length = 0;
      nuclearMembranes.length = 0;
      wrap = document.createElement("div");
      wrap.className = "mito-scene";
      const svgRoot = el("svg", { viewBox: `0 0 800 400`, width: "100%" });
      root = svgRoot;

      // 气泡（预留：点击染色体显示讲解）
      bubble = document.createElement("div");
      bubble.className = "chromo-bubble";
      bubble.style.display = "none";
      comboHint = document.createElement("div");
      comboHint.className = "combo-hint";
      comboHint.style.display = "none";
      wrap.append(comboHint, svgRoot, bubble);

      // —— 控制栏：基因标注开关 ——
      const bar = document.createElement("div");
      bar.className = "scene-controls";
      const geneToggle = document.createElement("label");
      geneToggle.innerHTML = `<input type="checkbox" /> 显示基因标注`;
      geneToggle.querySelector("input")!.addEventListener("change", (e) => {
        showGenes = (e.target as HTMLInputElement).checked;
        if (lastState) layout(lastState);
      });
      bar.append(geneToggle);
      wrap.appendChild(bar);

      // 8 个单体组：杆 + 着丝点 + 标注（一次创建，全程复用）
      CHROMATIDS.forEach((spec) => {
        const half = spec.len / 2;
        const g = el("g", { class: `chromatid chromo-${spec.key}`, cursor: "pointer" });
        const rod = el("path", { d: `M 0 ${-half} L 0 ${half}`, fill: "none", stroke: spec.color, "stroke-width": 10, "stroke-linecap": "round" });
        const centro = el("circle", { class: "centro", r: 5, fill: "#111827" });
        const label = el("text", {
          class: "gene-label",
          x: 0, y: Math.round(-spec.len / 4) + 4,
          "text-anchor": "middle", "font-size": 13, "font-weight": "bold",
          fill: "#ffffff", stroke: "#334155", "stroke-width": 3, "paint-order": "stroke",
          visibility: showGenes ? "visible" : "hidden",
        });
        label.textContent = spec.gene;
        g.append(rod, centro, label);
        g.addEventListener("click", () => {
          if (!lastState || !bubble) return;
          const rect = (g as unknown as HTMLElement).getBoundingClientRect();
          const hostRect = wrap!.getBoundingClientRect();
          const x = Math.min(rect.left - hostRect.left, Math.max(0, hostRect.width - 300));
          bubble.textContent = describe(lastState, spec.chrom);
          bubble.style.display = "block";
          bubble.style.left = `${x}px`;
          bubble.style.top = `${rect.top - hostRect.top - 46}px`;
        });
        groups.set(spec.key, g);
        svgRoot.appendChild(g);
      });
      container.appendChild(wrap);
    },

    /** 渲染指定状态：隐藏气泡并重算布局 */
    render(state: Record<string, unknown>) {
      lastState = state;
      hideBubble();
      layout(lastState);
    },

    /** 销毁：移除整个场景容器并清理引用 */
    destroy() {
      wrap?.remove();
      groups.clear();
    },
  };
}

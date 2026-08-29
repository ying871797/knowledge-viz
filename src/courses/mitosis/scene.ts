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

/** 纺锤丝八根：绑定到各自姐妹单体（pole 声明极点端；着丝点端查 mitosisSlots 槽位，
    杜绝手写坐标错连——后期错连即由此类手写产生，现已废除） */
export const MITOSIS_FIBERS: { key: string; pole: "top" | "bottom" }[] = [
  { key: "A1a", pole: "top" }, { key: "A1b", pole: "bottom" },
  { key: "A2a", pole: "top" }, { key: "A2b", pole: "bottom" },
  { key: "B1a", pole: "top" }, { key: "B1b", pole: "bottom" },
  { key: "B2a", pole: "top" }, { key: "B2b", pole: "bottom" },
];

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
export function mitosisSlots(id: string): Slots {
  const S: Slots = {};
  switch (id) {
    case "interphase-before": {
      // 间期前（未复制）：四象限重叠杆
      rod(S, "A1", -40, 40);
      rod(S, "A2", 40, 40);
      rod(S, "B1", -40, -40);
      rod(S, "B2", 40, -40);
      break;
    }
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
  spindleVisible: boolean;            // 纺锤丝显隐（几何由 MITOSIS_FIBERS × 槽位推导，见 updateMitoPool）
}
const NUC_HIDDEN: NucEllipse = { cx: 0, cy: 0, rx: 0, ry: 0, o: 0 };

/** 逐阶段背景状态表 */
const BG: Record<string, MitoBg> = {
  interphase: {
    nuc1: { cx: 400, cy: 200, rx: 130, ry: 100, o: 1 },
    nuc2: { ...NUC_HIDDEN },
    plate: null,
    spindleVisible: false,
  },
  prophase: {
    nuc1: { ...NUC_HIDDEN },
    nuc2: { ...NUC_HIDDEN },
    plate: null,
    spindleVisible: true,
  },
  metaphase: {
    nuc1: { ...NUC_HIDDEN },
    nuc2: { ...NUC_HIDDEN },
    plate: null,
    spindleVisible: true,
  },
  anaphase: {
    nuc1: { ...NUC_HIDDEN },
    nuc2: { ...NUC_HIDDEN },
    plate: null,
    spindleVisible: true,
  },
  telophase: {
    nuc1: { cx: 400, cy: 110, rx: 130, ry: 45, o: 1 },
    nuc2: { cx: 400, cy: 290, rx: 130, ry: 45, o: 1 },
    plate: 200,
    spindleVisible: false,
  },
  daughter: {
    nuc1: { cx: 400, cy: 110, rx: 130, ry: 45, o: 1 },
    nuc2: { cx: 400, cy: 290, rx: 130, ry: 45, o: 1 },
    plate: 200,
    spindleVisible: false,
  },
};
const BG_FALLBACK = BG.interphase;

// ============ 背景元素池（预声明 DOM，全程不 remove+reappend） ============
const mitoPool = {
  cellWallSingle: null as SVGRectElement | null,
  cellWallTop: null as SVGRectElement | null,
  cellWallBot: null as SVGRectElement | null,
  nuc1: null as SVGEllipseElement | null,
  nuc2: null as SVGEllipseElement | null,
  cellPlate: null as SVGLineElement | null,
  // 纺锤丝：池化 path，几何 = 极点→单体着丝点（d = "M 极点 L 槽位"），CSS transition 驱动
  spindleLines: [] as SVGPathElement[],
};

/** 更新背景元素池：按阶段切换显隐与几何（禁止每帧 remove+reappend） */
function updateMitoPool(s: Record<string, unknown>, prevVisible: boolean[]): void {
  const bg = BG[String(s.stage)] ?? BG_FALLBACK;
  const isDaughter = String(s.stage) === "daughter";

  // 细胞壁：单壁 vs 双壁互斥
  mitoPool.cellWallSingle!.style.opacity = isDaughter ? "0" : "1";
  mitoPool.cellWallTop!.style.opacity = isDaughter ? "1" : "0";
  mitoPool.cellWallBot!.style.opacity = isDaughter ? "1" : "0";

  // 核膜
  for (const [key, nuc] of [["nuc1", bg.nuc1], ["nuc2", bg.nuc2]] as const) {
    const el = mitoPool[key]!;
    el.setAttribute("cx", String(nuc.cx));
    el.setAttribute("cy", String(nuc.cy));
    el.setAttribute("rx", String(nuc.rx));
    el.setAttribute("ry", String(nuc.ry));
    el.style.opacity = String(nuc.o);
  }

  // 细胞板
  if (bg.plate !== null) {
    mitoPool.cellPlate!.setAttribute("y1", String(bg.plate));
    mitoPool.cellPlate!.setAttribute("y2", String(bg.plate));
    mitoPool.cellPlate!.style.opacity = "1";
  } else {
    mitoPool.cellPlate!.style.opacity = "0";
  }

  // 纺锤丝 ×8：极点端固定（绑定表 pole），着丝点端 = 当前槽位（查 mitosisSlots，杜绝手写坐标错连）。
// 入场（隐藏→可见）：d 瞬切到位 + class grow 走 dasharray 绘制动画（pathLength=1，从两极长出）；
// 可见期 dasharray 保持 1 1，d 走 CSS 过渡贴合。prevVisible 就地更新为上帧可见集。
const slots = mitosisSlots(String(s.stage));
const seen = new Set<number>();
for (let i = 0; i < mitoPool.spindleLines.length; i++) mitoPool.spindleLines[i].classList.remove("grow");
mitoPool.spindleLines.forEach((path, i) => {
  if (bg.spindleVisible) {
    const fib = MITOSIS_FIBERS[i];
    const slot = slots[fib.key];
    const pole = fib.pole === "top" ? POLE_TOP : POLE_BOT;
    seen.add(i);
    const firstAppear = !prevVisible[i];
    path.setAttribute("d", `M ${pole[0]} ${pole[1]} L ${400 + slot.x} ${200 + slot.y}`);
    if (firstAppear) path.classList.add("grow");
    path.style.strokeDasharray = "1 1";
    path.style.opacity = "1";
    prevVisible[i] = true;
  } else {
    path.style.opacity = "0";
    path.style.strokeDasharray = "0 1";
    prevVisible[i] = false;
  }
});
}

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
  let prevVisible: boolean[] = [];   // 纺锤丝上帧可见集（入场检测）

  /** 核心：查槽位表 + 背景状态 → 渲染（唯一渲染路径） */
  function layout(s: Record<string, unknown>): void {
    if (!root) return;
    const slots = mitosisSlots(String(s.stage));

    // 背景元素池：按阶段切换显隐与几何（禁止每帧 remove+reappend）
    updateMitoPool(s, prevVisible);

    // 染色体：查槽位设 translate+rotate
    CHROMATIDS.forEach((spec) => {
      const g = groups.get(spec.key)!;
      const slot = slots[spec.key];
      g.style.transform = `translate(${400 + slot.x}px, ${200 + slot.y}px) rotate(${slot.a}deg)`;
      const lbl = g.querySelector("text")!;
      lbl.style.transform = `rotate(${-slot.a}deg)`;
      lbl.setAttribute("visibility", showGenes ? "visible" : "hidden");
    });
  }

  function hideBubble(): void {
    if (bubble) bubble.style.display = "none";
  }

  return {
    /** 挂载：创建 SVG、8 个单体组、背景元素与交互控件。可重入：清空闭包数组 */
    mount(container: HTMLElement) {
      // 测试隔离：清空残留的 DOM 池
      for (const k of ["cellWallSingle", "cellWallTop", "cellWallBot", "nuc1", "nuc2", "cellPlate"] as const) {
        if (mitoPool[k]) { mitoPool[k]!.remove(); mitoPool[k] = null; }
      }
      mitoPool.spindleLines.forEach((l) => l.remove());
      mitoPool.spindleLines.length = 0;
      prevVisible = [];
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

      // 背景元素池：一次创建全程复用，由 updateMitoPool 按阶段切换显隐
      const BG_BASE = { fill: "#f8fafc66", stroke: "#94a3b8", "stroke-width": 3 };
      mitoPool.cellWallSingle = el("rect", { class: "cell-wall", ...BG_BASE, x: CELL.x, y: CELL.y, width: CELL.w, height: CELL.h, rx: 24, opacity: 1 });
      mitoPool.cellWallTop = el("rect", { class: "cell-wall", ...BG_BASE, x: 200, y: 30, width: 400, height: 150, rx: 16, opacity: 0 });
      mitoPool.cellWallBot = el("rect", { class: "cell-wall", ...BG_BASE, x: 200, y: 220, width: 400, height: 150, rx: 16, opacity: 0 });
      svgRoot.append(mitoPool.cellWallSingle, mitoPool.cellWallTop, mitoPool.cellWallBot);
      mitoPool.nuc1 = el("ellipse", { class: "nuclear-membrane", fill: "none", stroke: "#94a3b8", "stroke-width": 2, "stroke-dasharray": "6 4", opacity: 0 });
      mitoPool.nuc2 = el("ellipse", { class: "nuclear-membrane", fill: "none", stroke: "#94a3b8", "stroke-width": 2, "stroke-dasharray": "6 4", opacity: 0 });
      svgRoot.append(mitoPool.nuc1, mitoPool.nuc2);
      mitoPool.cellPlate = el("line", { class: "cell-plate", x1: CELL.x + 40, x2: CELL.x + CELL.w - 40, stroke: "#059669", "stroke-width": 4, opacity: 0 });
      svgRoot.appendChild(mitoPool.cellPlate);
      // 纺锤丝池：8 根 path（d = M 极点 L 着丝点），几何由 updateMitoPool 每次重设；
      // 两命令跨阶段同构 → CSS d transition 平滑（与单体 transform 同 --tween-ms / ease-out）；
      // pathLength=1 归一化供入场 grow 动画（dasharray 0→1 沿 path 从 M 极点绘向 L 着丝点）
      for (let i = 0; i < MITOSIS_FIBERS.length; i++) {
        const p = el("path", { class: "spindle-line", d: "M 0 0 L 0 0", pathLength: 1, fill: "none", stroke: "#d4a574", "stroke-width": 1.5, opacity: 0 });
        p.style.strokeDasharray = "0 1";
        mitoPool.spindleLines.push(p);
        prevVisible.push(false);
        svgRoot.appendChild(p);
      }

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

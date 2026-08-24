import type { SceneComponent } from "../../core/types";
import type { MeiosisState } from "./data";

// SVG 命名空间与画布尺寸（viewBox）
const NS = "http://www.w3.org/2000/svg";
const VB_W = 800, VB_H = 400;

/** 染色体规格：颜色、长度、基因标注等静态信息 */
interface ChromoSpec {
  key: string;          // 如 "A1"（A 号长染色体·母方）
  pair: "A" | "B";      // A 长（红系）、B 短（蓝系）
  len: number;
  color: string;
  mateColor: string;    // 其同源伙伴的颜色（交叉互换用）
  gene: string;         // 基因标注字母
}

// 四条染色体：两对同源，父/母方用深浅区分
const CHROMOSOMES: ChromoSpec[] = [
  { key: "A1", pair: "A", len: 120, color: "#dc2626", mateColor: "#fca5a5", gene: "A" },
  { key: "A2", pair: "A", len: 120, color: "#fca5a5", mateColor: "#dc2626", gene: "a" },
  { key: "B1", pair: "B", len: 70,  color: "#2563eb", mateColor: "#93c5fd", gene: "B" },
  { key: "B2", pair: "B", len: 70,  color: "#93c5fd", mateColor: "#2563eb", gene: "b" },
];

// 各细胞的中心坐标（按 cells 数量取前 n 个）
// 两细胞期左右横排（满幅利用 800×400 画布宽度）、四细胞期 2×2 网格
export const CELL_CENTERS: Record<number, [number, number][]> = {
  1: [[400, 200]],
  2: [[215, 200], [585, 200]],
  4: [[175, 98], [480, 98], [175, 302], [480, 302]],
};

// ---------- 参数化槽位布局的几何要素 ----------
// 细胞半径：cells 数量 → 半径；两细胞期横排后半径从 95 提升到 150（Ru 21→76，染色体活动空间 ×3.6）；
// 四细胞期列心左移 + R 提至 95（竖排两行圆不相切的几何上限约 96），精子尾右伸与左移抵消、整体居中
export const CELL_RADIUS: Record<number, number> = { 1: 150, 2: 150, 4: 95 };

// ---------- 卵细胞模式（细胞质不均等分裂）的渲染几何 ----------
const OO_CENTER: [number, number] = [240, 200];  // 大细胞（次级卵母细胞/卵）中心
const OO_RADIUS = 140;                            // 大细胞半径
const PB_R = 46;                                  // 极体小圆半径
// 极体按数量的分布角度（度）：1 个在上方；3 个沿右上弧线展开
const PB_ANGLES: Record<number, number[]> = { 1: [-50], 3: [-50, -5, 40] };
// 极体圆心到大细胞中心的距离（轻微搭接，视觉上「贴边」）
const PB_DIST = OO_RADIUS + PB_R - 4;

/** 极坐标转直角：极体中心相对大细胞中心的位置 */
function pbCenter(deg: number): [number, number] {
  return [
    Math.round(OO_CENTER[0] + PB_DIST * Math.cos(deg * Math.PI / 180)),
    Math.round(OO_CENTER[1] + PB_DIST * Math.sin(deg * Math.PI / 180)),
  ];
}
const SAFE_MARGIN = 14;   // 安全边距：染色体外缘与细胞膜的最小距离
const HALF_LEN_MAX = 60;  // 最长染色体（A 对，len=120）的半长
const CHROMO_WIDTH = 10;  // 染色体描边宽度
const ARM_DX = 12;        // X 形对角臂端点横向偏移：两臂过原点在着丝粒处交合
// 同源对内中心距：宽度 2×10 基础上再留 6 余量（满足不变式 2：任意两条中心距 ≥ 20）
const PAIR_CENTER_DIST = CHROMO_WIDTH * 2 + 6;

/**
 * 可用半径 Ru = R - 安全边距 - halfLen。
 * 所有槽位坐标必须满足 |pos| ≤ Ru，从根源杜绝染色体出界；
 * 四细胞期（R=82）容不下整条染色体时收敛为 0（每格中心 1 条）。
 */
export function usableRadius(cells: number): number {
  return Math.max((CELL_RADIUS[cells] ?? 0) - SAFE_MARGIN - HALF_LEN_MAX, 0);
}

/** 槽位表：各染色体相对其所属细胞中心的偏移及所属细胞下标 */
export interface SlotTable {
  /** key -> 相对所属细胞中心的偏移 [dx, dy]（已取整，避免 transform 出现长小数） */
  offsets: Record<string, [number, number]>;
  /** key -> 所属细胞在 CELL_CENTERS[cells] 中的下标 */
  cellOf: Record<string, number>;
}

/**
 * 纯函数：给定阶段状态 → 槽位表。
 * 只做几何计算、不触碰 DOM，便于对不变式直接单元测试：
 * 1. 任意染色体中心到所属细胞中心的距离 ≤ 该细胞 Ru
 * 2. 同一细胞内任意两条染色体中心距 ≥ 20
 * 3. comboAlt 切换仅改变 B 对的极性归属（A 对位置不变），对应两种自由组合方式
 */
export function computeSlots(s: MeiosisState, comboAlt = false): SlotTable {
  const offsets: Record<string, [number, number]> = {};
  const cellOf: Record<string, number> = {};
  const ru = usableRadius(s.cells);
  // 极坐标辅助：角度（度）、半径 → 取整后的直角坐标
  const polar = (deg: number, r: number): [number, number] =>
    [Math.round(r * Math.cos(deg * Math.PI / 180)), Math.round(r * Math.sin(deg * Math.PI / 180))];

  if (s.cells === 1) {
    if (s.separating === "homolog") {
      // 减Ⅰ后期：两极各 2 条。每一极内两条按 y=±Ru*0.5 上下错开（不再共点），
      // x=±Ru*0.7；comboAlt 切换两种真实的自由组合方式——
      //   方式一（默认）：A1(A)+B1(B) 移向上极、A2(a)+B2(b) 移向下极；
      //   方式二：B 对两成员对调极性 → A1(A)+B2(b) 同极（对内以 PAIR_CENTER_DIST 紧贴）。
      // 注意：不能只镜像 x（镜像不改变「谁与谁同极」，组合方式并未变化）
      const sx = Math.round(ru * 0.7), sy = Math.round(ru * 0.5);
      const d = PAIR_CENTER_DIST;
      if (!comboAlt) {
        Object.assign(offsets, {
          A1: [-sx, -sy], B1: [sx, -sy],
          A2: [sx, sy], B2: [-sx, sy],
        });
      } else {
        Object.assign(offsets, {
          A1: [-sx, -sy], B2: [-sx + d, -sy],
          A2: [sx, sy], B1: [sx - d, sy],
        });
      }
    } else if (s.equatorial === "paired") {
      // 减Ⅰ中期：两对同源沿赤道板（水平中线）左右分置，
      // 对心距 = 2.2×halfLen = 132；对内上下紧贴（中心距 = PAIR_CENTER_DIST）
      const pc = Math.round(2.2 * HALF_LEN_MAX) / 2; // 66
      const h = PAIR_CENTER_DIST / 2;                // 13
      Object.assign(offsets, {
        A1: [-pc, -h], A2: [-pc, h],
        B1: [pc, -h], B2: [pc, h],
      });
    } else if (s.equatorial === "single") {
      // 单列赤道板（有丝分裂式逐条排列）：短对外侧、长对内侧
      const inner = Math.round(ru * 0.4), outer = Math.round(ru * 0.85);
      Object.assign(offsets, {
        A1: [-inner, 0], A2: [inner, 0],
        B1: [-outer, 0], B2: [outer, 0],
      });
    } else if (s.pairing) {
      // 联会/四分体：两对分别置于左上/右下象限区域，对间明显间隔；
      // 对内水平并排、中心距 = PAIR_CENTER_DIST（紧贴）
      const gx = Math.round(ru * 0.55), gy = Math.round(ru * 0.35), h = PAIR_CENTER_DIST / 2;
      Object.assign(offsets, {
        A1: [-gx - h, -gy], A2: [-gx + h, -gy],
        B1: [gx - h, gy], B2: [gx + h, gy],
      });
    } else {
      // 基态（散布）/间期/复制态：四象限均匀分布——
      // 45°/135°/225°/315° 方向、距离 Ru*0.75；
      // 注意 SVG y 轴向下，sin>0 表示屏幕下方：长对（135°/45°）占下方两象限、短对占上方
      const d = Math.round(ru * 0.75);
      Object.assign(offsets, {
        A1: polar(135, d), A2: polar(45, d),
        B1: polar(225, d), B2: polar(315, d),
      });
    }
    Object.keys(offsets).forEach((k) => { cellOf[k] = 0; });
  } else if (s.cells === 2 && s.unequal) {
    // 卵细胞模式（细胞质不均等分裂）：只有 1 个大细胞（次级卵母细胞/卵）承载可见染色体。
    // 减Ⅱ中期：可见对并排居中（±13）落在赤道板上；减Ⅱ后期：组中心错开排布（双杆分极由渲染层完成）；
    // 其余阶段：可见对分居大细胞两极。极体对槽位错开居中区域，
    // 由渲染层缩小并锚定到极体小圆（不变式仍以同一中心校验，全部偏移 ≤ Ru 且两两 ≥ 20）
    let ox: Record<string, [number, number]>;
    if (s.separating === "sister") {
      ox = { A1: [-13, -13], B1: [13, 13], A2: [13, -13], B2: [-13, 13] };
    } else if (s.equatorial === "single") {
      ox = { A1: [-13, 0], B1: [13, 0], A2: [0, 24], B2: [0, -24] };
    } else {
      const h = Math.round(ru * 0.5);
      ox = { A1: [-h, 0], B1: [h, 0], A2: [0, 24], B2: [0, -24] };
    }
    Object.assign(offsets, ox);
    Object.keys(offsets).forEach((k) => { cellOf[k] = 0; });
  } else if (s.cells === 2) {
    // 减Ⅱ后期：组中心错开排布（双杆分极由渲染层呈现）；其余阶段一长一短对称分布两极
    if (s.separating === "sister") {
      Object.assign(offsets, {
        A1: [-13, -13], B2: [13, -13],
        B1: [13, 13], A2: [-13, 13],
      });
    } else {
      const h = Math.round(ru * 0.5);
      Object.assign(offsets, {
        A1: [-h, 0], B2: [h, 0],
        B1: [-h, 0], A2: [h, 0],
      });
    }
    cellOf.A1 = 0; cellOf.B2 = 0;
    cellOf.B1 = 1; cellOf.A2 = 1;
  } else {
    // 四细胞期 / 精子变形：每个子细胞含一长一短两条染色体（对应数目 n=2）——
    // 左上格(A1,B2)、右下格(B1,A2)为本体所在；姊妹杆由渲染层平移至同行兄弟格
    Object.assign(offsets, {
      A1: [-13, -13], B2: [13, -13],
      B1: [-13, 13], A2: [13, 13],
    });
    cellOf.A1 = 0; cellOf.B2 = 0;
    cellOf.B1 = 2; cellOf.A2 = 2;
  }

  return { offsets, cellOf };
}

/** 创建带属性的 SVG 元素的便捷工厂 */
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * 绘制一条染色体：replicated 时为 X 形（两条单体），否则单杆形。
 * showGenes 仅决定构建时基因字样初始可见性，运行时可见性由 layout 统一控制。
 */
function buildChromosome(spec: ChromoSpec, showGenes: boolean, onClick: (spec: ChromoSpec) => void): SVGGElement {
  const g = el("g", { class: `chromo chromo-${spec.key}`, cursor: "pointer" });
  const w = CHROMO_WIDTH;
  const half = spec.len / 2;
  g.dataset.key = spec.key;
  g.addEventListener("click", () => onClick(spec));

  // 三段结构：竖直单杆（未复制时显示）+ 两条对角臂（复制后显示，过原点在着丝粒处交合成真 X 形）
  const rod = el("path", { d: `M 0 ${-half} L 0 ${half}`, fill: "none", stroke: spec.color, "stroke-width": w, "stroke-linecap": "round" });
  const diagA = el("path", { d: `M ${-ARM_DX} ${-half} L ${ARM_DX} ${half}`, fill: "none", stroke: spec.color, "stroke-width": w, "stroke-linecap": "round" });
  const diagB = el("path", { d: `M ${ARM_DX} ${-half} L ${-ARM_DX} ${half}`, fill: "none", stroke: spec.color, "stroke-width": w, "stroke-linecap": "round" });
  // 姊妹杆：减Ⅱ后期着丝点分裂后与本体杆一一对应（双杆分极）；
  // 减Ⅱ末期限则平移至同行兄弟子细胞，使每格呈现一长一短两条染色体
  const sisterRod = el("path", { d: `M 0 ${-half} L 0 ${half}`, fill: "none", stroke: spec.color, "stroke-width": w, "stroke-linecap": "round" });
  // 姊妹杆的配套部件：着丝点圆点克隆与基因标注副本（永远复制姊妹杆的 transform）
  const sisterCentro = el("circle", { class: "sister-centro", r: 5, fill: "#111827" });
  const sisterLabel = el("text", {
    class: "sister-label",
    x: 0, y: Math.round(-spec.len / 4) + 4,
    "text-anchor": "middle", "font-size": 13, "font-weight": "bold",
    fill: "#ffffff", stroke: "#334155", "stroke-width": 3, "paint-order": "stroke",
    visibility: showGenes ? "visible" : "hidden",
  });
  sisterLabel.textContent = spec.gene;
  g.append(rod, diagA, diagB, sisterRod, sisterCentro, sisterLabel);
  // 对角臂与姊妹杆系默认隐藏，由 layout 按阶段统一切换
  diagA.style.display = "none";
  diagB.style.display = "none";
  sisterRod.style.display = "none";
  sisterCentro.style.display = "none";

  // 着丝粒
  g.appendChild(el("circle", { class: "centro", r: 5, fill: "#111827" }));

  // 基因标注：居中徽标式——写在染色体上半段中点，白字深描边（paint-order 先描后填）任何底色可读；
  // 染色体永不相叠（布局不变式保证），故标注几何上不可能重叠
  const label = el("text", {
    class: "gene-label",
    x: 0, y: Math.round(-spec.len / 4) + 4,
    "text-anchor": "middle", "font-size": 13, "font-weight": "bold",
    fill: "#ffffff", stroke: "#334155", "stroke-width": 3, "paint-order": "stroke",
    visibility: showGenes ? "visible" : "hidden",
  });
  label.textContent = spec.gene;
  g.appendChild(label);

  g.dataset.geneLabel = String(showGenes);
  return g;
}

/**
 * 减数分裂场景组件：
 * 根据课程阶段状态渲染细胞轮廓与染色体布局，
 * 提供点击染色体气泡、基因标注开关、自由组合方式切换三类交互。
 */
export function createMeiosisScene(): SceneComponent & { destroy(): void } {
  let root: SVGSVGElement | null = null;
  let wrap: HTMLDivElement | null = null;
  let bubble: HTMLDivElement | null = null;
  let groups = new Map<string, SVGGElement>();
  let lastState: MeiosisState | null = null;
  let showGenes = false;
  let comboAlt = false;          // 自由组合两种方式切换
  let comboBtn: HTMLButtonElement;      // 自由组合切换按钮（仅减Ⅰ后期可用）
  let comboHint: HTMLDivElement;        // 当前组合方式的常驻说明文字

  /** 气泡文案：描述该染色体的单体数与同源染色体有无 */
  function describe(spec: ChromoSpec): string {
    const s = lastState!;
    // 减Ⅰ结束后（进入两个细胞，或正处于任一分离期）细胞中已无同源染色体
    const mono = s.cells >= 2 || s.separating !== "none";
    return `${spec.pair === "A" ? "长" : "短"}染色体（${spec.key}，基因 ${spec.gene}）：` +
      `当前${s.replicated ? "含 2 条姐妹染色单体" : "无染色单体"}；` +
      `${mono ? "同源染色体已分离，细胞中不存在其同源染色体" : "细胞中存在它的同源染色体"}`;
  }

  /** 在指定坐标显示气泡（相对场景容器） */
  function showBubble(text: string, x: number, y: number): void {
    bubble!.textContent = text;
    bubble!.style.display = "block";
    bubble!.style.left = `${x}px`;
    bubble!.style.top = `${y}px`;
  }
  function hideBubble(): void {
    if (bubble) bubble!.style.display = "none";
  }

  /** 核心：根据状态计算每条染色体应处的目标位置与形态 */
  function layout(s: MeiosisState): void {
    if (!root) return;
    // 卵细胞模式 cells=2（不均等分裂）：单一「大细胞」承载可见染色体，极体小圆贴边环绕
    const oocyteSplit = s.cells === 2 && s.unequal;
    const centers = CELL_CENTERS[s.cells];
    // 细胞轮廓（变形期画精子形态：椭圆头部 + 尾部）；先清除旧轮廓再重建
    root.querySelectorAll(".cell-outline, .sperm-tail, .polar-body").forEach((n) => n.remove());
    const radius = CELL_RADIUS[s.cells] ?? 62;
    if (oocyteSplit) {
      // 大细胞轮廓
      root!.appendChild(el("circle", { class: "cell-outline", cx: OO_CENTER[0], cy: OO_CENTER[1], r: OO_RADIUS, fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": 2 }));
      // 极体小圆：按数量沿右上弧线贴边分布（第一极体在上方，后续依次向右展开）
      for (const deg of PB_ANGLES[s.polarBodies ?? 0] ?? []) {
        const [px, py] = pbCenter(deg);
        root!.appendChild(el("circle", { class: "polar-body cell-outline", cx: px, cy: py, r: PB_R, fill: "#fef9c388", stroke: "#94a3b8", "stroke-width": 2 }));
      }
    } else {
      centers.forEach(([cx, cy]) => {
        if (s.spermShape) {
          // 精子形态：椭圆头部中心与染色体簇中心对齐（同为细胞中心），波浪形尾部向右延伸
          const head = el("ellipse", { class: "cell-outline", cx, cy, rx: radius * 0.6, ry: radius * 0.52, fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": 2 });
          const tail = el("path", { class: "sperm-tail", d: `M ${cx + radius * 0.38} ${cy} q ${radius * 0.5} ${-18} ${radius * 0.95} 0 q ${radius * 0.45} ${18} ${radius * 0.85} ${-4}`, fill: "none", stroke: "#94a3b8", "stroke-width": 2 });
          root!.append(head, tail);
        } else if (s.unequal && s.cells === 1) {
          // 卵细胞模式减Ⅰ后期：轮廓偏心拉长，暗示细胞质将不均等分裂
          const c = el("ellipse", { class: "cell-outline", cx, cy: cy + Math.round(radius * 0.08), rx: Math.round(radius * 0.92), ry: Math.round(radius * 1.06), fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": 2 });
          root!.appendChild(c);
        } else {
          // 圆形细胞轮廓
          const c = el("circle", { class: "cell-outline", cx, cy, r: radius, fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": 2 });
          root!.appendChild(c);
        }
      });
    }

    // 目标位置表：由参数化槽位表（纯函数）换算为画布绝对坐标；
    // 卵细胞模式以大细胞中心为基准（槽位不变式仍按原中心成立）
    const slots = computeSlots(s, comboAlt);
    const base: [number, number] = oocyteSplit ? OO_CENTER : centers[0];
    const pos: Record<string, [number, number]> = {};
    CHROMOSOMES.forEach(({ key }) => {
      // 卵细胞模式以大细胞中心为基准，其余按所属细胞中心（原逻辑）
      const [cx, cy] = oocyteSplit ? base : centers[slots.cellOf[key]];
      const [dx, dy] = slots.offsets[key];
      pos[key] = [cx + dx, cy + dy];
    });

    // 应用位置（CSS transition 补间约 1.5s）与形态。
    // 精子变形期（cells:4、每格 1 条）：染色体竖向包络（半长 60 + 描边余量约 11）= 71，
    // 头部椭圆加大后 ry = R*0.52 ≈ 49.4，取 scale(0.45)：71*0.45 ≈ 32 ≤ ry*0.8 ≈ 39.5，
    // 既不穿出轮廓又比旧值 0.3 放大 50%，改善可读性
    // 极体内染色体：缩小后锚定到对应极体小圆中心（与极体一一配对）
    const HIDDEN_KEYS = ["A2", "B2"];   // 卵细胞模式：进入极体的另一对组合
    const pbAnchors: Record<string, [number, number]> = {};   // 记录实际锚位，供末期限分配向量计算
    CHROMOSOMES.forEach(({ key }) => {
      const g = groups.get(key)!;
      if (oocyteSplit && HIDDEN_KEYS.includes(key)) {
        const angles = PB_ANGLES[s.polarBodies ?? 0] ?? [];
        // 无极体可容纳时整组隐藏（避免出现无轮廓支撑的幽灵染色体）
        if (!angles.length) {
          g.style.display = "none";
          return;
        }
        g.style.display = "";
        // 谱系配对锚定：A2 与 B2 同属第一极体，始终落在同一个极体小圆内
        // （横向 ±8 错开）；减Ⅱ末期限它们的姊妹杆才迁往另一子极体（见 EGG_MAP）
        const hi = HIDDEN_KEYS.indexOf(key);
        const [px, py] = pbCenter(angles[0]);
        const dx = Math.round((hi - (HIDDEN_KEYS.length - 1) / 2) * 16);
        pbAnchors[key] = [px + dx, py];
        g.style.transform = `translate(${px + dx}px, ${py}px) scale(0.35)`;
        return;
      }
      const [x, y] = pos[key];
      g.style.transform = `translate(${x}px, ${y}px)${s.spermShape ? " scale(0.45)" : ""}`;
    });
    CHROMOSOMES.forEach(({ key }) => {
      const g = groups.get(key)!;
      // 四段显隐：未复制→竖杆；复制后→两条对角臂（过着丝点交叉）；
      // 减Ⅱ后期（cells=2）：本体杆移向左极、姊妹杆移向右极（双杆分极）；
      // 减Ⅱ末期限/精子期（cells=4）：本体杆在主子细胞，姊妹杆平移至同行兄弟子细胞
      const [rod, diagA, diagB, sisterRod] = g.querySelectorAll<SVGPathElement>("path");
      const splitting = !s.replicated && s.separating === "sister" && s.cells === 2;
      const gametePairing = s.cells === 4;   // 末期与变形期都保持每头部 2 条（向量按组缩放补偿）
      // 卵细胞减Ⅱ末期限：8 根杆守恒分配——姊妹杆按 EGG_MAP 进入指定极体
      const eggDistribution = oocyteSplit && !splitting && (s.polarBodies ?? 0) >= 3;
      // 着丝点与基因标注提前取用：双杆分极时须随本体杆同步平移（避免滞留细胞中央成游离伪影）
      const centro = g.querySelector<SVGCircleElement>("circle.centro")!;
      const label = g.querySelector("text.gene-label")!;
      const sisterCentro = g.querySelector<SVGCircleElement>(".sister-centro")!;
      const sisterLabel = g.querySelector("text.sister-label")!;
      // 减Ⅱ尾部三帧（后期分极/末期限配对/变形期、卵细胞分配）瞬切：
      // 滑行补间会让着丝点在途偏离中心，暗示错误的生物学过程；标记 no-tween 交由 CSS 禁用过渡
      g.classList.toggle("no-tween", splitting || gametePairing || eggDistribution);
      rod.style.display = s.replicated ? "none" : "";
      diagA.style.display = s.replicated ? "" : "none";
      diagB.style.display = s.replicated ? "" : "none";
      if (splitting) {
        const H = oocyteSplit ? Math.round(OO_RADIUS * 0.6) : Math.round(usableRadius(s.cells) * 0.85);
        const off = `translate(${-H},0)`;
        const sib = `translate(${H},0)`;
        rod.setAttribute("transform", off);
        sisterRod.setAttribute("transform", sib);
        sisterRod.style.display = "";
        centro.setAttribute("transform", off);
        label.setAttribute("transform", off);
        // 姊妹着丝点随姊妹杆移向另一极
        sisterCentro.setAttribute("transform", sib);
        sisterCentro.style.display = "";
        sisterLabel.setAttribute("transform", sib);
      } else if (gametePairing) {
        rod.removeAttribute("transform");
        // 兄弟子细胞位于同行右侧：列间距 = CELL_CENTERS[4][1][0] - [0][0]；
        // 变形期组级 scale(0.45)，向量需除以缩放才能让姊妹杆准确落在兄弟头部中心
        const vec = CELL_CENTERS[4][1][0] - CELL_CENTERS[4][0][0];
        const k = s.spermShape ? Math.round(vec / 0.45) : vec;
        const sib = `translate(${k},0)`;
        sisterRod.setAttribute("transform", sib);
        sisterRod.style.display = "";
        sisterCentro.setAttribute("transform", sib);
        sisterCentro.style.display = "";
        sisterLabel.setAttribute("transform", sib);
        label.removeAttribute("transform");
      } else if (eggDistribution) {
        // 卵细胞末期限分配表（父坐标绝对锚点）：
        // own=本体杆所在（组级 transform 已锚定），sis=姊妹杆目标极体位（带 scale 0.35 适配极体大小）
        const EGG_MAP: Record<string, { sis: [number, number] }> = {
          A1: { sis: [371, 317] },   // 极体③ 左半
          B1: { sis: [387, 317] },   // 极体③ 右半
          A2: { sis: [413, 184] },   // 极体② 左半
          B2: { sis: [429, 184] },   // 极体② 右半
        };
        const dest = EGG_MAP[key];
        // 隐藏对（A2/B2）的组自带 scale(0.35)，路径向量需除回组缩放；
        // 基准锚位必须用组的「实际」位置（极体中心），而非槽位推算值——否则姊妹杆飞出极体
        const anchor = pbAnchors[key] ?? pos[key];
        const gs = HIDDEN_KEYS.includes(key) ? 0.35 : 1;
        const tx = Math.round((dest.sis[0] - anchor[0]) / gs);
        const ty = Math.round((dest.sis[1] - anchor[1]) / gs);
        const sib = `translate(${tx},${ty}) scale(${gs === 1 ? 0.35 : 1})`;
        sisterRod.setAttribute("transform", sib);
        sisterRod.style.display = "";
        // 着丝点全覆盖：进入极体的姊妹杆同样有随行着丝点
        sisterCentro.setAttribute("transform", sib);
        sisterCentro.style.display = "";
        sisterLabel.setAttribute("transform", sib);
        label.removeAttribute("transform");
      } else {
        rod.removeAttribute("transform");
        sisterRod.style.display = "none";
        centro.removeAttribute("transform");
        label.removeAttribute("transform");
        sisterCentro.style.display = "none";
        sisterLabel.removeAttribute("transform");
      }
      // 基因标注可见性由开关统一控制（本体与副本同源）；字号随所属细胞半径自适应（小细胞时保底 13）
      label.setAttribute("visibility", showGenes ? "visible" : "hidden");
      sisterLabel.setAttribute("visibility", showGenes ? "visible" : "hidden");
      // 字号档位类：大字号档（单细胞期）加 gene-label-lg，供窄屏 CSS 区分补偿幅度、保留层次；
      // 精子变形期染色体组被整体缩放（scale 0.45），组内文字随之变小，
      // 需反向补偿字号（fs / 0.45），否则标注小到不可读——副本标注与本体同参数
      const fs = Math.max(13, Math.round(radius * 0.16));
      label.setAttribute("font-size", String(s.spermShape ? Math.round(fs / 0.45) : fs));
      label.classList.toggle("gene-label-lg", fs >= 18);
      sisterLabel.setAttribute("font-size", String(s.spermShape ? Math.round(fs / 0.45) : fs));
      sisterLabel.classList.toggle("gene-label-lg", fs >= 18);
    });

    // 自由组合按钮与说明文字：仅减Ⅰ后期（同源分离）可用，说明文字常驻显示于场景上方
    const canCombo = s.separating === "homolog";
    comboBtn.disabled = !canCombo;
    comboBtn.textContent = canCombo ? "切换自由组合方式" : "自由组合（减Ⅰ后期可用）";
    comboHint.style.display = canCombo ? "inline-block" : "none";
    if (canCombo) {
      comboHint.textContent = comboAlt
        ? "自由组合方式二：A 与 b 移向同一极（a 与 B 移向另一极）"
        : "自由组合方式一：A 与 B 移向同一极（a 与 b 移向另一极）";
    }
  }

  return {
    /** 挂载：创建 SVG 根节点、气泡与交互开关栏，并绘制四条染色体 */
    mount(container: HTMLElement) {
      wrap = document.createElement("div");
      wrap.className = "meiosis-scene";
      const svgRoot = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}`, width: "100%" });
      root = svgRoot;
      bubble = document.createElement("div");
      bubble.className = "chromo-bubble";
      bubble.style.display = "none";
      // 当前组合方式说明文字：位于场景（SVG）上方，随 comboAlt 切换内容
      comboHint = document.createElement("div");
      comboHint.className = "combo-hint";
      comboHint.style.display = "none";
      wrap.append(comboHint, svgRoot, bubble);

      // 场景专属开关：基因标注 / 自由组合对比
      const bar = document.createElement("div");
      bar.className = "scene-controls";
      const geneToggle = document.createElement("label");
      geneToggle.innerHTML = `<input type="checkbox" /> 显示基因标注`;
      geneToggle.querySelector("input")!.addEventListener("change", (e) => {
        showGenes = (e.target as HTMLInputElement).checked;
        if (lastState) layout(lastState);
      });
      const comboToggle = document.createElement("button");
      comboBtn = comboToggle;
      // 初始（未渲染任何阶段前）不可用，文案提示可用时机
      comboBtn.disabled = true;
      comboBtn.textContent = "自由组合（减Ⅰ后期可用）";
      comboBtn.addEventListener("click", () => {
        // disabled 状态下忽略点击（防御浏览器差异，保证行为一致）
        if (comboBtn.disabled) return;
        comboAlt = !comboAlt;
        if (lastState) layout(lastState);
      });
      bar.append(geneToggle, comboToggle);

      // 模式切换按钮：精子/卵细胞形成互切，通过路由参数触发整页重挂载（重置到第 0 步）
      // 当前模式在挂载时从路由读取；点击仅改 hash，重挂载由入口层路由分发完成
      const inOocyte = /mode=oocyte/.test(location.hash);
      const modeBtn = document.createElement("button");
      modeBtn.className = "mode-switch";
      modeBtn.textContent = inOocyte ? "切换到精子形成" : "切换到卵细胞形成";
      modeBtn.addEventListener("click", () => {
        location.hash = inOocyte ? "#/course/meiosis" : "#/course/meiosis?mode=oocyte";
      });
      bar.append(modeBtn);

      wrap.appendChild(bar);

      CHROMOSOMES.forEach((spec) => {
        // mount 时基因标注默认不可见，运行时由 layout 按 showGenes 统一控制
        const g = buildChromosome(spec, false, (s) => {
          if (!lastState) return;
          const rect = (g as unknown as HTMLElement).getBoundingClientRect();
          const hostRect = wrap!.getBoundingClientRect();
          // 水平钳制：气泡锚点靠近容器右缘时左移，防止窄屏溢出视口（jsdom 宽度为 0 时钳到 0，不影响测试）
          const x = Math.min(rect.left - hostRect.left, Math.max(0, hostRect.width - 300));
          showBubble(describe(s), x, rect.top - hostRect.top - 46);
        });
        groups.set(spec.key, g);
        svgRoot.appendChild(g);
      });
      container.appendChild(wrap);
    },

    /** 渲染指定状态：隐藏气泡并重算布局 */
    render(state: Record<string, unknown>) {
      lastState = state as MeiosisState;
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

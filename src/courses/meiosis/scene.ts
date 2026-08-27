import type { SceneComponent } from "../../core/types";
import type { MeiosisState } from "./data";

// ============ 画布与几何常量 ============
const NS = "http://www.w3.org/2000/svg";
const VB_W = 800, VB_H = 400;
const X_ANGLE = 11;            // 复制态 X 形张角（度）
const PAIR_GAP = 13;           // 并排染色体/单体对的半间距
const SPREAD = Math.round(76 * 0.75);   // 基态四象限散布距离（Ru·0.75）
const POLE_X = Math.round(76 * 0.7);    // 减Ⅰ后期两极横向距离
const POLE_Y = Math.round(76 * 0.5);    // 减Ⅰ后期两极纵向错开
const SPLIT_V = 70;                     // 减Ⅱ后期极距（姐妹分赴本细胞上/下两极，±70 杆心距，范数 ≤76）

// 纺锤丝常量
const POLE_OFFSET = 110;                // 极点到细胞中心的纵向距离
const OO_POLE_SHIFT = -20;             // 卵细胞模式极点同向偏移（向上）

// ============ 纺锤丝连接表：声明式（每阶段每染色体 → 细胞 + 极点） ============
// 减Ⅰ：同源染色体整对连同一极（默认 A1/B1→上、A2/B2→下）；减Ⅱ：姐妹分连两极（有丝分裂式）。
// 极点由所属细胞中心 ± POLE_OFFSET 得出（卵细胞两细胞期大细胞用 OO_CENTER）。
interface SpindleFiber { key: string; cell: number; pole: "top" | "bottom" }
const MI_FIBERS: SpindleFiber[] = [
  { key: "A1a", cell: 0, pole: "top" }, { key: "B1a", cell: 0, pole: "top" },
  { key: "A2a", cell: 0, pole: "bottom" }, { key: "B2a", cell: 0, pole: "bottom" },
];
const MI_COMBO_ALT: SpindleFiber[] = [
  { key: "A1a", cell: 0, pole: "top" }, { key: "B2a", cell: 0, pole: "top" },
  { key: "A2a", cell: 0, pole: "bottom" }, { key: "B1a", cell: 0, pole: "bottom" },
];
// 减Ⅱ中期：精子细胞0={A1,B2}、细胞1={A2,B1}；卵细胞大细胞={A1,B1}
const MII_SPERM: SpindleFiber[] = [
  { key: "A1a", cell: 0, pole: "top" }, { key: "B2a", cell: 0, pole: "bottom" },
  { key: "A2a", cell: 1, pole: "top" }, { key: "B1a", cell: 1, pole: "bottom" },
];
const MII_OO: SpindleFiber[] = [
  { key: "A1a", cell: 0, pole: "top" }, { key: "B1a", cell: 0, pole: "bottom" },
];
// 减Ⅱ后期：姐妹分连两极（每细胞每染色体 2 根）
const MIIA_SPERM: SpindleFiber[] = [
  { key: "A1a", cell: 0, pole: "top" }, { key: "A1b", cell: 0, pole: "bottom" },
  { key: "B2a", cell: 0, pole: "top" }, { key: "B2b", cell: 0, pole: "bottom" },
  { key: "A2a", cell: 1, pole: "top" }, { key: "A2b", cell: 1, pole: "bottom" },
  { key: "B1a", cell: 1, pole: "top" }, { key: "B1b", cell: 1, pole: "bottom" },
];
const MIIA_OO: SpindleFiber[] = [
  { key: "A1a", cell: 0, pole: "top" }, { key: "A1b", cell: 0, pole: "bottom" },
  { key: "B1a", cell: 0, pole: "top" }, { key: "B1b", cell: 0, pole: "bottom" },
];
function fibersFor(s: MeiosisState, comboAlt: boolean): SpindleFiber[] {
  switch (s.stage) {
    case "prophase-I": case "metaphase-I":
    case "oo-prophase-I": case "oo-metaphase-I":
      return MI_FIBERS;
    case "anaphase-I": case "oo-anaphase-I":
      return comboAlt ? MI_COMBO_ALT : MI_FIBERS;
    case "metaphase-II":
      return MII_SPERM;
    case "oo-metaphase-II":
      return MII_OO;
    case "anaphase-II":
      return MIIA_SPERM;
    case "oo-anaphase-II":
      return MIIA_OO;
    default:
      return [];
  }
}

// 细胞中心（按 cells 数量取前 n 个）
export const CELL_CENTERS: Record<number, [number, number][]> = {
  1: [[400, 200]],
  2: [[215, 200], [585, 200]],
  4: [[175, 98], [480, 98], [175, 302], [480, 302]],
};
// 细胞半径：两细胞期横排后 150（Ru 21→76），四细胞期 95
export const CELL_RADIUS: Record<number, number> = { 1: 150, 2: 150, 4: 95 };
export function usableRadius(cells: number): number {
  return Math.max((CELL_RADIUS[cells] ?? 0) - 14 - 60, 0);
}

// ============ 卵细胞模式几何 ============
const OO_CENTER: [number, number] = [240, 200];  // 大细胞（次级卵母细胞/卵）中心
const OO_RADIUS = 140;
const PB_R = 46;                                  // 极体小圆半径
const PB_DIST = OO_RADIUS + PB_R - 4;             // 极体圆心到大细胞中心距离
const PB_ANGLES: Record<number, number[]> = { 1: [-50], 3: [-50, -5, 40] };
function pbCenter(deg: number): [number, number] {
  return [
    Math.round(OO_CENTER[0] + PB_DIST * Math.cos(deg * Math.PI / 180)),
    Math.round(OO_CENTER[1] + PB_DIST * Math.sin(deg * Math.PI / 180)),
  ];
}

// ============ 元素模型：8 根染色单体（全程固定，零增删） ============
interface ChromatidSpec {
  key: string;      // "A1a"：染色体 A1 的单体 a
  chrom: string;    // 所属染色体
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
// 染色体 → 基因/长短（气泡文案用）
const CHROM_INFO: Record<string, { gene: string; long: boolean }> = {
  A1: { gene: "A", long: true }, A2: { gene: "a", long: true },
  B1: { gene: "B", long: true }, B2: { gene: "b", long: false },
};

// ============ 槽位：每阶段 → 每单体 {cell, x, y, a} ============
/** cell=所属细胞下标（精子模式相对细胞中心；卵细胞 cells=2 阶段 x/y 为绝对坐标）；a=旋转角（度） */
export interface Slot { cell: number; x: number; y: number; a: number }
export type Slots = Record<string, Slot>;

/** 复制态（X 形）：姐妹两杆同位反向旋转 */
function xpair(S: Slots, k: string, cell: number, x: number, y: number): void {
  S[`${k}a`] = { cell, x, y, a: -X_ANGLE };
  S[`${k}b`] = { cell, x, y, a: X_ANGLE };
}
/** 未复制（重叠杆）：姐妹两杆同位同角 */
function rod(S: Slots, k: string, cell: number, x: number, y: number): void {
  S[`${k}a`] = { cell, x, y, a: 0 };
  S[`${k}b`] = { cell, x, y, a: 0 };
}
/** 着丝点已分裂：姐妹两杆分居两点 */
function split(S: Slots, k: string, cell: number, x1: number, y1: number, x2: number, y2: number): void {
  S[`${k}a`] = { cell, x: x1, y: y1, a: 0 };
  S[`${k}b`] = { cell, x: x2, y: y2, a: 0 };
}

/** 精子模式逐阶段槽位表（纯声明数据） */
function spermSlots(id: string, comboAlt: boolean): Slots {
  const S: Slots = {};
  switch (id) {
    case "spermatogonium": {
      // 四象限散布：极坐标 45°/135°/225°/315° × Ru·0.75 → 分量 ±40（对角距 57 ≤ Ru）
      rod(S, "A1", 0, -40, 40);
      rod(S, "A2", 0, 40, 40);
      rod(S, "B1", 0, -40, -40);
      rod(S, "B2", 0, 40, -40);
      break;
    }
    case "interphase": {
      xpair(S, "A1", 0, -40, 40);
      xpair(S, "A2", 0, 40, 40);
      xpair(S, "B1", 0, -40, -40);
      xpair(S, "B2", 0, 40, -40);
      break;
    }
    case "prophase-I": {
      // 联会：同源对靠拢——{A1,A2} 左上、{B1,B2} 右下，对内并排（±13）
      const gx = Math.round(76 * 0.55), gy = Math.round(76 * 0.35);
      xpair(S, "A1", 0, -gx - PAIR_GAP, -gy);
      xpair(S, "A2", 0, -gx + PAIR_GAP, -gy);
      xpair(S, "B1", 0, gx - PAIR_GAP, gy);
      xpair(S, "B2", 0, gx + PAIR_GAP, gy);
      break;
    }
    case "metaphase-I": {
      // 减Ⅰ中期：两对分列赤道板左右（对心距 132 → 每对 ±66），对内上下紧贴（±13）
      const pc = 66;
      xpair(S, "A1", 0, -pc, -PAIR_GAP);
      xpair(S, "A2", 0, -pc, PAIR_GAP);
      xpair(S, "B1", 0, pc, -PAIR_GAP);
      xpair(S, "B2", 0, pc, PAIR_GAP);
      break;
    }
    case "anaphase-I": {
      // 减Ⅰ后期：同源分离——A1+B1 移向上极、A2+B2 移向下极（X 整体移动）；
      // 自由组合切换：B 对对调极性（A1 与 B1 同极 ↔ A1 与 B2 同极）
      const d = PAIR_GAP * 2;
      xpair(S, "A1", 0, -POLE_X, -POLE_Y);
      xpair(S, "A2", 0, POLE_X, POLE_Y);
      if (comboAlt) {
        xpair(S, "B2", 0, -POLE_X + d, -POLE_Y);
        xpair(S, "B1", 0, POLE_X - d, POLE_Y);
      } else {
        xpair(S, "B1", 0, POLE_X, -POLE_Y);
        xpair(S, "B2", 0, -POLE_X, POLE_Y);
      }
      break;
    }
    case "telophase-I": {
      // 减Ⅰ末期：两细胞各 2 个 X，并排居中（±13，为减Ⅱ中期排列做铺垫）
      xpair(S, "A1", 0, -PAIR_GAP, 0);
      xpair(S, "B2", 0, PAIR_GAP, 0);
      xpair(S, "A2", 1, -PAIR_GAP, 0);
      xpair(S, "B1", 1, PAIR_GAP, 0);
      break;
    }
    case "metaphase-II": {
      // 减Ⅱ中期：两细胞各 2 个 X 并排居中赤道板（±13, 0）
      xpair(S, "A1", 0, -PAIR_GAP, 0);
      xpair(S, "B2", 0, PAIR_GAP, 0);
      xpair(S, "B1", 1, -PAIR_GAP, 0);
      xpair(S, "A2", 1, PAIR_GAP, 0);
      break;
    }
    case "anaphase-II": {
      // 减Ⅱ后期：着丝点分裂——姐妹染色单体分赴本细胞上/下两极（垂直分离，与纺锤丝连接一致）
      split(S, "A1", 0, -PAIR_GAP, -SPLIT_V, -PAIR_GAP, SPLIT_V);
      split(S, "B2", 0, PAIR_GAP, -SPLIT_V, PAIR_GAP, SPLIT_V);
      split(S, "B1", 1, -PAIR_GAP, -SPLIT_V, -PAIR_GAP, SPLIT_V);
      split(S, "A2", 1, PAIR_GAP, -SPLIT_V, PAIR_GAP, SPLIT_V);
      break;
    }
    case "telophase-II": {
      // 减Ⅱ末期：四细胞 2×2——各极姐妹进入同列上下格（垂直分极的延续）
      rod(S, "A1", 0, -PAIR_GAP, -PAIR_GAP);
      rod(S, "B2", 0, PAIR_GAP, -PAIR_GAP);
      rod(S, "B1", 1, -PAIR_GAP, -PAIR_GAP);
      rod(S, "A2", 1, PAIR_GAP, -PAIR_GAP);
      S.A1b = { cell: 2, x: -PAIR_GAP, y: PAIR_GAP, a: 0 };
      S.B2b = { cell: 2, x: PAIR_GAP, y: PAIR_GAP, a: 0 };
      S.B1b = { cell: 3, x: -PAIR_GAP, y: PAIR_GAP, a: 0 };
      S.A2b = { cell: 3, x: PAIR_GAP, y: PAIR_GAP, a: 0 };
      break;
    }
    case "sperm": {
      // 变形期：分配同减Ⅱ末期，头部浓缩 + 尾部
      rod(S, "A1", 0, -PAIR_GAP, -PAIR_GAP);
      rod(S, "B2", 0, PAIR_GAP, -PAIR_GAP);
      rod(S, "B1", 1, -PAIR_GAP, -PAIR_GAP);
      rod(S, "A2", 1, PAIR_GAP, -PAIR_GAP);
      S.A1b = { cell: 2, x: -PAIR_GAP, y: PAIR_GAP, a: 0 };
      S.B2b = { cell: 2, x: PAIR_GAP, y: PAIR_GAP, a: 0 };
      S.B1b = { cell: 3, x: -PAIR_GAP, y: PAIR_GAP, a: 0 };
      S.A2b = { cell: 3, x: PAIR_GAP, y: PAIR_GAP, a: 0 };
      break;
    }
    default:
      // 段 4 卵细胞模式接管前的兜底：间期形态占位
      xpair(S, "A1", 0, -40, 40);
      xpair(S, "A2", 0, 40, 40);
      xpair(S, "B1", 0, -40, -40);
      xpair(S, "B2", 0, 40, -40);
  }
  return S;
}

/** 卵细胞模式逐阶段槽位表（阶段 6~10 的 x/y 为画布绝对坐标） */
function oocyteSlots(id: string): Slots {
  const S: Slots = {};
  switch (id) {
    case "oo-oogonium":
      rod(S, "A1", 0, -40, 40);
      rod(S, "A2", 0, 40, 40);
      rod(S, "B1", 0, -40, -40);
      rod(S, "B2", 0, 40, -40);
      break;
    case "oo-interphase":
      xpair(S, "A1", 0, -40, 40);
      xpair(S, "A2", 0, 40, 40);
      xpair(S, "B1", 0, -40, -40);
      xpair(S, "B2", 0, 40, -40);
      break;
    case "oo-prophase-I": {
      const gx = Math.round(76 * 0.55), gy = Math.round(76 * 0.35);
      xpair(S, "A1", 0, -gx - PAIR_GAP, -gy);
      xpair(S, "A2", 0, -gx + PAIR_GAP, -gy);
      xpair(S, "B1", 0, gx - PAIR_GAP, gy);
      xpair(S, "B2", 0, gx + PAIR_GAP, gy);
      break;
    }
    case "oo-metaphase-I": {
      // 对心距 132 → 每对 ±66
      const pc = 66;
      xpair(S, "A1", 0, -pc, -PAIR_GAP);
      xpair(S, "A2", 0, -pc, PAIR_GAP);
      xpair(S, "B1", 0, pc, -PAIR_GAP);
      xpair(S, "B2", 0, pc, PAIR_GAP);
      break;
    }
    case "oo-anaphase-I": {
      // 卵细胞减Ⅰ后期：同源分离（X 整体移动；不均等分裂由轮廓表达）
      xpair(S, "A1", 0, -POLE_X, -POLE_Y);
      xpair(S, "A2", 0, POLE_X, POLE_Y);
      xpair(S, "B1", 0, POLE_X, -POLE_Y);
      xpair(S, "B2", 0, -POLE_X, POLE_Y);
      break;
    }
    case "oo-telophase-I": {
      // 减Ⅰ末期：大次级卵母细胞 {A1,B1} + 第一极体 {A2,B2}（不均等分裂，约 3:1）
      xpair(S, "A1", 0, 227, 200);
      xpair(S, "B1", 0, 253, 200);
      xpair(S, "A2", 0, 341, 61);
      xpair(S, "B2", 0, 365, 61);
      break;
    }
    case "oo-metaphase-II": {
      // 减Ⅱ中期：大细胞赤道板排列；极体①跟随（减Ⅱ停滞待受精）
      xpair(S, "A1", 0, 227, 200);
      xpair(S, "B1", 0, 253, 200);
      xpair(S, "A2", 0, 341, 61);
      xpair(S, "B2", 0, 365, 61);
      break;
    }
    case "oo-anaphase-II": {
      // 减Ⅱ后期：大细胞内着丝点分裂——姐妹染色单体分赴本细胞上/下两极（垂直分离）；极体①保持 X
      S.A1a = { cell: 0, x: OO_CENTER[0] - PAIR_GAP, y: OO_CENTER[1] - 84, a: 0 };
      S.A1b = { cell: 0, x: OO_CENTER[0] - PAIR_GAP, y: OO_CENTER[1] + 84, a: 0 };
      S.B1a = { cell: 0, x: OO_CENTER[0] + PAIR_GAP, y: OO_CENTER[1] - 84, a: 0 };
      S.B1b = { cell: 0, x: OO_CENTER[0] + PAIR_GAP, y: OO_CENTER[1] + 84, a: 0 };
      xpair(S, "A2", 0, 341, 61);
      xpair(S, "B2", 0, 365, 61);
      break;
    }
    case "oo-telophase-II":
    case "oo-egg": {
      // 减Ⅱ末期/成熟卵：8 根杆守恒分配——
      // 卵{A1a,B1a} + 极体①{A2a,B2a} + 极体②{A2b,B2b} + 极体③{A1b,B1b}，每细胞恰 2 条
      rod(S, "A1", 0, 227, 200);
      rod(S, "B1", 0, 253, 200);
      rod(S, "A2", 0, 341, 61);
      rod(S, "B2", 0, 365, 61);
      S.A1b = { cell: 0, x: 371, y: 317, a: 0 };   // 极体③ 左半
      S.B1b = { cell: 0, x: 387, y: 317, a: 0 };   // 极体③ 右半
      S.A2b = { cell: 0, x: 413, y: 184, a: 0 };   // 极体② 左半
      S.B2b = { cell: 0, x: 429, y: 184, a: 0 };   // 极体② 右半
      break;
    }
    default:
      // 兜底：间期形态占位
      xpair(S, "A1", 0, -40, 40);
      xpair(S, "A2", 0, 40, 40);
      xpair(S, "B1", 0, -40, -40);
      xpair(S, "B2", 0, 40, -40);
  }
  return S;
}

/** 槽位总入口：模式 + 阶段 + 自由组合 → 每单体的目标位 */
export function slotsFor(s: MeiosisState, comboAlt = false): Slots {
  return s.stage?.startsWith("oo-") ? oocyteSlots(s.stage) : spermSlots(s.stage, comboAlt);
}

// ============ 细胞轮廓（预声明 DOM 池 + updatePool 按阶段切换显隐） ============
// 池元素在 mount() 中创建，全程不 remove+reappend，由 CSS transition 补间显隐与形变
const bgPool = {
  spermCircles: [] as SVGCircleElement[],
  spermEllipses: [] as SVGEllipseElement[],
  spermTails: [] as SVGPathElement[],
  oocyteLarge: null as SVGCircleElement | null,
  polarBodies: [] as SVGCircleElement[],
  oocyteEccentric: null as SVGEllipseElement | null,
  // 纺锤丝：池化 line，几何由 updateSpindleLines 每次重设（极点端固定两极）
  spindleLines: [] as SVGLineElement[],
};

/** 更新背景元素池的显隐与几何：精子模式 vs 卵细胞模式互斥 */
function updatePool(root: SVGSVGElement, s: MeiosisState): void {
  const radius = CELL_RADIUS[s.cells] ?? 62;
  const isOocyte = s.cells === 2 && s.unequal;
  const centers = CELL_CENTERS[s.cells] ?? [];
  const pbCount = s.polarBodies ?? 0;
  const pbAngles = PB_ANGLES[pbCount] ?? [];

  // 精子模式
  const showSperm = !isOocyte;
  for (let i = 0; i < 4; i++) {
    const c = bgPool.spermCircles[i];
    const e = bgPool.spermEllipses[i];
    const t = bgPool.spermTails[i];
    if (showSperm && i < centers.length && !s.spermShape) {
      const [cx, cy] = centers[i];
      c.setAttribute("cx", String(cx));
      c.setAttribute("cy", String(cy));
      c.setAttribute("r", String(radius));
      c.style.opacity = "1";
      e.style.opacity = "0";
      t.style.opacity = "0";
    } else if (showSperm && i < centers.length && s.spermShape) {
      const [cx, cy] = centers[i];
      e.setAttribute("cx", String(cx));
      e.setAttribute("cy", String(cy));
      e.setAttribute("rx", String(Math.round(radius * 0.6)));
      e.setAttribute("ry", String(Math.round(radius * 0.52)));
      e.style.opacity = "1";
      t.setAttribute("d", `M ${cx + radius * 0.38} ${cy} q ${radius * 0.5} ${-18} ${radius * 0.95} 0 q ${radius * 0.45} ${18} ${radius * 0.85} ${-4}`);
      t.style.opacity = "1";
      c.style.opacity = "0";
    } else {
      c.style.opacity = "0";
      e.style.opacity = "0";
      t.style.opacity = "0";
    }
  }

  // 卵细胞模式
  if (isOocyte) {
    bgPool.oocyteLarge!.setAttribute("cx", String(OO_CENTER[0]));
    bgPool.oocyteLarge!.setAttribute("cy", String(OO_CENTER[1]));
    bgPool.oocyteLarge!.style.opacity = "1";
    bgPool.oocyteEccentric!.style.opacity = "0";
    for (let i = 0; i < 3; i++) {
      const pb = bgPool.polarBodies[i];
      if (i < pbAngles.length) {
        const [px, py] = pbCenter(pbAngles[i]);
        pb.setAttribute("cx", String(px));
        pb.setAttribute("cy", String(py));
        pb.style.opacity = "1";
      } else {
        pb.style.opacity = "0";
      }
    }
  } else if (s.cells === 1 && s.unequal) {
    // 卵细胞减Ⅰ后期：偏心椭圆
    const [cx, cy] = centers[0] ?? [400, 200];
    bgPool.oocyteLarge!.style.opacity = "0";
    bgPool.oocyteEccentric!.setAttribute("cx", String(cx));
    bgPool.oocyteEccentric!.setAttribute("cy", String(cy + Math.round(radius * 0.08)));
    bgPool.oocyteEccentric!.setAttribute("rx", String(Math.round(radius * 0.92)));
    bgPool.oocyteEccentric!.setAttribute("ry", String(Math.round(radius * 1.06)));
    bgPool.oocyteEccentric!.style.opacity = "1";
    bgPool.polarBodies.forEach((pb) => { pb.style.opacity = "0"; });
  } else {
    bgPool.oocyteLarge!.style.opacity = "0";
    bgPool.oocyteEccentric!.style.opacity = "0";
    bgPool.polarBodies.forEach((pb) => { pb.style.opacity = "0"; });
  }
}

// ============ 纺锤丝：池化 line + setAttribute 几何 + CSS transition ============
/** 更新纺锤丝：每根 line 直接由极点指向染色体（极点端固定在两极，染色体端跟随） */
function updateSpindleLines(
  s: MeiosisState,
  slots: Record<string, { cell: number; x: number; y: number; a: number }>,
  comboAlt: boolean,
): void {
  const fibers = fibersFor(s, comboAlt);
  const centers = CELL_CENTERS[s.cells] ?? [];
  const oocyteAbs = s.cells === 2 && s.unequal;   // 卵细胞两细胞期：槽位即画布绝对坐标

  fibers.forEach((f, idx) => {
    const sl = slots[f.key];
    if (!sl) return;
    // 染色体画布坐标
    const [bx, by] = oocyteAbs ? [0, 0] : centers[sl.cell] ?? [0, 0];
    const tx = bx + sl.x;
    const ty = by + sl.y;
    // 极点：卵细胞两细胞期大细胞用 OO_CENTER，其余用所属细胞中心 ± POLE_OFFSET
    const center = oocyteAbs ? OO_CENTER : centers[f.cell] ?? [0, 0];
    const yOff = s.unequal ? OO_POLE_SHIFT : 0;
    const pole: [number, number] = f.pole === "top"
      ? [center[0], center[1] - POLE_OFFSET + yOff]
      : [center[0], center[1] + POLE_OFFSET + yOff];

    const line = bgPool.spindleLines[idx];
    line.setAttribute("x1", String(pole[0]));
    line.setAttribute("y1", String(pole[1]));
    line.setAttribute("x2", String(tx));
    line.setAttribute("y2", String(ty));
    line.style.opacity = "1";
  });

  // 隐藏未使用的线
  for (let i = fibers.length; i < bgPool.spindleLines.length; i++) {
    bgPool.spindleLines[i].style.opacity = "0";
  }
}

// ============ 工具 ============
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** 气泡文案：描述该单体的单体数与同源染色体有无 */
function describe(s: MeiosisState, chrom: string): string {
  const info = CHROM_INFO[chrom];
  // 减Ⅰ结束后（进入两个细胞，或正处于任一分离期）细胞中已无同源染色体
  const mono = s.cells >= 2 || s.separating !== "none";
  return `${info.long ? "长" : "短"}染色体（${chrom}，基因 ${info.gene}）：` +
    `当前${s.replicated ? "含 2 条姐妹染色单体" : "无染色单体"}；` +
    `${mono ? "同源染色体已分离，细胞中不存在其同源染色体" : "细胞中存在它的同源染色体"}`;
}

// ============ 场景组件 ============
export function createMeiosisScene(): SceneComponent & { destroy(): void } {
  let root: SVGSVGElement | null = null;
  let wrap: HTMLDivElement | null = null;
  let bubble: HTMLDivElement | null = null;
  let comboBtn: HTMLButtonElement;
  let comboHint: HTMLDivElement;
  let comboAlt = false;
  let showGenes = false;
  let lastState: MeiosisState | null = null;
  const groups = new Map<string, SVGGElement>();

  /** 核心：查槽位表 → 每单体设置 translate+rotate（唯一渲染路径，无特判） */
  function layout(s: MeiosisState): void {
    if (!root) return;
    updatePool(root, s);
    const slots = slotsFor(s, comboAlt);
    updateSpindleLines(s, slots, comboAlt);
    const centers = CELL_CENTERS[s.cells] ?? [];
    const oocyteAbs = s.cells === 2 && s.unequal;   // 卵细胞 cells=2 阶段：槽位即绝对坐标
    const radius = CELL_RADIUS[s.cells] ?? 62;
    const fs = Math.max(13, Math.round(radius * 0.16));

    CHROMATIDS.forEach((spec) => {
      const g = groups.get(spec.key)!;
      const slot = slots[spec.key];
      const [bx, by] = oocyteAbs ? [0, 0] : centers[slot.cell] ?? [0, 0];
      g.style.transform = `translate(${bx + slot.x}px, ${by + slot.y}px) rotate(${slot.a}deg)`;
      // 标注反向旋转保持文字直立；字号随细胞半径自适应（变形期随组缩放需反向补偿）
      const lbl = g.querySelector("text")!;
      lbl.setAttribute("transform", `rotate(${-slot.a})`);
      lbl.setAttribute("visibility", showGenes ? "visible" : "hidden");
      lbl.setAttribute("font-size", String(s.spermShape ? Math.round(fs / 0.45) : fs));
      lbl.classList.toggle("gene-label-lg", fs >= 18);
    });

    // 自由组合按钮与说明文字：仅减Ⅰ后期（同源分离）可用
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

  function hideBubble(): void {
    if (bubble) bubble.style.display = "none";
  }

  return {
    /** 挂载：创建 SVG、8 个单体组与交互控件 */
    mount(container: HTMLElement) {
      wrap = document.createElement("div");
      wrap.className = "meiosis-scene";
      const svgRoot = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}`, width: "100%" });
      root = svgRoot;
      // 可重入：清空池引用防止跨挂载累积
      bgPool.spermCircles.length = 0;
      bgPool.spermEllipses.length = 0;
      bgPool.spermTails.length = 0;
      bgPool.polarBodies.length = 0;
      bgPool.oocyteLarge = null;
      bgPool.oocyteEccentric = null;
      // 纺锤丝池清空（测试隔离）
      bgPool.spindleLines.forEach((l) => l.remove());
      bgPool.spindleLines.length = 0;
      bubble = document.createElement("div");
      bubble.className = "chromo-bubble";
      bubble.style.display = "none";
      comboHint = document.createElement("div");
      comboHint.className = "combo-hint";
      comboHint.style.display = "none";
      wrap.append(comboHint, svgRoot, bubble);

      const bar = document.createElement("div");
      bar.className = "scene-controls";
      const geneToggle = document.createElement("label");
      geneToggle.innerHTML = `<input type="checkbox" /> 显示基因标注`;
      geneToggle.querySelector("input")!.addEventListener("change", (e) => {
        showGenes = (e.target as HTMLInputElement).checked;
        if (lastState) layout(lastState);
      });
      comboBtn = document.createElement("button");
      comboBtn.disabled = true;
      comboBtn.textContent = "自由组合（减Ⅰ后期可用）";
      comboBtn.addEventListener("click", () => {
        if (comboBtn.disabled) return;
        comboAlt = !comboAlt;
        if (lastState) layout(lastState);
      });
      // 模式切换：精子/卵细胞形成互切，路由参数触发整页重挂载（重置到第 0 步）
      const inOocyte = /mode=oocyte/.test(location.hash);
      const modeBtn = document.createElement("button");
      modeBtn.className = "mode-switch";
      modeBtn.textContent = inOocyte ? "切换到精子形成" : "切换到卵细胞形成";
      modeBtn.addEventListener("click", () => {
        location.hash = inOocyte ? "#/course/meiosis" : "#/course/meiosis?mode=oocyte";
      });
      bar.append(geneToggle, comboBtn, modeBtn);
      wrap.appendChild(bar);

      // 细胞背景元素池：一次创建全程复用，由 updatePool 按阶段切换显隐（禁止每帧 remove+reappend）
      const BG_STYLE = { fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": 2 };
      for (let i = 0; i < 4; i++) {
        const c = el("circle", { class: "cell-outline", r: 62, ...BG_STYLE, opacity: 0 });
        bgPool.spermCircles.push(c);
        svgRoot.appendChild(c);
      }
      for (let i = 0; i < 4; i++) {
        const e = el("ellipse", { class: "cell-outline", ...BG_STYLE, opacity: 0 });
        bgPool.spermEllipses.push(e);
        svgRoot.appendChild(e);
      }
      for (let i = 0; i < 4; i++) {
        const t = el("path", { class: "sperm-tail", fill: "none", stroke: "#94a3b8", "stroke-width": 2, opacity: 0 });
        bgPool.spermTails.push(t);
        svgRoot.appendChild(t);
      }
      bgPool.oocyteLarge = el("circle", { class: "cell-outline", r: OO_RADIUS, ...BG_STYLE, opacity: 0 });
      svgRoot.appendChild(bgPool.oocyteLarge);
      for (let i = 0; i < 3; i++) {
        const pb = el("circle", { class: "polar-body cell-outline", r: PB_R, fill: "#fef9c388", stroke: "#94a3b8", "stroke-width": 2, opacity: 0 });
        bgPool.polarBodies.push(pb);
        svgRoot.appendChild(pb);
      }
      bgPool.oocyteEccentric = el("ellipse", { class: "cell-outline", ...BG_STYLE, opacity: 0 });
      svgRoot.appendChild(bgPool.oocyteEccentric);

      // 纺锤丝池：16 根 line，几何由 updateSpindleLines 每次重设（极点端固定）
      for (let i = 0; i < 16; i++) {
        const line = el("line", { class: "spindle-line", x1: 0, y1: 0, x2: 0, y2: 0, stroke: "#d4a574", "stroke-width": 1.5, opacity: 0 });
        bgPool.spindleLines.push(line);
        svgRoot.appendChild(line);
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

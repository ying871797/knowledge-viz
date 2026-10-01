/**
 * 细胞呼吸场景（必修一 1-5.3）
 *
 * 设计要点：
 * - **声明式槽位表**：LAYOUT 以 stage id 为键，声明该幕每个元素的位置与显隐。
 *   render() 只读表、不含任何 stage id 分支（AGENTS.md「按 stage id 分支 = 模型选错的信号」）。
 * - **固定元素集**：所有元素在 mount() 中一次性建池（背景层 / 分子层 / ATP 量块 / 反应式），
 *   阶段切换只改 style.transform 与 style.opacity，零 DOM 增删（防闪烁与过渡中断）。
 * - **过渡通道**：一律 style.transform / style.opacity，不写 SVG transform/opacity 属性
 *   （属性写入不触发 CSS transition）。ATP 量用「6 个小块 + 显隐」表达，不用 scaleY
 *   ——SVG 的 transform-box/transform-origin 解析在各浏览器不一致，缩放几何有风险，
 *   而 opacity 是最稳的通道（与 [H] 小圆的「少量/大量」表达法同构）。
 *
 * 【示意取舍】(1) 分子用「示意计数」：O₂ 取 3 粒、CO₂ 取 2 粒、H₂O 取 2 粒、[H] 取 4 粒，
 *   用于表达「少量/大量」的定性对比；真实计量（1 葡萄糖 ↔ 6 O₂ / 6 CO₂ / 12 H₂O）
 *   由最后一幕的反应式文本 + 曲线图承载。理由：真实计量会让分子元素达 18 个，
 *   违反元素纪律（去掉 5/6 的粒子后理解成本不上升）。讲解文案已明说「分子为示意计数」。
 * (2) [H] 画成带方括号的「载体小圆」，不画成自由 H 原子，讲解与图例点明即 NADH。
 * (3) 线粒体内膜只画 4 条嵴示意线，不画内膜折叠的完整结构。
 * (4) 酒精只在无氧模式出现（教材对乳酸菌只给文字描述，不要求结构细节），
 *   人与动物细胞的无氧呼吸以文字 + 公式卡承载。
 * (5) 丙酮酸不画 C 原子骨架（教材本就用「丙酮酸」作为整体），避免暗示结构细节。
 */
import type { SceneComponent, StageIdState } from "../../core/types";

const NS = "http://www.w3.org/2000/svg";
/** 画布尺寸；移动端 aspect-ratio 上限由 __tests__/mobileScene.test.ts 实测约束 */
const VIEW_W = 960;
const VIEW_H = 500;
const COURSE_ID = "cellular-respiration";

// —— 配色（颜色是冗余编码：每个分子都自带文字标签，不是唯一区分通道）——
const C_GLUCOSE = "#f59e0b"; // 琥珀：葡萄糖
const C_O2 = "#38bdf8"; // 天蓝：O₂
const C_H2O = "#22d3ee"; // 青：H₂O
const C_CO2 = "#94a3b8"; // 灰蓝：CO₂
const C_PYR = "#a855f7"; // 紫：丙酮酸
const C_H = "#e11d48"; // 玫红：[H] 载体
const C_ATP = "#16a34a"; // 绿：ATP
const C_ALCOHOL = "#c084fc"; // 浅紫：酒精

interface Slot {
  x: number;
  y: number;
}

/** 场所高亮的目标 */
type Highlight = "cyto" | "matrix" | "membrane" | "none";

/**
 * 单幕的场景状态：只声明「位置 + 显隐 + 高亮 + ATP 量级 + 反应式」，
 * 没有任何行为分支。
 */
interface SlotMap {
  glucose: Slot;                       // 葡萄糖
  o2: Slot;                            // O₂ 云（三粒的整体中心）
  pyruvate: [Slot, Slot];              // 丙酮酸 ×2
  co2: [Slot, Slot];                   // CO₂ ×2
  h: [Slot, Slot, Slot, Slot];         // [H] 小圆 ×4
  h2o: [Slot, Slot];                   // H₂O ×2
  alcohol: [Slot, Slot];               // 酒精 ×2（仅无氧模式）
  hPoolLit: boolean;                   // [H] 汇集槽是否点亮
  hCount: number;                      // 可见 [H] 粒数（0..4）
  atpCount: number;                    // 可见 ATP 量块数（0..6，定性量级，非分子数）
  show: {                              // 各分子的显隐（[H] / ATP 由 hCount / atpCount 控制）
    glucose: boolean;
    o2: boolean;
    pyruvate: boolean;
    co2: boolean;
    h2o: boolean;
    alcohol: boolean;
  };
  hl: Highlight;                       // 场所高亮落在哪
  mitoDim: boolean;                    // 线粒体是否整体淡化（无氧模式）
  eq: { left: string; right: string } | null; // 底部反应式；null = 不显示
}

// —— 细胞质基质侧的槽位（细胞轮廓 x36..500 / y36..420 内）——
const CELL: {
  glucose: Slot;
  o2: Slot;
  pyruvate: [Slot, Slot];
  alcohol: [Slot, Slot];
  co2InCell: [Slot, Slot];
  hPool: [Slot, Slot, Slot, Slot];
} = {
  glucose: { x: 152, y: 142 },
  o2: { x: 376, y: 142 },
  pyruvate: [{ x: 176, y: 240 }, { x: 312, y: 240 }],
  /** 酒精（无氧产物）落在丙酮酸位：两模式不同时可见 */
  alcohol: [{ x: 176, y: 240 }, { x: 312, y: 240 }],
  /** CO₂ 在细胞质一侧的落点（无氧模式） */
  co2InCell: [{ x: 430, y: 186 }, { x: 430, y: 292 }],
  /** [H] 汇集槽内 4 个位置（横向，间距 56 ≥ 直径 24 + 4） */
  hPool: [{ x: 262, y: 359 }, { x: 318, y: 359 }, { x: 374, y: 359 }, { x: 430, y: 359 }],
};

// —— 线粒体侧的槽位（内膜椭圆 cx720 cy228 rx140 ry108 内）——
const MITO: {
  hMembrane: [Slot, Slot, Slot, Slot];
  membraneSite: Slot;
  waterSite: [Slot, Slot];
  pyruvateIn: [Slot, Slot];
  co2InMatrix: [Slot, Slot];
  co2Released: [Slot, Slot];
} = {
  /** [H] 停靠位：落在线粒体内膜左弧的 4 个点上（球 r=12，两两中心距 ≥ 37） */
  hMembrane: [{ x: 605, y: 166 }, { x: 582, y: 209 }, { x: 582, y: 247 }, { x: 605, y: 290 }],
  /** O₂ 抵达内膜旁的位置（第 3 阶段发生「氧被还原成水」的场所） */
  membraneSite: { x: 688, y: 228 },
  /** H₂O 落点：与 membraneSite 同一水平带、左右分列两粒（不叠放，才能读出「2 粒」）。
   *  与 O₂ 三粒占据的 640~736 区间重叠 → 第 3 幕「O₂ 消失、H₂O 原地出现」即视觉上的转化 */
  waterSite: [{ x: 664, y: 228 }, { x: 720, y: 228 }],
  /** 丙酮酸进入线粒体基质后的落点（右列） */
  pyruvateIn: [{ x: 764, y: 176 }, { x: 764, y: 272 }],
  /** CO₂ 在基质中产生的落点（左列，避开内膜所在的水平带） */
  co2InMatrix: [{ x: 652, y: 160 }, { x: 652, y: 300 }],
  /** CO₂ 抵达线粒体外膜、准备释放到细胞外的落点 */
  co2Released: [{ x: 864, y: 176 }, { x: 864, y: 280 }],
};

/** ATP 量块：2 列 × 3 行，从下往上填充，靠显隐表达「少量 → 大量」的定性量级 */
const ATP_SLOTS: Slot[] = [
  { x: 88, y: 344 }, { x: 114, y: 344 },
  { x: 88, y: 324 }, { x: 114, y: 324 },
  { x: 88, y: 304 }, { x: 114, y: 304 },
];

// —— 线粒体内膜上的嵴（内膜向内折叠，示意）——
// 起止点取自内膜椭圆左弧（cx720, cy228, rx140, ry108）上的 4 个位置，向圆心方向伸入约 26px
const CRISTAE: Array<[number, number, number, number]> = [
  [605, 166, 628, 178],
  [582, 209, 608, 213],
  [582, 247, 608, 243],
  [605, 290, 628, 278],
];

const EQ_AEROBIC = {
  left: "C₆H₁₂O₆ + 6O₂ + 6H₂O",
  right: "6CO₂ + 12H₂O + 能量",
};
const EQ_ALCOHOL = {
  left: "C₆H₁₂O₆",
  right: "2C₂H₅OH + 2CO₂ + 少量能量",
};

// —— 各幕槽位表（唯一事实源；无氧第 2 幕按教材 alcohol 发酵演示，
//     乳酸菌路线由讲解文案 + 公式卡承载，画面不画结构）——
const LAYOUT: Record<string, SlotMap> = {
  // ========== 有氧模式 ==========
  // 0 反应物总览：只有葡萄糖与 O₂，线粒体未激活，ATP 为空
  "aerobic-overview": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: false,
    hCount: 0,
    atpCount: 0,
    show: { glucose: true, o2: true, pyruvate: false, co2: false, h2o: false, alcohol: false },
    hl: "none",
    mitoDim: false,
    eq: null,
  },
  // 1 第 1 阶段场所：高亮细胞质基质
  "stage1-site": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: false,
    hCount: 0,
    atpCount: 0,
    show: { glucose: true, o2: true, pyruvate: false, co2: false, h2o: false, alcohol: false },
    hl: "cyto",
    mitoDim: false,
    eq: null,
  },
  // 2 第 1 阶段分解：葡萄糖消失，2 粒丙酮酸出现
  "stage1-split": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: false,
    hCount: 0,
    atpCount: 1,
    show: { glucose: false, o2: true, pyruvate: true, co2: false, h2o: false, alcohol: false },
    hl: "cyto",
    mitoDim: false,
    eq: null,
  },
  // 3 第 1 阶段产物：少量 [H] 进入汇集槽，ATP 微量
  "stage1-yield": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: true,
    hCount: 2, // 少量
    atpCount: 2,
    show: { glucose: false, o2: true, pyruvate: true, co2: false, h2o: false, alcohol: false },
    hl: "cyto",
    mitoDim: false,
    eq: null,
  },
  // 4 第 2 阶段场所：丙酮酸进入线粒体基质，高亮基质
  "stage2-site": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: MITO.pyruvateIn,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: true,
    hCount: 2,
    atpCount: 2,
    show: { glucose: false, o2: true, pyruvate: true, co2: false, h2o: false, alcohol: false },
    hl: "matrix",
    mitoDim: false,
    eq: null,
  },
  // 5 第 2 阶段脱羧：丙酮酸消失，CO₂ 出现在基质，[H] 增到大量
  "stage2-decarb": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: MITO.pyruvateIn,
    co2: MITO.co2InMatrix,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: true,
    hCount: 4, // 大量
    atpCount: 3,
    show: { glucose: false, o2: true, pyruvate: false, co2: true, h2o: false, alcohol: false },
    hl: "matrix",
    mitoDim: false,
    eq: null,
  },
  // 6 第 3 阶段场所：O₂ 进入线粒体内膜、[H] 集体移至内膜，高亮内膜
  "stage3-site": {
    glucose: CELL.glucose,
    o2: MITO.membraneSite,
    pyruvate: MITO.pyruvateIn,
    co2: MITO.co2InMatrix,
    h: MITO.hMembrane,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: false,
    hCount: 4,
    atpCount: 3,
    show: { glucose: false, o2: true, pyruvate: false, co2: true, h2o: false, alcohol: false },
    hl: "membrane",
    mitoDim: false,
    eq: null,
  },
  // 7 第 3 阶段生成水：O₂ 消失、[H] 归零，原地生成 H₂O，ATP 大量
  "stage3-water": {
    glucose: CELL.glucose,
    o2: MITO.membraneSite,
    pyruvate: MITO.pyruvateIn,
    co2: MITO.co2InMatrix,
    h: MITO.hMembrane,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: false,
    hCount: 0, // [H] 被 O₂ 全部用掉
    atpCount: 6, // 大量
    show: { glucose: false, o2: false, pyruvate: false, co2: true, h2o: true, alcohol: false },
    hl: "membrane",
    mitoDim: false,
    eq: null,
  },
  // 8 总反应式：CO₂ 移至外膜待释放，反应式出现
  "aerobic-total": {
    glucose: CELL.glucose,
    o2: MITO.membraneSite,
    pyruvate: MITO.pyruvateIn,
    co2: MITO.co2Released,
    h: MITO.hMembrane,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: false,
    hCount: 0,
    atpCount: 6,
    show: { glucose: false, o2: false, pyruvate: false, co2: true, h2o: true, alcohol: false },
    hl: "none",
    mitoDim: false,
    eq: EQ_AEROBIC,
  },

  // ========== 无氧模式 ==========
  // 0 条件：无氧 —— O₂ 不参与、线粒体整体淡化
  //    eq 保持 null：反应式是全课收尾核对，只在第 4 幕（能量去向）出现一次。
  //    早期版本在此幕也显示 eq，导致「p0 显示 → p1~p3 消失 → p4 重现」的闪烁节奏
  //    （违反「一阶段一信息」「切换安静」），且学生会误以为反应式绑定某一幕。
  //    总反应式的文字仍由该幕 narration 第 2 句口述，信息不丢。
  "anaerobic-condition": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: false,
    hCount: 0,
    atpCount: 0,
    show: { glucose: true, o2: false, pyruvate: false, co2: false, h2o: false, alcohol: false },
    hl: "none",
    mitoDim: true,
    eq: null,
  },
  // 1 第 1 阶段（与有氧共用）
  "anaerobic-stage1": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: true,
    hCount: 2,
    atpCount: 2,
    show: { glucose: false, o2: false, pyruvate: true, co2: false, h2o: false, alcohol: false },
    hl: "cyto",
    mitoDim: true,
    eq: null,
  },
  // 2 第 2 阶段场所：仍在细胞质基质
  "anaerobic-site": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: true,
    hCount: 2,
    atpCount: 2,
    show: { glucose: false, o2: false, pyruvate: true, co2: false, h2o: false, alcohol: false },
    hl: "cyto",
    mitoDim: true,
    eq: null,
  },
  // 3 第 2 阶段产物：丙酮酸 → 酒精 + CO₂；[H] 保持不被消耗（高频错点，用断言锁死）
  "anaerobic-products": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: true,
    hCount: 2, // 关键：与上一幕相同 —— 无氧呼吸不消耗 [H]
    atpCount: 2,
    show: { glucose: false, o2: false, pyruvate: false, co2: true, h2o: false, alcohol: true },
    hl: "cyto",
    mitoDim: true,
    eq: null,
  },
  // 4 能量去向：ATP 维持微量
  "anaerobic-yield": {
    glucose: CELL.glucose,
    o2: CELL.o2,
    pyruvate: CELL.pyruvate,
    co2: CELL.co2InCell,
    h: CELL.hPool,
    h2o: MITO.waterSite,
    alcohol: CELL.alcohol,
    hPoolLit: true,
    hCount: 2,
    atpCount: 2,
    show: { glucose: false, o2: false, pyruvate: false, co2: true, h2o: false, alcohol: true },
    hl: "cyto",
    mitoDim: true,
    eq: EQ_ALCOHOL,
  },
};

export function createRespirationScene(): SceneComponent & { destroy(): void } {
  // —— DOM 池引用（mount 时填充；每次 mount 重建，保证可重入）——
  let svg!: SVGSVGElement;
  let wrap: HTMLDivElement | null = null;
  let hlCyto!: SVGRectElement;
  let hlMatrix!: SVGEllipseElement;
  let hlMembrane!: SVGEllipseElement;
  let mitoLayer!: SVGGElement;
  let hPool!: SVGRectElement;
  let hLabel!: SVGTextElement;
  let glucoseG!: SVGGElement;
  let o2G!: SVGGElement;
  let co2G: SVGGElement[] = [];
  let hG: SVGGElement[] = [];
  let h2oG: SVGGElement[] = [];
  let alcoholG: SVGGElement[] = [];
  let pyruvateG: SVGGElement[] = [];
  let atpBlocks: SVGGElement[] = [];
  let eqLayer!: SVGGElement;
  let eqLeft!: SVGTextElement;
  let eqRight!: SVGTextElement;

  function el<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
  ): SVGElementTagNameMap[K] {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  /** 居中文字（用 dy=0.35em 而非 dominant-baseline，兼容性更稳） */
  function text(content: string, size: number, fill: string, anchor: "middle" | "start" = "middle"): SVGTextElement {
    const t = el("text", {
      "text-anchor": anchor,
      dy: "0.35em",
      "font-size": String(size),
      fill,
    });
    t.textContent = content;
    return t;
  }

  /** 药丸形分子（圆角矩形 + 居中文字），局部坐标以中心为原点 */
  function pill(label: string, w: number, h: number, fill: string, fontSize: number): SVGGElement {
    const g = el("g");
    g.append(el("rect", { x: String(-w / 2), y: String(-h / 2), width: String(w), height: String(h), rx: String(h / 2), fill }));
    g.append(text(label, fontSize, "#ffffff"));
    return g;
  }

  /** 圆形分子（圆 + 居中文字） */
  function ball(label: string, r: number, fill: string, fontSize: number): SVGGElement {
    const g = el("g");
    g.append(el("circle", { r: String(r), fill }));
    g.append(text(label, fontSize, "#ffffff"));
    return g;
  }

  /** 把元素移到某个槽位：唯一的位置写入通道 */
  function place(node: SVGElement, slot: Slot): void {
    node.style.transform = `translate(${slot.x}px, ${slot.y}px)`;
  }

  /** 显隐：opacity 通道（CSS transition 可过渡，attribute 不可） */
  function setVisible(node: SVGElement, visible: boolean): void {
    node.style.opacity = visible ? "1" : "0";
  }

  function mount(container: HTMLElement): void {
    // 可重入：清空池引用，防止测试多次挂载时跨挂载累积
    co2G = []; hG = []; h2oG = []; alcoholG = []; pyruvateG = []; atpBlocks = [];

    const wrapEl = document.createElement("div");
    wrapEl.className = "resp-scene";
    wrap = wrapEl;
    svg = el("svg", { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, width: "100%", class: "scene-svg" });
    // 幕 id 挂在 svg 上，供测试直接断言当前幕与槽位一致
    svg.dataset.stage = "";

    // — 细胞（细胞质基质）—
    svg.append(el("rect", {
      x: "36", y: "36", width: "464", height: "384", rx: "48",
      class: "cell-outline", fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": "2",
    }));
    hlCyto = el("rect", { x: "52", y: "52", width: "432", height: "352", rx: "38", class: "site-hl" });
    hlCyto.setAttribute("fill", "rgba(56,189,248,0.10)");
    hlCyto.style.opacity = "0";
    svg.append(hlCyto);
    const cytoName = text("细胞质基质", 13, "#64748b", "start");
    cytoName.setAttribute("transform", "translate(76, 66)");
    svg.append(cytoName);

    // [H] 汇集槽：示意 [H] 载体在细胞质基质中的临时汇集处
    hPool = el("rect", {
      x: "190", y: "332", width: "260", height: "54", rx: "16", class: "h-pool",
      fill: "rgba(225,29,72,0.05)", stroke: "#fda4af", "stroke-width": "1.5", "stroke-dasharray": "5 4",
    });
    hPool.style.opacity = "0";
    svg.append(hPool);
    hLabel = text("[H]", 12, "#e11d48", "start");
    hLabel.setAttribute("transform", "translate(204, 366)");
    hLabel.style.opacity = "0";
    svg.append(hLabel);

    // — 线粒体（外膜 / 内膜 / 嵴 / 三处场所标注）—
    mitoLayer = el("g", { class: "mito-layer" });
    const outer = el("ellipse", {
      cx: "720", cy: "228", rx: "180", ry: "148", class: "mito-outer",
      fill: "rgba(248,250,252,0.9)", stroke: "#94a3b8", "stroke-width": "2",
    });
    hlMatrix = el("ellipse", { cx: "720", cy: "228", rx: "140", ry: "108", class: "site-hl" });
    hlMatrix.setAttribute("fill", "rgba(245,158,11,0.12)");
    hlMatrix.style.opacity = "0";
    const inner = el("ellipse", {
      cx: "720", cy: "228", rx: "140", ry: "108", class: "mito-inner",
      fill: "none", stroke: "#94a3b8", "stroke-width": "2",
    });
    hlMembrane = el("ellipse", {
      cx: "720", cy: "228", rx: "140", ry: "108", class: "site-hl",
      fill: "none", stroke: "#f59e0b", "stroke-width": "7", "stroke-opacity": "0.55",
    });
    hlMembrane.style.opacity = "0";
    const cristae = el("g", { class: "cristae" });
    for (const [x1, y1, x2, y2] of CRISTAE) {
      cristae.append(el("line", {
        x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2), class: "crista",
      }));
    }
    const mitoName = text("线粒体", 14, "#64748b");
    mitoName.setAttribute("transform", "translate(720, 62)");
    // 线粒体基质标注放在矩阵底部中央——左上/左下留给 CO₂ 落点、右列留给丙酮酸落点
    const matrixName = text("线粒体基质", 13, "#b45309");
    matrixName.setAttribute("transform", "translate(720, 318)");
    const innerMemName = text("线粒体内膜", 13, "#b45309");
    innerMemName.setAttribute("transform", "translate(800, 130)");
    mitoLayer.append(outer, hlMatrix, inner, hlMembrane, cristae, mitoName, matrixName, innerMemName);
    svg.append(mitoLayer);

    // — 分子（固定池；append 顺序即层叠顺序，线粒体上的分子压在膜之上）—
    glucoseG = pill("葡萄糖", 112, 42, C_GLUCOSE, 15);
    glucoseG.setAttribute("class", "resp-glucose");
    svg.append(glucoseG);

    o2G = el("g", { class: "resp-o2" });
    for (const dx of [-48, 0, 48]) {
      const b = ball("O₂", 15, C_O2, 11);
      b.style.transform = `translate(${dx}px, 0px)`;
      o2G.append(b);
    }
    const o2Name = text("O₂", 13, "#0369a1");
    o2Name.setAttribute("transform", "translate(0, 36)");
    o2G.append(o2Name);
    svg.append(o2G);

    for (let i = 0; i < 2; i++) {
      const g = pill("丙酮酸", 74, 34, C_PYR, 13);
      g.setAttribute("class", "resp-pyruvate");
      pyruvateG.push(g);
      svg.append(g);
    }
    for (let i = 0; i < 2; i++) {
      const g = pill("CO₂", 54, 28, C_CO2, 12);
      g.setAttribute("class", "resp-co2");
      co2G.push(g);
      svg.append(g);
    }
    for (let i = 0; i < 4; i++) {
      const g = ball("[H]", 12, C_H, 9);
      g.setAttribute("class", "resp-h");
      hG.push(g);
      svg.append(g);
    }
    for (let i = 0; i < 2; i++) {
      const g = pill("H₂O", 44, 28, C_H2O, 12);
      g.setAttribute("class", "resp-h2o");
      h2oG.push(g);
      svg.append(g);
    }
    for (let i = 0; i < 2; i++) {
      const g = pill("酒精", 74, 34, C_ALCOHOL, 13);
      g.setAttribute("class", "resp-alcohol");
      alcoholG.push(g);
      svg.append(g);
    }

    // — ATP 量块（2 列 × 3 行；靠显隐表达定性量级，不用几何缩放）—
    const meter = el("g", { class: "atp-meter" });
    meter.append(el("rect", {
      x: "75", y: "292", width: "50", height: "62", rx: "8", class: "atp-frame",
      fill: "#f0fdf4", stroke: "#86efac", "stroke-width": "1.5",
    }));
    for (let i = 0; i < ATP_SLOTS.length; i++) {
      const b = el("rect", { x: "-11", y: "-8", width: "22", height: "16", rx: "4", fill: C_ATP });
      const g = el("g", { class: "resp-atp" });
      g.append(b);
      g.style.transform = `translate(${ATP_SLOTS[i].x}px, ${ATP_SLOTS[i].y}px)`;
      g.style.opacity = "0";
      atpBlocks.push(g);
      meter.append(g);
    }
    const atpName = text("ATP", 12, "#15803d");
    atpName.setAttribute("transform", "translate(100, 372)");
    meter.append(atpName);
    svg.append(meter);

    // — 底部反应式（左式 + 箭头 + 右式）——
    eqLayer = el("g", { class: "eq-layer" });
    eqLayer.style.opacity = "0";
    const defs = el("defs");
    const marker = el("marker", {
      id: "resp-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5",
      markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse",
    });
    marker.append(el("path", { d: "M0 0 L10 5 L0 10 z", fill: "#0f172a" }));
    defs.append(marker);
    eqLeft = text("", 16, "#0f172a");
    eqLeft.setAttribute("transform", "translate(200, 476)");
    eqRight = text("", 16, "#0f172a");
    eqRight.setAttribute("transform", "translate(760, 476)");
    const arrow = el("path", {
      d: "M410 470 L548 470", class: "eq-arrow",
      stroke: "#0f172a", "stroke-width": "2", fill: "none", "marker-end": "url(#resp-arrow)",
    });
    eqLayer.append(defs, arrow, eqLeft, eqRight);
    svg.append(eqLayer);

    wrapEl.append(svg);

    // — 模式切换（有氧 ⇄ 无氧），走路由参数触发整页重挂载（重置到第 0 步）——
    const bar = document.createElement("div");
    bar.className = "scene-controls";
    const inAnaerobic = /mode=anaerobic/.test(location.hash);
    const modeBtn = document.createElement("button");
    modeBtn.className = "mode-switch";
    modeBtn.textContent = inAnaerobic ? "切换到有氧呼吸" : "切换到无氧呼吸";
    modeBtn.addEventListener("click", () => {
      location.hash = inAnaerobic
        ? `#/course/${COURSE_ID}`
        : `#/course/${COURSE_ID}?mode=anaerobic`;
    });
    bar.append(modeBtn);
    wrapEl.append(bar);

    container.append(wrapEl);
  }

  function render(rawState: unknown): void {
    const state = rawState as StageIdState;
    const L = LAYOUT[state.stage];
    // fail-fast：未在槽位表声明的 stage id 是数据 bug，不静默回退
    if (!L) throw new Error(`[细胞呼吸] 槽位表缺少 stage: ${state.stage}`);
    svg.dataset.stage = state.stage;

    // 场所高亮（固定元素集，只切 opacity）
    hlCyto.style.opacity = L.hl === "cyto" ? "1" : "0";
    hlMatrix.style.opacity = L.hl === "matrix" ? "1" : "0";
    hlMembrane.style.opacity = L.hl === "membrane" ? "1" : "0";
    // 无氧模式：线粒体整体淡化（表达「全程不进线粒体」）
    mitoLayer.style.opacity = L.mitoDim ? "0.2" : "1";

    // 分子：位置 + 显隐
    place(glucoseG, L.glucose);
    setVisible(glucoseG, L.show.glucose);
    place(o2G, L.o2);
    setVisible(o2G, L.show.o2);
    for (let i = 0; i < 2; i++) {
      place(pyruvateG[i], L.pyruvate[i]);
      setVisible(pyruvateG[i], L.show.pyruvate);
      place(co2G[i], L.co2[i]);
      setVisible(co2G[i], L.show.co2);
      place(alcoholG[i], L.alcohol[i]);
      setVisible(alcoholG[i], L.show.alcohol);
      place(h2oG[i], L.h2o[i]);
      setVisible(h2oG[i], L.show.h2o);
    }

    // [H]：前 hCount 粒可见，其余隐藏（固定 4 粒，靠显隐表达「少量/大量」，零增删节点）
    for (let i = 0; i < hG.length; i++) {
      place(hG[i], L.h[i]);
      setVisible(hG[i], i < L.hCount);
    }
    setVisible(hPool, L.hPoolLit);
    setVisible(hLabel, L.hPoolLit);

    // ATP 量块：定性量级（少量 → 大量），非分子数
    for (let i = 0; i < atpBlocks.length; i++) {
      setVisible(atpBlocks[i], i < L.atpCount);
    }

    // 底部反应式
    if (L.eq) {
      if (eqLeft.textContent !== L.eq.left) eqLeft.textContent = L.eq.left;
      if (eqRight.textContent !== L.eq.right) eqRight.textContent = L.eq.right;
      eqLayer.style.opacity = "1";
    } else {
      eqLayer.style.opacity = "0";
    }
  }

  return {
    mount,
    render,

    /** 销毁：移除整个场景容器（模式切换按钮的监听随之失效，与减数分裂模块同做法） */
    destroy() {
      wrap?.remove();
      wrap = null;
    },

    legend: [
      { color: C_GLUCOSE, label: "葡萄糖" },
      { color: C_O2, label: "O₂" },
      { color: C_PYR, label: "丙酮酸" },
      { color: C_CO2, label: "CO₂" },
      { color: C_H, label: "[H] 载体（NADH）" },
      { color: C_ATP, label: "ATP 能量" },
    ],
  };
}
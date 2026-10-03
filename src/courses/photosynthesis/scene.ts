/**
 * 光合作用场景（必修一 1-5.4）
 *
 * 设计要点：
 * - **声明式槽位表**：LAYOUT 以 stage id 为键，声明该幕每个元素的位置、显隐、
 *   两场所高亮强度与双向箭头开关。render() 只读表，不含任何 stage id 分支
 *   （AGENTS.md「按 stage id 分支 = 模型选错的信号」）。
 * - **固定元素集**：所有元素在 mount() 中一次性建池（叶绿体轮廓 / 类囊体基粒 /
 *   两处场所高亮 / 分子 / 双向箭头 / 反应式），阶段切换只改 style.transform 与
 *   style.opacity，零 DOM 增删（防闪烁与过渡中断）。
 * - **过渡通道**：一律 style.transform / style.opacity，不写 SVG transform/opacity
 *   属性（属性写入不触发 CSS transition）。
 *
 * 【反误导三重设计】(1) 两个场所的椭圆底色全程可见，逐幕只调节二者 opacity
 *   （非当前场所保底 0.25，从不归零）→「同时存在」从 DOM 层杜绝「消失 = 不存在」；
 *   (2) p7 双向箭头同时点亮，正面表达「同时进行、循环依存」；
 *   (3) 测试断言「任意幕两场所 opacity 之和 ≥ 1」把保底锁死。
 *
 * 【示意取舍】
 * (1) 分子为示意计数：H₂O/O₂/CO₂/C₅/糖各 1，C₃ 2，[H] 与 ATP 各 4。真实计量由
 *     总反应式与公式卡承载。理由：真实计量会引入 10+ 重复分子，违反元素纪律。
 * (2) 画面统一画「[H]」小圆（与教材一致），讲解文案在首次出现处点明即 NADPH；
 *     不在画面加第二套名称（元素纪律）。
 * (3) 不画纸层析法 / 希尔反应 / 卡尔文同位素示踪，也不画 O/H 原子层级。
 * (4) 基粒只画 3 堆 × 3 片类囊体，示意「类囊体堆叠而成」，不画真实数目。
 * (5) 两反应幕（p5/p6）采用「反应物 + 产物同帧」：CO₂ 固定幕同现 CO₂/C₅/2C₃，
 *     C₃ 还原幕同现 2C₃/[H]/ATP/糖/C₅，以便读出「A → B」的转化关系；由讲解文案
 *     说明箭头方向。C₅ 在两幕落在同一槽位，表达「被消耗后又再生回原位」的循环。
 * (6) 载体（[H]/ATP）在 p1~p5 停靠类囊体侧（y=196），p6 整体下移到基质侧
 *     （y=285）与 C₃ 汇合，表达「被暗反应消耗」；p7 回到类囊体侧，表达
 *     「光反应持续产生」。
 */
import type { SceneComponent, StageIdState } from "../../core/types";

const NS = "http://www.w3.org/2000/svg";
/** 画布尺寸；移动端 aspect-ratio 上限由 __tests__/mobileScene.test.ts 实测约束 */
const VIEW_W = 960;
const VIEW_H = 500;

// —— 配色（颜色是冗余编码：每个分子都自带文字标签，不是唯一区分通道）——
const C_H2O = "#22d3ee";   // 青：H₂O
const C_O2 = "#38bdf8";    // 天蓝：O₂
const C_H = "#e11d48";     // 玫红：[H] 载体（NADPH）
const C_ATP = "#16a34a";   // 绿：ATP
const C_CO2 = "#94a3b8";   // 灰蓝：CO₂
const C_ADP = "#78716c";   // 石色：ADP + Pi（光反应的底物，仅在 p3 出现）
const C_C5 = "#a855f7";    // 紫：C₅
const C_C3 = "#c084fc";    // 浅紫：C₃
const C_SUGAR = "#f59e0b"; // 琥珀：糖（(CH₂O)）

interface Slot {
  x: number;
  y: number;
}

/**
 * 单幕场景状态：只声明「位置 + 显隐 + 两场所高亮 + 载体数 + 箭头 + 反应式」，
 * 没有任何行为分支。
 */
interface SlotMap {
  h2o: Slot;                          // H₂O（类囊体侧）
  o2: Slot;                           // O₂（类囊体侧）
  adp: Slot;                          // ADP + Pi（与 H₂O 共用槽：二者不同幕同现）
  co2: Slot;                          // CO₂（基质侧）
  c5: Slot;                           // C₅（基质侧）
  c3: [Slot, Slot];                   // C₃ ×2（基质侧）
  sugar: Slot;                        // 糖（基质侧）
  h: [Slot, Slot, Slot, Slot];        // [H] 载体 ×4（随幕换停靠行）
  atp: [Slot, Slot, Slot, Slot];      // ATP ×4（随幕换停靠行）
  hCount: number;                     // 可见 [H] 粒数（0..4，示意计数）
  atpCount: number;                   // 可见 ATP 粒数（0..4，示意计数）
  show: {                             // 各分子的显隐（[H]/ATP 由 hCount/atpCount 控制）
    h2o: boolean;
    o2: boolean;
    adp: boolean;
    co2: boolean;
    c5: boolean;
    c3: boolean;
    sugar: boolean;
  };
  thylakoid: number;                  // 类囊体薄膜高亮强度（0..1，从不归零）
  stroma: number;                     // 叶绿体基质高亮强度（0..1，从不归零）
  arrows: boolean;                    // p7 双向箭头是否点亮
  eq: { left: string; right: string } | null; // 底部反应式；null = 不显示
}

// —— 叶绿体几何 ——
const CHLORO = { cx: 480, cy: 248, orx: 328, ory: 176, irx: 304, iry: 152 };
/** 基粒：3 堆 × 3 片类囊体（示意堆叠） */
const GRANA_X = [360, 480, 600];
const GRANA_Y = [136, 152, 168];
const GRANUM = { rx: 46, ry: 7 };
/**
 * 两处场所高亮椭圆（互不重叠；opacity 由各幕声明，从不归零）。
 * 尺寸门禁：每个可见分子的包围盒四角都必须落在对应椭圆内（测试以
 * 包围盒四角断言，椭圆凸 ⇒ 四角在内 ⇔ 整个盒在内），防止「分子飘在灰区」。
 * y 取值还需满足：类囊体下缘 234 < 基质上缘 246（两处色块分明、不粘连），
 * 且基质下缘 398 落在内膜下缘 400 之内（色块不溢出叶绿体）。
 */
const HL_THY = { cx: 480, cy: 162, rx: 250, ry: 72 };    // 类囊体薄膜（绿）
const HL_STROMA = { cx: 480, cy: 322, rx: 240, ry: 76 }; // 叶绿体基质（琥珀）

// —— 类囊体侧槽位 ——
const THY: {
  h2o: Slot;
  o2: Slot;
  adp: Slot;
} = {
  h2o: { x: 280, y: 152 },
  /**
   * O₂ 紧邻 H₂O 的右侧（中心距 78、边缘间隙 37），全幕静止：
   * 水的光解幕因此读成「水在这里，O₂ 从这里出来」——同一水平带、就近位置上的
   * 「消失 + 出现」= 原地转化的视觉依据，与呼吸第 3 幕 O₂→H₂O 同一手法。
   * 若放远（如 x=680）则光解幕画面零位移，H₂O 淡出于左、O₂ 淡入于右，
   * 学生只能靠讲解文案才读出「分解」，踩中 AGENTS.md「需依赖文案 = 画面失败」红线。
   * 取 358 而非更左：需与 adp 药丸右缘（338）留出 ≥4px（358−16=342 ≥ 342），
   * 否则会被同一幕的「4px 不粘连」断言拦下。
   */
  o2: { x: 358, y: 152 },
  /**
   * ADP+Pi 与 H₂O 同一高度（都贴在类囊体薄膜上），但 x 右移 20px：
   * 药丸宽 76px，贴最左缘时包围盒四角会越出类囊体椭圆（场所归属不变式会拦下），
   * 右移后四角完整落在椭圆内。两者不同幕同现（p2 消耗水、p3 才出现 ADP+Pi），
   * 同高度是刻意的：直观表达「同一处场所上先后发生的两步」。
   */
  adp: { x: 300, y: 152 },
};

/**
 * 载体停靠行（[H]×4 + ATP×4）。A = 类囊体侧（光反应产生处），B = 基质侧（暗反应消耗处）。
 * 两行 x 相同 → p5→p6 是纯垂直位移（最小动作）。
 * x 取值保证 y=196 时全部落在 hl-thylakoid 椭圆内（|x−480| ≤ 168）。
 */
const CARRIER_A: { h: [Slot, Slot, Slot, Slot]; atp: [Slot, Slot, Slot, Slot] } = {
  h: [{ x: 326, y: 196 }, { x: 366, y: 196 }, { x: 406, y: 196 }, { x: 446, y: 196 }],
  atp: [{ x: 504, y: 196 }, { x: 542, y: 196 }, { x: 580, y: 196 }, { x: 618, y: 196 }],
};
const CARRIER_B: { h: [Slot, Slot, Slot, Slot]; atp: [Slot, Slot, Slot, Slot] } = {
  h: [{ x: 326, y: 285 }, { x: 366, y: 285 }, { x: 406, y: 285 }, { x: 446, y: 285 }],
  atp: [{ x: 504, y: 285 }, { x: 542, y: 285 }, { x: 580, y: 285 }, { x: 618, y: 285 }],
};

// —— 叶绿体基质侧槽位（y=325 一列）——
const STROMA: {
  co2: Slot;
  c5: Slot;
  c3: [Slot, Slot];
  sugar: Slot;
} = {
  co2: { x: 280, y: 325 },
  c5: { x: 400, y: 325 },
  c3: [{ x: 540, y: 325 }, { x: 600, y: 325 }],
  sugar: { x: 672, y: 325 },
};

const EQ_TOTAL = {
  left: "CO₂ + H₂O",
  right: "(CH₂O) + O₂",
};

/** 构造一帧：默认互斥显隐，只覆写本幕需要的字段（纯数据，可读性优于逐字段重复） */
function frame(over: Partial<SlotMap>): SlotMap {
  return {
    h2o: THY.h2o,
    o2: THY.o2,
    adp: THY.adp,
    co2: STROMA.co2,
    c5: STROMA.c5,
    c3: STROMA.c3,
    sugar: STROMA.sugar,
    h: CARRIER_A.h,
    atp: CARRIER_A.atp,
    hCount: 0,
    atpCount: 0,
    show: { h2o: false, o2: false, adp: false, co2: false, c5: false, c3: false, sugar: false },
    thylakoid: 0.55,
    stroma: 0.55,
    arrows: false,
    eq: null,
    ...over,
  };
}

// —— 各幕槽位表（唯一事实源）——
const LAYOUT: Record<string, SlotMap> = {
  // 0 总览：只摆两种反应物，表明两个部位各消耗什么
  "photo-overview": frame({
    show: { h2o: true, o2: false, adp: false, co2: true, c5: false, c3: false, sugar: false },
  }),
  // 1 光反应场所：高亮类囊体薄膜（基质保底 0.25）
  "photo-thylakoid-site": frame({
    show: { h2o: true, o2: false, adp: false, co2: true, c5: false, c3: false, sugar: false },
    thylakoid: 1, stroma: 0.25,
  }),
  // 2 水的光解：H₂O 消耗，O₂ 与 [H] 出现（[H] 停在类囊体侧）
  "photo-water-split": frame({
    show: { h2o: false, o2: true, adp: false, co2: true, c5: false, c3: false, sugar: false },
    hCount: 4,
    thylakoid: 1, stroma: 0.25,
  }),
  // 3 ATP 的合成：ADP+Pi 出现，ATP 在类囊体侧生成
  "photo-atp-synth": frame({
    show: { h2o: false, o2: true, adp: true, co2: true, c5: false, c3: false, sugar: false },
    hCount: 4, atpCount: 4,
    thylakoid: 1, stroma: 0.25,
  }),
  // 4 暗反应场所：高亮叶绿体基质（类囊体薄膜保底 0.25）；C₅ 出现
  "photo-stroma-site": frame({
    show: { h2o: false, o2: true, adp: false, co2: true, c5: true, c3: false, sugar: false },
    hCount: 4, atpCount: 4,
    thylakoid: 0.25, stroma: 1,
  }),
  // 5 CO₂ 的固定：CO₂ + C₅ → 2C₃（此步不耗能，载体数量不变）
  "photo-co2-fix": frame({
    show: { h2o: false, o2: true, adp: false, co2: true, c5: true, c3: true, sugar: false },
    hCount: 4, atpCount: 4,
    thylakoid: 0.25, stroma: 1,
  }),
  // 6 C₃ 的还原：载体下移到基质侧与 C₃ 汇合，产出糖并再生 C₅（C₅ 回到 p5 原槽位）
  "photo-c3-reduce": frame({
    show: { h2o: false, o2: true, adp: false, co2: false, c5: true, c3: true, sugar: true },
    h: CARRIER_B.h, atp: CARRIER_B.atp,
    hCount: 4, atpCount: 4,
    thylakoid: 0.25, stroma: 1,
  }),
  // 7 两反应的关系：两场所同时点亮 + 双向箭头；载体回到类囊体侧（光反应持续产生）
  "photo-relation": frame({
    show: { h2o: false, o2: true, adp: false, co2: false, c5: true, c3: false, sugar: true },
    hCount: 4, atpCount: 4,
    thylakoid: 1, stroma: 1, arrows: true,
  }),
  // 8 总反应式：最终产物 O₂ 与糖；载体归零（均已在暗反应中被用掉）
  "photo-total": frame({
    show: { h2o: false, o2: true, adp: false, co2: false, c5: false, c3: false, sugar: true },
    thylakoid: 0.5, stroma: 0.5,
    eq: EQ_TOTAL,
  }),
};

export function createPhotosynthesisScene(): SceneComponent & { destroy(): void } {
  // —— DOM 池引用（mount 时填充；每次 mount 重建，保证可重入）——
  let svg!: SVGSVGElement;
  let wrap: HTMLDivElement | null = null;
  let hlThylakoid!: SVGEllipseElement;
  let hlStroma!: SVGEllipseElement;
  let h2oG!: SVGGElement;
  let o2G!: SVGGElement;
  let adpG!: SVGGElement;
  let co2G!: SVGGElement;
  let c5G!: SVGGElement;
  let c3G: SVGGElement[] = [];
  let sugarG!: SVGGElement;
  let hG: SVGGElement[] = [];
  let atpG: SVGGElement[] = [];
  let arrowsG!: SVGGElement;
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

  /** 把元素移到某个槽位：唯一的位置写入通道（逗号分隔，textAudit 的 parseTransform 只认逗号） */
  function place(node: SVGElement, slot: Slot): void {
    node.style.transform = `translate(${slot.x}px, ${slot.y}px)`;
  }

  /** 显隐：opacity 通道（CSS transition 可过渡，attribute 不可） */
  function setVisible(node: SVGElement, visible: boolean): void {
    node.style.opacity = visible ? "1" : "0";
  }

  function mount(container: HTMLElement): void {
    // 可重入：清空池引用，防止测试多次挂载时跨挂载累积
    c3G = []; hG = []; atpG = [];

    const wrapEl = document.createElement("div");
    wrapEl.className = "photo-scene";
    wrap = wrapEl;
    svg = el("svg", { viewBox: `0 0 ${VIEW_W} ${VIEW_H}`, width: "100%", class: "scene-svg" });
    svg.dataset.stage = "";

    // — 叶绿体轮廓（外膜 + 内膜）—
    svg.append(el("ellipse", {
      cx: String(CHLORO.cx), cy: String(CHLORO.cy), rx: String(CHLORO.orx), ry: String(CHLORO.ory),
      class: "chloro-outer",
    }));
    svg.append(el("ellipse", {
      cx: String(CHLORO.cx), cy: String(CHLORO.cy), rx: String(CHLORO.irx), ry: String(CHLORO.iry),
      class: "chloro-inner",
    }));

    // — 两处场所高亮（互为对照；opacity 由各幕声明，从不归零）—
    hlThylakoid = el("ellipse", {
      cx: String(HL_THY.cx), cy: String(HL_THY.cy), rx: String(HL_THY.rx), ry: String(HL_THY.ry),
      class: "site-hl site-thylakoid",
    });
    hlStroma = el("ellipse", {
      cx: String(HL_STROMA.cx), cy: String(HL_STROMA.cy), rx: String(HL_STROMA.rx), ry: String(HL_STROMA.ry),
      class: "site-hl site-stroma",
    });
    hlThylakoid.style.opacity = "0";
    hlStroma.style.opacity = "0";
    svg.append(hlThylakoid, hlStroma);

    // — 基粒（类囊体堆叠）—
    const grana = el("g", { class: "grana" });
    for (const gx of GRANA_X) {
      for (const gy of GRANA_Y) {
        grana.append(el("ellipse", {
          cx: String(gx), cy: String(gy), rx: String(GRANUM.rx), ry: String(GRANUM.ry),
          class: "granum",
        }));
      }
    }
    svg.append(grana);

    // — 场所标注（静态）—
    const chloroName = text("叶绿体", 14, "#64748b");
    chloroName.setAttribute("transform", "translate(480, 52)");
    const thyName = text("类囊体薄膜", 13, "#047857");
    thyName.setAttribute("transform", "translate(480, 112)");
    const stromaName = text("叶绿体基质", 13, "#b45309");
    stromaName.setAttribute("transform", "translate(480, 385)");
    svg.append(chloroName, thyName, stromaName);

    // — 分子（固定池；append 顺序即层叠顺序）—
    h2oG = pill("H₂O", 50, 28, C_H2O, 12);
    h2oG.setAttribute("class", "photo-h2o");
    o2G = ball("O₂", 16, C_O2, 12);
    o2G.setAttribute("class", "photo-o2");
    adpG = pill("ADP+Pi", 76, 30, C_ADP, 11);
    adpG.setAttribute("class", "photo-adp");
    co2G = pill("CO₂", 54, 28, C_CO2, 12);
    co2G.setAttribute("class", "photo-co2");
    c5G = pill("C₅", 50, 28, C_C5, 12);
    c5G.setAttribute("class", "photo-c5");
    sugarG = pill("糖", 50, 28, C_SUGAR, 13);
    sugarG.setAttribute("class", "photo-sugar");
    svg.append(h2oG, o2G, adpG, co2G, c5G, sugarG);

    for (let i = 0; i < 2; i++) {
      const g = pill("C₃", 50, 28, C_C3, 12);
      g.setAttribute("class", "photo-c3");
      c3G.push(g);
      svg.append(g);
    }
    for (let i = 0; i < 4; i++) {
      const g = ball("[H]", 12, C_H, 9);
      g.setAttribute("class", "photo-h");
      hG.push(g);
      svg.append(g);
    }
    for (let i = 0; i < 4; i++) {
      const g = ball("ATP", 13, C_ATP, 9);
      g.setAttribute("class", "photo-atp");
      atpG.push(g);
      svg.append(g);
    }

    // — p7 双向箭头（下行：光反应→暗反应；上行：暗反应→光反应）—
    arrowsG = el("g", { class: "rel-arrows" });
    arrowsG.style.opacity = "0";
    const defs = el("defs");
    const marker = el("marker", {
      id: "photo-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5",
      markerWidth: "6", markerHeight: "6", orient: "auto",
    });
    marker.append(el("path", { d: "M0 0 L10 5 L0 10 z", fill: "#0f172a" }));
    defs.append(marker);
    const down = el("path", {
      d: "M420 214 L420 262", class: "rel-arrow",
      stroke: "#0f172a", "stroke-width": "2", fill: "none", "marker-end": "url(#photo-arrow)",
    });
    const up = el("path", {
      d: "M540 262 L540 214", class: "rel-arrow",
      stroke: "#0f172a", "stroke-width": "2", fill: "none", "marker-end": "url(#photo-arrow)",
    });
    const lblDown = text("ATP、[H]", 11, "#0f172a");
    lblDown.setAttribute("transform", "translate(480, 224)");
    const lblUp = text("ADP、Pi、NADP⁺", 11, "#0f172a");
    lblUp.setAttribute("transform", "translate(480, 248)");
    arrowsG.append(defs, down, up, lblDown, lblUp);
    svg.append(arrowsG);

    // — 底部反应式（左式 + 箭头 + 右式）—
    eqLayer = el("g", { class: "eq-layer" });
    eqLayer.style.opacity = "0";
    const eqDefs = el("defs");
    const eqMarker = el("marker", {
      id: "photo-eq-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5",
      markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse",
    });
    eqMarker.append(el("path", { d: "M0 0 L10 5 L0 10 z", fill: "#0f172a" }));
    eqDefs.append(eqMarker);
    eqLeft = text("", 16, "#0f172a");
    eqLeft.setAttribute("transform", "translate(200, 476)");
    eqRight = text("", 16, "#0f172a");
    eqRight.setAttribute("transform", "translate(760, 476)");
    const eqArrow = el("path", {
      d: "M392 470 L568 470", class: "eq-arrow",
      stroke: "#0f172a", "stroke-width": "2", fill: "none", "marker-end": "url(#photo-eq-arrow)",
    });
    eqLayer.append(eqDefs, eqArrow, eqLeft, eqRight);
    svg.append(eqLayer);

    wrapEl.append(svg);
    container.append(wrapEl);
  }

  function render(rawState: unknown): void {
    const state = rawState as StageIdState;
    const L = LAYOUT[state.stage];
    // fail-fast：未在槽位表声明的 stage id 是数据 bug，不静默回退
    if (!L) throw new Error(`[光合作用] 槽位表缺少 stage: ${state.stage}`);
    svg.dataset.stage = state.stage;

    // 两场所高亮：固定元素集，只切 opacity；非当前场所保底 0.25（从不归零）
    hlThylakoid.style.opacity = String(L.thylakoid);
    hlStroma.style.opacity = String(L.stroma);

    // 分子：位置 + 显隐
    place(h2oG, L.h2o); setVisible(h2oG, L.show.h2o);
    place(o2G, L.o2); setVisible(o2G, L.show.o2);
    place(adpG, L.adp); setVisible(adpG, L.show.adp);
    place(co2G, L.co2); setVisible(co2G, L.show.co2);
    place(c5G, L.c5); setVisible(c5G, L.show.c5);
    place(sugarG, L.sugar); setVisible(sugarG, L.show.sugar);
    for (let i = 0; i < 2; i++) {
      place(c3G[i], L.c3[i]);
      setVisible(c3G[i], L.show.c3);
    }

    // [H] / ATP：前 count 粒可见，其余隐藏（固定池，靠显隐表达数量，零增删节点）
    for (let i = 0; i < hG.length; i++) {
      place(hG[i], L.h[i]);
      setVisible(hG[i], i < L.hCount);
    }
    for (let i = 0; i < atpG.length; i++) {
      place(atpG[i], L.atp[i]);
      setVisible(atpG[i], i < L.atpCount);
    }

    // p7 双向箭头
    arrowsG.style.opacity = L.arrows ? "1" : "0";

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

    /** 销毁：移除整个场景容器 */
    destroy() {
      wrap?.remove();
      wrap = null;
    },

    legend: [
      { color: C_H2O, label: "H₂O" },
      { color: C_O2, label: "O₂" },
      { color: C_H, label: "[H] 载体（NADPH）" },
      { color: C_ATP, label: "ATP 能量" },
      { color: C_CO2, label: "CO₂" },
      { color: C_C5, label: "C₅" },
      { color: C_C3, label: "C₃" },
      { color: C_SUGAR, label: "糖（(CH₂O)）" },
    ],
  };
}

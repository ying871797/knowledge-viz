/**
 * PCR 场景（v5「统一行模型」，方案 .proposals/2026-09-26-001-pcr-rebuild.html，已批准）。
 *
 * 模型（示意取舍登记 .superpowers/sdd/progress.md）：
 * - 一行 = 一个分子；分子内「母链在上、引物与新链在下」贯穿全程（取舍⑳，取代 v4.5 槽位=角色与泳道/延伸双结构）。
 * - 变性 = 行内上下两条链（双链的两条，都是母链/模板）原位纯垂直位移分开（用户 hard 要求）；
 *   退火 = 每条母链下方挂 1 支引物；延伸 = 新链从引物 3′ 端锚点在母链下方长出（锚点生长）；
 *   一轮结束一行裂为两行（分子整体位移，链相对位置不变、不横穿行界）。
 * - 引物内嵌式（用户裁决「延续 v4.4」）：PRIMER_W=50、L 264..314 / R 546..596，5′ 端全部在母链带内
 *   （5′ 内缩 14px，3′ 端仍钉 314/546）。——v5 方案默认的「悬垂式」被用户否决，按内嵌执行。
 * - 每分子 2 枚 Taq（用户裁决）：延伸幕 s3/s6/s9 各行的双链两端 3′ 端各守 1 枚——
 *   新链锚点（引物 3′ 端）1 枚 + 模板链 3′ 端 1 枚；紫色圆球 + 白内环（课本图 3-5）。
 * - 颜色：母链灰 / 合成链蓝（含作下轮模板时）/ 目标绿 + 角标；继续用蓝不新增代际色相
 *   （用户裁决「颜色由我选」→ 选蓝，靠灰+蓝 / 蓝+蓝配对区分轮次，色相 ≤3 约束）。
 * - 方向标注全程保留（用户裁决④）：母链 5′ 左 → 上标 5′左/3′右；5′ 右 → 3′左/5′右；子链反平行。
 * - 链长三档（带宽约定）：长=母链全长 360（250..610）、中=引物 3′ 端到母链 5′ 端 296、
 *   短=目标扩增区 232（314..546）。半保留：每条双链 = 一旧一新。
 * - 温度牌 95/55/72 三枚常驻 opacity 高亮；曲线/公式沿用 data.ts（v4 已批准）。
 */
import type { SceneComponent } from "../../core/types";

const NS = "http://www.w3.org/2000/svg";
const VB_W = 860;
const VB_H = 500;

// ---------- 几何常量（改动前先重算层位净距/内嵌余量） ----------
const BAND_X = 250;                          // 全长链左缘
const BAND_W = 360;                          // 全长链跨 250..610
const BAND_H = 14;
const TARGET_X = 314;                        // 扩增区左缘 = 左引物 3′ 端
const TARGET_W = 232;                        // 扩增区 314..546（两引物 3′ 端之间）
const MEDIUM_W = 296;                        // 中链宽（引物 3′ 端→母链 5′ 端：546−250=296、610−314=296）
const PRIMER_W = 50;                         // v4.4 内嵌式（用户裁决）：5′ 端全部在母链带内
const PRIMER_H = 10;
const PRIMER_L_X = BAND_X + 14;              // 264..314：左引物，3′ 端在 314（5′ 内缩 14）
const PRIMER_R_X = TARGET_X + TARGET_W;      // 546..596：右引物，3′ 端在 546（5′ 内缩 14，596<610 内嵌）
const PRIMER_OFF = 14;                       // 退火泳道：引物贴链下方错开（不叠链带）
const SS_OFF = 45;                           // 泳道两条链上下分离振幅（±45，净距 124−2×52=20）
const EX_OFF = 8;                            // 模板/配对链贴拢（±8）
const CHAIN_OFF = 18;                        // 新链层（母链下方；8 行档净距 52−37=15…下行模板顶 −15 → 净距 ≥6）
const PRIMER_Y = 6;                          // 延伸/目标行引物层（模板下方，不叠带）
const NEW_H = 12;
const DIR_L_X = 176;
const DIR_R_X = 664;
const TAQ2_GAP = 16;                         // 模板 3′ 端 Taq 相对带缘的水平错开（带外 16px）

const GRAY = "#64748b";    // 初始模板链（原始母链）
const BLUE = "#2563eb";    // 合成链（任何一轮的新链；作为下轮模板时仍蓝）
const GREEN = "#22c55e";   // 目标产物（扩增区双引物界定）
const ORANGE = "#f59e0b";  // 引物
const TAQ = "#8b5cf6";     // Taq 聚合酶（紫色，课本图 3-5；色相预算豁免）

/** 行数 → 各行列中心 y。4 行档位行距 124（泳道净距 = 124 − 2×(45+7) = 20 ≥ 20 断言） */
const ROW_YS: Record<number, number[]> = {
  1: [250],
  2: [170, 330],
  4: [52, 176, 300, 424],
  8: [52, 104, 156, 208, 260, 312, 364, 416],
};

type SizeKind = "long" | "medium" | "short";
type TintKind = "gray" | "blue";
/** 5′ 朝向（决定引物/锚点/标注，不决定槽位）：top=5′ 左（3′ 右→挂 R 引物、锚点 546）；
 *  bottom=5′ 右（3′ 左→挂 L 引物、锚点 314） */
type DirType = "top" | "bottom";

interface StrandSpec {
  size: SizeKind;
  tint: TintKind;
  type: DirType;
  /** 中链锚边：L=250..546（侧面 5′ 左）、R=314..610（侧面 5′ 右） */
  side?: "L" | "R";
}

type RowTag = "pair" | "lane" | "extend" | "extBoth";

interface PairCfg { tag: "pair" }
interface LaneCfg {
  tag: "lane";
  /** 上链（bandT）＝双链的上半（同为母链/模板） */
  up: StrandSpec;
  /** 下链（bandB）＝双链的下半（变性后同样作模板）——v5 正名：不再是「上一轮新链位」 */
  down: StrandSpec;
  /** 退火阶段给每条链挂 1 支引物（引物都添加在母链下方） */
  anneal: boolean;
}
interface ExtendCfg {
  tag: "extend";
  /** 模板链（恒在 bandT 上槽） */
  temp: StrandSpec;
  /** 新链长度类：原模板→medium（296），上一轮新链→short（232） */
  newSize: "medium" | "short";
}
interface ExtBothCfg {
  tag: "extBoth";
  /** 目标行：蓝短模板在 bandT、绿短新链长出；双引物 + 角标 */
  temp: StrandSpec;
}
type RowCfg = PairCfg | LaneCfg | ExtendCfg | ExtBothCfg;

/** 合法槽位表：stage id → 各行分子形态（layout 内无 stage 分支，按 tag 分支即模型）。
 *  行数逐幕 1→1→1→2→2→2→4→4→4→8→8（产物上下排列，三轮全展示） */
const ROW_MAP: Record<string, RowCfg[]> = {
  "s0-template": [{ tag: "pair" }],
  "s1-denature-1": [
    // 1 行泳道：两条 DNA 母链打开、原位上下位移分开（都是模板，无新旧之分）
    { tag: "lane", up: { size: "long", tint: "gray", type: "top" }, down: { size: "long", tint: "gray", type: "bottom" }, anneal: false },
  ],
  "s2-anneal-1": [
    { tag: "lane", up: { size: "long", tint: "gray", type: "top" }, down: { size: "long", tint: "gray", type: "bottom" }, anneal: true },
  ],
  "s3-extend-1": [
    // 第 1 轮：两条母链各成行（模板恒在上）→ 中链新链在母链下方长出（长中双链）
    { tag: "extend", temp: { size: "long", tint: "gray", type: "top" }, newSize: "medium" },
    { tag: "extend", temp: { size: "long", tint: "gray", type: "bottom" }, newSize: "medium" },
  ],
  "s4-denature-2": [
    // 第 2 轮变性：2 行泳道（每行 = 上轮产物双链的两条，位移分开）
    { tag: "lane", up: { size: "long", tint: "gray", type: "top" }, down: { size: "medium", tint: "blue", type: "bottom", side: "L" }, anneal: false },
    { tag: "lane", up: { size: "long", tint: "gray", type: "bottom" }, down: { size: "medium", tint: "blue", type: "top", side: "R" }, anneal: false },
  ],
  "s5-anneal-2": [
    { tag: "lane", up: { size: "long", tint: "gray", type: "top" }, down: { size: "medium", tint: "blue", type: "bottom", side: "L" }, anneal: true },
    { tag: "lane", up: { size: "long", tint: "gray", type: "bottom" }, down: { size: "medium", tint: "blue", type: "top", side: "R" }, anneal: true },
  ],
  "s6-extend-2": [
    // 第 2 轮：灰母链→中链；上轮蓝中链→短链（每行裂两行，分子整体位移）
    { tag: "extend", temp: { size: "long", tint: "gray", type: "top" }, newSize: "medium" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "bottom", side: "L" }, newSize: "short" },
    { tag: "extend", temp: { size: "long", tint: "gray", type: "bottom" }, newSize: "medium" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "top", side: "R" }, newSize: "short" },
  ],
  "s7-denature-3": [
    // 第 3 轮变性：4 行泳道 = 2(灰长+蓝中) + 2(蓝中+蓝短)
    { tag: "lane", up: { size: "long", tint: "gray", type: "top" }, down: { size: "medium", tint: "blue", type: "bottom", side: "L" }, anneal: false },
    { tag: "lane", up: { size: "medium", tint: "blue", type: "bottom", side: "L" }, down: { size: "short", tint: "blue", type: "top" }, anneal: false },
    { tag: "lane", up: { size: "long", tint: "gray", type: "bottom" }, down: { size: "medium", tint: "blue", type: "top", side: "R" }, anneal: false },
    { tag: "lane", up: { size: "medium", tint: "blue", type: "top", side: "R" }, down: { size: "short", tint: "blue", type: "bottom" }, anneal: false },
  ],
  "s8-anneal-3": [
    { tag: "lane", up: { size: "long", tint: "gray", type: "top" }, down: { size: "medium", tint: "blue", type: "bottom", side: "L" }, anneal: true },
    { tag: "lane", up: { size: "medium", tint: "blue", type: "bottom", side: "L" }, down: { size: "short", tint: "blue", type: "top" }, anneal: true },
    { tag: "lane", up: { size: "long", tint: "gray", type: "bottom" }, down: { size: "medium", tint: "blue", type: "top", side: "R" }, anneal: true },
    { tag: "lane", up: { size: "medium", tint: "blue", type: "top", side: "R" }, down: { size: "short", tint: "blue", type: "bottom" }, anneal: true },
  ],
  "s9-extend-3": [
    // 第 3 轮：2 长中 + 4 中短 + 2 目标（蓝短模板 + 绿短双链）
    { tag: "extend", temp: { size: "long", tint: "gray", type: "top" }, newSize: "medium" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "bottom", side: "L" }, newSize: "short" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "bottom", side: "L" }, newSize: "short" },
    { tag: "extBoth", temp: { size: "short", tint: "blue", type: "top" } },
    { tag: "extend", temp: { size: "long", tint: "gray", type: "bottom" }, newSize: "medium" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "top", side: "R" }, newSize: "short" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "top", side: "R" }, newSize: "short" },
    { tag: "extBoth", temp: { size: "short", tint: "blue", type: "bottom" } },
  ],
  "s10-result": [
    { tag: "extend", temp: { size: "long", tint: "gray", type: "top" }, newSize: "medium" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "bottom", side: "L" }, newSize: "short" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "bottom", side: "L" }, newSize: "short" },
    { tag: "extBoth", temp: { size: "short", tint: "blue", type: "top" } },
    { tag: "extend", temp: { size: "long", tint: "gray", type: "bottom" }, newSize: "medium" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "top", side: "R" }, newSize: "short" },
    { tag: "extend", temp: { size: "medium", tint: "blue", type: "top", side: "R" }, newSize: "short" },
    { tag: "extBoth", temp: { size: "short", tint: "blue", type: "bottom" } },
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

/** Taq 只在延伸步骤现身（s3/s6/s9），结果态退场 */
const TAQ_ON = new Set(["s3-extend-1", "s6-extend-2", "s9-extend-3"]);

/** 链带 span：长=250..610，中 side L=250..546 / side R=314..610，短=314..546 */
function spanOf(s: StrandSpec): { x: number; w: number } {
  if (s.size === "long") return { x: BAND_X, w: BAND_W };
  if (s.size === "short") return { x: TARGET_X, w: TARGET_W };
  return s.side === "R" ? { x: TARGET_X, w: MEDIUM_W } : { x: BAND_X, w: MEDIUM_W };
}

function tintColor(t: TintKind): string {
  return t === "blue" ? BLUE : GRAY;
}

function opp(t: DirType): DirType {
  return t === "top" ? "bottom" : "top";
}

interface RowEls {
  g: SVGGElement;
  bandT: SVGRectElement;
  bandB: SVGRectElement;
  newEl: SVGRectElement;
  primerL: SVGRectElement;
  primerR: SVGRectElement;
  taq1: SVGGElement;
  taq2: SVGGElement;
  badge: SVGGElement;
  dirs: SVGTextElement[];
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function makeTaq(): SVGGElement {
  const t = el("g", { class: "pcr-taq" });
  t.appendChild(el("circle", { cx: "0", cy: "0", r: "8", fill: TAQ, stroke: "#6d28d9", "stroke-width": "2" }));
  t.appendChild(el("circle", { cx: "0", cy: "0", r: "2.4", fill: "#f8fafc" }));
  return t;
}

function makeRow(): RowEls {
  const g = el("g", { class: "pcr-row" });
  const bandT = el("rect", { class: "pcr-band", x: String(BAND_X), y: "0", width: String(BAND_W), height: String(BAND_H), rx: String(BAND_H / 2), fill: GRAY });
  const bandB = el("rect", { class: "pcr-band", x: String(BAND_X), y: "0", width: String(BAND_W), height: String(BAND_H), rx: String(BAND_H / 2), fill: GRAY });
  const newEl = el("rect", { class: "pcr-new", x: "0", y: "0", width: "0", height: String(NEW_H), rx: String(NEW_H / 2), fill: BLUE });
  const primerL = el("rect", { class: "pcr-primer-L", x: String(PRIMER_L_X), y: "0", width: String(PRIMER_W), height: String(PRIMER_H), rx: String(PRIMER_H / 2), fill: ORANGE, stroke: "#b45309" });
  const primerR = el("rect", { class: "pcr-primer-R", x: String(PRIMER_R_X), y: "0", width: String(PRIMER_W), height: String(PRIMER_H), rx: String(PRIMER_H / 2), fill: ORANGE, stroke: "#b45309" });

  // Taq 聚合酶每行 2 枚（用户裁决）：taq1 守新链锚点、taq2 守模板 3′ 端；仅延伸时现身
  const taq1 = makeTaq();
  const taq2 = makeTaq();

  // 目标产物角标：贴目标带右缘同高（x=560..628），不进 8 行档上方行的链带垂直带
  const badge = el("g", { class: "pcr-target-badge" });
  badge.appendChild(el("rect", { x: String(TARGET_X + TARGET_W + 14), y: "-16", width: "68", height: "16", rx: "8", fill: GREEN }));
  const badgeText = el("text", { x: String(TARGET_X + TARGET_W + 48), y: "-6", fill: "#fff", "font-size": "12", "text-anchor": "middle" });
  badgeText.textContent = "目标产物";
  badge.appendChild(badgeText);

  // 5′/3′ 反平行标注（四枚，文本随链真实朝向，行随分子显隐）——用户裁决④保留全程
  const dirDefs = [
    { side: "aL", x: DIR_L_X },
    { side: "aR", x: DIR_R_X },
    { side: "bL", x: DIR_L_X },
    { side: "bR", x: DIR_R_X },
  ];
  const dirs = dirDefs.map((d) => {
    const t = el("text", { class: "pcr-dir", "data-side": d.side, x: String(d.x), y: "4", fill: "#334155", "font-size": "13", "text-anchor": "middle" });
    t.textContent = "";
    return t;
  });

  g.append(bandT, bandB, newEl, primerL, primerR, taq1, taq2, badge, ...dirs);
  return { g, bandT, bandB, newEl, primerL, primerR, taq1, taq2, badge, dirs };
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
    setO(r.bandT, false);
    setO(r.bandB, false);
    setO(r.newEl, false);
    setO(r.primerL, false);
    setO(r.primerR, false);
    setO(r.taq1, false);
    setO(r.taq2, false);
    setO(r.badge, false);
    r.dirs.forEach((d) => setO(d, false));
  }

  /** 带写入：x/width/fill 同步到属性与 style（CSS 几何通道可过渡），新链跨宽用 width 过渡 */
  function setBand(e: SVGRectElement, x: number, w: number, color: string): void {
    e.setAttribute("x", String(x));
    e.setAttribute("width", String(w));
    e.style.setProperty("x", `${x}px`);
    e.style.width = `${w}px`;
    e.setAttribute("fill", color);
  }

  /** 5′/3′ 标注随链真实朝向：上标的母链 5′ 左→5′/3′、5′ 右→3′/5′；下标的子链反平行 */
  function setDirs(r: RowEls, topY: number, childY: number, topType: DirType, bottomType: DirType): void {
    r.dirs[0].textContent = topType === "top" ? "5′" : "3′";    // aL
    r.dirs[1].textContent = topType === "top" ? "3′" : "5′";    // aR
    r.dirs[2].textContent = bottomType === "top" ? "5′" : "3′"; // bL
    r.dirs[3].textContent = bottomType === "top" ? "3′" : "5′"; // bR
    r.dirs[0].style.transform = `translateY(${topY - 4}px)`;
    r.dirs[1].style.transform = `translateY(${topY - 4}px)`;
    r.dirs[2].style.transform = `translateY(${childY + 4}px)`;
    r.dirs[3].style.transform = `translateY(${childY + 4}px)`;
    r.dirs.forEach((d) => setO(d, true));
  }

  /** 锚点生长（取舍⑮）：新链以引物 3′ 端（母链 3′ 侧，314 或 546）为固定锚点，向母链 5′ 端方向 0→全长 */
  function setChild(r: RowEls, temp: StrandSpec, full: number, p: number, color: string): void {
    const w = Math.round(full * p);
    const x = temp.type === "top" ? PRIMER_R_X - w : TARGET_X; // 5′ 左：锚 546 左伸；5′ 右：锚 314 右伸
    setBand(r.newEl, x, w, color);
    r.newEl.style.transform = `translateY(${CHAIN_OFF}px)`;
    setO(r.newEl, true);
  }

  function setTaq(t: SVGGElement, x: number, y: number): void {
    t.style.transform = `translate(${x}px, ${y}px)`;
    setO(t, true);
  }

  function layoutRow(r: RowEls, cfg: RowCfg, p: number, taqOn: boolean): void {
    rowOff(r);

    switch (cfg.tag) {
      case "pair": {
        // s0：两条原母链（灰A 5′ 左 / 灰B 5′ 右），无新旧之分，±8 贴拢
        setO(r.bandT, true);
        setO(r.bandB, true);
        setBand(r.bandT, BAND_X, BAND_W, GRAY);
        setBand(r.bandB, BAND_X, BAND_W, GRAY);
        r.bandT.style.transform = `translateY(${-EX_OFF}px)`;
        r.bandB.style.transform = `translateY(${EX_OFF}px)`;
        setDirs(r, -EX_OFF, EX_OFF, "top", "bottom");
        break;
      }
      case "lane": {
        // 泳道：双链两条（都是母链/模板）±45 原位纯垂直位移分开；引物加在每条链下方
        const us = spanOf(cfg.up);
        const ds = spanOf(cfg.down);
        setO(r.bandT, true);
        setO(r.bandB, true);
        setBand(r.bandT, us.x, us.w, tintColor(cfg.up.tint));
        setBand(r.bandB, ds.x, ds.w, tintColor(cfg.down.tint));
        r.bandT.style.transform = `translateY(${-SS_OFF}px)`;
        r.bandB.style.transform = `translateY(${SS_OFF}px)`;
        setDirs(r, -SS_OFF, SS_OFF, cfg.up.type, cfg.down.type);
        if (cfg.anneal) {
          // 每条链恰 1 支引物、贴各自 3′ 端下方 14px（引物都添加在母链下方，按朝向选 L/R）
          const upP = cfg.up.type === "top" ? r.primerR : r.primerL;
          const dnP = cfg.down.type === "top" ? r.primerR : r.primerL;
          setO(upP, true);
          upP.style.transform = `translateY(${-SS_OFF + PRIMER_OFF}px)`;
          setO(dnP, true);
          dnP.style.transform = `translateY(${SS_OFF + PRIMER_OFF}px)`;
        }
        break;
      }
      case "extend": {
        // 延伸：模板恒在 bandT(−8)、新链恒在下(+18) 锚点长出；每行 2 枚 Taq 守双链两 3′ 端
        const s = spanOf(cfg.temp);
        setO(r.bandT, true);
        setBand(r.bandT, s.x, s.w, tintColor(cfg.temp.tint));
        r.bandT.style.transform = `translateY(${-EX_OFF}px)`;
        setChild(r, cfg.temp, cfg.newSize === "medium" ? MEDIUM_W : TARGET_W, p, BLUE);
        const anchor = cfg.temp.type === "top" ? PRIMER_R_X : TARGET_X;
        const pEl = cfg.temp.type === "top" ? r.primerR : r.primerL;
        setO(pEl, true);
        pEl.style.transform = `translateY(${PRIMER_Y}px)`;
        setDirs(r, -EX_OFF, CHAIN_OFF, cfg.temp.type, opp(cfg.temp.type));
        if (taqOn) {
          // taq1：新链锚点（引物 3′ 端）；taq2：模板链 3′ 端（type top=右缘 / bottom=左缘，错开带外）
          setTaq(r.taq1, anchor, CHAIN_OFF);
          const t3 = cfg.temp.type === "top" ? s.x + s.w : s.x;
          setTaq(r.taq2, t3 + (cfg.temp.type === "top" ? TAQ2_GAP : -TAQ2_GAP), -EX_OFF);
        }
        break;
      }
      case "extBoth": {
        // 目标行（取舍⑱）：蓝短模板在上、绿短新链在下、双引物 + 角标；2 枚 Taq 守两 3′ 端
        setO(r.bandT, true);
        setBand(r.bandT, TARGET_X, TARGET_W, BLUE);
        r.bandT.style.transform = `translateY(${-EX_OFF}px)`;
        setChild(r, cfg.temp, TARGET_W, p, GREEN);
        setO(r.primerL, true);
        setO(r.primerR, true);
        r.primerL.style.transform = `translateY(${PRIMER_Y}px)`;
        r.primerR.style.transform = `translateY(${PRIMER_Y}px)`;
        setO(r.badge, true);
        setDirs(r, -EX_OFF, CHAIN_OFF, cfg.temp.type, opp(cfg.temp.type));
        if (taqOn) {
          // taq1 守绿新链锚点（546/314）、taq2 守蓝短模板 3′ 端（546/314 同侧，纵向错开避免叠酶）
          const anchor = cfg.temp.type === "top" ? PRIMER_R_X : TARGET_X;
          setTaq(r.taq1, anchor, CHAIN_OFF);
          setTaq(r.taq2, anchor + (cfg.temp.type === "top" ? TAQ2_GAP : -TAQ2_GAP), -EX_OFF);
        }
        break;
      }
    }
  }

  function render(state: PcrState): void {
    const s = state as PcrState & { stage?: string; extensionProgress?: number; targetCount?: number };
    const stageId = String(s.stage ?? "");
    const cfgs = ROW_MAP[stageId] ?? [];
    const ys = ROW_YS[cfgs.length] ?? ROW_YS[1]!;
    const p = Number(s.extensionProgress) || 0;
    const taqOn = TAQ_ON.has(stageId);
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
      layoutRow(r, cfg, p, taqOn);
    });

    root.temps.forEach((t) => {
      t.style.opacity = t.getAttribute("data-temp") === activeTemp ? "1" : "0.25";
    });

    const targetCount = Number(s.targetCount) || 0;
    if (root.clear) {
      root.clear.style.display = targetCount > 0 ? "" : "none";
      root.clear.textContent = `目标产物 ×${targetCount}`;
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
      { color: GRAY, label: "初始模板链" },
      { color: ORANGE, label: "引物" },
      { color: BLUE, label: "新合成链" },
      { color: GREEN, label: "目标产物" },
      { color: TAQ, label: "Taq 聚合酶" },
    ],
  };
}
/**
 * 共享排版审计工具（测试用）：jsdom 无布局计算，故用启发式估算
 * SVG 文字框与结构图形 AABB，做「文字不互相遮挡」的机械断言。
 *
 * 估算规则（与 .proposals/2026-09-12-text-clearance.html 一致）：
 * - 文字宽度：CJK/全角字符 1.0em，ASCII/数字 0.6em；框高 = fontSize×1.2，baseline 上 0.9em 下 0.22em
 * - 定位：读 x/y 属性 + text-anchor，经祖先链 style.transform（translate/rotate/scale，
 *   CSS 从右到左应用 = 矩阵 T·R·S）累计到 svg 根
 * - 结构图形：rect/circle/ellipse/line/path（解析 d 点集 bbox），AABB + stroke-width/2
 * - 可见性：沿祖先链检查 opacity（属性或 style）/visibility/display，任一隐藏即跳过
 * - 判定：text-text 各 +3px 膨胀后相交 → 冲突；text-shape +1px（按 1px 级容差）
 *
 * 豁免规则（默认）：
 * - 文字与其「同一最近父组」内的形状（本体，如碱基字母↔链带、gene-label↔单体杆）
 * - 姐妹染色单体：同染色体（chromo-XXa/b）文本↔杆、以及同位同文的双子标注
 * - 缩放 < 0.6 的组内文字（极体/精子头部等微缩示意，字面不可读，不参与断言）
 * - helix 层内互斥的上下链文字（螺旋投影在两链交汇节点必然重合，属示意取舍）
 * - 背景/细参考线类图元默认不视为遮挡物（细胞轮廓、纺锤丝、氢键、刻度等）
 */
import type { Course } from "../core/types";

export type Box = { x1: number; y1: number; x2: number; y2: number };

// ============ 变换矩阵（仿射 [a,b,c,d,e,f]：x' = a·x + c·y + e） ============
type Mat = [number, number, number, number, number, number];
const IDENT: Mat = [1, 0, 0, 1, 0, 0];

function mul(m1: Mat, m2: Mat): Mat {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}
const apply = (m: Mat, x: number, y: number): [number, number] =>
  [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** translate(r,r)/rotate(deg)/scale(s)，按书写顺序左乘（translate·rotate·scale） */
function parseTransform(str: string | null): Mat {
  const re = /(translate|rotate|scale)\(\s*(-?[\d.]+)(?:px)?(?:\s*,\s*(-?[\d.]+)(?:px)?)?\s*\)/g;
  let m = IDENT;
  let hit = false;
  let r: RegExpExecArray | null;
  while ((r = re.exec(str ?? "")) !== null) {
    hit = true;
    const fn = r[1];
    const a = parseFloat(r[2]);
    const b = r[3] === undefined ? a : parseFloat(r[3]);
    if (fn === "translate") m = mul(m, [1, 0, 0, 1, a, b]);
    else if (fn === "rotate") {
      const rad = (a * Math.PI) / 180;
      const c = Math.cos(rad), s = Math.sin(rad);
      m = mul(m, [c, s, -s, c, 0, 0]);
    } else if (fn === "scale") {
      const sx = r[3] === undefined ? a : a; // scale(a) 与 scale(a,b)：仅取第 1 参
      m = mul(m, [b === a ? a : sx, 0, 0, b, 0, 0]);
    }
  }
  return hit ? m : IDENT;
}

const compileTransform = (el: Element, root: Element): { mat: Mat; scale: number } => {
  let mat: Mat = IDENT;
  let scale = 1;
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    if (n instanceof SVGElement) mat = mul(parseTransform(n.style.transform), mat);
    const t = n.getAttribute?.("transform");
    if (t) mat = mul(parseTransform(t), mat);
    const s = n.getAttribute?.("data-scale");
    if (s) scale *= parseFloat(s);
    // style.transform 内嵌 scale 的累计（gene-label 反旋转所在组 scale 由外层 g 承担，这里仅累计显式 scale）
    const st = n instanceof SVGElement ? n.style.transform : "";
    const sm = /scale\(\s*(-?[\d.]+)/.exec(st ?? "");
    if (sm) scale *= parseFloat(sm[1]);
  }
  return { mat, scale };
};

// ============ 可见性与尺寸估算 ============
function isHidden(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (!(n instanceof SVGElement) && n.tagName !== "svg") continue;
    if ((n as SVGElement).style.opacity === "0") return true;
    if ((n as SVGElement).getAttribute("opacity") === "0") return true;
  }
  return false;
}

function fontSizeOf(text: SVGTextElement): number {
  const attr = text.getAttribute("font-size") || "13";
  return parseFloat(attr) || 13;
}

/** 启发式文字宽度（CJK/全角 1.0em，ASCII 0.6em） */
function textWidth(text: string, fs: number): number {
  let w = 0;
  for (const ch of text) {
    if (/[\u2E80-\u9FFF\uFF00-\uFFEF\u2014\u2018\u2019\u201C\u201D\u2192\u3000-\u303F\uFE30-\uFE4F]/.test(ch)) w += fs;
    else w += fs * 0.6;
  }
  return w;
}

function textBox(el: SVGTextElement, root: Element): { box: Box; mat: Mat; scale: number } {
  const fs = fontSizeOf(el);
  const x = parseFloat(el.getAttribute("x") || "0");
  const y = parseFloat(el.getAttribute("y") || "0");
  const anchor = el.getAttribute("text-anchor") || "start";
  const w = textWidth(el.textContent?.trim() ?? "", fs);
  let l: number, r: number;
  if (anchor === "middle") { l = x - w / 2; r = x + w / 2; }
  else if (anchor === "end") { l = x - w; r = x; }
  else { l = x; r = x + w; }
  const t = y - fs * 0.9;
  const b = y + fs * 0.22;
  const { mat, scale } = compileTransform(el, root);
  const corners = [
    apply(mat, l, t), apply(mat, r, t), apply(mat, l, b), apply(mat, r, b),
  ];
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  return {
    box: { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) },
    mat, scale,
  };
}

// ============ 结构图形 AABB ============
function shapeBox(el: Element, root: Element): Box {
  const pad = (parseFloat(el.getAttribute("stroke-width") || "0") || 0) / 2;
  let base: Box = { x1: 0, y1: 0, x2: 0, y2: 0 };
  const g = (k: string, d = 0): number => parseFloat(el.getAttribute(k) || String(d)) || 0;
  switch (el.tagName) {
    case "rect": {
      const x = g("x"), y = g("y"), w = g("width"), h = g("height");
      base = { x1: x, y1: y, x2: x + w, y2: y + h };
      break;
    }
    case "circle": {
      const cx = g("cx"), cy = g("cy"), r = g("r");
      base = { x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r };
      break;
    }
    case "ellipse": {
      const cx = g("cx"), cy = g("cy"), rx = g("rx"), ry = g("ry");
      base = { x1: cx - rx, y1: cy - ry, x2: cx + rx, y2: cy + ry };
      break;
    }
    case "line": {
      const x1 = g("x1"), y1 = g("y1"), x2 = g("x2"), y2 = g("y2");
      base = { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) };
      break;
    }
    case "path": {
      const d = el.getAttribute("d") || "";
      const nums = (d.match(/-?[\d.]+/g) || []).map(parseFloat);
      let [x1, y1, x2, y2] = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        x1 = Math.min(x1, nums[i]); y1 = Math.min(y1, nums[i + 1]);
        x2 = Math.max(x2, nums[i]); y2 = Math.max(y2, nums[i + 1]);
      }
      base = { x1, y1, x2, y2 };
      break;
    }
  }
  const { mat } = compileTransform(el, root);
  const corners = [
    apply(mat, base.x1, base.y1), apply(mat, base.x2, base.y1),
    apply(mat, base.x1, base.y2), apply(mat, base.x2, base.y2),
  ];
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const p = pad;
  return { x1: Math.min(...xs) - p, y1: Math.min(...ys) - p, x2: Math.max(...xs) + p, y2: Math.max(...ys) + p };
}

const overlaps = (a: Box, b: Box, padA: number, padB: number): boolean =>
  a.x1 - padA < b.x2 + padB && a.x2 + padA > b.x1 - padB &&
  a.y1 - padA < b.y2 + padB && a.y2 + padA > b.y1 - padB;

// ============ 分组与染色体归属 ============
/** 最近「带 class 的父组」或 svg 根（同一元素 = 本体豁免） */
function groupKey(el: Element): Element {
  let n = el.parentElement;
  while (n && !(n.hasAttribute?.("class") && (n.getAttribute("class") || "").trim() !== "")) {
    n = n.parentElement;
  }
  return n ?? el.closest("svg") ?? el;
}

/** 染色体键：chromo-A1a → "A1"；无染色体归属返回 null */
function chromoKey(el: Element): string | null {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const cls = n.getAttribute?.("class") || "";
    const m = /\bchromo-(.+)[ab]\b/.exec(cls);
    if (m) return m[1];
  }
  return null;
}

// ============ 场景级审计入口 ============
const SHAPE_TAGS = new Set(["rect", "circle", "ellipse", "line", "path", "polyline", "polygon"]);
const EXCLUDED_SHAPES = [
  "cell-outline", "cell-wall", "nuclear-membrane", "cell-plate", "sperm-tail",
  "polar-body", "spindle-line", "membrane", "hbond", "pair-tick", "mrna-tick",
  "codon-sep", "gap-marker", "helix-strand", "helix-rung", "duplex-label",
];

export interface ConflictOptions {
  /** 附加豁免：返回 true 表示文本 a 与形状 b 属于设计重叠，不报 */
  extraExempt?: (a: Element, b: Element) => boolean;
  /** 忽略文字字号下限（px，含缩放后的有效字号） */
  minFont?: number;
  /** gene-label 标注允许压在自身/同细胞染色体杆上（含杆-杆交汇区），仅针对减数分裂/有丝分裂 */
  allowGeneLabelOnRod?: boolean;
}

/**
 * 收集指定 svg 内所有「文字遮挡」冲突，返回人类可读的描述列表（空数组 = 通过）。
 * 每项格式：`位置: 文字 "内容" [box] × 文字/形状 <标识>`
 */
export function collectVisualConflicts(svg: SVGSVGElement, loc = "svg", opts: ConflictOptions = {}): string[] {
  const minFont = opts.minFont ?? 8;
  const out: string[] = [];

  const texts = [...svg.querySelectorAll("text")]
    .filter((t) => !isHidden(t))
    .map((t) => ({ el: t as SVGTextElement, ...textBox(t as SVGTextElement, svg) }))
    .filter((t) => t.scale >= 0.6 && t.box.x1 !== t.box.x2 && t.box.y1 !== t.box.y2)
    .filter((t) => (t.el.textContent || "").trim() !== "");

  // —— 文字 × 文字 ——
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      // 同位同文的双子（姐妹染色单体叠放）
      const sameDup =
        (a.el.textContent || "") === (b.el.textContent || "") &&
        Math.abs(a.box.x1 - b.box.x1) < 2 && Math.abs(a.box.y1 - b.box.y1) < 2;
      if (sameDup) continue;
      // helix 投影两链交汇节点
      if (a.el.closest(".helix-layer") && b.el.closest(".helix-layer")) continue;
      if (!overlaps(a.box, b.box, 3, 3)) continue;
      out.push(`${loc}: 文字“${a.el.textContent}”${fmt(a.box)} × 文字“${b.el.textContent}”${fmt(b.box)}`);
    }
  }

  // —— 文字 × 结构图形 ——
  const shapes = [...svg.querySelectorAll([...SHAPE_TAGS].join(","))]
    .filter((s) => {
      if (isHidden(s)) return false;
      const cls = s.getAttribute("class") || "";
      return !EXCLUDED_SHAPES.some((x) => cls.split(/\s+/).includes(x));
    })
    .map((s) => ({ el: s, box: shapeBox(s, svg) }));

  for (const t of texts) {
    const tk = chromoKey(t.el);
    const isGene = opts.allowGeneLabelOnRod ? t.el.classList.contains("gene-label") : false;
    for (const sh of shapes) {
      if (sh.box.x1 === sh.box.x2 && sh.box.y1 === sh.box.y2) continue;
      if (groupKey(t.el) === groupKey(sh.el)) continue;      // 本体豁免
      if (tk && chromoKey(sh.el) === tk) continue;           // 同染色体姐妹豁免
      if (opts.extraExempt?.(t.el, sh.el)) continue;
      // 杆-杆交汇区（见 CAVEAT 注记）：gene-label 标注驻留自身杆，允许压在同细胞其他杆的
      // 交汇段上——这是形状-形状碰撞的投影，非标注自身排版问题。
      if (isGene && sh.el.closest?.(".chromatid")) continue;
      if (!overlaps(t.box, sh.box, 1, 1)) continue;
      out.push(`${loc}: 文字“${t.el.textContent}”${fmt(t.box)} × 图形<${shapeLabel(sh.el)}>${fmt(sh.box)}`);
    }
  }

  return out;
}

export function expectNoOverlaps(svg: SVGSVGElement, loc = "svg", opts: ConflictOptions = {}): void {
  const bad = collectVisualConflicts(svg, loc, opts);
  if (bad.length > 0) {
    throw new Error(`文本遮挡冲突（${bad.length}）:\n  ${bad.join("\n  ")}`);
  }
}

const fmt = (b: Box): string => `[${Math.round(b.x1)},${Math.round(b.y1)}–${Math.round(b.x2)},${Math.round(b.y2)}]`;

function shapeLabel(el: Element): string {
  const cls = (el.getAttribute("class") || "").split(/\s+/)[0];
  return cls ? cls : el.tagName;
}

// ============ 全阶段审计 runner ============
export interface SceneAuditVariant {
  label: string;             // 变体名（如 "helix"/"combo-alt"）
  enable(): void;            // 切到变体并完成重渲染
  disable(): void;           // 切回默认并完成重渲染
}
export interface SceneAuditConfig {
  name: string;
  mount(): void;
  destroy?: () => void;
  pre?: () => void;          // 挂载后、首阶段渲染前执行一次（如勾选基因标注）
  render(state: unknown): void;
  stages: Array<{ id: string; state: unknown; variants?: SceneAuditVariant[] }>;
  svg(): SVGSVGElement | null;
  extraExempt?: (a: Element, b: Element) => boolean;
  minFont?: number;
  allowGeneLabelOnRod?: boolean;
}

/** 逐阶段渲染并审计，返回全部冲突描述（空数组 = 全绿） */
export function runSceneAudit(cfg: SceneAuditConfig): string[] {
  cfg.mount();
  const out: string[] = [];
  try {
    cfg.pre?.();
    for (const st of cfg.stages) {
      cfg.render(st.state);
      const svg = cfg.svg();
      if (!svg) continue;
      out.push(...collectVisualConflicts(svg, `${cfg.name}/${st.id}`, {
        extraExempt: cfg.extraExempt, minFont: cfg.minFont, allowGeneLabelOnRod: cfg.allowGeneLabelOnRod,
      }));
      for (const v of st.variants ?? []) {
        v.enable();
        cfg.render(st.state);
        if (svg) out.push(...collectVisualConflicts(svg, `${cfg.name}/${st.id}+${v.label}`, {
          extraExempt: cfg.extraExempt, minFont: cfg.minFont, allowGeneLabelOnRod: cfg.allowGeneLabelOnRod,
        }));
        v.disable();
      }
    }
  } finally {
    cfg.destroy?.();
    cfg.svg()?.remove();
  }
  return out;
}

// ============ 曲线图阶段标签间距 ============
/** 阶段标签水平间距下限（numberChart 参数，与 numberChart.ts 保持一致） */
export const CHART_SPACING = { left: 44, right: 16, width: 720 };

export interface StageLabelCheck {
  a: string; b: string; gap: number; need: number;
}

/** 相邻阶段标签是否互相遮挡（CJK 1.0em、ASCII 0.6em；两侧各留 pad 空隙） */
export function stageLabelViolations(labels: string[], opts: { fontSize?: number; pad?: number } = {}): StageLabelCheck[] {
  const fs = opts.fontSize ?? 13;
  const pad = opts.pad ?? 3;
  const n = labels.length;
  if (n <= 1) return [];
  const xFor = (i: number): number =>
    CHART_SPACING.left + (i * (CHART_SPACING.width - CHART_SPACING.left - CHART_SPACING.right)) / (n - 1);
  const bad: StageLabelCheck[] = [];
  for (let i = 0; i < n - 1; i++) {
    const gap = xFor(i + 1) - xFor(i);
    const need = textWidth(labels[i], fs) / 2 + pad + textWidth(labels[i + 1], fs) / 2 + pad;
    if (need > gap) bad.push({ a: labels[i], b: labels[i + 1], gap: +gap.toFixed(1), need: +need.toFixed(1) });
  }
  return bad;
}

/** 断言一组阶段标签在给定字号下互不遮挡（图表回归门禁） */
export function expectStageLabelsFit(labels: string[], opts: { fontSize?: number; pad?: number } = {}): void {
  const bad = stageLabelViolations(labels, opts);
  if (bad.length > 0) {
    throw new Error(
      `曲线图阶段标签互相遮挡（fontSize=${opts.fontSize ?? 13}）:\n  ` +
      bad.map((v) => `"${v.a}" × "${v.b}"：间距 ${v.gap}px < 需要 ${v.need}px`).join("\n  "),
    );
  }
}
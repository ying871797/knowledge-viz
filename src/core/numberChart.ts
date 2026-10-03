import type { Series } from "./types";

/**
 * 通用数目曲线图：横轴为「时期段轴」——每个时期占一整段等宽区间，
 * 数量在段内恒定（平台），仅在段边界瞬变（阶跃）；唯一的例外是
 * 渐变段（间期 DNA 复制这类「期内连续过程」），段内为线性斜坡。
 * 与主场景共享播放器索引实现联动（setActive 高亮当前期色带 + 放大数据点）。
 */

// 画布尺寸与边距（viewBox 单位）
export const W = 720;
export const H = 240;
export const M = { top: 16, right: 16, bottom: 44, left: 44 };

/** 绘图区宽度（时期段轴的可用长度） */
const PLOT_W = W - M.left - M.right;

const COLORS = ["#2563eb", "#dc2626", "#b45309"];
const NS = "http://www.w3.org/2000/svg";

/** 第 k 条时期边界：n 个时期段共 n+1 条边界，k=0 为左缘、k=n 为右缘 */
export function spanX(k: number, n: number): number {
  if (n <= 0) return M.left;
  return M.left + (k * PLOT_W) / n;
}

/** 第 i 个时期段的中心 x：数据点与阶段标签共用此位置（「一段一列」） */
export function spanCenterX(i: number, n: number): number {
  return spanX(i, n) + PLOT_W / n / 2;
}

/** 纵轴映射：数值 v 在 yMax 范围内的 y 坐标（值越大越靠上） */
export function yFor(v: number, yMax: number): number {
  // yMax≤0（含 NaN）时映射无意义：回落基线，避免返回 NaN/Infinity 污染整条路径
  if (!(yMax > 0)) return H - M.bottom;
  return H - M.bottom - (v / yMax) * (H - M.top - M.bottom);
}

/**
 * 阶梯路径：段内水平平台 + 段边界垂直跳变；渐变段内为线性斜坡。
 * 用 H/V 两个命令表达，使「跳变发生在段边界」可在 d 字符串上直接断言。
 * 渐变段的起点值取上一段的值（期初），终点值取本段的值（期末）。
 */
export function buildStepPath(values: number[], yMax: number, gradual: ReadonlySet<number>): string {
  const n = values.length;
  if (n === 0) return "";
  const y = (v: number): number => yFor(v, yMax);
  let d = `M ${spanX(0, n)} ${y(values[0])}`;
  // penX 追踪笔位：只在笔位不在本段左缘时才发 H
  // （渐变段的斜坡已把笔位带到本段右缘，下一轮无需再推进）
  let penX = spanX(0, n);
  for (let i = 1; i < n; i++) {
    const left = spanX(i, n);
    if (left !== penX) { d += ` H ${left}`; penX = left; }
    if (gradual.has(i)) {
      d += ` L ${spanX(i + 1, n)} ${y(values[i])}`; // 斜坡恰好填满本段
      penX = spanX(i + 1, n);
    } else if (values[i] !== values[i - 1]) {
      d += ` V ${y(values[i])}`; // 阶跃：落在段左缘，随后由下一轮的 H 铺满本段
    }
  }
  return `${d} H ${spanX(n, n)}`; // 末段延伸到绘图区右缘（n=1 时也成立）
}

/**
 * 数据点纵坐标：普通段取本段值；渐变段取斜坡中点。
 * 渐变段不存在单一「值」，点必须落在曲线上——若取本段值，点会浮在斜坡上方肉眼可见。
 */
function dotValue(values: number[], i: number, gradual: ReadonlySet<number>): number {
  if (i > 0 && gradual.has(i)) return (values[i - 1] + values[i]) / 2;
  return values[i];
}

/** 创建带属性的 SVG 元素的工具函数 */
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export class NumberChart {
  private svg: SVGSVGElement;
  private axisGroup: SVGGElement;
  private seriesLayer: SVGGElement;
  private markerBand: SVGRectElement;
  private legendEl: HTMLDivElement;
  private series: Series[] = [];
  private gradual: ReadonlySet<number>;
  private activeIndex = -1;
  private examMode = false;
  private clickCb: ((i: number) => void) | null = null;

  constructor(
    private container: HTMLElement,
    private labels: string[],
    /** 纵轴刻度格式化器（默认直接输出数值），如以 n 表示法显示 */
    private tickFormat: (v: number) => string = String,
    /** 纵轴刻度步进（如 n 值）：>1 时刻度只取 step 的整数倍（0, step, 2step…），用于 n 表示法去真实条数 */
    private tickStep = 1,
    /** 渐变段索引集合：该段内数量由上一段值线性变化到本段值；其余段为「期内恒定 + 边界阶跃」 */
    gradualSegments: number[] = [],
  ) {
    this.gradual = new Set(gradualSegments);
    this.svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img" });
    this.axisGroup = el("g", {});
    this.seriesLayer = el("g", {});
    // 高亮色带置于曲线层之下：半透明底色不遮挡曲线
    this.markerBand = el("rect", {
      class: "marker", x: M.left, y: M.top,
      width: 0, height: H - M.top - M.bottom,
      fill: "#f59e0b", "fill-opacity": 0.12, visibility: "hidden",
    });
    this.svg.append(this.markerBand, this.axisGroup, this.seriesLayer);
    // 图例：HTML 层（不占 SVG 绘图区，避免遮挡曲线），位于 svg 之前
    this.legendEl = document.createElement("div");
    this.legendEl.className = "chart-legend";
    container.appendChild(this.legendEl);
    container.appendChild(this.svg);
  }

  /** 坐标轴、刻度与时期标签（setSeries 时按当前 yMax 重建） */
  private rebuildAxes(): void {
    const g = el("g", {});
    const yMax = this.yMax();
    g.appendChild(el("line", { x1: M.left, y1: M.top, x2: M.left, y2: H - M.bottom, stroke: "#94a3b8" }));
    g.appendChild(el("line", { x1: M.left, y1: H - M.bottom, x2: W - M.right, y2: H - M.bottom, stroke: "#94a3b8" }));
    // 纵向网格线：数值为小整数时逐值画线；tickStep>1（n 表示法）时只画 n 的整数倍刻度。
    // 前置约定：使用 tickStep 的课程其全部数据值须为 step 的整数倍（buildChartConfigs 由
    // dna=dpc×chromosome、chromosome∈{n,2n,4n} 保证），使每个数据点恰好落在网格线上；
    // 若未来引入非倍数数据，顶部刻度需另行收口到 yMax。
    const step = Number.isFinite(this.tickStep) ? Math.max(1, Math.round(this.tickStep)) : 1;
    for (let v = 0; v <= yMax; v += step) {
      const y = yFor(v, yMax);
      if (v > 0) g.appendChild(el("line", { x1: M.left, y1: y, x2: W - M.right, y2: y, stroke: "#e2e8f0" }));
      const t = el("text", { class: "axis-text", x: M.left - 8, y: y + 4, "text-anchor": "end", "font-size": 12, fill: "#64748b" });
      t.textContent = this.tickFormat(v);
      g.appendChild(t);
    }
    // 时期标签：居于各自时期段的中心（与该段数据点同 x）
    // 练习模式下隐藏，重建时也需保持隐藏状态
    this.labels.forEach((label, i) => {
      const t = el("text", {
        class: "stage-label", x: spanCenterX(i, this.labels.length), y: H - M.bottom + 18,
        "text-anchor": "middle", "font-size": 11, fill: "#64748b",
        // 练习模式下重建的标签直接带上 visibility:hidden，避免击穿练习模式
        ...(this.examMode ? { visibility: "hidden" } : {}),
      });
      t.textContent = label;
      g.appendChild(t);
    });
    this.axisGroup.replaceChildren(g);
  }

  /** 当前全部系列的最大值（至少为 1，避免除零） */
  private yMax(): number {
    let max = 1;
    for (const s of this.series) for (const v of s.values) max = Math.max(max, v);
    return max;
  }

  /** 重绘全部阶梯曲线、数据点与 HTML 图例 */
  setSeries(series: Series[]): void {
    this.series = series;
    this.activeIndex = -1;
    this.seriesLayer.replaceChildren();
    this.rebuildAxes();
    // HTML 图例：色点 + 标签；虚线系列加虚线样式
    this.legendEl.replaceChildren();
    series.forEach((s, si) => {
      const color = s.color ?? COLORS[si % COLORS.length];
      const item = document.createElement("span");
      item.className = "legend-item";
      const swatch = document.createElement("i");
      swatch.className = "legend-swatch";
      if (s.dashed) {
        swatch.classList.add("legend-swatch-dashed");
        // 虚线样式：CSS 用 repeating-gradient 基于 currentColor，故在此注入系列色
        swatch.style.color = color;
      } else {
        swatch.style.background = color;
      }
      item.append(swatch, document.createTextNode(s.label));
      this.legendEl.appendChild(item);
    });
    // 练习模式下只保留坐标轴，不绘制曲线（图例同样隐藏）
    if (this.examMode) {
      this.legendEl.style.display = "none";
      return;
    }
    this.legendEl.style.display = "";

    const count = this.labels.length;
    const yMax = this.yMax();
    series.forEach((s, si) => {
      const color = s.color ?? COLORS[si % COLORS.length];
      // 阶梯曲线：段内平台 + 边界阶跃（渐变段为斜坡）
      const path = el("path", {
        class: "curve", d: buildStepPath(s.values, yMax, this.gradual), fill: "none",
        stroke: color, "stroke-width": 2, "stroke-linejoin": "round",
        ...(s.dashed ? { "stroke-dasharray": "6 4" } : {}),
      });
      this.seriesLayer.appendChild(path);
      // 数据点：每段一个，居于段中心；点击回调携带段索引
      s.values.forEach((_, i) => {
        const dot = el("circle", {
          class: "dot", cx: spanCenterX(i, count), cy: yFor(dotValue(s.values, i, this.gradual), yMax),
          r: 4, fill: color, "data-stage": i,
        });
        dot.addEventListener("click", () => this.clickCb?.(i));
        this.seriesLayer.appendChild(dot);
      });
    });
  }

  /** 高亮第 i 个时期段：色带覆盖整段 + 该段数据点放大 */
  setActive(i: number): void {
    const n = this.labels.length;
    // 越界索引（<0 或 ≥n）按隐藏处理：色带只落在合法时期段内，不把 x/width 算到画布外
    const valid = Number.isInteger(i) && i >= 0 && i < n;
    this.activeIndex = valid ? i : -1;
    const visible = !this.examMode && valid;
    this.markerBand.setAttribute("visibility", visible ? "visible" : "hidden");
    if (!visible) return;
    this.markerBand.setAttribute("x", String(spanX(i, n)));
    this.markerBand.setAttribute("width", String(n > 0 ? PLOT_W / n : 0));
    // 放大当前段的数据点，其余恢复默认半径
    this.seriesLayer.querySelectorAll<SVGCircleElement>("circle.dot").forEach((d) => {
      const on = Number(d.getAttribute("data-stage")) === i;
      d.setAttribute("r", on ? "7" : "4");
    });
  }

  /** 练习模式：隐藏曲线、数据点、图例与时期标签（保留坐标轴） */
  setExamMode(on: boolean): void {
    this.examMode = on;
    if (on) {
      const idx = this.activeIndex;
      this.seriesLayer.replaceChildren(); // 清空曲线
      this.legendEl.style.display = "none"; // 隐藏 HTML 图例
      this.svg.querySelectorAll("text.stage-label").forEach((t) => t.setAttribute("visibility", "hidden"));
      this.markerBand.setAttribute("visibility", "hidden");
      this.activeIndex = idx; // 保留记忆，退出练习模式后恢复
    } else {
      // 注意：setSeries 会把 activeIndex 重置为 -1，须先缓存再恢复
      const idx = this.activeIndex;
      const cur = [...this.series];
      this.svg.querySelectorAll("text.stage-label").forEach((t) => t.removeAttribute("visibility"));
      this.setSeries(cur);
      this.setActive(idx);
    }
  }

  /** 注册数据点点击回调（参数为段索引） */
  onPointClick(cb: (i: number) => void): void {
    this.clickCb = cb;
  }
}

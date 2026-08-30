import type { Series } from "./types";

/**
 * 通用数目曲线图：横轴为阶段，纵轴按数据最大值自适应。
 * 与主场景共享播放器索引实现联动（setActive 高亮竖线 + 放大数据点）。
 */

// 画布尺寸与边距（viewBox 单位）
export const W = 720;
export const H = 240;
export const M = { top: 16, right: 16, bottom: 44, left: 44 };

const COLORS = ["#2563eb", "#dc2626", "#b45309"];
const NS = "http://www.w3.org/2000/svg";

/** 横轴映射：第 i 个阶段（共 count 个）在绘图区内的 x 坐标，均匀分布 */
export function xFor(i: number, count: number): number {
  if (count <= 1) return M.left;
  return M.left + (i * (W - M.left - M.right)) / (count - 1);
}

/** 纵轴映射：数值 v 在 yMax 范围内的 y 坐标（值越大越靠上） */
export function yFor(v: number, yMax: number): number {
  return H - M.bottom - (v / yMax) * (H - M.top - M.bottom);
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
  private markerLine: SVGLineElement;
  private legendEl: HTMLDivElement;
  private series: Series[] = [];
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
  ) {
    this.svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img" });
    this.axisGroup = el("g", {});
    this.seriesLayer = el("g", {});
    this.markerLine = el("line", { class: "marker", stroke: "#f59e0b", "stroke-width": 2, visibility: "hidden" });
    this.svg.append(this.axisGroup, this.seriesLayer, this.markerLine);
    // 图例：HTML 层（不占 SVG 绘图区，避免遮挡曲线），位于 svg 之前
    this.legendEl = document.createElement("div");
    this.legendEl.className = "chart-legend";
    container.appendChild(this.legendEl);
    container.appendChild(this.svg);
  }

  /** 坐标轴、刻度与阶段标签（setSeries 时按当前 yMax 重建） */
  private rebuildAxes(): void {
    const g = el("g", {});
    const yMax = this.yMax();
    g.appendChild(el("line", { x1: M.left, y1: M.top, x2: M.left, y2: H - M.bottom, stroke: "#94a3b8" }));
    g.appendChild(el("line", { x1: M.left, y1: H - M.bottom, x2: W - M.right, y2: H - M.bottom, stroke: "#94a3b8" }));
    // 纵向网格线：数值为小整数时逐值画线；tickStep>1（n 表示法）时只画 n 的整数倍刻度。
    // 前置约定：使用 tickStep 的课程其全部数据值须为 step 的整数倍（buildChartConfigs 由
    // dna=dpc×chromosome、chromosome∈{n,2n,4n} 保证），使每个数据点恰好落在网格线上；
    // 若未来引入非倍数数据，顶部刻度需另行收口到 yMax。
    const step = Math.max(1, Math.round(this.tickStep));
    for (let v = 0; v <= yMax; v += step) {
      const y = yFor(v, yMax);
      if (v > 0) g.appendChild(el("line", { x1: M.left, y1: y, x2: W - M.right, y2: y, stroke: "#e2e8f0" }));
      const t = el("text", { class: "axis-text", x: M.left - 8, y: y + 4, "text-anchor": "end", "font-size": 12, fill: "#64748b" });
      t.textContent = this.tickFormat(v);
      g.appendChild(t);
    }
    // 阶段标签（练习模式下隐藏，重建时也需保持隐藏状态）
    this.labels.forEach((label, i) => {
      const t = el("text", {
        class: "stage-label", x: xFor(i, this.labels.length), y: H - M.bottom + 18,
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

  /** 重绘全部曲线、数据点与 HTML 图例 */
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
      // 折线：各数据点坐标拼接为 points
      const pts = s.values.map((v, i) => `${xFor(i, count)},${yFor(v, yMax)}`).join(" ");
      const poly = el("polyline", {
        points: pts, fill: "none", stroke: color, "stroke-width": 2,
        ...(s.dashed ? { "stroke-dasharray": "6 4" } : {}),
      });
      this.seriesLayer.appendChild(poly);
      // 数据点：点击回调携带列索引 i
      s.values.forEach((_, i) => {
        const dot = el("circle", {
          class: "dot", cx: xFor(i, count), cy: yFor(s.values[i], yMax),
          r: 4, fill: color, "data-stage": i,
        });
        dot.addEventListener("click", () => this.clickCb?.(i));
        this.seriesLayer.appendChild(dot);
      });
    });
  }

  /** 高亮第 i 阶段：竖线定位 + 该列数据点放大 */
  setActive(i: number): void {
    this.activeIndex = i;
    const visible = !this.examMode && i >= 0;
    this.markerLine.setAttribute("visibility", visible ? "visible" : "hidden");
    if (!visible) return;
    const x = xFor(i, this.labels.length);
    this.markerLine.setAttribute("x1", String(x));
    this.markerLine.setAttribute("x2", String(x));
    this.markerLine.setAttribute("y1", String(M.top));
    this.markerLine.setAttribute("y2", String(H - M.bottom));
    // 放大当前列的数据点，其余恢复默认半径
    this.seriesLayer.querySelectorAll<SVGCircleElement>("circle.dot").forEach((d) => {
      const on = Number(d.getAttribute("data-stage")) === i;
      d.setAttribute("r", on ? "7" : "4");
    });
  }

  /** 练习模式：隐藏曲线、数据点、图例与阶段标签（保留坐标轴） */
  setExamMode(on: boolean): void {
    this.examMode = on;
    if (on) {
      const idx = this.activeIndex;
      this.seriesLayer.replaceChildren(); // 清空曲线
      this.legendEl.style.display = "none"; // 隐藏 HTML 图例
      this.svg.querySelectorAll("text.stage-label").forEach((t) => t.setAttribute("visibility", "hidden"));
      this.markerLine.setAttribute("visibility", "hidden");
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

  /** 注册数据点点击回调（参数为列索引） */
  onPointClick(cb: (i: number) => void): void {
    this.clickCb = cb;
  }
}

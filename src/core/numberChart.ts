/**
 * 通用数目曲线图：横轴为阶段，纵轴按数据最大值自适应。
 * 与主场景共享播放器索引实现联动（setActive 高亮竖线 + 放大数据点）。
 */
export interface Series {
  label: string;
  values: number[];
  color?: string;
  dashed?: boolean;
}

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
  private series: Series[] = [];
  private activeIndex = -1;
  private examMode = false;
  private clickCb: ((i: number) => void) | null = null;

  constructor(private container: HTMLElement, private labels: string[]) {
    this.svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img" });
    this.axisGroup = el("g", {});
    this.seriesLayer = el("g", {});
    this.markerLine = el("line", { class: "marker", stroke: "#f59e0b", "stroke-width": 2, visibility: "hidden" });
    this.svg.append(this.axisGroup, this.seriesLayer, this.markerLine);
    container.appendChild(this.svg);
  }

  /** 坐标轴、刻度与阶段标签（setSeries 时按当前 yMax 重建） */
  private rebuildAxes(): void {
    const g = el("g", {});
    const yMax = this.yMax();
    g.appendChild(el("line", { x1: M.left, y1: M.top, x2: M.left, y2: H - M.bottom, stroke: "#94a3b8" }));
    g.appendChild(el("line", { x1: M.left, y1: H - M.bottom, x2: W - M.right, y2: H - M.bottom, stroke: "#94a3b8" }));
    // 纵向网格线（数值为小整数时逐值画线）
    for (let v = 0; v <= yMax; v++) {
      const y = yFor(v, yMax);
      if (v > 0) g.appendChild(el("line", { x1: M.left, y1: y, x2: W - M.right, y2: y, stroke: "#e2e8f0" }));
      const t = el("text", { x: M.left - 8, y: y + 4, "text-anchor": "end", "font-size": 12, fill: "#64748b" });
      t.textContent = String(v);
      g.appendChild(t);
    }
    // 阶段标签（练习模式下隐藏）
    this.labels.forEach((label, i) => {
      const t = el("text", { class: "stage-label", x: xFor(i, this.labels.length), y: H - M.bottom + 18, "text-anchor": "middle", "font-size": 11, fill: "#64748b" });
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

  /** 重绘全部曲线、数据点与图例 */
  setSeries(series: Series[]): void {
    this.series = series;
    this.activeIndex = -1;
    this.seriesLayer.replaceChildren();
    this.rebuildAxes();
    // 练习模式下只保留坐标轴，不绘制曲线
    if (this.examMode) return;

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
    // 图例（虚线系列加 "-- " 前缀）
    series.forEach((s, si) => {
      const color = s.color ?? COLORS[si % COLORS.length];
      const t = el("text", { x: W - M.right - 150 + si * 80, y: M.top + 4, "font-size": 12, fill: color });
      t.textContent = `${s.dashed ? "-- " : ""}${s.label}`;
      this.seriesLayer.appendChild(t);
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
    const yMax = this.yMax();
    // 放大当前列的数据点，其余恢复默认半径
    this.seriesLayer.querySelectorAll<SVGCircleElement>("circle.dot").forEach((d) => {
      const on = Number(d.getAttribute("data-stage")) === i;
      d.setAttribute("r", on ? "7" : "4");
    });
    void yMax;
  }

  /** 练习模式：隐藏曲线、数据点、图例与阶段标签（保留坐标轴） */
  setExamMode(on: boolean): void {
    this.examMode = on;
    if (on) {
      const idx = this.activeIndex;
      this.seriesLayer.replaceChildren(); // 清空曲线
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

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
const CELL_CENTERS: Record<number, [number, number][]> = {
  1: [[400, 200]],
  2: [[230, 200], [570, 200]],
  4: [[115, 200], [305, 200], [495, 200], [685, 200]],
};

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
  const w = 10;
  g.dataset.key = spec.key;
  g.addEventListener("click", () => onClick(spec));

  // 单体路径：以组内原点为中心的竖直杆；X 形由两条微弯 path 组成
  const arm = (dx: number, flip: boolean) =>
    `M ${flip ? dx : -dx} ${-spec.len / 2} Q 0 ${-spec.len / 6} ${flip ? -dx : dx} 0 Q 0 ${spec.len / 6} ${flip ? dx : -dx} ${spec.len / 2}`;
  const paths: SVGPathElement[] = [];
  const addArm = (d: string, color: string) => {
    const p = el("path", { d, fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round" });
    paths.push(p);
    g.appendChild(p);
  };
  addArm(arm(6, false), spec.color);
  addArm(arm(6, true), spec.color);
  // 第二对臂默认隐藏，replicated=true 时显示（X 形）
  paths[1].style.display = "none";

  // 着丝粒
  g.appendChild(el("circle", { r: 5, fill: "#111827" }));

  // 交叉互换标记：非姐妹单体末端互换色带（默认隐藏）
  const swap = el("rect", { x: -w / 2, y: -spec.len / 2 - 4, width: w + 6, height: 8, fill: spec.mateColor, rx: 2 });
  swap.style.display = "none";
  g.appendChild(swap);

  // 基因标注
  const label = el("text", { y: -spec.len / 2 - 12, "text-anchor": "middle", "font-size": 13, fill: "#334155", visibility: showGenes ? "visible" : "hidden" });
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

  /** 气泡文案：描述该染色体的单体数与同源染色体有无 */
  function describe(spec: ChromoSpec): string {
    const s = lastState!;
    const mono = s.cells >= 4 || (s.separating === "sister");
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
    const centers = CELL_CENTERS[s.cells];
    // 细胞轮廓（变形期画精子形态：椭圆头部 + 尾部）；先清除旧轮廓再重建
    root.querySelectorAll(".cell-outline, .sperm-tail").forEach((n) => n.remove());
    const radius = s.cells === 1 ? 150 : s.cells === 2 ? 105 : 62;
    centers.forEach(([cx, cy]) => {
      if (s.spermShape) {
        // 精子形态：椭圆头部 + 波浪形尾部
        const head = el("ellipse", { class: "cell-outline", cx: cx - 14, cy, rx: radius * 0.55, ry: radius * 0.42, fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": 2 });
        const tail = el("path", { class: "sperm-tail", d: `M ${cx + radius * 0.38} ${cy} q ${radius * 0.5} ${-18} ${radius * 0.95} 0 q ${radius * 0.45} ${18} ${radius * 0.85} ${-4}`, fill: "none", stroke: "#94a3b8", "stroke-width": 2 });
        root!.append(head, tail);
      } else {
        // 圆形细胞轮廓
        const c = el("circle", { class: "cell-outline", cx, cy, r: radius, fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": 2 });
        root!.appendChild(c);
      }
    });

    // 目标位置表：key -> [cx, cy]
    const pos: Record<string, [number, number]> = {};
    if (s.cells === 1) {
      const [cx, cy] = centers[0];
      if (s.equatorial !== "none") {
        // 中期：排在赤道板（水平中线 y=cy）
        if (s.equatorial === "paired") {
          pos.A1 = [cx - 130, cy]; pos.A2 = [cx - 130 + (s.separating === "homolog" ? 90 : 24), cy]; // 联会后分开
          pos.B1 = [cx + 130, cy]; pos.B2 = [cx + 130 - (s.separating === "homolog" ? 90 : 24), cy];
        } else {
          pos.A1 = [cx - 40, cy]; pos.A2 = [cx + 40, cy];
          pos.B1 = [cx - 130, cy]; pos.B2 = [cx + 130, cy];
        }
        if (s.separating === "homolog") {
          // 减Ⅰ后期：同源分离移向两极；comboAlt 决定非同源的自由组合方向
          pos.A1 = [comboAlt ? cx + 170 : cx - 170, cy - 60]; pos.A2 = [comboAlt ? cx - 170 : cx + 170, cy + 60];
          pos.B1 = [comboAlt ? cx - 170 : cx + 170, cy - 60]; pos.B2 = [comboAlt ? cx + 170 : cx - 170, cy + 60];
        }
      } else if (s.pairing) {
        // 联会/四分体：同源紧贴
        pos.A1 = [cx - 90, cy - 20]; pos.A2 = [cx - 66, cy + 20];
        pos.B1 = [cx + 90, cy - 20]; pos.B2 = [cx + 66, cy + 20];
        if (s.separating === "homolog") {
          // 后期：同源分离、非同源自由组合（comboAlt 切换组合方式）
          pos.A1 = [comboAlt ? cx + 160 : cx - 160, cy - 50]; pos.A2 = [comboAlt ? cx - 160 : cx + 160, cy + 50];
          pos.B1 = [comboAlt ? cx - 160 : cx + 160, cy - 50]; pos.B2 = [comboAlt ? cx + 160 : cx - 160, cy + 50];
        }
      } else if (s.separating === "homolog") {
        pos.A1 = [comboAlt ? cx + 160 : cx - 160, cy - 50]; pos.A2 = [comboAlt ? cx - 160 : cx + 160, cy + 50];
        pos.B1 = [comboAlt ? cx - 160 : cx + 160, cy - 50]; pos.B2 = [comboAlt ? cx + 160 : cx - 160, cy + 50];
      } else {
        // 散布基态
        pos.A1 = [cx - 110, cy - 40]; pos.A2 = [cx - 80, cy + 50];
        pos.B1 = [cx + 110, cy - 30]; pos.B2 = [cx + 85, cy + 45];
      }
    } else if (s.cells === 2) {
      const [c1, c2] = centers;
      // 减Ⅱ：每个细胞 2 条染色体（一长一短，互为非同源），默认即排在各自赤道板位置
      pos.A1 = [c1[0] - 25, c1[1]]; pos.B2 = [c1[0] + 25, c1[1]];
      pos.B1 = [c2[0] - 25, c2[1]]; pos.A2 = [c2[0] + 25, c2[1]];
      if (s.separating === "sister") {
        // 姐妹染色单体分开：X 形拆开（用位移表现分离趋势）
        pos.A1 = [c1[0] - 55, c1[1]]; pos.B2 = [c1[0] + 55, c1[1]];
        pos.B1 = [c2[0] - 55, c2[1]]; pos.A2 = [c2[0] + 55, c2[1]];
      }
    } else {
      // 4 个精细胞：每格 1 条（顺序对应两对染色体的四种组合之一）
      const order = ["A1", "B2", "B1", "A2"];
      order.forEach((key, i) => { pos[key] = centers[i]; });
    }

    // 应用位置（CSS transition 补间约 1.5s）与形态
    CHROMOSOMES.forEach(({ key }) => {
      const g = groups.get(key)!;
      const [x, y] = pos[key];
      g.style.transform = `translate(${x}px, ${y}px)`;
    });
    CHROMOSOMES.forEach(({ key }) => {
      const g = groups.get(key)!;
      // X 形显隐由 replicated 决定：第二条臂 display 控制
      const second = g.querySelectorAll<SVGPathElement>("path")[1];
      second.style.display = s.replicated ? "" : "none";
      // 交叉互换色带：仅在「互换标记可见且已复制」时显示
      const swapMark = g.querySelector("rect")!;
      swapMark.style.display = s.crossingOver && s.replicated ? "" : "none";
      // 基因标注可见性由开关统一控制
      const label = g.querySelector("text")!;
      label.setAttribute("visibility", showGenes ? "visible" : "hidden");
    });
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
      wrap.append(svgRoot, bubble);

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
      comboToggle.textContent = "切换自由组合方式";
      comboToggle.addEventListener("click", () => {
        comboAlt = !comboAlt;
        if (lastState) layout(lastState);
      });
      bar.append(geneToggle, comboToggle);
      wrap.appendChild(bar);

      CHROMOSOMES.forEach((spec) => {
        // mount 时基因标注默认不可见，运行时由 layout 按 showGenes 统一控制
        const g = buildChromosome(spec, false, (s) => {
          if (!lastState) return;
          const rect = (g as unknown as HTMLElement).getBoundingClientRect();
          const hostRect = wrap!.getBoundingClientRect();
          showBubble(describe(s), rect.left - hostRect.left, rect.top - hostRect.top - 46);
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

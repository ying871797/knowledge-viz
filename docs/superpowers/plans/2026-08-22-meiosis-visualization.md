# 高中生物知识点可视化工作流（试点：减数分裂）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可扩展的生物知识点可视化站点，第一期实现「减数分裂」分步动画课程（含数目曲线联动、交互开关、练习模式）。

**Architecture:** 数据与渲染分离——`core/` 为通用引擎（播放器、曲线图、讲解面板、页面装配），每个知识点是 `courses/<id>/` 下的独立模块（data + SVG 场景组件）。全部由离散阶段状态机驱动，曲线图与主场景共享同一播放器状态实现双向联动。

**Tech Stack:** Vite 5 + TypeScript 5（无框架，原生 DOM/SVG）、Vitest + jsdom 测试、GitHub Pages 部署。

## Global Constraints

- Node ≥ 18；不引入 UI 框架和动画库，仅 `vite` / `typescript` / `vitest` / `jsdom`
- 所有代码注释使用中文；核心文件必须有基本注释
- 课程数据加载必须经 `validateCourse` 校验，不合格 fail-fast 显示占位提示，禁止静默渲染错误画面
- 播放器边界：首步后退、末步前进均为 no-op；自动播放在末步停止
- 构建产物为纯静态文件，`base: './'` 以适配 GitHub Pages 子路径
- 不做自测题功能（用户已明确移除）；保留场景内「据图判断练习模式」
- 生物学表述对照人教版必修二教材

---

### Task 1: 工程脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`
- Create: `tests/smoke.test.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: 可运行的 `npm run dev / build / test` 工具链

- [ ] **Step 1: 初始化 npm 项目并安装依赖**

```bash
npm init -y
npm i -D vite typescript vitest jsdom
```

- [ ] **Step 2: 写入配置文件**

`package.json` 的 `scripts` 替换为：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`：

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  // 相对路径 base，适配 GitHub Pages 子路径部署
  base: "./",
  test: {
    environment: "jsdom",
  },
});
```

`.gitignore`：

```
node_modules/
dist/
```

- [ ] **Step 3: 创建入口骨架**

`index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>生物概念可视化讲解</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts`：

```typescript
// 入口：先输出占位内容，后续任务逐步替换为路由与课程装配
const root = document.getElementById("app")!;
root.textContent = "生物概念可视化讲解";
```

- [ ] **Step 4: 冒烟测试**

`tests/smoke.test.ts`：

```typescript
import { describe, it, expect } from "vitest";

describe("工程冒烟测试", () => {
  it("jsdom 环境可用且断言生效", () => {
    const el = document.createElement("div");
    el.textContent = "ok";
    expect(el.textContent).toBe("ok");
  });
});
```

- [ ] **Step 5: 验证工具链**

Run: `npm test && npm run build`
Expected: 1 个测试通过；构建成功产出 `dist/`

- [ ] **Step 6: 提交**

```bash
git init
git add -A
git commit -m "chore: Vite+TS+Vitest 工程脚手架"
```

---

### Task 2: 课程数据类型与校验器（TDD）

**Files:**
- Create: `src/core/types.ts`
- Test: `src/core/__tests__/validate.test.ts`

**Interfaces:**
- Produces: `StageNumbers`、`Stage`（含可选 `callout` 拐点气泡文案）、`Course`、`SceneComponent` 接口；`validateCourse(input: unknown): Course`

- [ ] **Step 1: 写失败测试**

`src/core/__tests__/validate.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { validateCourse, type Course } from "../types";

// 合法的最小课程样例
const valid: Course = {
  meta: { id: "meiosis", title: "减数分裂", chapter: "必修二", difficulty: 4 },
  stages: [
    {
      id: "spermatogonium", title: "精原细胞", narration: ["基态 2n=4"],
      sceneState: {}, numbers: { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 },
    },
    {
      id: "interphase", title: "间期", narration: ["复制"],
      sceneState: {}, numbers: { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 },
    },
  ],
};

describe("validateCourse", () => {
  it("合法数据原样通过", () => {
    expect(validateCourse(valid)).toEqual(valid);
  });
  it("非对象输入抛错", () => {
    expect(() => validateCourse(null)).toThrow();
  });
  it("stages 为空抛错", () => {
    expect(() => validateCourse({ ...valid, stages: [] })).toThrow(/stages/);
  });
  it("负数数目抛错", () => {
    const bad = structuredClone(valid);
    bad.stages[0].numbers.chromosome = -1;
    expect(() => validateCourse(bad)).toThrow(/chromosome/);
  });
  it("数目自洽性校验：dna ≠ dnaPerChromosome × chromosome 抛错", () => {
    const bad = structuredClone(valid);
    bad.stages[1].numbers.dna = 9;
    expect(() => validateCourse(bad)).toThrow(/不一致/);
  });
  it("有单体但 dnaPerChromosome≠2 抛错", () => {
    const bad = structuredClone(valid);
    bad.stages[1].numbers.chromatid = 8;
    bad.stages[1].numbers.dnaPerChromosome = 1;
    expect(() => validateCourse(bad)).toThrow(/单体/);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/__tests__/validate.test.ts`
Expected: FAIL（`../types` 不存在）

- [ ] **Step 3: 实现类型与校验器**

`src/core/types.ts`：

```typescript
/** 阶段数目数据：三条曲线的数据点来源 */
export interface StageNumbers {
  chromosome: number;        // 细胞内染色体数
  dna: number;               // 细胞内 DNA 数
  chromatid: number;         // 染色单体数
  dnaPerChromosome: number;  // 每条染色体 DNA 数（1 或 2）
}

export interface Stage {
  id: string;
  title: string;
  narration: string[];                  // 讲解要点与易错提示
  sceneState: Record<string, unknown>;  // 场景渲染参数，由各课程自定义
  numbers: StageNumbers;
  callout?: string;                     // 关键拐点气泡文案（如数目突变说明）
}

export interface Course {
  meta: { id: string; title: string; chapter: string; difficulty: number };
  stages: Stage[];
}

/** 场景组件接口：每个知识点课程各自实现 */
export interface SceneComponent {
  mount(container: HTMLElement): void;
  render(state: Record<string, unknown>): void;
}

function isNonNegNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** 结构校验，fail-fast：不合格抛错，由调用方显示占位提示 */
export function validateCourse(input: unknown): Course {
  const c = input as Course;
  if (!c || typeof c !== "object") throw new Error("课程数据必须是对象");
  if (!c.meta?.id || !c.meta?.title) throw new Error("meta.id/meta.title 缺失");
  if (!Array.isArray(c.stages) || c.stages.length === 0) throw new Error("stages 必须为非空数组");

  c.stages.forEach((s, i) => {
    const tag = s.id ?? `stage[${i}]`;
    if (!s.id || !s.title) throw new Error(`${tag} 缺少 id/title`);
    if (!Array.isArray(s.narration)) throw new Error(`${tag}.narration 必须是数组`);
    const n = s.numbers;
    if (!n) throw new Error(`${tag} 缺少 numbers`);
    (["chromosome", "dna", "chromatid", "dnaPerChromosome"] as const).forEach((k) => {
      if (!isNonNegNum(n[k])) throw new Error(`${tag}.numbers.${k} 必须是非负有限数值`);
    });
    if (n.chromosome > 0 && Math.abs(n.dnaPerChromosome * n.chromosome - n.dna) > 1e-9)
      throw new Error(`${tag} 数目不一致：dnaPerChromosome × chromosome ≠ dna`);
    if (n.chromatid > 0 && n.dnaPerChromosome !== 2)
      throw new Error(`${tag} 存在染色单体时每条染色体 DNA 数应为 2`);
    if (n.chromatid === 0 && n.dna !== n.chromosome)
      throw new Error(`${tag} 无染色单体时 dna 应等于 chromosome`);
  });

  return c;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/__tests__/validate.test.ts`
Expected: PASS（6 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/core
git commit -m "feat: 课程数据类型与 fail-fast 校验器"
```

---

### Task 3: 播放器状态机（TDD）

**Files:**
- Create: `src/core/player.ts`
- Test: `src/core/__tests__/player.test.ts`

**Interfaces:**
- Produces: `new Player(stageCount: number, onChange: (i: number) => void, intervalMs = 1500)`；成员 `current`、`isPlaying`、`goTo(i)`、`next()`、`prev()`、`play()`、`pause()`、`toggle()`、`destroy()`

- [ ] **Step 1: 写失败测试**

`src/core/__tests__/player.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Player } from "../player";

describe("Player", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const onChange = vi.fn();
    return { onChange, p: new Player(4, onChange, 1000) };
  };

  it("初始索引为 0 且不触发回调", () => {
    const { onChange, p } = make();
    expect(p.current).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("首步 prev 为 no-op", () => {
    const { onChange, p } = make();
    p.prev();
    expect(p.current).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("末步 next 为 no-op", () => {
    const { p } = make();
    p.goTo(3);
    p.next();
    expect(p.current).toBe(3);
  });
  it("goTo 越界时夹取到有效范围", () => {
    const { p } = make();
    p.goTo(-5);
    expect(p.current).toBe(0);
    p.goTo(99);
    expect(p.current).toBe(3);
  });
  it("play 按间隔推进并在末步自动停止", () => {
    const { p } = make();
    p.play();
    expect(p.isPlaying).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(p.current).toBe(3);
    vi.advanceTimersByTime(1000); // 下一个 tick 触发末步自动暂停
    expect(p.isPlaying).toBe(false);
  });
  it("toggle 在播放/暂停间切换", () => {
    const { p } = make();
    p.toggle();
    expect(p.isPlaying).toBe(true);
    p.toggle();
    expect(p.isPlaying).toBe(false);
  });
  it("destroy 后不再推进", () => {
    const { p } = make();
    p.play();
    p.destroy();
    vi.advanceTimersByTime(5000);
    expect(p.current).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/__tests__/player.test.ts`
Expected: FAIL（`../player` 不存在）

- [ ] **Step 3: 实现 Player**

`src/core/player.ts`：

```typescript
/**
 * 分步播放器：纯逻辑状态机，不依赖 DOM。
 * 边界规则：首步后退/末步前进为 no-op；自动播放到末步自动暂停。
 */
export class Player {
  private index = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private stageCount: number,
    private onChange: (index: number) => void,
    private intervalMs = 1500,
  ) {}

  get current(): number {
    return this.index;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  /** 跳转并夹取范围；相同索引不触发回调 */
  goTo(i: number): void {
    const target = Math.max(0, Math.min(this.stageCount - 1, Math.round(i)));
    if (target === this.index) return;
    this.index = target;
    this.onChange(this.index);
  }

  next(): void {
    this.goTo(this.index + 1);
  }

  prev(): void {
    this.goTo(this.index - 1);
  }

  play(): void {
    if (this.timer !== null || this.index >= this.stageCount - 1) return;
    this.timer = setInterval(() => {
      if (this.index >= this.stageCount - 1) {
        this.pause();
        return;
      }
      this.next();
    }, this.intervalMs);
  }

  pause(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  toggle(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  destroy(): void {
    this.pause();
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/__tests__/player.test.ts`
Expected: PASS（7 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/core/player.ts src/core/__tests__/player.test.ts
git commit -m "feat: 分步播放器状态机"
```

---

### Task 4: 数目曲线图组件（TDD）

**Files:**
- Create: `src/core/numberChart.ts`
- Test: `src/core/__tests__/numberChart.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `interface Series { label: string; values: number[]; color?: string; dashed?: boolean }`
  - `class NumberChart(container: HTMLElement, labels: string[])`，方法 `setSeries(series: Series[])`、`setActive(i: number)`、`setExamMode(on: boolean)`、`onPointClick(cb: (i: number) => void)`
  - 内部纯函数 `xFor(i, count)` / `yFor(v, yMax)` 导出供测试

- [ ] **Step 1: 写失败测试**

`src/core/__tests__/numberChart.test.ts`：

```typescript
import { describe, it, expect, vi } from "vitest";
import { NumberChart, xFor, yFor, W, M } from "../numberChart";

describe("坐标映射", () => {
  it("xFor 均匀分布且覆盖绘图区", () => {
    expect(xFor(0, 5)).toBe(M.left);
    expect(xFor(4, 5)).toBe(W - M.right);
  });
  it("yFor 值越大越靠上", () => {
    expect(yFor(0, 8)).toBeGreaterThan(yFor(8, 8));
  });
});

describe("NumberChart 渲染", () => {
  const mount = () => {
    const container = document.createElement("div");
    return { container, chart: new NumberChart(container, ["甲", "乙", "丙"]) };
  };
  const series = [
    { label: "DNA", values: [4, 8, 4] },
    { label: "染色体", values: [4, 4, 2], dashed: true },
  ];

  it("setSeries 后生成对应数量的折线", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    expect(container.querySelectorAll("polyline").length).toBe(2);
  });

  it("数据点圆的纵轴位置符合映射", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    const dot = container.querySelectorAll<SVGCircleElement>("circle.dot")[0];
    // 第一条系列第一个值 4，yMax=8 → 中点高度
    const expectedY = 16 /* top */ + (240 - 16 - 44) / 2;
    expect(Number(dot.getAttribute("cy"))).toBeCloseTo(expectedY, 5);
  });

  it("setActive 移动高亮竖线", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    chart.setActive(2);
    const line = container.querySelector<SVGLineElement>("line.marker")!;
    expect(Number(line.getAttribute("x1"))).toBeCloseTo(xFor(2, 3), 5);
  });

  it("点击数据点触发回调并携带列索引", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    const cb = vi.fn();
    chart.onPointClick(cb);
    const dot = container.querySelectorAll<SVGCircleElement>("circle.dot")[4];
    dot.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cb).toHaveBeenCalledWith(1); // 第 5 个点 = 第 2 系列 × 第 2 列
  });

  it("练习模式隐藏曲线与图例", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    chart.setExamMode(true);
    expect(container.querySelectorAll("polyline").length).toBe(0);
    chart.setExamMode(false);
    expect(container.querySelectorAll("polyline").length).toBe(2);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/__tests__/numberChart.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 NumberChart**

`src/core/numberChart.ts`：

```typescript
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

export function xFor(i: number, count: number): number {
  if (count <= 1) return M.left;
  return M.left + (i * (W - M.left - M.right)) / (count - 1);
}

export function yFor(v: number, yMax: number): number {
  return H - M.bottom - (v / yMax) * (H - M.top - M.bottom);
}

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
    if (this.examMode) return;

    const count = this.labels.length;
    const yMax = this.yMax();
    series.forEach((s, si) => {
      const color = s.color ?? COLORS[si % COLORS.length];
      const pts = s.values.map((v, i) => `${xFor(i, count)},${yFor(v, yMax)}`).join(" ");
      const poly = el("polyline", {
        points: pts, fill: "none", stroke: color, "stroke-width": 2,
        ...(s.dashed ? { "stroke-dasharray": "6 4" } : {}),
      });
      this.seriesLayer.appendChild(poly);
      s.values.forEach((_, i) => {
        const dot = el("circle", {
          class: "dot", cx: xFor(i, count), cy: yFor(s.values[i], yMax),
          r: 4, fill: color, "data-stage": i,
        });
        dot.addEventListener("click", () => this.clickCb?.(i));
        this.seriesLayer.appendChild(dot);
      });
    });
    // 图例
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

  onPointClick(cb: (i: number) => void): void {
    this.clickCb = cb;
  }
}
```

注意：坐标轴由 `rebuildAxes()` 在每次 `setSeries` 时按当前数据最大值重建；`setExamMode(false)` 通过缓存 `this.series` 重绘恢复，恢复时先缓存 `activeIndex` 再还原（`setSeries` 会重置它）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/core/__tests__/numberChart.test.ts`
Expected: PASS（7 个用例）。若 `expectedY` 断言因 yMax 计算不符，检查 `yMax()` 是否取全系列最大值 8。

- [ ] **Step 5: 提交**

```bash
git add src/core/numberChart.ts src/core/__tests__/numberChart.test.ts
git commit -m "feat: 通用 SVG 数目曲线图组件"
```

---

### Task 5: 讲解面板组件

**Files:**
- Create: `src/core/notes.ts`
- Test: `src/core/__tests__/notes.test.ts`

**Interfaces:**
- Produces: `class NotesPanel(container: HTMLElement)`，方法：
  - `render(title: string, items: string[]): void`（正常展示标题与要点列表）
  - `renderMasked(hint: string): void`（练习模式：隐藏标题显示提示语）

- [ ] **Step 1: 写失败测试**

`src/core/__tests__/notes.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { NotesPanel } from "../notes";

describe("NotesPanel", () => {
  it("render 展示标题与全部要点", () => {
    const c = document.createElement("div");
    const n = new NotesPanel(c);
    n.render("减Ⅰ前期", ["联会形成四分体", "可发生交叉互换"]);
    expect(c.querySelector("h3")!.textContent).toBe("减Ⅰ前期");
    expect(c.querySelectorAll("li").length).toBe(2);
  });
  it("renderMasked 隐藏真实标题", () => {
    const c = document.createElement("div");
    const n = new NotesPanel(c);
    n.renderMasked("判断当前时期");
    expect(c.querySelector("h3")!.textContent).toContain("？");
    expect(c.querySelectorAll("li").length).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/__tests__/notes.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`src/core/notes.ts`：

```typescript
/** 左侧阶段讲解面板：正常态展示标题+要点；练习模式遮蔽答案 */
export class NotesPanel {
  private titleEl: HTMLElement;
  private listEl: HTMLUListElement;

  constructor(private container: HTMLElement) {
    container.classList.add("notes-panel");
    this.titleEl = document.createElement("h3");
    this.listEl = document.createElement("ul");
    container.append(this.titleEl, this.listEl);
  }

  render(title: string, items: string[]): void {
    this.titleEl.textContent = title;
    this.listEl.replaceChildren(
      ...items.map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      }),
    );
  }

  /** 练习模式：不暴露当前阶段名 */
  renderMasked(hint: string): void {
    this.titleEl.textContent = `？期 —— ${hint}`;
    this.listEl.replaceChildren();
  }
}
```

- [ ] **Step 4: 运行确认通过并提交**

Run: `npx vitest run src/core/__tests__/notes.test.ts`
Expected: PASS（2 个用例）

```bash
git add src/core/notes.ts src/core/__tests__/notes.test.ts
git commit -m "feat: 阶段讲解面板组件"
```

---

### Task 6: 减数分裂课程数据

**Files:**
- Create: `src/courses/meiosis/data.ts`
- Test: `src/courses/meiosis/__tests__/data.test.ts`

**Interfaces:**
- Consumes: `validateCourse`（Task 2）
- Produces: `export const meiosisCourse: Course`（10 个阶段）；`export type MeiosisState` 场景状态类型（后续 scene.ts 使用）

**MeiosisState 字段约定**（scene.ts 据此渲染）：
`cells: 1 | 2 | 4`（画面中细胞个数）、`replicated: boolean`（已完成复制，出现姐妹染色单体）、`pairing: boolean`（联会/四分体）、`crossingOver: boolean`（交叉互换片段高亮）、`equatorial: "none" | "paired" | "single"`（赤道板排列方式）、`separating: "none" | "homolog" | "sister"`（分离类型）、`spermShape: boolean`（精子变形形态）

- [ ] **Step 1: 写校验测试**

`src/courses/meiosis/__tests__/data.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { meiosisCourse } from "../data";
import { validateCourse } from "../../../core/types";

describe("减数分裂课程数据", () => {
  it("通过结构校验（含数目自洽性）", () => {
    expect(() => validateCourse(meiosisCourse)).not.toThrow();
  });  it("包含 10 个阶段且 id 唯一", () => {
    const ids = meiosisCourse.stages.map((s) => s.id);
    expect(ids.length).toBe(10);
    expect(new Set(ids).size).toBe(10);
  });
  it("关键数目节点正确：间期后 DNA 加倍、减Ⅰ末期减半、减Ⅱ后期暂时加倍", () => {
    const n = (i: number) => meiosisCourse.stages[i].numbers;
    expect(n(1)).toMatchObject({ dna: 8, chromatid: 8 });
    expect(n(5)).toMatchObject({ chromosome: 2 });   // 减Ⅰ末期
    expect(n(7)).toMatchObject({ chromosome: 4, chromatid: 0 }); // 减Ⅱ后期
    expect(n(9)).toMatchObject({ chromosome: 2, dna: 2 });       // 精子
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/courses/meiosis/__tests__/data.test.ts`
Expected: FAIL（`../data` 不存在）

- [ ] **Step 3: 编写数据文件**

`src/courses/meiosis/data.ts`：

```typescript
import type { Course, Stage } from "../../core/types";

/** 场景状态字段约定，见计划文档 Task 6 说明 */
export interface MeiosisState {
  cells: 1 | 2 | 4;
  replicated: boolean;
  pairing: boolean;
  crossingOver: boolean;
  equatorial: "none" | "paired" | "single";
  separating: "none" | "homolog" | "sister";
  spermShape: boolean;
}

const st = (
  id: string,
  title: string,
  narration: string[],
  sceneState: MeiosisState,
  numbers: Stage["numbers"],
  callout?: string,
): Stage => ({ id, title, narration, sceneState, numbers, callout });

export const meiosisCourse: Course = {
  meta: { id: "meiosis", title: "减数分裂", chapter: "必修二 第一章第2节", difficulty: 4 },
  stages: [
    st("spermatogonium", "精原细胞（间期前）",
      ["精原细胞染色体数 2n=4，即两对同源染色体", "长染色体一对（红）、短染色体一对（蓝）"],
      { cells: 1, replicated: false, pairing: false, crossingOver: false, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 }),
    st("interphase", "间期（复制）",
      ["染色体复制：每条染色体形成两条姐妹染色单体", "染色体数不变，DNA 数加倍"],
      { cells: 1, replicated: true, pairing: false, crossingOver: false, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 },
      "间期复制的实质：DNA 复制 → 每条染色体上 DNA 由 1 变 2"),
    st("prophase-I", "减Ⅰ前期",
      ["同源染色体两两配对（联会），形成四分体", "四分体中的非姐妹染色单体常发生交叉互换"],
      { cells: 1, replicated: true, pairing: true, crossingOver: true, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("metaphase-I", "减Ⅰ中期",
      ["同源染色体成对排列在赤道板两侧", "注意：是「成对排列」，不同于有丝分裂的「逐条排列」"],
      { cells: 1, replicated: true, pairing: true, crossingOver: true, equatorial: "paired", separating: "none", spermShape: false },
      { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("anaphase-I", "减Ⅰ后期",
      ["同源染色体分离，分别移向两极", "非同源染色体自由组合 → 配子多样性的重要来源"],
      { cells: 1, replicated: true, pairing: true, crossingOver: true, equatorial: "none", separating: "homolog", spermShape: false },
      { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("telophase-I", "减Ⅰ末期",
      ["一个细胞分成两个次级精母细胞", "每个细胞：染色体数减半（2 条），但每条染色体仍含 2 条单体"],
      { cells: 2, replicated: true, pairing: false, crossingOver: true, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 2, dna: 4, chromatid: 4, dnaPerChromosome: 2 },
      "染色体数 4→2：减半的实质是同源染色体分离"),
    st("metaphase-II", "减Ⅱ中期",
      ["染色体排列在每个细胞的赤道板上", "易错点：此时细胞中已无同源染色体"],
      { cells: 2, replicated: true, pairing: false, crossingOver: true, equatorial: "single", separating: "none", spermShape: false },
      { chromosome: 2, dna: 4, chromatid: 4, dnaPerChromosome: 2 }),
    st("anaphase-II", "减Ⅱ后期",
      ["着丝粒分裂，姐妹染色单体分开成为两条子染色体", "染色体数暂时加倍（2→4）"],
      { cells: 2, replicated: false, pairing: false, crossingOver: false, equatorial: "none", separating: "sister", spermShape: false },
      { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 },
      "染色体数 2→4：暂时加倍的原因是着丝粒分裂"),
    st("telophase-II", "减Ⅱ末期",
      ["共形成四个精细胞", "每个精细胞：染色体数 n=2，每条染色体只含 1 个 DNA"],
      { cells: 4, replicated: false, pairing: false, crossingOver: false, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 2, dna: 2, chromatid: 0, dnaPerChromosome: 1 }),
    st("sperm", "变形（精子）",
      ["精细胞变形：头部浓缩、长出尾部", "最终染色体数 n=2，DNA 数 n=2"],
      { cells: 4, replicated: false, pairing: false, crossingOver: false, equatorial: "none", separating: "none", spermShape: true },
      { chromosome: 2, dna: 2, chromatid: 0, dnaPerChromosome: 1 }),
  ],
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/courses/meiosis/__tests__/data.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/courses/meiosis
git commit -m "feat: 减数分裂十阶段课程数据"
```

---

### Task 7: 减数分裂 SVG 场景

**Files:**
- Create: `src/courses/meiosis/scene.ts`

**Interfaces:**
- Consumes: `SceneComponent`、`MeiosisState`（Task 6）
- Produces: `createMeiosisScene(): SceneComponent & { destroy(): void }`

本任务为视觉渲染，以**浏览器手动验收**为主（SVG 视觉不适合快照测试），验收清单见 Step 3。逻辑尽量收敛为纯函数布局计算以便日后需要时补测。

- [ ] **Step 1: 实现场景组件**

`src/courses/meiosis/scene.ts`（完整实现）：

```typescript
import type { SceneComponent } from "../../core/types";
import type { MeiosisState } from "./data";

const NS = "http://www.w3.org/2000/svg";
const VB_W = 800, VB_H = 400;

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

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** 绘制一条染色体：replicated 时为 X 形（两条单体），否则单杆形 */
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

export function createMeiosisScene(): SceneComponent & { destroy(): void } {
  let root: SVGSVGElement | null = null;
  let wrap: HTMLDivElement | null = null;
  let bubble: HTMLDivElement | null = null;
  let groups = new Map<string, SVGGElement>();
  let lastState: MeiosisState | null = null;
  let showGenes = false;
  let comboAlt = false;          // 自由组合两种方式切换

  function describe(spec: ChromoSpec): string {
    const s = lastState!;
    const mono = s.cells >= 4 || (s.separating === "sister");
    return `${spec.pair === "A" ? "长" : "短"}染色体（${spec.key}，基因 ${spec.gene}）：` +
      `当前${s.replicated ? "含 2 条姐妹染色单体" : "无染色单体"}；` +
      `${mono ? "同源染色体已分离，细胞中不存在其同源染色体" : "细胞中存在它的同源染色体"}`;
  }

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
    // 细胞轮廓（变形期画精子形态：椭圆头部 + 尾部）
    root.querySelectorAll(".cell-outline, .sperm-tail").forEach((n) => n.remove());
    const radius = s.cells === 1 ? 150 : s.cells === 2 ? 105 : 62;
    centers.forEach(([cx, cy]) => {
      if (s.spermShape) {
        const head = el("ellipse", { class: "cell-outline", cx: cx - 14, cy, rx: radius * 0.55, ry: radius * 0.42, fill: "#f8fafc88", stroke: "#94a3b8", "stroke-width": 2 });
        const tail = el("path", { class: "sperm-tail", d: `M ${cx + radius * 0.38} ${cy} q ${radius * 0.5} ${-18} ${radius * 0.95} 0 q ${radius * 0.45} ${18} ${radius * 0.85} ${-4}`, fill: "none", stroke: "#94a3b8", "stroke-width": 2 });
        root!.append(head, tail);
      } else {
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
      // 4 个精细胞：每格 1 条
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
      // 交叉互换色带
      const swapMark = g.querySelector("rect")!;
      swapMark.style.display = s.crossingOver && s.replicated ? "" : "none";
      // 基因标注可见性
      const label = g.querySelector("text")!;
      label.setAttribute("visibility", showGenes ? "visible" : "hidden");
    });
  }

  return {
    mount(container: HTMLElement) {
      wrap = document.createElement("div");
      wrap.className = "meiosis-scene";
      root = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}`, width: "100%" });
      bubble = document.createElement("div");
      bubble.className = "chromo-bubble";
      bubble.style.display = "none";
      wrap.append(root, bubble);

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
        const g = buildChromosome(spec, false, (s) => {
          if (!lastState) return;
          const rect = (g as unknown as HTMLElement).getBoundingClientRect();
          const hostRect = wrap!.getBoundingClientRect();
          showBubble(describe(s), rect.left - hostRect.left, rect.top - hostRect.top - 46);
        });
        groups.set(spec.key, g);
        root.appendChild(g);
      });
      container.appendChild(wrap);
    },

    render(state: Record<string, unknown>) {
      lastState = state as MeiosisState;
      hideBubble();
      layout(lastState);
    },

    destroy() {
      wrap?.remove();
      groups.clear();
    },
  };
}
```

- [ ] **Step 2: 手动验收**

Run: `npm run dev`，在 `main.ts` 临时挂载（Task 8 会正式接线，此处临时验证）：

```typescript
import { createMeiosisScene } from "./courses/meiosis/scene";
const root = document.getElementById("app")!;
const scene = createMeiosisScene();
scene.mount(root);
scene.render({ cells: 1, replicated: true, pairing: true, crossingOver: true, equatorial: "none", separating: "none", spermShape: true });
```

手动验收清单：
1. 减Ⅰ前期：同源染色体两两贴近，末端出现异色色带（交叉互换标记）
2. 点击任意染色体：出现描述气泡（含单体数、有无同源）
3. 「显示基因标注」勾选后出现 A/a/B/b 字样
4. 「切换自由组合方式」点击后染色体目标位置镜像翻转（过渡动画约 1.5s）
5. `cells: 4, spermShape: true` 时画出 4 个小细胞

- [ ] **Step 3: 提交**

```bash
git add src/courses/meiosis/scene.ts
git commit -m "feat: 减数分裂 SVG 场景与交互开关"
```

---

### Task 8: 页面装配与联动

**Files:**
- Create: `src/core/app.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: Task 2–7 全部导出
- Produces: `mountCoursePage(root: HTMLElement, course: Course, createScene: () => SceneComponent & { destroy(): void }): void`；`mountHomePage(root: HTMLElement, courses: Course[]): void`（Task 9 扩展注册表）

- [ ] **Step 1: 实现 app.ts**

`src/core/app.ts`：

```typescript
import type { Course, SceneComponent } from "./types";
import { Player } from "./player";
import { NumberChart, type Series } from "./numberChart";
import { NotesPanel } from "./notes";

/** 课程页装配：布局 + 播放控制 + 双向联动 + 练习模式 */
export function mountCoursePage(
  root: HTMLElement,
  course: Course,
  createScene: () => SceneComponent & { destroy?: () => void },
): void {
  // 结构校验 fail-fast：不合格渲染占位提示
  try {
    // validateCourse 已在导入侧执行；这里再次防御
    if (!course.stages.length) throw new Error("stages 为空");
  } catch (err) {
    root.innerHTML = "";
    const fallback = document.createElement("p");
    fallback.className = "load-error";
    fallback.textContent = `课程数据异常：${(err as Error).message}`;
    root.appendChild(fallback);
    console.error("[course]", err);
    return;
  }

  const back = document.createElement("a");
  back.href = "#/";
  back.textContent = "← 返回目录";
  back.className = "back-link";

  const h2 = document.createElement("h2");
  h2.className = "course-title";
  h2.textContent = course.meta.title;

  const grid = document.createElement("div");
  grid.className = "course-grid";
  const notesBox = document.createElement("aside");
  const stageBox = document.createElement("section");
  grid.append(notesBox, stageBox);

  const totalsCard = document.createElement("div");
  totalsCard.className = "chart-card";
  const perCard = document.createElement("div");
  perCard.className = "chart-card";
  const totalsTitle = document.createElement("h4");
  totalsTitle.textContent = "细胞内数目变化";
  const perTitle = document.createElement("h4");
  perTitle.textContent = "每条染色体上的 DNA 数";
  totalsCard.append(totalsTitle);
  perCard.append(perTitle);

  const controls = document.createElement("div");
  controls.className = "controls";
  const btnPrev = Object.assign(document.createElement("button"), { textContent: "⏮ 上一步" });
  const btnPlay = Object.assign(document.createElement("button"), { textContent: "▶ 播放" });
  const btnNext = Object.assign(document.createElement("button"), { textContent: "下一步 ⏭" });
  const slider = Object.assign(document.createElement("input"), { type: "range" }) as HTMLInputElement;
  slider.min = "0"; slider.max = String(course.stages.length - 1); slider.value = "0";
  const examToggle = Object.assign(document.createElement("label"), { className: "exam-toggle" });
  examToggle.innerHTML = `<input type="checkbox" /> 据图判断练习模式`;
  const revealBtn = Object.assign(document.createElement("button"), { textContent: "揭晓答案" });
  revealBtn.style.display = "none";
  controls.append(btnPrev, btnPlay, btnNext, slider, examToggle, revealBtn);

  root.append(back, h2, grid, totalsCard, perCard, controls);

  const notes = new NotesPanel(notesBox);
  const scene = createScene();
  scene.mount(stageBox);

  const labels = course.stages.map((s) => s.title);
  const totals = new NumberChart(totalsCard, labels);
  const perChr = new NumberChart(perCard, labels);

  // 总数图三条曲线 + 显隐开关（可隐藏单条曲线让学生预测变化）
  const TOTAL_SERIES: Series[] = [
    { label: "DNA数", values: course.stages.map((s) => s.numbers.dna), color: "#2563eb" },
    { label: "染色体数", values: course.stages.map((s) => s.numbers.chromosome), color: "#dc2626" },
    { label: "染色单体数", values: course.stages.map((s) => s.numbers.chromatid), color: "#b45309", dashed: true },
  ];
  totals.setSeries(TOTAL_SERIES);
  perChr.setSeries([
    { label: "每条染色体DNA", values: course.stages.map((s) => s.numbers.dnaPerChromosome), color: "#059669" },
  ]);

  // 曲线显隐复选框组
  const seriesToggles = document.createElement("div");
  seriesToggles.className = "series-toggles";
  TOTAL_SERIES.forEach((s, si) => {
    const lab = document.createElement("label");
    const box = Object.assign(document.createElement("input"), { type: "checkbox" }) as HTMLInputElement;
    box.checked = true;
    box.addEventListener("change", () => {
      totals.setSeries(TOTAL_SERIES.filter((_, i) => i === si || (seriesToggles.children[i] as HTMLElement).querySelector("input")!.checked));
      totals.setActive(player.current);
    });
    lab.append(box, document.createTextNode(` ${s.label}`));
    seriesToggles.appendChild(lab);
  });
  totalsCard.appendChild(seriesToggles);

  // 拐点气泡
  const callout = document.createElement("div");
  callout.className = "callout";
  callout.style.display = "none";
  root.appendChild(callout);

  let examMode = false;
  const player = new Player(course.stages.length, applyStage, 1500);

  function applyStage(i: number): void {
    const stage = course.stages[i];
    slider.value = String(i);
    if (examMode) {
      notes.renderMasked("看主场景画面，判断这是哪个时期，再揭晓答案");
    } else {
      notes.render(stage.title, stage.narration);
    }
    scene.render(stage.sceneState);
    totals.setActive(i);
    perChr.setActive(i);
    if (stage.callout && !examMode) {
      callout.textContent = `💡 ${stage.callout}`;
      callout.style.display = "block";
    } else {
      callout.style.display = "none";
    }
    btnPlay.textContent = player.isPlaying ? "⏸ 暂停" : "▶ 播放";
  }

  // 双向联动：曲线数据点点击 → 跳转该阶段
  totals.onPointClick((i) => { player.pause(); player.goTo(i); });
  perChr.onPointClick((i) => { player.pause(); player.goTo(i); });

  btnPrev.addEventListener("click", () => { player.pause(); player.prev(); });
  btnNext.addEventListener("click", () => { player.pause(); player.next(); });
  btnPlay.addEventListener("click", () => { player.toggle(); applyStage(player.current); });
  slider.addEventListener("input", () => { player.pause(); player.goTo(Number(slider.value)); });

  examToggle.querySelector("input")!.addEventListener("change", (e) => {
    examMode = (e.target as HTMLInputElement).checked;
    totals.setExamMode(examMode);
    perChr.setExamMode(examMode);
    revealBtn.style.display = examMode ? "" : "none";
    applyStage(player.current);
  });
  revealBtn.addEventListener("click", () => {
    const stage = course.stages[player.current];
    notes.render(`答案：${stage.title}`, stage.narration);
  });

  applyStage(0);
}
```

同时把 fail-fast 校验提前到挂载处执行：在 `main.ts` 注册时调用 `validateCourse(course)`，异常则同样走占位提示（见 Task 9）。

- [ ] **Step 2: 追加全局样式**

Modify `src/style.css`（新建于 Task 1 或此处创建，`main.ts` 中 `import "./style.css"`）：

```css
body { font-family: "Microsoft YaHei", system-ui, sans-serif; margin: 0; background: #f8fafc; color: #1f2937; }
#app { max-width: 1080px; margin: 0 auto; padding: 20px; }
.course-grid { display: flex; gap: 16px; }
.course-grid aside { flex: 0 0 260px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
.course-grid section { flex: 1; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px; position: relative; }
.chart-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; margin-top: 12px; }
.controls { display: flex; gap: 10px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
.controls input[type="range"] { flex: 1; min-width: 140px; }
.series-toggles { display: flex; gap: 12px; margin-top: 6px; font-size: 13px; }
.meiosis-scene { position: relative; }
.chromo-bubble { position: absolute; max-width: 280px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 8px 12px; font-size: 13px; z-index: 5; }
.scene-controls { display: flex; gap: 14px; margin-top: 8px; }
.chromo { transition: transform 1.5s ease; }
.cell-outline { transition: r .8s ease; }
.callout { margin-top: 10px; background: #dbeafe; border-left: 4px solid #2563eb; padding: 10px 14px; border-radius: 6px; }
.load-error { color: #b91c1c; background: #fee2e2; padding: 16px; border-radius: 8px; }
@media (max-width: 720px) { .course-grid { flex-direction: column; } .course-grid aside { flex: none; } }
```

- [ ] **Step 3: 手动验收**

`npm run dev` 打开页面，核对：
1. 两栏布局 + 三张卡片（总数曲线、每条染色体曲线、控制条）
2. 播放/单步/进度条均驱动主场景与两条曲线同步
3. 点击曲线任一数据点，主场景跳到对应阶段
4. 取消勾选「染色单体数」后该曲线消失，重新勾选恢复（高亮竖线位置正确）
5. 减Ⅰ末期与减Ⅱ后期进入时出现 💡 拐点气泡
6. 勾选练习模式：曲线消失、讲解面板变为「？期」；点「揭晓答案」恢复讲解
7. 全程无控制台报错

- [ ] **Step 4: 提交**

```bash
git add src/core/app.ts src/style.css src/main.ts
git commit -m "feat: 课程页装配与曲线-场景双向联动"
```

---

### Task 9: 首页导航、入口路由与部署

**Files:**
- Modify: `src/main.ts`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `mountCoursePage`、`meiosisCourse`、`createMeiosisScene`、`validateCourse`
- Produces: hash 路由（`#/` 目录页、`#/course/<id>` 课程页）；GitHub Actions 自动发布

- [ ] **Step 1: 实现路由与课程注册表**

`src/main.ts`：

```typescript
import "./style.css";
import { mountCoursePage } from "./core/app";
import { validateCourse } from "./core/types";
import type { Course, SceneComponent } from "./core/types";
import { meiosisCourse } from "./courses/meiosis/data";
import { createMeiosisScene } from "./courses/meiosis/scene";

/** 课程注册表：新增知识点时在此登记即可 */
interface CourseEntry {
  meta: Course["meta"];
  load: () => Course;
  createScene: () => SceneComponent & { destroy?: () => void };
}
const registry: CourseEntry[] = [];

try {
  const course = validateCourse(meiosisCourse);
  registry.push({ meta: course.meta, load: () => course, createScene: createMeiosisScene });
} catch (err) {
  console.error("[registry]", err);
}

const root = document.getElementById("app")!;

function renderHome(): void {
  root.innerHTML = "";
  const h1 = document.createElement("h1");
  h1.textContent = "生物概念可视化讲解";
  const ul = document.createElement("ul");
  ul.className = "home-list";
  registry.forEach((entry) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#/course/${entry.meta.id}`;
    a.textContent = `${entry.meta.title}（${entry.meta.chapter}）`;
    li.appendChild(a);
    ul.appendChild(li);
  });
  root.append(h1, ul);
}

function renderCourse(id: string): void {
  const entry = registry.find((e) => e.meta.id === id);
  if (!entry) { renderHome(); return; }
  root.innerHTML = "";
  mountCoursePage(root, entry.load(), entry.createScene);
}

function route(): void {
  const hash = location.hash || "#/";
  const match = /^#\/course\/([\w-]+)/.exec(hash);
  if (match) renderCourse(match[1]);
  else renderHome();
}

window.addEventListener("hashchange", route);
route();
```

- [ ] **Step 2: 手动验收**

`npm run dev`：首页列出「减数分裂」条目；点击进入课程页；浏览器后退键返回目录。

- [ ] **Step 3: GitHub Actions 部署工作流**

`.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: 最终验证并提交**

Run: `npm test && npm run build && npm run preview`
Expected: 全部测试通过；预览页首页/课程页/回退均正常

```bash
git add src/main.ts .github
git commit -m "feat: 首页导航路由与 GitHub Pages 自动部署"
```

---

## 后续扩展（不在本期计划内）

新增知识点（如 DNA 复制）：新建 `src/courses/dna-replication/{data,scene}.ts` 并在 `main.ts` 注册表登记一行，引擎零改动。

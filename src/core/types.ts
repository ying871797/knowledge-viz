import type { Series } from "./numberChart";

/** 单张图表的配置：课程声明"我要画什么图" */
export interface ChartConfig {
  title: string;                        // 图表标题
  series: Series[];                     // 曲线数据（复用 numberChart.Series）
  tickFormat?: (v: number) => string;   // 纵轴刻度格式化（如 n 表示法）
  tickStep?: number;                    // 纵轴刻度步进（>1 时刻度只取 step 的整数倍，配合 n 表示法去真实条数）
}

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
  narration: string[];
  sceneState: Record<string, unknown>;
  /** 数目数据（曲线图表数据源）；hideCharts 课程可省略 */
  numbers?: StageNumbers;
  callout?: string;                     // 关键拐点气泡文案（如数目突变说明）
}

export interface Course {
  meta: { id: string; title: string; chapter: string; difficulty: number; /** 隐藏数目曲线图表（如 DNA 复制等无数目语义的课程） */
    hideCharts?: boolean; };
  stages: Stage[];
  /** 课程自定义图表配置；有此字段时 app.ts 据此渲染曲线图表 */
  chartConfigs?: ChartConfig[];
}

/** 场景组件接口：每个知识点课程各自实现 */
export interface SceneComponent {
  mount(container: HTMLElement): void;
  render(state: Record<string, unknown>): void;
  /** 场景图例数据（可选）：有则由 app.ts 渲染为 HTML 覆盖层，不参与 SVG 缩放 */
  legend?: Array<{ color: string; label: string }>;
}

// 判断值是否为非负有限数值（用于 fail-fast 校验）
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
    // hideCharts 或 chartConfigs 课程无数目语义，跳过数目校验
    if (c.meta.hideCharts || c.chartConfigs) return;
    const n = s.numbers;
    if (!n) throw new Error(`${tag} 缺少 numbers`);
    (["chromosome", "dna", "chromatid", "dnaPerChromosome"] as const).forEach((k) => {
      if (!isNonNegNum(n[k])) throw new Error(`${tag}.numbers.${k} 必须是非负有限数值`);
    });
    // 有染色单体意味着每条染色体含 2 个 DNA 分子
    if (n.chromatid > 0 && n.dnaPerChromosome !== 2)
      throw new Error(`${tag} 存在染色单体时每条染色体 DNA 数应为 2`);
    // 数目自洽性：dna = dnaPerChromosome × chromosome
    if (n.chromosome > 0 && Math.abs(n.dnaPerChromosome * n.chromosome - n.dna) > 1e-9)
      throw new Error(`${tag} 数目不一致：dnaPerChromosome × chromosome ≠ dna`);
    // 无染色单体时每条染色体只有 1 个 DNA
    if (n.chromatid === 0 && n.dna !== n.chromosome)
      throw new Error(`${tag} 无染色单体时 dna 应等于 chromosome`);
  });

  // 若提供 chartConfigs，进行基础一致性校验
  if (c.chartConfigs) {
    if (!Array.isArray(c.chartConfigs)) throw new Error("chartConfigs 必须是数组");
    c.chartConfigs.forEach((config, ci) => {
      if (!config.title || typeof config.title !== "string")
        throw new Error(`chartConfigs[${ci}] 缺少 title`);
      if (!Array.isArray(config.series)) throw new Error(`chartConfigs[${ci}] series 必须是数组`);
      config.series.forEach((series, si) => {
        if (!series.label || typeof series.label !== "string")
          throw new Error(`chartConfigs[${ci}].series[${si}] 缺少 label`);
        if (!Array.isArray(series.values))
          throw new Error(`chartConfigs[${ci}].series[${si}] values 必须是数组`);
        if (series.values.length !== c.stages.length)
          throw new Error(`chartConfigs[${ci}].series[${si}] values 长度必须等于 stages 数量（${c.stages.length}）`);
        if (series.values.some((v) => typeof v !== "number" || !Number.isFinite(v)))
          throw new Error(`chartConfigs[${ci}].series[${si}] values 必须是有限数值`);
      });
    });
  }

  return c;
}

/** 单条曲线数据：课程声明"我要画什么图"时给出 */
export interface Series {
  label: string;
  values: number[];
  color?: string;
  dashed?: boolean;
}

/** 单张图表的配置：课程声明"我要画什么图" */
export interface ChartConfig {
  title: string;                        // 图表标题
  series: Series[];                     // 曲线数据（本文件定义）
  tickFormat?: (v: number) => string;   // 纵轴刻度格式化（如 n 表示法）
  tickStep?: number;                    // 纵轴刻度步进（>1 时刻度只取 step 的整数倍，配合 n 表示法去真实条数）
  /**
   * 渐变段索引集合（可选）：该段内数量由上一段的值线性变化到本段的值（段内斜坡），
   * 其余段一律「期内恒定 + 段边界阶跃」。索引指 stages 下标。
   * 教材依据：DNA 复制是间期内的连续过程（"因复制而加倍"），
   * 而着丝粒分裂与细胞一分为二都是瞬时事件 → 阶跃。
   * 阶梯与斜坡无法从 values 推导（两者都表现为 values[i] ≠ values[i-1]），故须显式声明。
   */
  gradualSegments?: number[];
}

/** 关键公式卡条目：数量名 + 公式 + 例值，静态展示（不随阶段高亮） */
export interface FormulaInfo {
  name: string;      // 数量名（如 "分子数"）
  expr: string;      // 公式（如 "2ⁿ"）
  example?: string;  // 例值（如 "n=3 → 8"）
}

/** 阶段数目数据：三条曲线的数据点来源 */
export interface StageNumbers {
  chromosome: number;        // 细胞内染色体数
  dna: number;               // 细胞内 DNA 数
  chromatid: number;         // 染色单体数
  dnaPerChromosome: number;  // 每条染色体 DNA 数（1 或 2）
}

export interface Stage<State = Record<string, unknown>> {
  id: string;
  title: string;
  /** 曲线图横轴短标签（可选）：用于图表 X 轴，避免完整标题互相遮挡；未设则回退 title */
  chartLabel?: string;
  narration: string[];
  sceneState: State;
  /** 数目数据（曲线图表数据源）；无数目字段的课程可省略（如 PCR/抽象通路课程） */
  numbers?: StageNumbers;
  callout?: string;                     // 关键拐点气泡文案（如数目突变说明）
}

export interface Course<State = Record<string, unknown>> {
  meta: { id: string; title: string; chapter: string; difficulty: number };
  stages: Stage<State>[];
  /** 课程自定义图表配置；有此字段时 app.ts 据此渲染曲线图表（无则无图、无练习开关） */
  chartConfigs?: ChartConfig[];
  /** 关键公式卡（可选，通用能力）：静态展示课程末尾的关键数量公式 */
  formulas?: FormulaInfo[];
}

/** 最小场景状态：仅靠 stage id 查槽位表（mitosis / gene-expression / dna-replication / 未来光合）
 *  用 type 别名（而非 interface）：保结构类型可赋给 Record<string, unknown>，注册表擦除免隐式索引签名门坎 */
export type StageIdState = { stage: string };

/** 场景组件接口：每个知识点课程各自实现 */
export interface SceneComponent<State = Record<string, unknown>> {
  mount(container: HTMLElement): void;
  render(state: State): void;
  /** 场景图例数据（可选）：有则由 app.ts 渲染为 HTML 覆盖层，不参与 SVG 缩放 */
  legend?: Array<{ color: string; label: string }>;
}

// 判断值是否为非负有限数值（用于 fail-fast 校验）
function isNonNegNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** 结构校验，fail-fast：不合格抛错，由调用方显示占位提示 */
export function validateCourse<State = Record<string, unknown>>(input: unknown): Course<State> {
  const c = input as Course<State>;
  if (!c || typeof c !== "object") throw new Error("课程数据必须是对象");
  if (!c.meta?.id || !c.meta?.title) throw new Error("meta.id/meta.title 缺失");
  // difficulty 若提供须为 1..5 整数：main.ts 难度圆点按 4−difficulty 生成，越界会抛 RangeError（白屏）
  const difficulty = c.meta.difficulty;
  if (difficulty !== undefined && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5))
    throw new Error("meta.difficulty 必须是 1..5 的整数");
  if (!Array.isArray(c.stages) || c.stages.length === 0) throw new Error("stages 必须为非空数组");

  const seenStageIds = new Set<string>();
  c.stages.forEach((s, i) => {
    const tag = s.id ?? `stage[${i}]`;
    if (!s.id || !s.title) throw new Error(`${tag} 缺少 id/title`);
    // stage.id 必须唯一：重复会让槽位表/路由行为未定义（两份数据指向同一幕）
    if (seenStageIds.has(s.id)) throw new Error(`stage id 重复：${s.id}`);
    seenStageIds.add(s.id);
    if (!Array.isArray(s.narration)) throw new Error(`${tag}.narration 必须是数组`);
    // 讲解元素须为非空字符串：空串/空白会在讲解面板留下空白帧
    s.narration.forEach((line, li) => {
      if (typeof line !== "string" || !line.trim())
        throw new Error(`${tag}.narration[${li}] 必须是非空字符串`);
    });
    if (!s.sceneState || typeof s.sceneState !== "object" || Array.isArray(s.sceneState))
      throw new Error(`${tag}.sceneState 必须是对象`);
    // numbers 全程可选：仅在存在时校验数值与自洽性（是否画图由 chartConfigs 决定，两者互不影响）
    const n = s.numbers;
    if (!n) return;
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

  // 若提供 formulas，进行基础校验（通用能力，schema 见 ADR-0003）
  if (c.formulas) {
    if (!Array.isArray(c.formulas)) throw new Error("formulas 必须是数组");
    c.formulas.forEach((f, fi) => {
      if (!f || typeof f !== "object" || typeof f.name !== "string" || !f.name)
        throw new Error(`formulas[${fi}] 缺少 name`);
      if (typeof f.expr !== "string" || !f.expr)
        throw new Error(`formulas[${fi}] 缺少 expr`);
    });
  }

  // 若提供 chartConfigs，进行基础一致性校验
  if (c.chartConfigs) {
    if (!Array.isArray(c.chartConfigs)) throw new Error("chartConfigs 必须是数组");
    c.chartConfigs.forEach((config, ci) => {
      if (!config.title || typeof config.title !== "string")
        throw new Error(`chartConfigs[${ci}] 缺少 title`);
      // 空 series = 空图（无任何提示）；label 图内须唯一（同名两线图例无法区分）
      if (!Array.isArray(config.series) || config.series.length === 0)
        throw new Error(`chartConfigs[${ci}].series 必须是非空数组`);
      // tickStep 须为正整数：0/负数/NaN 会让刻度循环异常（NaN 时只剩 0 刻度）
      if (config.tickStep !== undefined && (!Number.isInteger(config.tickStep) || config.tickStep <= 0))
        throw new Error(`chartConfigs[${ci}].tickStep 必须是正整数`);
      const seenLabels = new Set<string>();
      config.series.forEach((series, si) => {
        if (!series.label || typeof series.label !== "string")
          throw new Error(`chartConfigs[${ci}].series[${si}] 缺少 label`);
        if (seenLabels.has(series.label))
          throw new Error(`chartConfigs[${ci}] label 重复：${series.label}`);
        seenLabels.add(series.label);
        if (!Array.isArray(series.values))
          throw new Error(`chartConfigs[${ci}].series[${si}] values 必须是数组`);
        if (series.values.length !== c.stages.length)
          throw new Error(`chartConfigs[${ci}].series[${si}] values 长度必须等于 stages 数量（${c.stages.length}）`);
        // 数值须非负：负值会被画到基线以下，纵轴语义失效
        if (series.values.some((v) => !isNonNegNum(v)))
          throw new Error(`chartConfigs[${ci}].series[${si}] values 必须是非负有限数值`);
      });
      // 渐变段索引：必须落在 stages 范围内、不重复（越界会让斜坡画到绘图区外）
      if (config.gradualSegments !== undefined) {
        if (!Array.isArray(config.gradualSegments))
          throw new Error(`chartConfigs[${ci}].gradualSegments 必须是数组`);
        const seen = new Set<number>();
        config.gradualSegments.forEach((gi) => {
          if (!Number.isInteger(gi) || gi < 0 || gi >= c.stages.length)
            throw new Error(`chartConfigs[${ci}].gradualSegments 索引 ${gi} 越界（合法范围 0..${c.stages.length - 1}）`);
          if (seen.has(gi)) throw new Error(`chartConfigs[${ci}].gradualSegments 索引 ${gi} 重复`);
          seen.add(gi);
        });
      }
    });
  }

  return c;
}
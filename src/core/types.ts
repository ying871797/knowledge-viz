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

  return c;
}

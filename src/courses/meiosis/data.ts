import type { Course, Stage } from "../../core/types";
import { buildChartConfigs } from "../../core/chartUtils";

/** 场景状态字段约定（用 type 别名以兼容 Stage 的 Record<string, unknown>） */
export type MeiosisState = {
  /** 阶段 id：场景据此查槽位表（重构后渲染的唯一阶段标识） */
  stage: string;
  cells: 1 | 2 | 4;
  replicated: boolean;
  pairing: boolean;
  crossingOver: boolean;
  equatorial: "none" | "paired" | "single";
  separating: "none" | "homolog" | "sister";
  spermShape: boolean;
  /** 卵细胞模式专用（可选，精子模式不使用）：细胞质不均等分裂——偏心/大小子细胞布局 */
  unequal?: boolean;
  /** 卵细胞模式专用：已形成的极体数量（0~3） */
  polarBodies?: number;
}

// 构造单个阶段的辅助函数：自动把阶段 id 注入 sceneState（场景查槽位表用）
const st = (
  id: string,
  title: string,
  narration: string[],
  sceneState: Omit<MeiosisState, "stage">,
  numbers: Stage["numbers"],
  callout?: string,
): Stage => ({ id, title, narration, sceneState: { ...sceneState, stage: id }, numbers, callout });

const spermStages: Stage[] = [
    st("spermatogonium", "精原细胞（间期前）",
      ["染色体数 2n（两对同源染色体）", "长染色体一对（红）、短染色体一对（蓝）"],
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
      ["一个细胞分成两个次级精母细胞", "每个细胞：染色体数减半为 n，但每条染色体仍含 2 条染色单体"],
      { cells: 2, replicated: true, pairing: false, crossingOver: true, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 2, dna: 4, chromatid: 4, dnaPerChromosome: 2 },
      "染色体数 2n→n：减半的实质是同源染色体分离"),
    st("metaphase-II", "减Ⅱ中期",
      ["染色体排列在每个细胞的赤道板上", "易错点：此时细胞中已无同源染色体"],
      { cells: 2, replicated: true, pairing: false, crossingOver: true, equatorial: "single", separating: "none", spermShape: false },
      { chromosome: 2, dna: 4, chromatid: 4, dnaPerChromosome: 2 }),
    st("anaphase-II", "减Ⅱ后期",
      ["着丝粒分裂，姐妹染色单体分开成为两条子染色体", "染色体数暂时加倍（n→2n）"],
      { cells: 2, replicated: false, pairing: false, crossingOver: true, equatorial: "none", separating: "sister", spermShape: false },
      { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 },
      "染色体数 n→2n：暂时加倍的原因是着丝粒分裂"),
    st("telophase-II", "减Ⅱ末期",
      ["共形成四个精细胞", "每个精细胞：染色体数为 n，每条染色体只含 1 个 DNA"],
      { cells: 4, replicated: false, pairing: false, crossingOver: true, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 2, dna: 2, chromatid: 0, dnaPerChromosome: 1 }),
    st("sperm", "变形（精子）",
      ["精细胞变形：头部浓缩、长出尾部", "最终染色体数为 n，DNA 数也为 n"],
      { cells: 4, replicated: false, pairing: false, crossingOver: true, equatorial: "none", separating: "none", spermShape: true },
      { chromosome: 2, dna: 2, chromatid: 0, dnaPerChromosome: 1 }),
];

export const meiosisCourse: Course = {
  meta: { id: "meiosis", title: "减数分裂", chapter: "必修二 第一章第2节", difficulty: 4 },
  stages: spermStages,
  chartConfigs: buildChartConfigs(spermStages),
};

/**
 * 卵细胞模式课程：与精子版共用同一套染色体行为模型与数目模板，
 * 差异仅在细胞质的不均等分裂（两次）与极体演化（第一极体均分 → 共 3 个极体后退化）。
 * 知识点依据：人教版必修二；减Ⅱ中期停滞、受精后完成。
 */
const ooStages: Stage[] = [
    st("oo-oogonium", "卵原细胞（间期前）",
      ["染色体数 2n（两对同源染色体）", "发生在卵巢：卵原细胞经有丝分裂增殖"],
      { cells: 1, replicated: false, pairing: false, crossingOver: false, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 }),
    st("oo-interphase", "间期（复制）→ 初级卵母细胞",
      ["染色体复制：每条染色体形成两条姐妹染色单体", "复制后的细胞称为初级卵母细胞"],
      { cells: 1, replicated: true, pairing: false, crossingOver: false, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 },
      "间期复制的实质：DNA 复制 → 每条染色体上 DNA 由 1 变 2"),
    st("oo-prophase-I", "减Ⅰ前期",
      ["同源染色体两两配对（联会），形成四分体", "四分体中的非姐妹染色单体常发生交叉互换"],
      { cells: 1, replicated: true, pairing: true, crossingOver: true, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("oo-metaphase-I", "减Ⅰ中期",
      ["同源染色体成对排列在赤道板两侧", "与精子形成完全相同的染色体行为"],
      { cells: 1, replicated: true, pairing: true, crossingOver: true, equatorial: "paired", separating: "none", spermShape: false },
      { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("oo-anaphase-I", "减Ⅰ后期（不均等分裂）",
      ["同源染色体分离，分别移向两极", "关键差异①：细胞质不均等分裂——纺锤体偏向一极"],
      { cells: 1, replicated: true, pairing: true, crossingOver: true, equatorial: "none", separating: "homolog", spermShape: false, unequal: true },
      { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("oo-telophase-I", "减Ⅰ末期",
      ["产生 1 个大的次级卵母细胞和 1 个小的第一极体", "染色体数减半为 n，但每条染色体仍含 2 条染色单体"],
      { cells: 2, replicated: true, pairing: false, crossingOver: true, equatorial: "none", separating: "none", spermShape: false, unequal: true, polarBodies: 1 },
      { chromosome: 2, dna: 4, chromatid: 4, dnaPerChromosome: 2 },
      "染色体数 2n→n：减半的实质是同源染色体分离"),
    st("oo-metaphase-II", "减Ⅱ中期（停滞待受精）",
      ["染色体排列在次级卵母细胞的赤道板上", "减Ⅱ在此中期停滞，直到受精后才继续完成"],
      { cells: 2, replicated: true, pairing: false, crossingOver: true, equatorial: "single", separating: "none", spermShape: false, unequal: true, polarBodies: 1 },
      { chromosome: 2, dna: 4, chromatid: 4, dnaPerChromosome: 2 }),
    st("oo-anaphase-II", "减Ⅱ后期（不均等分裂）",
      ["着丝点分裂，姐妹染色单体分开成为两条子染色体", "关键差异②：细胞质再次不均等分裂"],
      { cells: 2, replicated: false, pairing: false, crossingOver: true, equatorial: "none", separating: "sister", spermShape: false, unequal: true, polarBodies: 1 },
      { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 },
      "染色体数 n→2n：暂时加倍的原因是着丝粒分裂"),
    st("oo-telophase-II", "减Ⅱ末期",
      ["次级卵母细胞产生 1 个大的卵细胞和 1 个小的第二极体", "同时第一极体均等分裂为两个极体——共 3 个极体"],
      { cells: 2, replicated: false, pairing: false, crossingOver: true, equatorial: "none", separating: "none", spermShape: false, unequal: true, polarBodies: 3 },
      { chromosome: 2, dna: 2, chromatid: 0, dnaPerChromosome: 1 }),
    st("oo-egg", "成熟卵细胞",
      ["最终得到 1 个卵细胞（n），3 个极体退化消失", "对比精子形成：不变形，只产生 1 个有效配子"],
      { cells: 2, replicated: false, pairing: false, crossingOver: true, equatorial: "none", separating: "none", spermShape: false, unequal: true, polarBodies: 3 },
      { chromosome: 2, dna: 2, chromatid: 0, dnaPerChromosome: 1 }),
];

export const oogenesisCourse: Course = {
  meta: { id: "meiosis", title: "减数分裂（卵细胞形成）", chapter: "必修二 第一章第2节", difficulty: 4 },
  stages: ooStages,
  chartConfigs: buildChartConfigs(ooStages),
};

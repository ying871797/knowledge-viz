import type { Course, Stage } from "../../core/types";

/** 场景状态字段约定，见计划文档 Task 6 说明（用 type 别名以兼容 Stage 的 Record<string, unknown>） */
export type MeiosisState = {
  cells: 1 | 2 | 4;
  replicated: boolean;
  pairing: boolean;
  crossingOver: boolean;
  equatorial: "none" | "paired" | "single";
  separating: "none" | "homolog" | "sister";
  spermShape: boolean;
}

// 构造单个阶段的辅助函数，减少重复样板
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
      { cells: 2, replicated: false, pairing: false, crossingOver: false, equatorial: "none", separating: "sister", spermShape: false },
      { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 },
      "染色体数 n→2n：暂时加倍的原因是着丝粒分裂"),
    st("telophase-II", "减Ⅱ末期",
      ["共形成四个精细胞", "每个精细胞：染色体数为 n，每条染色体只含 1 个 DNA"],
      { cells: 4, replicated: false, pairing: false, crossingOver: false, equatorial: "none", separating: "none", spermShape: false },
      { chromosome: 2, dna: 2, chromatid: 0, dnaPerChromosome: 1 }),
    st("sperm", "变形（精子）",
      ["精细胞变形：头部浓缩、长出尾部", "最终染色体数为 n，DNA 数也为 n"],
      { cells: 4, replicated: false, pairing: false, crossingOver: false, equatorial: "none", separating: "none", spermShape: true },
      { chromosome: 2, dna: 2, chromatid: 0, dnaPerChromosome: 1 }),
  ],
};

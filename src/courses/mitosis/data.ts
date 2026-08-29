import type { Course, Stage, StageIdState } from "../../core/types";
import { buildChartConfigs } from "../../core/chartUtils";

/** 有丝分裂数目数据（2n=4） */
interface MitoNumbers { chromosome: number; dna: number; chromatid: number; dnaPerChromosome: number }

/** 构造阶段（sceneState 注入阶段 id 供场景查槽位表） */
const st = (id: string, title: string, narration: string[], n: MitoNumbers): Stage<StageIdState> => ({
  id,
  title,
  narration,
  sceneState: { stage: id },
  numbers: n,
});

const mitosisStages: Stage<StageIdState>[] = [
    st("interphase-before", "间期前（未复制）", [
      "体细胞中染色体数为 2n（两对同源染色体）",
      "间期开始前：每条染色体含 1 个 DNA 分子，无姐妹染色单体",
    ], { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 }),
    st("interphase", "间期（复制）", [
      "分裂间期：完成 DNA 分子的复制和有关蛋白质的合成，细胞适度生长",
      "复制结果：每条染色体含 2 条姐妹染色单体，DNA 数目加倍（4→8）",
      "此时染色体呈染色质形态，不易观察",
    ], { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("prophase", "前期", [
      "两消：核膜核仁消失，染色质螺旋缠绕成为染色体",
      "两现：染色体和纺锤体出现（植物细胞纺锤体由两极发出的纺锤丝形成；动物细胞由中心体发出星射线）",
      "染色体散乱分布——不发生联会，区别于减数分裂",
    ], { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("metaphase", "中期", [
      "染色体的着丝点排列在赤道板上",
      "染色体形态比较固定、数目比较清晰——观察染色体形态和数目的最佳时期",
    ], { chromosome: 4, dna: 8, chromatid: 8, dnaPerChromosome: 2 }),
    st("anaphase", "后期", [
      "着丝点分裂，姐妹染色单体分开成为两条染色体，在纺锤丝牵引下向细胞两极移动",
      "染色体数目加倍（4→8），每条染色体含 1 个 DNA",
      "与减数分裂的区别：有丝分裂后期着丝点即分裂（减数分裂在减Ⅱ后期才分裂）",
    ], { chromosome: 8, dna: 8, chromatid: 0, dnaPerChromosome: 1 }),
    st("telophase", "末期", [
      "两现：染色体变成染色质，纺锤丝消失，核膜核仁重现",
      "植物细胞：赤道板位置出现细胞板，逐渐扩展形成细胞壁（动物细胞：细胞膜中部内陷缢裂）",
      "有丝分裂末期：染色体数目仍为加倍态（8），DNA 为 8",
    ], { chromosome: 8, dna: 8, chromatid: 0, dnaPerChromosome: 1 }),
    st("daughter", "子细胞", [
      "一个细胞分裂为两个子细胞，染色体数目恢复 4 条（2n）",
      "有丝分裂意义：亲代染色体经复制后精确平均分配到两个子细胞，保持遗传性状的稳定性",
      "对比减数分裂：有丝分裂子细胞染色体数目不变（减数分裂减半为 n）",
    ], { chromosome: 4, dna: 4, chromatid: 0, dnaPerChromosome: 1 }),
];

export const mitosisCourse: Course<StageIdState> = {
  meta: {
    id: "mitosis",
    title: "有丝分裂",
    chapter: "必修一 第6章第1节",
    difficulty: 3,
  },
  stages: mitosisStages,
  chartConfigs: buildChartConfigs(mitosisStages),
};

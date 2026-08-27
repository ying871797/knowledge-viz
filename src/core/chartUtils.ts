/**
 * 图表配置构建工具：从 stages.numbers 动态提取 ChartConfig[]。
 * 数据源唯一（stages[i].numbers），避免 DRY 违反。
 * 适用于所有使用 StageNumbers 的分裂类课程（meiosis / mitosis）。
 */
import type { Stage, ChartConfig } from "./types";

export function buildChartConfigs(stages: Stage[]): ChartConfig[] {
  const gameteN = stages[stages.length - 1].numbers!.chromosome;
  return [
    {
      title: "细胞内数目变化",
      series: [
        { label: "DNA数", values: stages.map((s) => s.numbers!.dna), color: "#2563eb" },
        { label: "染色体数", values: stages.map((s) => s.numbers!.chromosome), color: "#dc2626" },
        { label: "染色单体数", values: stages.map((s) => s.numbers!.chromatid), color: "#b45309", dashed: true },
      ],
      tickFormat: (v) => (v > 0 && v % gameteN === 0 ? `${v / gameteN}n` : String(v)),
    },
    {
      title: "每条染色体上的 DNA 数",
      series: [
        { label: "每条染色体DNA", values: stages.map((s) => s.numbers!.dnaPerChromosome), color: "#059669" },
      ],
    },
  ];
}

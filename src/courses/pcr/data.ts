import type { Course, Stage } from "../../core/types";

/**
 * PCR 课程场景状态：最小字段驱动 scene 渲染。
 * - demoState: 演示区主样态（成对 / 变性分开 / 退火配对 / 延伸中 / 结果）
 * - poolCount: 累计产物数（每轮 extension 翻倍）
 * - targetCount: 累计目标片段数（第 3 轮首次出现）
 * - extensionProgress: 新链生长进度 0~1（仅 demoState=extend/result 生效）
 */
export type PcrState = {
  stage: string;
  demoState: "paired" | "denatured" | "anneal" | "extend" | "result";
  poolCount: number;
  targetCount: number;
  extensionProgress: number;
}

/** 11 幕 PCR 课程数据（单模式：标准 3 轮循环） */
const pcrStages: Stage<PcrState>[] = [
  {
    id: "s0-template",
    title: "双链 DNA 模板",
    chartLabel: "模板",
    narration: [
      "PCR 目标：从这段双链 DNA 中大量复制特定片段",
      "两端各设计一条引物，限定要扩增的区域",
    ],
    sceneState: { stage: "s0-template", demoState: "paired", poolCount: 1, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s1-denature-1",
    title: "第1轮·变性",
    chartLabel: "1变性",
    narration: [
      "加热至 95°C 左右，双链间氢键断裂",
      "两条母链上下位移分开，分别作为复制的模板",
    ],
    sceneState: { stage: "s1-denature-1", demoState: "denatured", poolCount: 1, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s2-anneal-1",
    title: "第1轮·退火",
    chartLabel: "1退火",
    narration: [
      "降温至 55°C 左右，两条引物分别落在两条母链 3' 端内侧互补配对",
      "引物与母链反向平行：5' 端贴母链 3' 端、3' 端朝内指向延伸方向",
    ],
    sceneState: { stage: "s2-anneal-1", demoState: "anneal", poolCount: 1, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s3-extend-1",
    title: "第1轮·延伸",
    chartLabel: "1延伸",
    narration: [
      "升温至 72°C，新链从引物 3' 端沿母链模板向母链 5' 端方向合成",
      "新链 = 橙引物段（5'）+ 蓝合成段（3'）一条带，配满模板全长",
    ],
    sceneState: { stage: "s3-extend-1", demoState: "extend", poolCount: 2, targetCount: 0, extensionProgress: 1 },
  },
  {
    id: "s4-denature-2",
    title: "第2轮·变性",
    chartLabel: "2变性",
    narration: [
      "再次加热，两对双链分别上下位移分开",
      "第 1 轮的新链同样作为下一轮模板，此时共有 4 条单链",
    ],
    sceneState: { stage: "s4-denature-2", demoState: "denatured", poolCount: 2, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s5-anneal-2",
    title: "第2轮·退火",
    chartLabel: "2退火",
    narration: [
      "4 条引物分别落在 4 条单链 3' 端下方互补配对",
      "引物数量随产物数同步增长，每条链各挂 1 支",
    ],
    sceneState: { stage: "s5-anneal-2", demoState: "anneal", poolCount: 2, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s6-extend-2",
    title: "第2轮·延伸",
    chartLabel: "2延伸",
    narration: [
      "4 条单链各合成 1 条新链，产物从 2 个增至 4 个",
      "第 2 轮首次合成出正确长度链 A″/B″；目标双链要等第 3 轮复制才出现",
    ],
    sceneState: { stage: "s6-extend-2", demoState: "extend", poolCount: 4, targetCount: 0, extensionProgress: 1 },
  },
  {
    id: "s7-denature-3",
    title: "第3轮·变性",
    chartLabel: "3变性",
    narration: [
      "第三次加热，8 条单链分离",
      "每一轮分离的单链数 = 上一轮产物数 × 2",
    ],
    sceneState: { stage: "s7-denature-3", demoState: "denatured", poolCount: 4, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s8-anneal-3",
    title: "第3轮·退火",
    chartLabel: "3退火",
    narration: [
      "8 条引物分别落在 8 条单链 3' 端下方互补配对",
      "退火阶段引物数量再次翻倍，每条链各挂 1 支",
    ],
    sceneState: { stage: "s8-anneal-3", demoState: "anneal", poolCount: 4, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s9-extend-3",
    title: "第3轮·延伸",
    chartLabel: "3延伸",
    narration: [
      "8 条单链各合成 1 条新链，产物从 4 个增至 8 个",
      "以第 2 轮的 A″/B″ 为模板复制出正确长度互补链——绿虚线框标出首次出现的 2 个目标双链",
    ],
    sceneState: { stage: "s9-extend-3", demoState: "extend", poolCount: 8, targetCount: 2, extensionProgress: 1 },
  },
  {
    id: "s10-result",
    title: "扩增产物",
    chartLabel: "产物",
    narration: [
      "3 轮扩增后，产物从 1 个增长到 8 个，其中 2 个是目标产物（绿虚线框）",
      "真实 PCR 跑 25-35 轮，目标产物按 2ⁿ−2n 指数增长",
    ],
    sceneState: { stage: "s10-result", demoState: "result", poolCount: 8, targetCount: 2, extensionProgress: 1 },
  },
];

/**
 * PCR 课程曲线三图拆分 + 公式卡（v4 决策，见 .proposals/2026-08-29-001-pcr-course.html）。
 * ① 扩增曲线：分子数 2ⁿ / 总链数 2ⁿ⁺¹；
 * ② 引物曲线：累计消耗 2ⁿ⁺¹−2（退火列跳变）/ 第 n 次所需 2ⁿ⁺¹；
 * ③ 目标产物迷你图：2ⁿ−2n（独立成图，避开与分子数序列共轴被压扁）。
 */
const chartConfigs: Course<PcrState>["chartConfigs"] = [
  {
    title: "扩增曲线",
    series: [
      { label: "分子数（2ⁿ）", values: [1, 1, 1, 2, 2, 2, 4, 4, 4, 8, 8], color: "#2563eb" },
      { label: "总链数（2ⁿ⁺¹）", values: [2, 2, 2, 4, 4, 4, 8, 8, 8, 16, 16], color: "#64748b" },
    ],
  },
  {
    title: "引物曲线",
    series: [
      { label: "累计消耗引物（2ⁿ⁺¹−2）", values: [0, 0, 2, 2, 2, 6, 6, 6, 14, 14, 14], color: "#f59e0b" },
      { label: "第 n 次所需引物（2ⁿ⁺¹）", values: [2, 2, 2, 4, 4, 4, 8, 8, 8, 16, 16], color: "#b45309", dashed: true },
    ],
  },
  {
    title: "目标产物迷你图",
    series: [
      { label: "目标产物（2ⁿ−2n）", values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2], color: "#22c55e" },
    ],
  },
];

/** 关键公式卡（通用能力 Course.formulas，schema 见 ADR-0003）：数量名 + 公式 + n=3 例值 */
const formulas: Course["formulas"] = [
  { name: "分子数", expr: "2ⁿ", example: "n=3 → 8" },
  { name: "总链数", expr: "2ⁿ⁺¹", example: "n=3 → 16" },
  { name: "累计消耗引物", expr: "2ⁿ⁺¹−2", example: "n=3 → 14" },
  { name: "第 n 次所需引物", expr: "2ⁿ⁺¹", example: "n=3 → 16" },
  { name: "目标产物", expr: "2ⁿ−2n", example: "n=3 → 2" },
];

export const pcrCourse: Course<PcrState> = {
  meta: { id: "pcr", title: "PCR——聚合酶链式反应", chapter: "选必三", difficulty: 2 },
  stages: pcrStages,
  chartConfigs,
  formulas,
};

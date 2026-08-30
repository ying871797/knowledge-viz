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
    narration: [
      "PCR 目标：从这段双链 DNA 中大量复制特定片段",
      "两端各设计一条引物，限定要扩增的区域",
    ],
    sceneState: { stage: "s0-template", demoState: "paired", poolCount: 1, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s1-denature-1",
    title: "第1轮·变性",
    narration: [
      "加热至 95°C 左右，双链间氢键断裂",
      "DNA 分离为两条单链，作为复制的模板",
    ],
    sceneState: { stage: "s1-denature-1", demoState: "denatured", poolCount: 1, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s2-anneal-1",
    title: "第1轮·退火",
    narration: [
      "降温至 55°C 左右，两条引物分别与两条单链 3' 端互补配对",
      "引物为新链合成提供起点",
    ],
    sceneState: { stage: "s2-anneal-1", demoState: "anneal", poolCount: 1, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s3-extend-1",
    title: "第1轮·延伸",
    narration: [
      "升温至 72°C，Taq 聚合酶从引物 3' 端开始沿模板合成新链",
      "新链从引物端生长，直到模板另一端",
    ],
    sceneState: { stage: "s3-extend-1", demoState: "extend", poolCount: 2, targetCount: 0, extensionProgress: 1 },
  },
  {
    id: "s4-denature-2",
    title: "第2轮·变性",
    narration: [
      "再次加热，原模板与第 1 轮产物再次分离",
      "此时共有 4 条单链可作为模板",
    ],
    sceneState: { stage: "s4-denature-2", demoState: "denatured", poolCount: 2, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s5-anneal-2",
    title: "第2轮·退火",
    narration: [
      "4 条引物分别与 4 条单链 3' 端配对",
      "引物数量随产物数同步增长",
    ],
    sceneState: { stage: "s5-anneal-2", demoState: "anneal", poolCount: 2, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s6-extend-2",
    title: "第2轮·延伸",
    narration: [
      "Taq 聚合酶合成 4 条新链",
      "产物总量翻倍为 4，但本轮新链仍只一端由引物限定",
    ],
    sceneState: { stage: "s6-extend-2", demoState: "extend", poolCount: 4, targetCount: 0, extensionProgress: 1 },
  },
  {
    id: "s7-denature-3",
    title: "第3轮·变性",
    narration: [
      "第三次加热，8 条单链分离",
      "每一轮分离的单链数 = 上一轮产物数 × 2",
    ],
    sceneState: { stage: "s7-denature-3", demoState: "denatured", poolCount: 4, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s8-anneal-3",
    title: "第3轮·退火",
    narration: [
      "8 条引物分别与 8 条单链配对",
      "退火阶段引物数量再次翻倍",
    ],
    sceneState: { stage: "s8-anneal-3", demoState: "anneal", poolCount: 4, targetCount: 0, extensionProgress: 0 },
  },
  {
    id: "s9-extend-3",
    title: "第3轮·延伸",
    narration: [
      "Taq 聚合酶合成 8 条新链",
      "本轮首次出现两端均由引物限定的目标片段（2 个）",
    ],
    sceneState: { stage: "s9-extend-3", demoState: "extend", poolCount: 8, targetCount: 2, extensionProgress: 1 },
  },
  {
    id: "s10-result",
    title: "扩增产物",
    narration: [
      "3 轮扩增后，产物从 1 个增长到 8 个，其中 2 个是目标片段",
      "真实 PCR 跑 25-35 轮，产物可达数十亿",
    ],
    sceneState: { stage: "s10-result", demoState: "result", poolCount: 8, targetCount: 2, extensionProgress: 1 },
  },
];

/** PCR 课程曲线图：4 条曲线展示产物量、消耗引物、下轮所需引物、目标片段 11 阶段数据点 */
const chartConfigs: Course<PcrState>["chartConfigs"] = [
  {
    title: "PCR 产物与引物变化",
    series: [
      { label: "产物总量", values: [1, 1, 1, 2, 2, 2, 4, 4, 4, 8, 8], color: "#2563eb" },
      { label: "消耗引物", values: [0, 0, 2, 2, 2, 4, 6, 6, 8, 14, 14], color: "#ea580c" },
      { label: "下轮所需引物", values: [2, 2, 2, 4, 4, 4, 8, 8, 8, 16, 16], color: "#7c3aed", dashed: true },
      { label: "目标片段", values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2], color: "#059669" },
    ],
  },
];

export const pcrCourse: Course<PcrState> = {
  meta: { id: "pcr", title: "PCR——聚合酶链式反应", chapter: "选必三", difficulty: 2 },
  stages: pcrStages,
  chartConfigs,
};

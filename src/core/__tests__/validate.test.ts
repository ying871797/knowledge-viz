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
    bad.stages[0].numbers!.chromosome = -1;
    expect(() => validateCourse(bad)).toThrow(/chromosome/);
  });
  it("数目自洽性校验：dna ≠ dnaPerChromosome × chromosome 抛错", () => {
    const bad = structuredClone(valid);
    bad.stages[1].numbers!.dna = 9;
    expect(() => validateCourse(bad)).toThrow(/不一致/);
  });
  it("有单体但 dnaPerChromosome≠2 抛错", () => {
    const bad = structuredClone(valid);
    bad.stages[1].numbers!.chromatid = 8;
    bad.stages[1].numbers!.dnaPerChromosome = 1;
    expect(() => validateCourse(bad)).toThrow(/单体/);
  });
  it("无染色单体时 dna ≠ chromosome 抛错（回归 T2）", () => {
    const bad = structuredClone(valid);
    bad.stages[0].numbers!.chromatid = 0;
    // 先满足通用自洽校验（2×4=8），使特定规则（无单体时 dna 应等于 chromosome）被触发
    bad.stages[0].numbers!.dnaPerChromosome = 2;
    bad.stages[0].numbers!.dna = 8; // 与 chromosome=4 不等
    expect(() => validateCourse(bad)).toThrow(/dna 应等于 chromosome/);
  });
  it("无 numbers 且无 chartConfigs 的纯动画课程通过（无数目语义课程）", () => {
    const animOnly: Course = {
      meta: { id: "animated", title: "示例", chapter: "必修二", difficulty: 2 },
      stages: [
        { id: "a", title: "甲", narration: ["一"], sceneState: {} },
        { id: "b", title: "乙", narration: ["二"], sceneState: {} },
      ],
    };
    expect(validateCourse(animOnly)).toEqual(animOnly);
  });
  it("有 chartConfigs 时可省略 numbers", () => {
    const noNum: Course = {
      meta: { id: "pcr", title: "PCR", chapter: "选必三", difficulty: 2 },
      stages: [
        { id: "s0", title: "模板", narration: ["双链"], sceneState: {} },
        { id: "s1", title: "变性", narration: ["分开"], sceneState: {} },
      ],
      chartConfigs: [
        { title: "产物", series: [{ label: "产物量", values: [1, 2], color: "#2563eb" }] },
      ],
    };
    expect(validateCourse(noNum)).toEqual(noNum);
  });
  it("chartConfigs 课程带 numbers 仍受自洽校验（减数/有丝合法数据首启门禁）", () => {
    const bad: Course = {
      meta: { id: "mitosis", title: "有丝分裂", chapter: "必修一", difficulty: 3 },
      stages: [
        {
          id: "prophase", title: "前期", narration: ["复制后"], sceneState: {},
          numbers: { chromosome: 4, dna: 8, chromatid: 0, dnaPerChromosome: 2 },
        },
      ],
      chartConfigs: [{ title: "x", series: [{ label: "dna", values: [8], color: "#000" }] }],
    };
    // 不因 chartConfigs 而短路：numbers 存在即校验（无单体时 dna 应等于 chromosome）
    expect(() => validateCourse(bad)).toThrow(/dna 应等于 chromosome/);
  });
  it("chartConfigs 缺少 title 抛错", () => {
    const bad: Course = {
      meta: { id: "pcr", title: "PCR", chapter: "选必三", difficulty: 2 },
      stages: [{ id: "s0", title: "模板", narration: ["双链"], sceneState: {} }],
      chartConfigs: [{ title: "", series: [{ label: "x", values: [1], color: "#000" }] }],
    };
    expect(() => validateCourse(bad)).toThrow(/title/);
  });
  it("chartConfigs series 长度与 stages 不一致抛错", () => {
    const bad: Course = {
      meta: { id: "pcr", title: "PCR", chapter: "选必三", difficulty: 2 },
      stages: [
        { id: "s0", title: "模板", narration: ["双链"], sceneState: {} },
        { id: "s1", title: "变性", narration: ["分开"], sceneState: {} },
      ],
      chartConfigs: [{ title: "x", series: [{ label: "产物", values: [1, 2, 4], color: "#000" }] }],
    };
    expect(() => validateCourse(bad)).toThrow(/长度/);
  });
  it("chartConfigs values 含非数值抛错", () => {
    const bad: Course = {
      meta: { id: "pcr", title: "PCR", chapter: "选必三", difficulty: 2 },
      stages: [
        { id: "s0", title: "模板", narration: ["双链"], sceneState: {} },
        { id: "s1", title: "变性", narration: ["分开"], sceneState: {} },
      ],
      chartConfigs: [{ title: "x", series: [{ label: "产物", values: [1, "x" as unknown as number], color: "#000" }] }],
    };
    expect(() => validateCourse(bad)).toThrow(/数值/);
  });
});

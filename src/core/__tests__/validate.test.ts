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
    bad.stages[0].numbers.chromosome = -1;
    expect(() => validateCourse(bad)).toThrow(/chromosome/);
  });
  it("数目自洽性校验：dna ≠ dnaPerChromosome × chromosome 抛错", () => {
    const bad = structuredClone(valid);
    bad.stages[1].numbers.dna = 9;
    expect(() => validateCourse(bad)).toThrow(/不一致/);
  });
  it("有单体但 dnaPerChromosome≠2 抛错", () => {
    const bad = structuredClone(valid);
    bad.stages[1].numbers.chromatid = 8;
    bad.stages[1].numbers.dnaPerChromosome = 1;
    expect(() => validateCourse(bad)).toThrow(/单体/);
  });
});

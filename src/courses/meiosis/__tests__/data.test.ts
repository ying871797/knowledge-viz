import { describe, it, expect } from "vitest";
import { meiosisCourse } from "../data";
import { validateCourse } from "../../../core/types";

describe("减数分裂课程数据", () => {
  it("通过结构校验（含数目自洽性）", () => {
    expect(() => validateCourse(meiosisCourse)).not.toThrow();
  });
  it("包含 10 个阶段且 id 唯一", () => {
    const ids = meiosisCourse.stages.map((s) => s.id);
    expect(ids.length).toBe(10);
    expect(new Set(ids).size).toBe(10);
  });
  it("关键数目节点正确：间期后 DNA 加倍、减Ⅰ末期减半、减Ⅱ后期暂时加倍", () => {
    const n = (i: number) => meiosisCourse.stages[i].numbers;
    expect(n(1)).toMatchObject({ dna: 8, chromatid: 8 });
    expect(n(5)).toMatchObject({ chromosome: 2 });   // 减Ⅰ末期
    expect(n(7)).toMatchObject({ chromosome: 4, chromatid: 0 }); // 减Ⅱ后期
    expect(n(9)).toMatchObject({ chromosome: 2, dna: 2 });       // 精子
  });
});

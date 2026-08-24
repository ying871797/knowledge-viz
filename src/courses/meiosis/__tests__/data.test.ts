import { describe, it, expect } from "vitest";
import { meiosisCourse, oogenesisCourse } from "../data";
import { validateCourse } from "../../../core/types";
import type { MeiosisState } from "../data";

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

describe("卵细胞模式课程数据（oogenesisCourse）", () => {
  it("通过结构校验（含数目自洽性），且与精子版共用同一套数目模板", () => {
    expect(() => validateCourse(oogenesisCourse)).not.toThrow();
    oogenesisCourse.stages.forEach((s, i) => {
      expect(s.numbers).toMatchObject(meiosisCourse.stages[i].numbers);
    });
  });
  it("包含 10 个阶段且 id 唯一", () => {
    const ids = oogenesisCourse.stages.map((s) => s.id);
    expect(ids.length).toBe(10);
    expect(new Set(ids).size).toBe(10);
  });
  it("不均等分裂与极体演化标记正确", () => {
    const st = (i: number) => oogenesisCourse.stages[i].sceneState as unknown as MeiosisState;
    // 减Ⅰ后期起携带不均等分裂标记
    expect(st(4).unequal).toBe(true);
    // 减Ⅰ末期出现第一极体；减Ⅱ中期停滞（1 个极体）；减Ⅱ末期为 2 个；成熟期共 3 个
    expect(st(5).polarBodies).toBe(1);
    expect(st(6).polarBodies).toBe(1);
    expect(st(8).polarBodies).toBe(3);
    expect(st(9).polarBodies).toBe(3);
    // 精子版状态不受影响：不含这些字段
    const sperm = meiosisCourse.stages[5].sceneState as unknown as MeiosisState;
    expect(sperm.unequal).toBeUndefined();
    expect(sperm.polarBodies).toBeUndefined();
  });
});

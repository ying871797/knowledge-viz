/**
 * PCR 课程数据测试：stage 结构、三图序列与场景状态对齐、formulas 卡内容。
 * 强制：11 幕、序列长度=幕数、消耗引物修正值、目标产物序列与 targetCount、池数与 poolCount 一致。
 */
import { describe, it, expect } from "vitest";
import { pcrCourse } from "../data";

const stages = pcrCourse.stages;

describe("PCR 课程数据", () => {
  it("11 幕结构与 id 序列齐全", () => {
    expect(stages.length).toBe(11);
    expect(stages.map((s) => s.id)).toEqual([
      "s0-template", "s1-denature-1", "s2-anneal-1", "s3-extend-1",
      "s4-denature-2", "s5-anneal-2", "s6-extend-2",
      "s7-denature-3", "s8-anneal-3", "s9-extend-3", "s10-result",
    ]);
  });

  it("chartConfigs 拆分三张图，全部序列长度 = 11", () => {
    expect(pcrCourse.chartConfigs?.length).toBe(3);
    for (const cfg of pcrCourse.chartConfigs!) {
      expect(cfg.series.length).toBeGreaterThan(0);
      for (const s of cfg.series) expect(s.values.length).toBe(11);
    }
  });

  it("扩增曲线：分子数 2ⁿ / 总链数 2ⁿ⁺¹", () => {
    const [mol, total] = pcrCourse.chartConfigs![0].series;
    expect(mol.label).toContain("分子数");
    expect(mol.label).toContain("2ⁿ");
    expect(mol.values).toEqual([1, 1, 1, 2, 2, 2, 4, 4, 4, 8, 8]);
    expect(total.label).toContain("总链数");
    expect(total.label).toContain("2ⁿ⁺¹");
    expect(total.values).toEqual([2, 2, 2, 4, 4, 4, 8, 8, 8, 16, 16]);
  });

  it("引物曲线：累计消耗在退火列跳变且值修正（2ⁿ⁺¹−2）/ 第 n 次所需（2ⁿ⁺¹）", () => {
    const [used, need] = pcrCourse.chartConfigs![1].series;
    expect(used.label).toContain("累计消耗引物");
    expect(used.label).toContain("2ⁿ⁺¹−2");
    expect(used.values).toEqual([0, 0, 2, 2, 2, 6, 6, 6, 14, 14, 14]);
    expect(need.label).toContain("第 n 次所需引物");
    expect(need.label).toContain("2ⁿ⁺¹");
    expect(need.values).toEqual([2, 2, 2, 4, 4, 4, 8, 8, 8, 16, 16]);
  });

  it("目标产物迷你图：2ⁿ−2n，仅第 3 轮延伸/结果两幕为 2", () => {
    const [target] = pcrCourse.chartConfigs![2].series;
    expect(target.values).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2]);
  });

  it("曲线序列与场景状态对齐：分子数 = poolCount，目标产物 = targetCount", () => {
    const [mol] = pcrCourse.chartConfigs![0].series;
    const [target] = pcrCourse.chartConfigs![2].series;
    stages.forEach((s, i) => {
      const st = s.sceneState as { poolCount: number; targetCount: number };
      expect(mol.values[i]).toBe(st.poolCount);
      expect(target.values[i]).toBe(st.targetCount);
    });
  });

  it("formulas 卡：5 条关键公式与例值完整", () => {
    expect(pcrCourse.formulas?.map((f) => f.name)).toEqual([
      "分子数", "总链数", "累计消耗引物", "第 n 次所需引物", "目标产物",
    ]);
    const byName = Object.fromEntries(pcrCourse.formulas!.map((f) => [f.name, f]));
    expect(byName["目标产物"].expr).toBe("2ⁿ−2n");
    expect(byName["目标产物"].example).toBe("n=3 → 2");
    expect(byName["累计消耗引物"].example).toBe("n=3 → 14");
    for (const f of pcrCourse.formulas!) {
      expect(f.expr).toContain("ⁿ");
      expect(f.example).toMatch(/^n=3 → \d+$/);
    }
  });
});
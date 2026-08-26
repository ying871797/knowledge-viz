/** DNA 分子复制课程数据测试（段 1） */
import { describe, it, expect } from "vitest";
import { dnaReplicationCourse, SEQ_TOP, SEQ_BOT } from "../data";
import { validateCourse } from "../../../core/types";

describe("DNA 复制课程数据", () => {
  it("通过结构校验（hideCharts 跳过数目校验）", () => {
    expect(() => validateCourse(dnaReplicationCourse)).not.toThrow();
  });

  it("meta：hideCharts 开启，标题/章节正确", () => {
    expect(dnaReplicationCourse.meta.hideCharts).toBe(true);
    expect(dnaReplicationCourse.meta.title).toBe("DNA 分子的复制");
    expect(dnaReplicationCourse.meta.chapter).toBe("必修二 第3章第3节");
  });

  it("9 个阶段且 id 唯一，sceneState 注入 stage", () => {
    const ids = dnaReplicationCourse.stages.map((s) => s.id);
    expect(ids).toEqual(["helix", "unwind", "priming", "leading", "lagging", "removal", "filling", "ligation", "done"]);
    expect(new Set(ids).size).toBe(9);
    for (const s of dnaReplicationCourse.stages) {
      expect(s.sceneState.stage).toBe(s.id);
    }
  });

  it("解旋/后随阶段讲解点明双向复制与两条链各含冈崎片段", () => {
    const unwind = dnaReplicationCourse.stages[1].narration.join(" ");
    expect(unwind).toContain("双向");
    const lagging = dnaReplicationCourse.stages[4].narration.join(" ");
    expect(lagging).toContain("两条子链");
    expect(lagging).toContain("冈崎片段");
  });

  it("碱基序列：12 对、互补配对、中段 A/T 富集", () => {
    expect(SEQ_TOP.length).toBe(12);
    const complement: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
    SEQ_TOP.forEach((b, i) => expect(SEQ_BOT[i]).toBe(complement[b]));
    // 中段 pos4~8（下标 3~7）为 A/T
    const mid = SEQ_TOP.slice(3, 8).join("");
    expect(mid).toMatch(/^[AT]+$/);
  });
});

/**
 * 光合作用课程数据测试（必修一 1-5.4）
 *
 * 断言职责：
 * - validateCourse 门禁（fail-fast）通过
 * - stage id 与 scene.ts 槽位表一一对应（漏声明 → 场景直接抛错）
 * - 讲解文案忠实教材：光反应/暗反应两场所、[H] 点明即 NADPH、CO₂ 固定不耗能、
 *   C₃ 还原消耗 ATP/[H]、「有光无光都能进行」、明示分子为示意计数、不写 ATP 个数
 * - 不写 numbers、不声明 chartConfigs（本课无曲线图，代价是无练习模式，已登记）
 * - 总反应式与公式卡与 docx 一致
 */
import { describe, expect, it } from "vitest";
import { validateCourse } from "../../../core/types";
import { photosynthesisCourse, PHOTOSYNTHESIS_STAGE_IDS } from "../data";

const course = photosynthesisCourse;
const allNarration = course.stages.flatMap((s) => s.narration).join("\n");
const textOf = (id: string): string => course.stages.find((s) => s.id === id)!.narration.join("");

describe("光合作用 · 课程结构", () => {
  it("课程过 validateCourse 门禁", () => {
    expect(() => validateCourse(course)).not.toThrow();
  });

  it("课程身份与章节正确（必修一 第5章第4节）", () => {
    expect(course.meta.id).toBe("photosynthesis");
    expect(course.meta.title).toBe("光合作用");
    expect(course.meta.chapter).toBe("必修一 第5章第4节");
  });

  it("9 幕，stage 顺序与导出的 id 清单一致（场景槽位表按此顺序铺排）", () => {
    expect(course.stages).toHaveLength(9);
    expect(course.stages.map((s) => s.id)).toEqual([...PHOTOSYNTHESIS_STAGE_IDS]);
    expect(new Set(course.stages.map((s) => s.id)).size).toBe(9);
  });

  it("每幕都有非空讲解文案与合法 sceneState（sceneState.stage 即幕 id）", () => {
    for (const s of course.stages) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(s.narration.length, s.id).toBeGreaterThan(0);
      expect(s.sceneState.stage, s.id).toBe(s.id);
      for (const line of s.narration) expect(line.trim().length, s.id).toBeGreaterThan(0);
    }
  });

  it("不写 numbers 字段（分子数不是 StageNumbers 的量纲）", () => {
    for (const s of course.stages) expect(s.numbers, s.id).toBeUndefined();
  });

  it("不声明 chartConfigs（本课不设曲线图 → 无练习模式，已登记为方案偏离）", () => {
    expect(course.chartConfigs).toBeUndefined();
  });
});

describe("光合作用 · 讲解文案忠实教材", () => {
  it("点明两个场所（类囊体薄膜 / 叶绿体基质）", () => {
    expect(textOf("photo-thylakoid-site")).toContain("类囊体薄膜");
    expect(textOf("photo-stroma-site")).toContain("叶绿体基质");
    expect(allNarration).toContain("叶绿体");
  });

  it("[H] 首次出现处点明即 NADPH（教材用方括号表示载体，不画自由原子）", () => {
    expect(textOf("photo-water-split")).toContain("NADPH");
    expect(allNarration).toContain("NADPH");
  });

  it("光反应条件与场所齐全（光、色素、酶 / 类囊体薄膜）", () => {
    const t = textOf("photo-thylakoid-site");
    expect(t).toContain("光");
    expect(t).toContain("色素");
    expect(t).toContain("酶");
    expect(t).toContain("类囊体薄膜");
  });

  it("暗反应讲清「有光无光都能进行」且条件是多种酶", () => {
    const t = textOf("photo-stroma-site");
    expect(t).toContain("有光无光都能进行");
    expect(t).toContain("酶");
  });

  it("CO₂ 的固定讲清不耗能，且给出 CO₂ + C₅ → 2C₃", () => {
    const t = textOf("photo-co2-fix");
    expect(t).toContain("CO₂");
    expect(t).toContain("C₅");
    expect(t).toContain("2C₃");
    expect(t).toMatch(/不消耗能量|不耗/);
  });

  it("C₃ 的还原讲清消耗 ATP 和 [H]，并给出 (CH₂O) 与 C₅ 再生", () => {
    const t = textOf("photo-c3-reduce");
    expect(t).toContain("(CH₂O)");
    expect(t).toContain("C₅");
    expect(t).toMatch(/消耗 ATP 和 \[H\]|消耗 ATP 和 NADPH/);
  });

  it("联系幕给出双向物质对应（光反应→ATP/[H]；暗反应→ADP/Pi/NADP⁺）", () => {
    const t = textOf("photo-relation");
    expect(t).toContain("ATP");
    expect(t).toContain("[H]");
    expect(t).toContain("ADP");
    expect(t).toContain("Pi");
    expect(t).toContain("NADP⁺");
  });

  it("总反应式与教材一致，且说明 (CH₂O) 表示糖类", () => {
    const t = textOf("photo-total");
    expect(t).toContain("CO₂ + H₂O");
    expect(t).toContain("(CH₂O) + O₂");
    expect(t).toMatch(/表示糖类/);
  });

  it("不写 ATP 具体个数（教材对 ATP/[H] 只给定性表述）", () => {
    expect(allNarration).not.toMatch(/\d+\s*(个|分子)?\s*ATP/);
    expect(allNarration).not.toMatch(/\d+\s*(个|分子)?\s*\[H\]/);
  });

  it("明示分子为示意计数（防误教化学计量）", () => {
    expect(allNarration).toContain("示意计数");
  });

  it("不引入课外扩展（不出现纸层析法、希尔反应等同位素示踪细节）", () => {
    expect(allNarration).not.toContain("纸层析");
    expect(allNarration).not.toContain("希尔反应");
    expect(allNarration).not.toContain("同位素示踪");
  });
});

describe("光合作用 · 关键公式卡", () => {
  it("给出总反应式、光反应、暗反应、两反应联系、场所与酶 5 张卡", () => {
    const names = course.formulas!.map((f) => f.name);
    expect(names).toEqual(["总反应式", "光反应", "暗反应", "两反应的联系", "场所与酶"]);
  });

  it("总反应式卡与 docx 一致（CO₂ + H₂O → (CH₂O) + O₂）", () => {
    const f = course.formulas!.find((x) => x.name === "总反应式")!;
    expect(f.expr).toBe("CO₂ + H₂O → (CH₂O) + O₂");
  });

  it("暗反应卡同时给出 CO₂ 固定与 C₃ 还原两步", () => {
    const f = course.formulas!.find((x) => x.name === "暗反应")!;
    expect(f.expr).toContain("CO₂ + C₅ → 2C₃");
    expect(f.expr).toContain("(CH₂O)");
  });
});

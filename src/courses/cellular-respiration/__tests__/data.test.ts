/**
 * 细胞呼吸课程数据测试（必修一 1-5.3）
 *
 * 断言职责：
 * - validateCourse 门禁（fail-fast）通过
 * - 有氧/无氧两套数据的 stage id 与 scene.ts 槽位表一一对应（漏声明 → 场景直接抛错）
 * - 讲解文案忠实教材：出现「细胞质基质 / 线粒体基质 / 线粒体内膜」三阶段场所、
 *   [H] 点明即 NADH、不写 ATP 具体个数（教材只给少量/大量）、明示分子为示意计数
 * - 曲线图：只画总反应式唯一确定计量的物质；有氧按「反应物 / 产物」正交拆成两张、
 *   无氧把酒精与 CO₂ 合并为一条；门禁含「图内无冗余序列、无绘图区平台重合」
 *   （拆图前两者同时存在，是曲线图看不清的根因）；单调整数列、值域非负、
 *   关键边界（葡萄糖第 1 阶段归零 / CO₂ 第 2 阶段出现 / O₂ 第 3 阶段归零）
 * - 未写 numbers 字段（分子数不是 StageNumbers 的量纲）
 */
import { describe, expect, it } from "vitest";
import { validateCourse } from "../../../core/types";
import { chartSeriesViolations } from "../../../test-utils/chartGuards";
import {
  cellularRespirationAerobic,
  cellularRespirationAnaerobic,
  AEROBIC_STAGE_IDS,
  ANAEROBIC_STAGE_IDS,
} from "../data";

const aerobic = cellularRespirationAerobic;
const anaerobic = cellularRespirationAnaerobic;
const allStages = [...aerobic.stages, ...anaerobic.stages];
const allNarration = allStages.flatMap((s) => s.narration).join("\n");

describe("细胞呼吸 · 课程结构", () => {
  it("两套课程都过 validateCourse 门禁", () => {
    expect(() => validateCourse(aerobic)).not.toThrow();
    expect(() => validateCourse(anaerobic)).not.toThrow();
  });

  it("两套课程共用同一个 meta.id 与章节（模式切换不换课程身份）", () => {
    expect(aerobic.meta.id).toBe(anaerobic.meta.id);
    expect(aerobic.meta.id).toBe("cellular-respiration");
    expect(aerobic.meta.chapter).toBe(anaerobic.meta.chapter);
    expect(aerobic.meta.chapter).toContain("必修一");
  });

  it("stage 顺序与导出的 id 清单一致（场景槽位表按此顺序铺排）", () => {
    expect(aerobic.stages.map((s) => s.id)).toEqual([...AEROBIC_STAGE_IDS]);
    expect(anaerobic.stages.map((s) => s.id)).toEqual([...ANAEROBIC_STAGE_IDS]);
  });

  it("有氧 9 幕、无氧 5 幕，且全部幕 id 互不重复（双模式共用同一张槽位表）", () => {
    expect(aerobic.stages).toHaveLength(9);
    expect(anaerobic.stages).toHaveLength(5);
    const ids = allStages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每幕都有非空讲解文案与合法 sceneState", () => {
    for (const s of allStages) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(s.narration.length, s.id).toBeGreaterThan(0);
      expect(s.sceneState.stage, s.id).toBe(s.id);
      for (const line of s.narration) expect(line.trim().length, s.id).toBeGreaterThan(0);
    }
  });

  it("不写 numbers 字段（分子数不是 StageNumbers 的量纲，避免误导性的自洽校验）", () => {
    for (const s of allStages) expect(s.numbers, s.id).toBeUndefined();
  });
});

describe("细胞呼吸 · 讲解文案忠实教材", () => {
  it("三个阶段的场所全部点名（细胞质基质 / 线粒体基质 / 线粒体内膜）", () => {
    const siteIds = ["stage1-site", "stage2-site", "stage3-site"];
    for (const id of siteIds) {
      const s = aerobic.stages.find((x) => x.id === id)!;
      expect(s.narration.join(""), id).toMatch(/细胞质基质|线粒体基质|线粒体内膜/);
    }
    // 「基质」与「内膜」不可混：第 2 阶段讲基质，第 3 阶段讲内膜
    expect(aerobic.stages.find((s) => s.id === "stage2-site")!.narration.join("")).toContain("线粒体基质");
    expect(aerobic.stages.find((s) => s.id === "stage3-site")!.narration.join("")).toContain("线粒体内膜");
  });

  it("[H] 首次出现处点明即 NADH（教材用方括号表示载体，不画自由原子）", () => {
    expect(allNarration).toContain("NADH");
    expect(aerobic.stages.find((s) => s.id === "stage1-yield")!.narration.join("")).toContain("NADH");
  });

  it("不写 ATP 具体个数（教材只给「少量/大量」，版本间数字有争议）", () => {
    // 阿拉伯数字与中文数字两种写法都要拦：只拦 \d 会漏掉「三十六 ATP」
    expect(allNarration).not.toMatch(/\d+\s*(个|分子)?\s*ATP/);
    expect(allNarration).not.toMatch(/[一二三四五六七八九十百千]\s*(个|分子)?\s*ATP/);
    expect(allNarration).not.toMatch(/36\s*(个|分子)?\s*ATP|38\s*ATP|2\s*ATP/);
  });

  it("明示分子为示意计数，把精确计量推给反应式与曲线图（防误教化学计量）", () => {
    expect(allNarration).toMatch(/示意计数/);
  });

  it("第 3 阶段讲清 [H] 全部与 O₂ 结合生成水并释放大量能量", () => {
    const s = aerobic.stages.find((x) => x.id === "stage3-water")!;
    const text = s.narration.join("");
    expect(text).toContain("[H]");
    expect(text).toContain("水");
    expect(text).toContain("大量");
    expect(s.callout).toBeTruthy();
  });

  it("总反应式幕点明 O₂ 来自外界、水的收支与产物氧的来源（教材三个易错点）", () => {
    const text = aerobic.stages.find((s) => s.id === "aerobic-total")!.narration.join("");
    expect(text).toContain("来自外界");
    expect(text).toContain("净");
    expect(text).toContain("产物中的氧");
  });

  it("无氧模式讲清「全程在细胞质基质、不消耗 [H]」两个高频错点", () => {
    expect(anaerobic.stages.find((s) => s.id === "anaerobic-site")!.narration.join("")).toContain("细胞质基质");
    const prod = anaerobic.stages.find((s) => s.id === "anaerobic-products")!;
    expect(prod.narration.join("")).toMatch(/\[H\]/);
    expect(prod.narration.join("")).toMatch(/不去|没有发生|不用|不把/);
  });

  it("无氧模式同时给出酒精与乳酸两条路线，且不把 CO₂ 误挂到乳酸发酵上", () => {
    expect(allNarration).toContain("乳酸");
    expect(allNarration).toContain("酒精");
    expect(anaerobic.stages.find((s) => s.id === "anaerobic-condition")!.narration.join("")).toContain("不产生 CO₂");
  });

  it("无氧模式明说能量大部分仍储存在产物中（教材表述，避免「能量消失」误解）", () => {
    expect(anaerobic.stages.find((s) => s.id === "anaerobic-yield")!.narration.join("")).toMatch(/储存|仍/);
  });
});

describe("细胞呼吸 · 曲线图数据", () => {
  const cfgOf = (c: typeof aerobic) => c.chartConfigs!;
  /** 展平全部图表的序列：拆图后序列不再全在第 0 张图里 */
  const seriesOf = (c: typeof aerobic) =>
    Object.fromEntries(cfgOf(c).flatMap((cfg) => cfg.series.map((s) => [s.label, s.values])));
  /** 展平全部图表的序列标签（即页面上的图例项） */
  const allLabels = (c: typeof aerobic) => cfgOf(c).flatMap((cfg) => cfg.series.map((s) => s.label));

  it("有氧 2 张图（反应物 / 产物）、无氧 1 张图，series 长度等于 stages 数（长度已由 validateCourse 覆盖，这里补语义）", () => {
    for (const [name, c, expected] of [["有氧", aerobic, 2], ["无氧", anaerobic, 1]] as const) {
      const cfgs = cfgOf(c);
      expect(cfgs.length, name).toBe(expected);
      cfgs.forEach((cfg) => {
        for (const s of cfg.series) {
          expect(s.values.length, `${name}/${s.label}`).toBe(c.stages.length);
          expect(s.label.length).toBeGreaterThan(0);
        }
      });
    }
  });

  it("有氧按「反应物 / 产物」正交切成两张，图内各 2 条且不混向", () => {
    expect(cfgOf(aerobic).map((c) => c.title)).toEqual([
      "反应物的存留（1 分子葡萄糖为基准）",
      "产物的累计（1 分子葡萄糖为基准）",
    ]);
    expect(cfgOf(aerobic)[0].series.map((s) => s.label)).toEqual(["剩余葡萄糖", "剩余 O₂"]);
    expect(cfgOf(aerobic)[1].series.map((s) => s.label)).toEqual(["累计产出 CO₂", "净增 H₂O"]);
  });

  it("全部序列非负、且不声明 gradualSegments（存量/累计量是阶跃，斜坡即误导）", () => {
    for (const c of [aerobic, anaerobic]) {
      for (const cfg of cfgOf(c)) {
        expect(cfg.gradualSegments, cfg.title).toBeUndefined();
        for (const s of cfg.series) {
          for (const v of s.values) expect(v, `${cfg.title}/${s.label}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("有氧图只画总反应式唯一确定计量的物质（不画 [H] / ATP 的数量曲线）", () => {
    const labels = allLabels(aerobic);
    expect(labels).toEqual(["剩余葡萄糖", "剩余 O₂", "累计产出 CO₂", "净增 H₂O"]);
    expect(labels.join()).not.toMatch(/\[H\]|NADH|ATP/);
  });

  it("无氧图不画 ATP（同样只画教材唯一确定的计量）", () => {
    expect(allLabels(anaerobic).join()).not.toMatch(/ATP/);
  });

  /**
   * 防回归门禁（跨课程共享，实现见 test-utils/chartGuards.ts）：
   * 图内不允许出现「冗余序列」或「同 (颜色, 线型) 的平台重合」。
   * 原口径只看线型、不看颜色（会把异色重合误判为违规），P4 通用化时升级为双通道。
   * 拆分前两者同时存在——有氧图 O₂/CO₂ 在第 6~7 幕同为 6、CO₂/H₂O 在第 8~9 幕同为 6；
   * 无氧图酒精与 CO₂ 同值同色整张图 100% 重叠。颜色或线型任一不同即视为可辨；
   * y=0 处两线贴在轴上，豁免。本课唯一保留的重合是图② CO₂/H₂O（配平事实，靠 dashed 区分）。
   */
  it("图内无冗余序列、无可辨性平台重合（跨课程共享门禁）", () => {
    const bad = [aerobic, anaerobic].flatMap((c) =>
      cfgOf(c).flatMap((cfg) => chartSeriesViolations(cfg, c.stages.length)),
    );
    expect(bad).toEqual([]);
  });

  it("图②里 CO₂ 与 H₂O 的配平重合必须由虚线兜底（防止后人把 dashed 删掉后两条线重新盖死）", () => {
    const [, products] = cfgOf(aerobic);
    const co2 = products.series.find((s) => s.label === "累计产出 CO₂")!;
    const h2o = products.series.find((s) => s.label === "净增 H₂O")!;
    // 末两幕两者同为 6 —— 这是总反应式 6CO₂ : 6H₂O 的配平状态，故意保留
    expect(co2.values.slice(-2)).toEqual([6, 6]);
    expect(h2o.values.slice(-2)).toEqual([6, 6]);
    // 既然重合，就必须在图形与图例上可区分：恰好一条虚线
    expect([co2.dashed, h2o.dashed].filter(Boolean).length).toBe(1);
  });

  it("同一张图内各序列的（颜色, 线型）组合两两不同（同色实线 = 两条线读不出谁是谁）", () => {
    // 颜色是与线型并列的区分通道；同图两条同色实线时 NumberChart 无法自动防重叠。
    // numberChart.ts 的兜底调色板（未声明 color 时按序列下标取模）。
    const FALLBACK = ["#2563eb", "#dc2626", "#b45309"];
    const violations: string[] = [];
    for (const [name, c] of [["有氧", aerobic], ["无氧", anaerobic]] as const) {
      for (const cfg of cfgOf(c)) {
        const seen = new Map<string, string>();
        cfg.series.forEach((s, i) => {
          const color = (s.color ?? FALLBACK[i % FALLBACK.length]).toLowerCase();
          const key = `${color}|${s.dashed ? "dashed" : "solid"}`;
          const prev = seen.get(key);
          if (prev) violations.push(`${name}/${cfg.title}：「${prev}」与「${s.label}」同为 ${key}`);
          else seen.set(key, s.label);
        });
      }
    }
    expect(violations).toEqual([]);
  });

  it("有氧图：葡萄糖在第 1 阶段末归零、CO₂ 在第 2 阶段末出现、O₂ 在第 3 阶段末归零", () => {
    const series = seriesOf(aerobic);
    // 幕序：0 总览 1 ①场所 2 ①分解 3 ①产物 4 ②场所 5 ②脱羧 6 ③场所 7 ③生成水 8 总反应式
    expect(series["剩余葡萄糖"]).toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(series["累计产出 CO₂"]).toEqual([0, 0, 0, 0, 0, 6, 6, 6, 6]);
    expect(series["剩余 O₂"]).toEqual([6, 6, 6, 6, 6, 6, 6, 0, 0]);
    // 水的净增量 = 总反应式「生成 12 − 消耗 6」= 6，只在第 3 阶段出现
    expect(series["净增 H₂O"]).toEqual([0, 0, 0, 0, 0, 0, 0, 6, 6]);
  });

  it("无氧图：葡萄糖在第 1 幕归零；酒精与 CO₂ 合并为一条、1:1 同步产出各 2（1 葡萄糖 → 2 丙酮酸 → 2+2）", () => {
    const labels = allLabels(anaerobic);
    const series = seriesOf(anaerobic);
    expect(labels).toEqual(["剩余葡萄糖", "产物：酒精 + CO₂（各 2 分子）"]);
    // 合并不能把「无氧也放 CO₂」这个高频错点从图上弄丢
    expect(labels.join()).toMatch(/酒精/);
    expect(labels.join()).toMatch(/CO₂/);
    expect(series["剩余葡萄糖"]).toEqual([1, 0, 0, 0, 0]);
    expect(series["产物：酒精 + CO₂（各 2 分子）"]).toEqual([0, 0, 0, 2, 2]);
  });
});

describe("细胞呼吸 · 关键公式卡", () => {
  it("有氧模式给总反应式、三阶段场所、水的收支、能量分配", () => {
    const names = aerobic.formulas!.map((f) => f.name);
    expect(names).toContain("有氧总反应式");
    expect(names).toContain("三阶段场所");
    expect(names).toContain("水的收支");
    expect(names).toContain("能量分配");
    const eq = aerobic.formulas!.find((f) => f.name === "有氧总反应式")!;
    expect(eq.expr).toContain("6CO₂");
    expect(eq.expr).toContain("12H₂O");
  });

  it("无氧模式给酒精与乳酸两条总式，并声明场所只在细胞质基质", () => {
    const exprs = anaerobic.formulas!.map((f) => f.expr).join(" | ");
    expect(exprs).toContain("2C₂H₅OH");
    expect(exprs).toContain("2C₃H₆O₃");
    expect(anaerobic.formulas!.some((f) => f.expr.includes("细胞质基质"))).toBe(true);
  });
});
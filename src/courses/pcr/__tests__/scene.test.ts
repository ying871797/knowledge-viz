/**
 * PCR 场景测试（v6.1 切换安静版，方案 .proposals/2026-09-26-003-pcr-v6-animation-quiet.html 已批准）。
 *
 * 布局模型 = 单容器恒定基座 + 元素级垂直微排（数值 = pcr_v6_demo.html 逐字段搬运）。
 * 测试职责分工：几何/数量/颜色/「切换安静三阈值」由断言强制；直观性/语义类（微排观感、无瞬切）以用户目检为准。
 * 本文件不测：addEvent 无关样式细节（颜色仅测 fill/stroke）、Taq（已彻底移除，另有专项用例）。
 */
import { describe, expect, it } from "vitest";
import { createPcrScene } from "../scene";
import { pcrCourse } from "../data";

const GRAY = "#64748b";
const BLUE = "#2563eb";
const ORANGE = "#f59e0b";
const GREEN = "#22c55e";

type G = SVGGElement;
type R = SVGRectElement;
type T = SVGTextElement;

const STAGES = pcrCourse.stages;
const stageOf = (id: string) => STAGES.find((s) => s.id === id)!;
const stageIdx = (id: string) => STAGES.findIndex((s) => s.id === id);

/** units 顺序 = scene.ts unitSpecs 顺序 + 各单元引物/成链激活幕（cap 显示的 stage index） */
const UNIT_KEYS = ["newA", "newB", "r2-0", "r2-1", "r2-2", "r2-3", "r3-0", "r3-1", "r3-2", "r3-3", "r3-4", "r3-5", "r3-6", "r3-7"];
const UNIT_ANN: Record<string, number> = {
  newA: 2, newB: 2, "r2-0": 5, "r2-1": 5, "r2-2": 5, "r2-3": 5,
  "r3-0": 8, "r3-1": 8, "r3-2": 8, "r3-3": 8, "r3-4": 8, "r3-5": 8, "r3-6": 8, "r3-7": 8,
};

/** 挂载某 stage 并渲染，返回句柄（含元素定位 helper） */
function mountAt(id: string, p?: number) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const scene = createPcrScene();
  scene.mount(container);
  const svg = container.querySelector("svg")!;
  const stage = stageOf(id);
  scene.render({ ...stage.sceneState, extensionProgress: p ?? Number(stage.sceneState.extensionProgress) });
  return {
    scene, container, svg,
    chain: (key: string) => svg.querySelector<G>(`.pcr-chain-${key}`)!,
    unit: (key: string) => svg.querySelector<G>(`.pcr-unit-${key}`)!,
    dirs: [...svg.querySelectorAll<T>(".pcr-dir")],
    p5s: [...svg.querySelectorAll<T>(".pcr-p5")],
    temps: [...svg.querySelectorAll<G>(".temp-tab")],
    targets: [...svg.querySelectorAll<G>(".pcr-target")],
    clearBadge: container.querySelector<HTMLElement>(".pcr-clear-badge"),
    state: stage.sceneState,
  };
}

/** 以给定 extensionProgress 重渲染（锚点生长中间帧） */
function renderAt(m: ReturnType<typeof mountAt>, p: number): void {
  m.scene.render({ ...m.state, extensionProgress: p });
}

const elY = (e: Element | null): number => {
  if (!e) return 0;
  const mm = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec((e as unknown as ElementCSSInlineStyle).style.transform);
  return mm ? Number(mm[1]) : 0;
};
const on = (e: Element | null): boolean => !!e && (e as unknown as ElementCSSInlineStyle).style.opacity === "1";
const num = (e: Element | null, k: string): number => (e ? Number(e.getAttribute(k)) : -1);

/** 某链容器（chain 或 unit g）内两枚方向标注 → [{text,x}] 按 x 排序 */
function dirPairs(g: G): Array<{ t: string; x: number }> {
  return [...g.querySelectorAll<T>(".pcr-dir")].map((d) => ({ t: d.textContent ?? "", x: num(d, "x") })).sort((a, b) => a.x - b.x);
}

/** 该幕 on 的链层（chainA/B 恒 on + 激活单元）y 快照 */
function activeLayers(id: string): Record<string, number> {
  const m = mountAt(id);
  const out: Record<string, number> = { chainA: elY(m.chain("A")), chainB: elY(m.chain("B")) };
  const idx = stageIdx(id);
  for (const k of UNIT_KEYS) {
    if (idx >= UNIT_ANN[k]) out[k] = elY(m.unit(k));
  }
  return out;
}

/** 相邻两幕同层位移值列表（仅含两幕都 on 的层） */
function layerDeltas(a: string, b: string): number[] {
  const ya = activeLayers(a);
  const yb = activeLayers(b);
  const out: number[] = [];
  for (const k of Object.keys(ya)) {
    if (k in yb) out.push(Math.abs(yb[k] - ya[k]));
  }
  return out;
}

/** 可见链带数：母链 band + 成链单元（cap 与 band 都 on）的 band */
function bandCount(id: string): number {
  const m = mountAt(id);
  const idx = stageIdx(id);
  let n = 0;
  for (const k of ["A", "B"]) if (on(m.chain(k).querySelector(".pcr-band"))) n++;
  for (const k of UNIT_KEYS) {
    if (idx < UNIT_ANN[k]) continue;
    const u = m.unit(k);
    if (on(u.querySelector(".pcr-cap")) && on(u.querySelector(".pcr-new"))) n++;
  }
  return n;
}

describe("PCR 场景（v6.1 切换安静：单容器微排）", () => {
  it("元素池零增删：s0 与 s10 两次渲染后 SVG 元素总数不变且 > 90", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const scene = createPcrScene();
    scene.mount(container);
    scene.render(stageOf("s0-template").sceneState);
    const count0 = container.querySelectorAll("svg *").length;
    scene.render(stageOf("s10-result").sceneState);
    const count10 = container.querySelectorAll("svg *").length;
    expect(count10).toBe(count0);
    expect(count0).toBeGreaterThan(90);
  });

  it("可见链带数逐幕：2→2→2→4→4→4→8→8→8→16→16（分子数 1→2→4→8 如实翻倍，不拆行）", () => {
    const expects: Array<[string, number]> = [
      ["s0-template", 2], ["s1-denature-1", 2], ["s2-anneal-1", 2], ["s3-extend-1", 4],
      ["s4-denature-2", 4], ["s5-anneal-2", 4], ["s6-extend-2", 8],
      ["s7-denature-3", 8], ["s8-anneal-3", 8], ["s9-extend-3", 16], ["s10-result", 16],
    ];
    for (const [id, want] of expects) expect(bandCount(id), id).toBe(want);
  });

  it("合成单元随幕激活：橙段 cap 计数 0→0→2→2→2→6→6→6→14→14→14；s5 时 r2 引物与第 1 轮链并存", () => {
    const capOn = (id: string) => {
      const m = mountAt(id);
      return UNIT_KEYS.filter((k) => on(m.unit(k).querySelector(".pcr-cap"))).length;
    };
    const expects: Array<[string, number]> = [
      ["s0-template", 0], ["s1-denature-1", 0], ["s2-anneal-1", 2], ["s3-extend-1", 2],
      ["s4-denature-2", 2], ["s5-anneal-2", 6], ["s6-extend-2", 6],
      ["s7-denature-3", 6], ["s8-anneal-3", 14], ["s9-extend-3", 14], ["s10-result", 14],
    ];
    for (const [id, want] of expects) expect(capOn(id), id).toBe(want);
    // s5：newA/newB 已成链（band on），r2 四组只有引物（band off）——新旧并存
    const m5 = mountAt("s5-anneal-2");
    expect(on(m5.unit("newA").querySelector(".pcr-new"))).toBe(true);
    expect(on(m5.unit("r2-0").querySelector(".pcr-cap"))).toBe(true);
    expect(on(m5.unit("r2-0").querySelector(".pcr-new"))).toBe(false);
  });

  it("第 3 轮 8 条模板 30px 均匀步进：r3-0..r3-7 层位 −78..+132 等差 30，不咬合", () => {
    const m = mountAt("s9-extend-3");
    const ys = UNIT_KEYS.slice(6).map((k) => elY(m.unit(k)));
    expect(ys).toEqual([-78, -48, -18, 12, 42, 72, 102, 132]);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1], `r3 slot ${i - 1}->${i}`).toBe(30);
      // 相邻层链带（±7px）净距 = 30 − 14 = 16 ≥ 0 不咬合
      expect(ys[i] - ys[i - 1] - 14).toBeGreaterThanOrEqual(0);
    }
  });

  it("延伸/结果幕 0 位移（切换安静阈值 1）：s2==s3、s5==s6、s8==s9、s9==s10 全层静止", () => {
    for (const [a, b] of [["s2-anneal-1", "s3-extend-1"], ["s5-anneal-2", "s6-extend-2"], ["s8-anneal-3", "s9-extend-3"], ["s9-extend-3", "s10-result"]] as const) {
      const ds = layerDeltas(a, b);
      expect(ds.length, `${a}->${b} 比较层数`).toBeGreaterThan(0);
      expect(ds.every((d) => d === 0), `${a}->${b} 应零位移`).toBe(true);
    }
  });

  it("变性幕位移 ≤14px（切换安静阈值 2）：s3→s4、s6→s7 每层微移不超 14", () => {
    for (const [a, b] of [["s3-extend-1", "s4-denature-2"], ["s6-extend-2", "s7-denature-3"]] as const) {
      const ds = layerDeltas(a, b);
      expect(Math.max(...ds), `${a}->${b} 最大位移`).toBeLessThanOrEqual(14);
    }
  });

  it("新轮微排 ≤28px（切换安静阈值 3）：s4→s5 引物贴附、s7→s8 新一轮插位不超 28", () => {
    for (const [a, b] of [["s4-denature-2", "s5-anneal-2"], ["s7-denature-3", "s8-anneal-3"]] as const) {
      const ds = layerDeltas(a, b);
      expect(ds.length, `${a}->${b} 至少比较 chain+第1轮层`).toBeGreaterThanOrEqual(4);
      expect(Math.max(...ds), `${a}->${b} 最大微排`).toBeLessThanOrEqual(28);
    }
  });

  it("变性层位表锚定（demo 数值）：s4 与 s7 各层 y 精确", () => {
    const m4 = mountAt("s4-denature-2");
    expect(elY(m4.chain("A"))).toBe(-58);
    expect(elY(m4.chain("B"))).toBe(34);
    expect(elY(m4.unit("newA"))).toBe(-18);   // A′ 下移贴 A 下方（变性分离）
    expect(elY(m4.unit("newB"))).toBe(68);    // B′ 下移贴 B 下方
    const m7 = mountAt("s7-denature-3");
    expect(elY(m7.chain("A"))).toBe(-92);
    expect(elY(m7.chain("B"))).toBe(34);
    expect(elY(m7.unit("newA"))).toBe(-20);
    expect(elY(m7.unit("newB"))).toBe(88);
    expect(elY(m7.unit("r2-0"))).toBe(-62);
    expect(elY(m7.unit("r2-1"))).toBe(10);
    expect(elY(m7.unit("r2-2"))).toBe(64);
    expect(elY(m7.unit("r2-3"))).toBe(118);
  });

  it("温度牌三枚常驻；s1 高亮 95、s5 高亮 55、s3 高亮 72、s10 全灭", () => {
    const tempBy = (id: string) => {
      const { temps } = mountAt(id);
      return Object.fromEntries(temps.map((t) => [t.getAttribute("data-temp"), on(t)]));
    };
    expect(tempBy("s0-template")).toEqual({ "95": false, "55": false, "72": false });
    expect(tempBy("s1-denature-1")).toEqual({ "95": true, "55": false, "72": false });
    expect(tempBy("s5-anneal-2")).toEqual({ "95": false, "55": true, "72": false });
    expect(tempBy("s3-extend-1")).toEqual({ "95": false, "55": false, "72": true });
    expect(tempBy("s10-result")).toEqual({ "95": false, "55": false, "72": false });
  });

  it("双灰母链全程常驻：s1 仅 A/B 灰链 ±44 分离，无引物、无合成段", () => {
    const m = mountAt("s1-denature-1");
    const aBand = m.chain("A").querySelector<R>(".pcr-band")!;
    const bBand = m.chain("B").querySelector<R>(".pcr-band")!;
    expect(aBand.getAttribute("fill")).toBe(GRAY);
    expect(bBand.getAttribute("fill")).toBe(GRAY);
    expect(num(aBand, "x")).toBe(224);
    expect(num(aBand, "width")).toBe(392);
    expect(elY(m.chain("A"))).toBe(-44);
    expect(elY(m.chain("B"))).toBe(44);
    expect(UNIT_KEYS.every((k) => !on(m.unit(k).querySelector(".pcr-cap")))).toBe(true);
    expect(UNIT_KEYS.every((k) => !on(m.unit(k).querySelector(".pcr-new")))).toBe(true);
  });

  it("s2 退火引物反平行：newA 橙 568..592@y−30、newB 橙 248..272@y+58；蓝段未生、p5 两枚；5′ 端贴模板 3′ 端内侧 24px", () => {
    const m = mountAt("s2-anneal-1");
    const aCap = m.unit("newA").querySelector<R>(".pcr-cap")!;
    const bCap = m.unit("newB").querySelector<R>(".pcr-cap")!;
    expect(on(aCap)).toBe(true);
    expect(num(aCap, "x")).toBe(568);
    expect(num(aCap, "width")).toBe(24);
    expect(elY(m.unit("newA"))).toBe(-30);
    expect(on(bCap)).toBe(true);
    expect(num(bCap, "x")).toBe(248);
    expect(elY(m.unit("newB"))).toBe(58);
    // 蓝段（合成段）未开始：宽 0 且隐藏
    expect(on(m.unit("newA").querySelector(".pcr-new"))).toBe(false);
    expect(on(m.unit("newB").querySelector(".pcr-new"))).toBe(false);
    // 反平行 24px：A 3′ 端 616 → R 引物 5′ 端 592；B 3′ 端 224 → L 引物 5′ 端 248
    expect(num(aCap, "x") + num(aCap, "width")).toBe(616 - 24);
    expect(num(bCap, "x")).toBe(224 + 24);
    // 退火引物 5′ 标注：2 枚（贴各引物 5′ 端 4px）
    const p5x = m.p5s.filter((t) => on(t)).map((t) => num(t, "x")).sort((a, b) => a - b);
    expect(p5x.length).toBe(2);
    expect(p5x).toEqual([252, 588]); // L 引物 5′ 端 248+4 / R 引物 5′ 端 592−4
  });

  it("s3 延伸完成：A′ 蓝 224..568、B′ 蓝 272..616（配满全长）；p5 熄灭、方向标注随链亮起", () => {
    const m = mountAt("s3-extend-1");
    const aBand = m.unit("newA").querySelector<R>(".pcr-new")!;
    const bBand = m.unit("newB").querySelector<R>(".pcr-new")!;
    expect(on(aBand)).toBe(true);
    expect(num(aBand, "x")).toBe(224);
    expect(num(aBand, "width")).toBe(344);
    expect(on(bBand)).toBe(true);
    expect(num(bBand, "x")).toBe(272);
    expect(num(bBand, "width")).toBe(344);
    expect(m.p5s.filter((t) => on(t)).length).toBe(0); // 成链后 5′ 由 dirs 承担
    expect(m.dirs.filter((t) => on(t)).length).toBe(4 + 4); // A/B + A′/B′
  });

  it("蓝段锚点生长：锚=引物 3′ 端（R 568 左伸、L 272 右伸），p=0/0.5/1 钉住锚点配满全长", () => {
    const m = mountAt("s3-extend-1");
    const aBand = m.unit("newA").querySelector<R>(".pcr-new")!;
    const bBand = m.unit("newB").querySelector<R>(".pcr-new")!;
    renderAt(m, 0.5);
    expect(num(aBand, "x")).toBe(568 - Math.round(344 * 0.5)); // 锚 568 左伸
    expect(num(bBand, "x")).toBe(272);                          // 锚 272 右伸
    expect(num(aBand, "width")).toBe(Math.round(344 * 0.5));
    expect(num(bBand, "width")).toBe(Math.round(344 * 0.5));
    renderAt(m, 0);
    expect(num(aBand, "x")).toBe(568); // 零长仍钉锚点（引物 3′ 端）
    expect(num(bBand, "x")).toBe(272);
    expect(num(aBand, "width")).toBe(0);
    expect(num(bBand, "width")).toBe(0);
    renderAt(m, 1);
    expect(num(aBand, "x")).toBe(224);
    expect(num(bBand, "x")).toBe(272);
    expect(num(aBand, "width")).toBe(344);
    expect(num(bBand, "width")).toBe(344);
  });

  it("第 2 轮链组成（s6）：A² 蓝 224..568/橙 568、A″ 橙 248+蓝 272..592、B² 蓝 272..616、B″ 橙 568+蓝 248..568", () => {
    const m = mountAt("s6-extend-2");
    const specOf = (k: string) => {
      const u = m.unit(k);
      return { capX: num(u.querySelector(".pcr-cap"), "x"), bx: num(u.querySelector(".pcr-new"), "x"), bw: num(u.querySelector(".pcr-new"), "width") };
    };
    expect(specOf("r2-0")).toEqual({ capX: 568, bx: 224, bw: 344 }); // A²（模板 A）
    expect(specOf("r2-1")).toEqual({ capX: 248, bx: 272, bw: 320 }); // A″（模板 A′，正确长度）
    expect(specOf("r2-2")).toEqual({ capX: 248, bx: 272, bw: 344 }); // B²（模板 B）
    expect(specOf("r2-3")).toEqual({ capX: 568, bx: 248, bw: 320 }); // B″（模板 B′，正确长度）
  });

  it("第 3 轮链组成（s9）：8 条新链蓝段与头橙段成带，两端到模板 5′ 端", () => {
    const m = mountAt("s9-extend-3");
    const exp: Array<{ capX: number; bx: number; bw: number }> = [
      { capX: 568, bx: 224, bw: 344 }, // r3-0：模板 A
      { capX: 248, bx: 272, bw: 320 }, // r3-1：模板 A²（≡A′）
      { capX: 248, bx: 272, bw: 320 }, // r3-2：模板 A′
      { capX: 568, bx: 248, bw: 320 }, // r3-3：模板 A″
      { capX: 248, bx: 272, bw: 344 }, // r3-4：模板 B
      { capX: 568, bx: 248, bw: 320 }, // r3-5：模板 B²（≡B′）
      { capX: 568, bx: 248, bw: 320 }, // r3-6：模板 B′
      { capX: 248, bx: 272, bw: 320 }, // r3-7：模板 B″
    ];
    UNIT_KEYS.slice(6).forEach((k, i) => {
      const u = m.unit(k);
      const got = { capX: num(u.querySelector(".pcr-cap"), "x"), bx: num(u.querySelector(".pcr-new"), "x"), bw: num(u.querySelector(".pcr-new"), "width") };
      expect(got, k).toEqual(exp[i]);
    });
  });

  it("5′/3′ 标注全程不省略：s0 4 枚可见且反平行（A 5′左/3′右、B 3′左/5′右）；s10 全 32 枚可见", () => {
    const m0 = mountAt("s0-template");
    expect(m0.dirs.filter((t) => on(t)).length).toBe(4);
    expect(dirPairs(m0.chain("A"))).toEqual([{ t: "5′", x: 235 }, { t: "3′", x: 605 }]);
    expect(dirPairs(m0.chain("B"))).toEqual([{ t: "3′", x: 235 }, { t: "5′", x: 605 }]);
    const m10 = mountAt("s10-result");
    expect(m10.dirs.filter((t) => on(t)).length).toBe(32);
  });

  it("标注随链真实朝向（v6 核心）：母链五三端 + 各合成链反平行（5′ = 引物 5′ 端、3′ = 模板 5′ 端同侧），x 贴链端 11px", () => {
    const pairs = (id: string, sel: string) => dirPairs(mountAt(id).svg.querySelector<G>(sel)!);
    // 母链：A 5′ 224 / 3′ 616；B 3′ 224 / 5′ 616
    expect(pairs("s4-denature-2", ".pcr-chain-A")).toEqual([{ t: "5′", x: 235 }, { t: "3′", x: 605 }]);
    expect(pairs("s4-denature-2", ".pcr-chain-B")).toEqual([{ t: "3′", x: 235 }, { t: "5′", x: 605 }]);
    // A′：5′ 592（引物 R 5′ 端）/ 3′ 224（模板 A 5′ 端）；B′：5′ 248 / 3′ 616
    expect(pairs("s4-denature-2", ".pcr-unit-newA")).toEqual([{ t: "3′", x: 235 }, { t: "5′", x: 581 }]);
    expect(pairs("s4-denature-2", ".pcr-unit-newB")).toEqual([{ t: "5′", x: 259 }, { t: "3′", x: 605 }]);
    // A″：5′ 248 / 3′ 592；B″：3′ 248 / 5′ 592
    expect(pairs("s7-denature-3", ".pcr-unit-r2-1")).toEqual([{ t: "5′", x: 259 }, { t: "3′", x: 581 }]);
    expect(pairs("s7-denature-3", ".pcr-unit-r2-3")).toEqual([{ t: "3′", x: 259 }, { t: "5′", x: 581 }]);
  });

  it("新链 3′ 端与模板 5′ 端同侧（p=1 远端）：A→224、A′→592、B→616、B′→248", () => {
    const m = mountAt("s6-extend-2");
    const bandOf = (k: string) => m.unit(k).querySelector<R>(".pcr-new")!;
    expect(num(bandOf("r2-0"), "x")).toBe(224);                             // 模板 A 5′ 端左缘
    expect(num(bandOf("r2-1"), "x") + num(bandOf("r2-1"), "width")).toBe(592); // 模板 A′ 5′ 端
    expect(num(bandOf("r2-2"), "x") + num(bandOf("r2-2"), "width")).toBe(616); // 模板 B 5′ 端
    expect(num(bandOf("r2-3"), "x")).toBe(248);                             // 模板 B′ 5′ 端左缘
  });

  it("退火 5′ 标注（p5）数量随轮次 2→4→8；延伸/结果熄灭（s3/s10 为 0）", () => {
    const onCount = (id: string) => mountAt(id).p5s.filter((t) => on(t)).length;
    expect(onCount("s2-anneal-1")).toBe(2);
    expect(onCount("s5-anneal-2")).toBe(4);
    expect(onCount("s8-anneal-3")).toBe(8);
    expect(onCount("s3-extend-1")).toBe(0);
    expect(onCount("s10-result")).toBe(0);
  });

  it("目标产物绿虚线框：仅 s9/s10 出现 2 个；框 1=−13..19 包住 A″(−2)+r3-3(+12)、框 2=110..144 包住 B″(+118)+r3-7(+132)；s8 无框", () => {
    const m8 = mountAt("s8-anneal-3");
    expect(m8.targets.filter((t) => on(t)).length).toBe(0);
    const m9 = mountAt("s9-extend-3");
    const [t1, t2] = m9.targets;
    expect(on(t1) && on(t2)).toBe(true);
    const r1 = t1.querySelector<R>("rect")!;
    const r2 = t2.querySelector<R>("rect")!;
    expect(num(r1, "x")).toBe(240);
    expect(num(r1, "width")).toBe(360);
    expect(num(r1, "y")).toBe(-13);
    expect(num(r1, "height")).toBe(32);
    expect(r1.getAttribute("stroke")).toBe(GREEN);
    expect(r1.getAttribute("stroke-dasharray")).toBe("7 4");
    expect(num(r2, "y")).toBe(110);
    expect(num(r2, "height")).toBe(34);
    // 框内层位验证：A″ 与 B″ 模板层及其上第 3 轮新链层
    expect(elY(m9.unit("r2-1"))).toBe(-2);
    expect(elY(m9.unit("r3-3"))).toBe(12);
    expect(elY(m9.unit("r2-3"))).toBe(118);
    expect(elY(m9.unit("r3-7"))).toBe(132);
    expect(mountAt("s10-result").targets.filter((t) => on(t)).length).toBe(2);
  });

  it("目标判据（v6.1 核心）：A″ = 橙 248..272 + 蓝 272..592，其上新链蓝 248..568（两端到 248/592）；B″ 对称", () => {
    const m = mountAt("s9-extend-3");
    const bandOf = (k: string) => m.unit(k).querySelector<R>(".pcr-new")!;
    // A″ 分子：模板 r2-1（橙 248 + 蓝 272..592=320）——蓝段右端 592 = 目标右界标
    expect(num(m.unit("r2-1").querySelector(".pcr-cap"), "x")).toBe(248);
    expect(num(bandOf("r2-1"), "x") + num(bandOf("r2-1"), "width")).toBe(592);
    // A″ 上第 3 轮新链 r3-3：从引物 R 3′ 端 568 配满到模板 A″ 5′ 端 248 → 蓝 248..568
    expect(num(bandOf("r3-3"), "x")).toBe(248);
    expect(num(bandOf("r3-3"), "width")).toBe(320);
    expect(num(bandOf("r3-3"), "x") + num(bandOf("r3-3"), "width") + 24).toBe(592); // 橙段补足到 592
    // B″ 分子：模板 r2-3（橙 568 + 蓝 248..568）——新链 r3-7 蓝 272..592
    expect(num(m.unit("r2-3").querySelector(".pcr-cap"), "x")).toBe(568);
    expect(num(bandOf("r2-3"), "x")).toBe(248);
    expect(num(bandOf("r2-3"), "width")).toBe(320);
    expect(num(bandOf("r3-7"), "x") - 24).toBe(248); // r3-7 蓝 272..592，橙段补到 248
    expect(num(bandOf("r3-7"), "x") + num(bandOf("r3-7"), "width")).toBe(592);
  });

  it("计数徽章：s3/s6/s9/s10 显示「目标产物 0/0/2/2（2ⁿ−2n）」，s0 隐藏", () => {
    const badge = (id: string) => {
      const { clearBadge } = mountAt(id);
      return { display: clearBadge!.style.display, text: clearBadge!.textContent };
    };
    expect(badge("s0-template")).toEqual({ display: "none", text: "" });
    expect(badge("s3-extend-1")).toEqual({ display: "", text: "目标产物 0（2¹−2×1）" });
    expect(badge("s6-extend-2")).toEqual({ display: "", text: "目标产物 0（2²−2×2）" });
    expect(badge("s9-extend-3")).toEqual({ display: "", text: "目标产物 2（2³−2×3）" });
    expect(badge("s10-result")).toEqual({ display: "", text: "目标产物 2（2³−2×3）" });
  });

  it("Taq 彻底移除：无 .pcr-taq 元素、场景内无紫色 (#8b5cf6)；其他课程紫色不受影响（不查 DOM）", () => {
    const m = mountAt("s9-extend-3");
    expect(m.container.querySelectorAll(".pcr-taq").length).toBe(0);
    const fills = [...m.container.querySelectorAll<SVGElement>("svg *")].map((e) => e.getAttribute("fill")).filter(Boolean);
    expect(fills.some((f) => f === "#8b5cf6")).toBe(false);
  });

  it("图例四项：灰母链 / 橙引物段 / 蓝合成段 / 绿目标产物（无 Taq 紫色项）", () => {
    const scene = createPcrScene();
    expect(scene.legend).toEqual([
      { color: GRAY, label: "母链（旧链/模板）" },
      { color: ORANGE, label: "引物段（新链 5′ 端，原位停驻）" },
      { color: BLUE, label: "合成段（新链 3′ 端）" },
      { color: GREEN, label: "目标产物（2ⁿ−2n）" },
    ]);
  });
});
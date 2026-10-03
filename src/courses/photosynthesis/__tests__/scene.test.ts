/**
 * 光合作用场景测试（必修一 1-5.4）
 *
 * 断言职责分工（与 AGENTS.md「测试职责分工」一致）：
 * - 几何 / 数量 / 显隐 / 配色 / 槽位表完备性：由断言强制
 * - 直观性 / 语义（观感平滑、微排是否好看）：以用户目检为准（见待目检清单）
 *
 * 本文件不测：讲解文案（在 data.test.ts 断言）、曲线图（本课无）、移动端裁切
 * （mobileScene.test.ts）。
 *
 * 重点锁死三条反误导不变式：
 * 1. 任意幕两场所 opacity 之和 ≥ 1 且各自 ≥ 0.25（两个场所始终同时可见）
 * 2. p7 双向箭头同时点亮
 * 3. C₅ 在 p6 回到 p5 的原槽位（被消耗后又再生）
 */
import { describe, expect, it } from "vitest";
import { createPhotosynthesisScene } from "../scene";
import { photosynthesisCourse } from "../data";
import { runSceneAudit } from "../../../test-utils/textAudit";

type G = SVGGElement;
type T = SVGTextElement;

const STAGES = photosynthesisCourse.stages;

/** 挂载并渲染某一幕 */
function mountAt(stageId: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const scene = createPhotosynthesisScene();
  scene.mount(container);
  const svg = container.querySelector("svg")!;
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) throw new Error(`未找到幕：${stageId}`);
  scene.render({ stage: stage.sceneState.stage });
  return {
    scene, container, svg,
    h2o: svg.querySelector<G>(".photo-h2o")!,
    o2: svg.querySelector<G>(".photo-o2")!,
    adp: svg.querySelector<G>(".photo-adp")!,
    co2: svg.querySelector<G>(".photo-co2")!,
    c5: svg.querySelector<G>(".photo-c5")!,
    c3: [...svg.querySelectorAll<G>(".photo-c3")],
    sugar: svg.querySelector<G>(".photo-sugar")!,
    h: [...svg.querySelectorAll<G>(".photo-h")],
    atp: [...svg.querySelectorAll<G>(".photo-atp")],
    thyHl: svg.querySelector<SVGEllipseElement>(".site-thylakoid")!,
    stromaHl: svg.querySelector<SVGEllipseElement>(".site-stroma")!,
    arrows: svg.querySelector<G>(".rel-arrows")!,
    eqLayer: svg.querySelector<G>(".eq-layer")!,
  };
}

/** 从 style.transform 解析元素当前落点 */
function pos(el: Element): { x: number; y: number } {
  const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec((el as HTMLElement).style.transform);
  if (!m) throw new Error(`元素未落位：${el.getAttribute("class")} transform=${(el as HTMLElement).style.transform}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}

type Box = { x1: number; y1: number; x2: number; y2: number };
const vis = (el: Element): boolean => (el as HTMLElement).style.opacity !== "0";
const visibleCount = (els: Element[]): number => els.filter(vis).length;
const opa = (el: Element): number => Number((el as HTMLElement).style.opacity);

/** 两处场所高亮椭圆（scene.ts 定死，几何在测试侧独立复述以便门禁） */
const HL_THY = { cx: 480, cy: 162, rx: 250, ry: 72 };
const HL_STROMA = { cx: 480, cy: 322, rx: 240, ry: 76 };
/** 载体停靠行 */
const ROW_A_Y = 196;
const ROW_B_Y = 285;

/** 元素在自身局部坐标系下的包围盒（合并内部图形与带 style.translate 的子组；文字不计） */
function localBox(el: Element): Box {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const walk = (node: Element, ox: number, oy: number): void => {
    for (const c of [...node.children]) {
      const n = (k: string): number => Number(c.getAttribute(k) ?? 0);
      if (c.tagName === "rect") {
        x1 = Math.min(x1, ox + n("x")); y1 = Math.min(y1, oy + n("y"));
        x2 = Math.max(x2, ox + n("x") + n("width")); y2 = Math.max(y2, ox + n("y") + n("height"));
      } else if (c.tagName === "circle") {
        const r = n("r");
        x1 = Math.min(x1, ox - r); y1 = Math.min(y1, oy - r);
        x2 = Math.max(x2, ox + r); y2 = Math.max(y2, oy + r);
      } else if (c.tagName !== "text") {
        const t = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec((c as HTMLElement).style.transform);
        walk(c, ox + (t ? Number(t[1]) : 0), oy + (t ? Number(t[2]) : 0));
      }
    }
  };
  walk(el, 0, 0);
  return { x1, y1, x2, y2 };
}

/** 元素的绝对包围盒 = 局部盒 + 落点 */
function absBox(el: Element): Box {
  const b = localBox(el), p = pos(el);
  return { x1: b.x1 + p.x, y1: b.y1 + p.y, x2: b.x2 + p.x, y2: b.y2 + p.y };
}

/**
 * 包围盒是否整体落在椭圆内：椭圆是凸集，故「四角在内」⟺「整个盒在内」。
 * shrink = 2px 是给色块软边缘留的容差，不按数学零容差卡死。
 */
function boxInEllipse(b: Box, e: typeof HL_THY, shrink = 2): boolean {
  const rx = e.rx - shrink, ry = e.ry - shrink;
  return [[b.x1, b.y1], [b.x2, b.y1], [b.x1, b.y2], [b.x2, b.y2]].every(([x, y]) => {
    const dx = (x - e.cx) / rx, dy = (y - e.cy) / ry;
    return dx * dx + dy * dy <= 1;
  });
}

/** 分子是否归属于两个场所之一（整体在某一高亮区内） */
function inEitherSite(el: Element): boolean {
  const b = absBox(el);
  return boxInEllipse(b, HL_THY) || boxInEllipse(b, HL_STROMA);
}

/** 各分子族清单（同名族内部另有专项用例校验并排间距） */
function moleculeGroups(m: ReturnType<typeof mountAt>): Array<[string, G[]]> {
  return [
    ["H₂O", [m.h2o]], ["O₂", [m.o2]], ["ADP+Pi", [m.adp]], ["CO₂", [m.co2]],
    ["C₅", [m.c5]], ["C₃", m.c3], ["糖", [m.sugar]], ["[H]", m.h], ["ATP", m.atp],
  ];
}

/** 两盒在某一轴上留有 ≥ gap 的间距（等价于「不重叠且至少空出 gap」） */
const separated = (a: Box, b: Box, gap: number): boolean =>
  a.x1 >= b.x2 + gap || a.x2 <= b.x1 - gap || a.y1 >= b.y2 + gap || a.y2 <= b.y1 - gap;

describe("光合作用场景 · 槽位表完备性", () => {
  it("全部 9 幕都能渲染（未在槽位表声明的 stage id 会直接抛错，不静默回退）", () => {
    for (const s of STAGES) {
      const container = document.createElement("div");
      const scene = createPhotosynthesisScene();
      scene.mount(container);
      expect(() => scene.render({ stage: s.sceneState.stage as string }), s.id).not.toThrow();
      container.remove();
    }
  });

  it("未声明的 stage id fail-fast 抛错（不静默画出错误画面）", () => {
    const container = document.createElement("div");
    const scene = createPhotosynthesisScene();
    scene.mount(container);
    expect(() => scene.render({ stage: "no-such-stage" })).toThrow(/槽位表缺少/);
    container.remove();
  });

  it("幕切换只改 style 通道（不写 SVG transform/opacity 属性，保证 CSS transition 可过渡）", () => {
    const m = mountAt("photo-thylakoid-site");
    m.scene.render({ stage: "photo-stroma-site" });
    const molecules = [m.h2o, m.o2, m.adp, m.co2, m.c5, m.sugar, ...m.c3, ...m.h, ...m.atp];
    for (const el of molecules) {
      expect(el.getAttribute("transform"), "不得写 transform 属性").toBeNull();
      expect(el.getAttribute("opacity"), "不得写 opacity 属性").toBeNull();
    }
    m.container.remove();
  });

  it("固定元素集零增删：切换幕时各分子的 DOM 数量不变", () => {
    const m = mountAt("photo-overview");
    const count = () => ({ c3: m.c3.length, h: m.h.length, atp: m.atp.length });
    const before = count();
    for (const s of STAGES) m.scene.render({ stage: s.sceneState.stage as string });
    expect(count()).toEqual(before);
    expect(before).toEqual({ c3: 2, h: 4, atp: 4 });
    m.container.remove();
  });
});

describe("光合作用场景 · 反误导：两场所始终同时可见", () => {
  it("任意幕两场所 opacity 之和 ≥ 1，且各自 ≥ 0.25（从不为 0，杜绝「消失 = 不存在」）", () => {
    for (const s of STAGES) {
      const m = mountAt(s.id);
      const t = opa(m.thyHl), st = opa(m.stromaHl);
      expect(t, `${s.id}：类囊体薄膜 opacity`).toBeGreaterThanOrEqual(0.25);
      expect(st, `${s.id}：叶绿体基质 opacity`).toBeGreaterThanOrEqual(0.25);
      expect(t + st, `${s.id}：两场所 opacity 之和必须 ≥ 1`).toBeGreaterThanOrEqual(1);
      m.container.remove();
    }
  });

  it("光反应三幕高亮类囊体薄膜、暗反应三幕高亮叶绿体基质（逐幕只点亮其一）", () => {
    for (const id of ["photo-thylakoid-site", "photo-water-split", "photo-atp-synth"]) {
      const m = mountAt(id);
      expect(opa(m.thyHl), id).toBeGreaterThan(opa(m.stromaHl));
      m.container.remove();
    }
    for (const id of ["photo-stroma-site", "photo-co2-fix", "photo-c3-reduce"]) {
      const m = mountAt(id);
      expect(opa(m.stromaHl), id).toBeGreaterThan(opa(m.thyHl));
      m.container.remove();
    }
  });

  it("关系幕两个场所同时满亮（同时进行的正面表达）", () => {
    const m = mountAt("photo-relation");
    expect(opa(m.thyHl)).toBe(1);
    expect(opa(m.stromaHl)).toBe(1);
    m.container.remove();
  });

  it("p7 双向箭头同时点亮，其余各幕一律熄灭", () => {
    for (const s of STAGES) {
      const m = mountAt(s.id);
      expect(vis(m.arrows), `${s.id}：双向箭头`).toBe(s.id === "photo-relation");
      m.container.remove();
    }
    const rel = mountAt("photo-relation");
    // 两条方向相反的箭头（下行 = 光反应→暗反应；上行 = 暗反应→光反应）。
    // 只断言结构性质（方向 + 连接同一对层面 + 横向不叠放），不锁具体坐标——布局微调不应碎测试
    const paths = [...rel.arrows.querySelectorAll("path.rel-arrow")];
    expect(paths).toHaveLength(2);
    const ends = (p: Element) => {
      const m = /^M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*L\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(
        p.getAttribute("d") ?? "",
      );
      if (!m) throw new Error(`关系幕箭头路径不是 M…L…：${p.getAttribute("d")}`);
      return { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] };
    };
    const [down, up] = [ends(paths[0]), ends(paths[1])];
    expect(down.y2, "第一条须为下行箭头（光反应→暗反应）").toBeGreaterThan(down.y1);
    expect(up.y2, "第二条须为上行箭头（暗反应→光反应）").toBeLessThan(up.y1);
    // 两条箭头连接同一对层面、方向相反
    expect(down.y1, "上下箭头须连接同一对层面").toBe(up.y2);
    expect(down.y2, "上下箭头须连接同一对层面").toBe(up.y1);
    // 横向不叠放：不同 x，否则两条线会互相盖住
    expect(down.x1, "上下两箭头必须在不同 x 上（不叠放）").not.toBe(up.x1);
    rel.container.remove();
  });
});

describe("光合作用场景 · 教材事实断言", () => {
  it("总览幕同时摆出两种反应物（类囊体侧 H₂O + 基质侧 CO₂）", () => {
    const m = mountAt("photo-overview");
    expect(vis(m.h2o)).toBe(true);
    expect(vis(m.co2)).toBe(true);
    expect(boxInEllipse(absBox(m.h2o), HL_THY), "H₂O 应整体落在类囊体区").toBe(true);
    expect(boxInEllipse(absBox(m.co2), HL_STROMA), "CO₂ 应整体落在基质区").toBe(true);
    m.container.remove();
  });

  it("水的光解：H₂O 消失、O₂ 与 [H] 出现（[H] 停在类囊体侧）", () => {
    const s1 = mountAt("photo-thylakoid-site");
    expect(vis(s1.h2o)).toBe(true);
    expect(vis(s1.o2)).toBe(false);
    s1.container.remove();

    const s2 = mountAt("photo-water-split");
    expect(vis(s2.h2o), "H₂O 在水的光解中被消耗").toBe(false);
    expect(vis(s2.o2), "O₂ 必须出现").toBe(true);
    expect(visibleCount(s2.h), "[H] 必须出现").toBe(4);
    for (const h of s2.h.filter(vis)) {
      expect(pos(h).y, "[H] 应停在类囊体侧载体行").toBe(ROW_A_Y);
      expect(boxInEllipse(absBox(h), HL_THY), "[H] 应整体落在类囊体区").toBe(true);
    }
    s2.container.remove();
  });

  it("水的光解读成「原地转化」：O₂ 与 H₂O 同一水平带且中心距 ≤120px，O₂ 在 p2~p8 全程静止", () => {
    // —— 同排就近：H₂O 消失 + O₂ 就近出现 = 一次转化的视觉依据（同一手法见呼吸第 3 幕）——
    const p1 = mountAt("photo-thylakoid-site");
    const p2 = mountAt("photo-water-split");
    const h2o = pos(p1.h2o);
    const o2 = pos(p2.o2);
    expect(o2.y, "O₂ 必须与 H₂O 同处一行（否则读成两个不相干的位置）").toBe(h2o.y);
    expect(Math.abs(o2.x - h2o.x), "O₂ 与 H₂O 中心距过大就读不出「O₂ 从水里出来」")
      .toBeLessThanOrEqual(120);
    expect(Math.abs(o2.x - h2o.x), "两者不得叠放").toBeGreaterThan(0);
    // 边缘须留出可见间隙（不是贴着的水→氧的一团）
    expect(Math.abs(o2.x - h2o.x) - 25 - 16, "O₂ 与 H₂O 药丸边缘间隙过小").toBeGreaterThanOrEqual(8);
    p1.container.remove();
    p2.container.remove();

    // —— 全程静止：p2~p8 落点逐一比对，杜绝「先近后远」的额外位移 ——
    const rest: Array<[string, { x: number; y: number }]> = [];
    for (const s of STAGES.slice(2)) {
      const m = mountAt(s.id);
      rest.push([s.id, pos(m.o2)]);
      m.container.remove();
    }
    for (const [id, p] of rest) {
      expect(p, `${id}：O₂ 不应再发生位移`).toEqual(rest[0][1]);
    }
  });

  it("ATP 的合成：ADP+Pi 出现、ATP 在类囊体侧生成；载体数与 [H] 齐平", () => {
    const m = mountAt("photo-atp-synth");
    expect(vis(m.adp)).toBe(true);
    expect(visibleCount(m.atp)).toBe(4);
    expect(visibleCount(m.h)).toBe(4);
    for (const a of m.atp.filter(vis)) {
      expect(pos(a).y, "ATP 应停靠在类囊体侧载体行").toBe(ROW_A_Y);
    }
    m.container.remove();
  });

  it("CO₂ 的固定幕同现 CO₂ / C₅ / 2C₃，且载体数不变（此步不耗能）", () => {
    const m = mountAt("photo-co2-fix");
    expect(vis(m.co2)).toBe(true);
    expect(vis(m.c5)).toBe(true);
    expect(visibleCount(m.c3)).toBe(2);
    expect(visibleCount(m.h), "CO₂ 固定不消耗 [H]").toBe(4);
    expect(visibleCount(m.atp), "CO₂ 固定不消耗 ATP").toBe(4);
    m.container.remove();
  });

  it("C₃ 的还原幕：载体下移到基质侧与 C₃ 汇合，产出糖并再生 C₅", () => {
    const m = mountAt("photo-c3-reduce");
    expect(visibleCount(m.c3)).toBe(2);
    expect(visibleCount(m.h), "[H] 汇入基质").toBe(4);
    expect(visibleCount(m.atp), "ATP 汇入基质").toBe(4);
    for (const c of [...m.h.filter(vis), ...m.atp.filter(vis)]) {
      expect(pos(c).y, "载体应下移到基质侧载体行").toBe(ROW_B_Y);
      expect(boxInEllipse(absBox(c), HL_STROMA), "载体应整体落在基质区").toBe(true);
    }
    expect(vis(m.sugar), "C₃ 还原必须产出糖").toBe(true);
    expect(vis(m.co2), "CO₂ 在固定步骤已被消耗").toBe(false);
    m.container.remove();
  });

  it("C₅ 在 p6 回到 p5 的原槽位（被消耗后又再生，循环不换位）", () => {
    const p5 = mountAt("photo-co2-fix");
    const p6 = mountAt("photo-c3-reduce");
    expect(vis(p5.c5)).toBe(true);
    expect(vis(p6.c5)).toBe(true);
    expect(pos(p6.c5)).toEqual(pos(p5.c5));
    p5.container.remove();
    p6.container.remove();
  });

  it("总反应式幕：载体归零、只剩最终产物 O₂ 与糖，反应式左右式与教材一致", () => {
    const m = mountAt("photo-total");
    expect(visibleCount(m.h), "[H] 已在暗反应中被消耗").toBe(0);
    expect(visibleCount(m.atp), "ATP 已在暗反应中被消耗").toBe(0);
    expect(vis(m.o2)).toBe(true);
    expect(vis(m.sugar)).toBe(true);
    expect(m.eqLayer.style.opacity).toBe("1");
    const texts = [...m.eqLayer.querySelectorAll<T>("text")].map((t) => t.textContent);
    expect(texts).toEqual(["CO₂ + H₂O", "(CH₂O) + O₂"]);
    m.container.remove();
  });

  it("反应式只在总反应式幕出现", () => {
    for (const s of STAGES) {
      const m = mountAt(s.id);
      expect(m.eqLayer.style.opacity, s.id).toBe(s.id === "photo-total" ? "1" : "0");
      m.container.remove();
    }
  });
});

describe("光合作用场景 · 场所归属不变式", () => {
  it("每个可见分子的包围盒都必须整体落在「类囊体薄膜」或「叶绿体基质」之一，无游离态", () => {
    for (const s of STAGES) {
      const m = mountAt(s.id);
      for (const [name, els] of moleculeGroups(m)) {
        for (const el of els) {
          if (!vis(el)) continue;
          const b = absBox(el);
          expect(
            inEitherSite(el),
            `${s.id}：${name} 包围盒 ${JSON.stringify(b)} 游离在两个场所之外`,
          ).toBe(true);
        }
      }
      m.container.remove();
    }
  });

  it("载体（[H]/ATP）永远归属于某一侧场所，不存在悬在两场所之间的灰区", () => {
    for (const s of STAGES) {
      const m = mountAt(s.id);
      for (const c of [...m.h.filter(vis), ...m.atp.filter(vis)]) {
        expect(inEitherSite(c), `${s.id}：载体 ${JSON.stringify(absBox(c))} 悬空`).toBe(true);
      }
      m.container.remove();
    }
  });

  it("两处场所高亮椭圆互不重叠，且不溢出叶绿体内膜下缘", () => {
    // 轴对齐包围盒不相交即为互不重叠（rx/ry 已含各自最大延伸）
    expect(HL_THY.cy + HL_THY.ry, "类囊体下缘须高于基质上缘")
      .toBeLessThan(HL_STROMA.cy - HL_STROMA.ry);
    // 内膜下缘 = 248 + 152 = 400，基质色块不得越出叶绿体
    expect(HL_STROMA.cy + HL_STROMA.ry).toBeLessThanOrEqual(400);
  });
});

describe("光合作用场景 · 布局可读性（几何断言）", () => {
  it("同一幕内任意两个不同分子族的可见元素包围盒之间至少空出 4px（无重叠、不粘连）", () => {
    for (const s of STAGES) {
      const m = mountAt(s.id);
      const visible: Array<[string, Box]> = [];
      for (const [name, els] of moleculeGroups(m)) {
        for (const el of els) if (vis(el)) visible.push([name, absBox(el)]);
      }
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const [n1, b1] = visible[i];
          const [n2, b2] = visible[j];
          // 同一分子族内部由专项用例校验（[H] 四粒、ATP 四粒、C₃ 两粒本就是并排设计）
          if (n1 === n2) continue;
          expect(separated(b1, b2, 4), `${s.id}：${n1} × ${n2} 包围盒未留出 4px`).toBe(true);
        }
      }
      m.container.remove();
    }
  });

  it("载体族内部：[H] 四粒与 ATP 四粒两两不重叠（不同 x 的并排设计不得粘连）", () => {
    for (const id of ["photo-atp-synth", "photo-c3-reduce", "photo-relation"]) {
      const m = mountAt(id);
      const boxes = [...m.h.filter(vis).map(absBox), ...m.atp.filter(vis).map(absBox)];
      expect(boxes).toHaveLength(8);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(separated(boxes[i], boxes[j], 4), `${id}：载体 ${i} × ${j} 包围盒未留出 4px`).toBe(true);
        }
      }
      m.container.remove();
    }
  });

  it("C₃ 两粒并排不叠放（叠放会读成 1 粒，破坏「2C₃」的计量读数）", () => {
    const m = mountAt("photo-co2-fix");
    const shown = m.c3.filter(vis);
    expect(shown).toHaveLength(2);
    const [a, b] = shown.map(absBox);
    expect(a.x2 + 4).toBeLessThanOrEqual(b.x1);
    m.container.remove();
  });

  it("可见分子的整体内容边界不超出 viewBox（0 0 960 500）", () => {
    // 用真实包围盒 absBox，而非「首个 rect/circle 的半宽」：并排多粒的组（如 O₂ 3 粒）
    // 旧写法只取第一粒尺寸，整组溢出会被漏掉。
    for (const s of STAGES) {
      const m = mountAt(s.id);
      for (const [name, els] of moleculeGroups(m)) {
        for (const el of els) {
          if (!vis(el)) continue;
          const b = absBox(el);
          expect(b.x1, `${s.id}：${name} 左溢出`).toBeGreaterThanOrEqual(0);
          expect(b.x2, `${s.id}：${name} 右溢出`).toBeLessThanOrEqual(960);
          expect(b.y1, `${s.id}：${name} 上溢出`).toBeGreaterThanOrEqual(0);
          expect(b.y2, `${s.id}：${name} 下溢出`).toBeLessThanOrEqual(500);
        }
      }
      m.container.remove();
    }
  });

  it("图例配色：不同分子族的色块两两不同（同色会把两族读成同一物质）", () => {
    const scene = createPhotosynthesisScene();
    const legend = scene.legend ?? [];
    expect(legend.length, "光合场景应有图例").toBeGreaterThan(0);
    const dup = legend
      .map((l) => l.color.toLowerCase())
      .filter((c, i, arr) => arr.indexOf(c) !== i);
    expect(dup, `图例存在同色项：${legend.map((l) => `${l.label}=${l.color}`).join(", ")}`).toEqual([]);
  });

  it("叶绿体轮廓与基粒全部落在 viewBox 内（背景层不出画）", () => {
    const m = mountAt("photo-overview");
    const outer = m.svg.querySelector<SVGEllipseElement>(".chloro-outer")!;
    const cx = Number(outer.getAttribute("cx")), cy = Number(outer.getAttribute("cy"));
    const rx = Number(outer.getAttribute("rx")), ry = Number(outer.getAttribute("ry"));
    expect(cx - rx).toBeGreaterThanOrEqual(0);
    expect(cx + rx).toBeLessThanOrEqual(960);
    expect(cy - ry).toBeGreaterThanOrEqual(0);
    expect(cy + ry).toBeLessThanOrEqual(500);
    const grana = [...m.svg.querySelectorAll(".granum")];
    expect(grana, "基粒 = 3 堆 × 3 片类囊体").toHaveLength(9);
    m.container.remove();
  });
});

describe("光合作用场景 · 排版审计（全幕）", () => {
  /**
   * 背景 / 结构图元豁免：这些图元本身不是「可读内容」，压在分子文字上属设计意图——
   * - chloro-outer / chloro-inner 叶绿体两层膜轮廓（分子本就画在其内部）
   * - site-hl 场所高亮衬底（标出「这一阶段发生在哪」）
   * - granum 类囊体盘（基粒堆叠示意）
   * - eq-arrow / rel-arrow 反应式与关系幕的箭头
   * 「文字压文字」「文字压分子」仍由审计器本体强制，未被豁免。
   */
  const BG_SHAPES = new Set([
    "chloro-outer", "chloro-inner", "site-hl", "granum", "eq-arrow", "rel-arrow",
  ]);

  it("9 幕均无文字遮挡（共享 textAudit 启发式）", () => {
    const scene = createPhotosynthesisScene();
    let host: HTMLElement | null = null;
    const conflicts = runSceneAudit({
      name: "photo",
      mount() {
        host = document.createElement("div");
        document.body.appendChild(host);
        scene.mount(host);
      },
      destroy() {
        host?.remove();
        host = null;
      },
      render(state: unknown) {
        scene.render(state as { stage: string });
      },
      svg() {
        return host?.querySelector("svg") ?? null;
      },
      extraExempt: (_t, sh) =>
        BG_SHAPES.has((sh.getAttribute("class") || "").split(/\s+/)[0]),
      stages: STAGES.map((s) => ({ id: s.id, state: { stage: s.sceneState.stage } })),
    });
    expect(conflicts).toEqual([]);
  });
});

/**
 * 细胞呼吸场景测试（必修一 1-5.3）
 *
 * 断言职责分工（与 AGENTS.md「测试职责分工」一致）：
 * - 几何 / 数量 / 显隐 / 配色 / 槽位表完备性：由断言强制
 * - 直观性 / 语义（观感平滑、微排是否好看）：以用户目检为准（见待目检清单）
 *
 * 本文件不测：讲解文案（在 data.test.ts 断言）、曲线图（data.test.ts）、移动端裁切（mobileScene.test.ts）。
 */
import { describe, expect, it } from "vitest";
import { createRespirationScene } from "../scene";
import { cellularRespirationAerobic, cellularRespirationAnaerobic } from "../data";
import { runSceneAudit } from "../../../test-utils/textAudit";

type G = SVGGElement;
type T = SVGTextElement;

const AEROBIC = cellularRespirationAerobic.stages;
const ANAEROBIC = cellularRespirationAnaerobic.stages;
const ALL_STAGES = [...AEROBIC, ...ANAEROBIC];

/** 挂载并渲染某一幕 */
function mountAt(stageId: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const scene = createRespirationScene();
  scene.mount(container);
  const svg = container.querySelector("svg")!;
  const stage = ALL_STAGES.find((s) => s.id === stageId);
  if (!stage) throw new Error(`未找到幕：${stageId}`);
  scene.render({ stage: stage.sceneState.stage });
  return {
    scene, container, svg,
    glucose: svg.querySelector<G>(".resp-glucose")!,
    o2: svg.querySelector<G>(".resp-o2")!,
    pyruvate: [...svg.querySelectorAll<G>(".resp-pyruvate")],
    co2: [...svg.querySelectorAll<G>(".resp-co2")],
    h: [...svg.querySelectorAll<G>(".resp-h")],
    h2o: [...svg.querySelectorAll<G>(".resp-h2o")],
    alcohol: [...svg.querySelectorAll<G>(".resp-alcohol")],
    atp: [...svg.querySelectorAll<G>(".resp-atp")],
    atpFrame: svg.querySelector<SVGRectElement>(".atp-frame")!,
    hPool: svg.querySelector<SVGRectElement>(".h-pool")!,
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

/** 线粒体两层膜的几何（cell-outline / mito-outer / mito-inner 由 scene.ts 定死） */
const MITO_INNER = { cx: 720, cy: 228, rx: 140, ry: 108 };
const MITO_OUTER = { cx: 720, cy: 228, rx: 180, ry: 148 };
const CELL_RECT = { x: 36, y: 36, w: 464, h: 384 };

/** 点是否落在椭圆内（留 pad 余量） */
function inEllipse(p: { x: number; y: number }, e: typeof MITO_INNER, pad = 0): boolean {
  const dx = (p.x - e.cx) / (e.rx - pad);
  const dy = (p.y - e.cy) / (e.ry - pad);
  return dx * dx + dy * dy <= 1;
}
/** 点是否落在矩形内（留 pad 余量） */
function inRect(p: { x: number; y: number }, r: typeof CELL_RECT, pad = 0): boolean {
  return (
    p.x >= r.x + pad && p.x <= r.x + r.w - pad &&
    p.y >= r.y + pad && p.y <= r.y + r.h - pad
  );
}

describe("细胞呼吸场景 · 槽位表完备性", () => {
  it("全部 14 幕都能渲染（未在槽位表声明的 stage id 会直接抛错，不静默回退）", () => {
    for (const s of ALL_STAGES) {
      const container = document.createElement("div");
      const scene = createRespirationScene();
      scene.mount(container);
      expect(() => scene.render({ stage: s.sceneState.stage as string }), s.id).not.toThrow();
      container.remove();
    }
  });

  it("未声明的 stage id fail-fast 抛错（不静默画出错误画面）", () => {
    const container = document.createElement("div");
    const scene = createRespirationScene();
    scene.mount(container);
    expect(() => scene.render({ stage: "no-such-stage" })).toThrow(/槽位表缺少/);
  });

  it("幕切换只改 style 通道（不写 SVG transform/opacity 属性，保证 CSS transition 可过渡）", () => {
    const m = mountAt("stage1-site");
    m.scene.render({ stage: "stage2-site" });
    for (const el of [...m.pyruvate, ...m.co2, ...m.h, ...m.h2o, m.glucose, m.o2, ...m.alcohol, ...m.atp]) {
      expect(el.getAttribute("transform"), "不得写 transform 属性").toBeNull();
      expect(el.getAttribute("opacity"), "不得写 opacity 属性").toBeNull();
    }
    m.container.remove();
  });

  it("固定元素集零增删：切换幕时各分子的 DOM 数量不变（背景层预声明，layout 只控显隐）", () => {
    const m = mountAt("aerobic-overview");
    const count = () => ({
      pyruvate: m.pyruvate.length, co2: m.co2.length, h: m.h.length,
      h2o: m.h2o.length, alcohol: m.alcohol.length, atp: m.atp.length,
    });
    const before = count();
    for (const s of ALL_STAGES) m.scene.render({ stage: s.sceneState.stage as string });
    expect(count()).toEqual(before);
    expect(before).toEqual({ pyruvate: 2, co2: 2, h: 4, h2o: 2, alcohol: 2, atp: 6 });
    m.container.remove();
  });
});

describe("细胞呼吸场景 · 有氧三阶段的事实断言", () => {
  it("第 1 阶段：葡萄糖 1 粒消失、丙酮酸 2 粒出现（1 变 2 的计量起点）", () => {
    const s0 = mountAt("aerobic-overview");
    expect(vis(s0.glucose)).toBe(true);
    expect(visibleCount(s0.pyruvate)).toBe(0);
    s0.container.remove();

    const s2 = mountAt("stage1-split");
    expect(vis(s2.glucose)).toBe(false);
    expect(visibleCount(s2.pyruvate)).toBe(2);
    s2.container.remove();
  });

  it("[H] 的量按「少量→大量」递增：第 1 阶段 2 粒、第 2 阶段 4 粒", () => {
    const s3 = mountAt("stage1-yield");
    expect(visibleCount(s3.h)).toBe(2);
    expect(vis(s3.hPool)).toBe(true);
    s3.container.remove();

    const s5 = mountAt("stage2-decarb");
    expect(visibleCount(s5.h)).toBe(4);
    s5.container.remove();
  });

  it("第 2 阶段：丙酮酸迁入线粒体基质（落点必须在内膜椭圆内），CO₂ 出现在基质", () => {
    const s4 = mountAt("stage2-site");
    for (const p of s4.pyruvate) {
      expect(vis(p)).toBe(true);
      expect(inEllipse(pos(p), MITO_INNER, 4), `丙酮酸落点 ${JSON.stringify(pos(p))} 应在线粒体基质内`).toBe(true);
    }
    expect(visibleCount(s4.co2)).toBe(0);
    s4.container.remove();

    const s5 = mountAt("stage2-decarb");
    expect(visibleCount(s5.co2)).toBe(2);
    for (const c of s5.co2) {
      expect(inEllipse(pos(c), MITO_INNER, 4), `CO₂ 落点 ${JSON.stringify(pos(c))} 应在线粒体基质内`).toBe(true);
    }
    s5.container.remove();
  });

  it("第 3 阶段：[H] 落点全部在线粒体内膜上（既不在基质中央也不在膜外）", () => {
    const s6 = mountAt("stage3-site");
    expect(visibleCount(s6.h)).toBe(4);
    for (const h of s6.h) {
      const p = pos(h);
      const dInner = Math.hypot((p.x - MITO_INNER.cx) / MITO_INNER.rx, (p.y - MITO_INNER.cy) / MITO_INNER.ry);
      const dOuter = Math.hypot((p.x - MITO_OUTER.cx) / MITO_OUTER.rx, (p.y - MITO_OUTER.cy) / MITO_OUTER.ry);
      // 归一化距离：dInner ≈ 1（内膜上）、dOuter < 1（仍在线粒体内）
      expect(dInner, `[H] 落点 ${JSON.stringify(p)} 应贴内膜（dInner≈1）`).toBeGreaterThan(0.92);
      expect(dInner, `[H] 落点 ${JSON.stringify(p)} 不应跑到基质中央`).toBeLessThan(1.08);
      expect(dOuter, `[H] 落点 ${JSON.stringify(p)} 应在线粒体之内`).toBeLessThan(1);
    }
    s6.container.remove();
  });

  it("第 3 阶段：[H] 被 O₂ 全部消耗归零，O₂ 消失、H₂O 出现、ATP 量块满", () => {
    const s6 = mountAt("stage3-site");
    expect(vis(s6.o2)).toBe(true);
    expect(visibleCount(s6.h2o)).toBe(0);
    s6.container.remove();

    const s7 = mountAt("stage3-water");
    expect(visibleCount(s7.h), "[H] 必须在第 3 阶段归零").toBe(0);
    expect(vis(s7.o2), "O₂ 在第 3 阶段被消耗").toBe(false);
    expect(visibleCount(s7.h2o)).toBe(2);
    expect(visibleCount(s7.atp), "第 3 阶段释放大量能量 → ATP 满").toBe(6);
    s7.container.remove();
  });

  it("H₂O 出现在 O₂ 消失的同一水平带（第 3 幕「O₂ 消失、H₂O 原地出现」即视觉上的转化）", () => {
    const s6 = mountAt("stage3-site");
    const s7 = mountAt("stage3-water");
    const o2 = pos(s6.o2);
    const waters = s7.h2o.map(pos);
    // O₂ 组三粒并排，占据 o2.x ± 59；H₂O 两粒必须落在这个横向区间内、且与 O₂ 同 y
    for (const p of waters) {
      expect(p.y, `H₂O y=${p.y} 应与 O₂ 的 y=${o2.y} 同带（原地转化的视觉依据）`).toBe(o2.y);
      expect(p.x, `H₂O 落点 ${p.x} 应落在 O₂ 占据的横向区间内`)
        .toBeGreaterThanOrEqual(o2.x - 59);
      expect(p.x).toBeLessThanOrEqual(o2.x + 59);
    }
    // 两粒分列，不得叠放（叠放会读成 1 粒）
    expect(waters[0].x).toBeLessThan(o2.x);
    expect(waters[1].x).toBeGreaterThan(o2.x);
    s6.container.remove(); s7.container.remove();
  });

  it("ATP 量块按「少量→大量」递增：第 1 阶段 2、第 2 阶段 3、第 3 阶段 6", () => {
    const s3 = mountAt("stage1-yield");
    expect(visibleCount(s3.atp)).toBe(2);
    s3.container.remove();
    const s5 = mountAt("stage2-decarb");
    expect(visibleCount(s5.atp)).toBe(3);
    s5.container.remove();
    const s7 = mountAt("stage3-water");
    expect(visibleCount(s7.atp)).toBe(6);
    s7.container.remove();
  });

  it("总反应式幕：CO₂ 移至线粒体外膜（待释放）、反应式左右式与教材一致", () => {
    const m = mountAt("aerobic-total");
    expect(visibleCount(m.co2)).toBe(2);
    for (const c of m.co2) {
      const p = pos(c);
      // 外膜之外、内膜之外：CO₂ 在外膜处，表示即将释放到细胞外
      expect(inEllipse(p, MITO_OUTER, -2), `CO₂ 落点 ${JSON.stringify(p)} 应贴近/越过外膜`).toBe(true);
      expect(inEllipse(p, MITO_INNER, -4), `CO₂ 不应还留在基质里`).toBe(false);
    }
    expect(m.eqLayer.style.opacity).toBe("1");
    const texts = [...m.eqLayer.querySelectorAll<T>("text")].map((t) => t.textContent);
    expect(texts).toEqual(["C₆H₁₂O₆ + 6O₂ + 6H₂O", "6CO₂ + 12H₂O + 能量"]);
    m.container.remove();
  });
});

describe("细胞呼吸场景 · 物质场所归属不变式", () => {
  it("每个可见分子的落点都必须落在「细胞质基质」或「线粒体（基质/内膜）」之一，无游离态", () => {
    for (const s of ALL_STAGES) {
      const m = mountAt(s.id);
      const groups: Array<[string, G[]]> = [
        ["葡萄糖", [m.glucose]], ["O₂", [m.o2]], ["丙酮酸", m.pyruvate],
        ["CO₂", m.co2], ["H₂O", m.h2o], ["酒精", m.alcohol], ["[H]", m.h],
      ];
      for (const [name, els] of groups) {
        for (const el of els) {
          if (!vis(el)) continue;
          const p = pos(el);
          const inCell = inRect(p, CELL_RECT, -2);
          const inMito = inEllipse(p, MITO_OUTER, -2);
          expect(inCell || inMito, `${s.id}：${name} 落点 ${JSON.stringify(p)} 游离在场外`).toBe(true);
        }
      }
      m.container.remove();
    }
  });

  it("丙酮酸只在细胞质基质与线粒体基质之间迁移，不出现在内膜之外", () => {
    // 第 1 阶段：在细胞质基质内
    for (const id of ["stage1-split", "stage1-yield", "anaerobic-stage1", "anaerobic-site"]) {
      const m = mountAt(id);
      expect(visibleCount(m.pyruvate), `${id}：该幕丙酮酸应可见`).toBe(2);
      for (const p of m.pyruvate) {
        expect(inRect(pos(p), CELL_RECT, 0), `${id}：第 1 阶段的丙酮酸应在细胞质基质内`).toBe(true);
      }
      m.container.remove();
    }
    // 第 2 阶段入口：已迁入线粒体基质（内膜椭圆内）
    const s4 = mountAt("stage2-site");
    expect(visibleCount(s4.pyruvate)).toBe(2);
    for (const p of s4.pyruvate) {
      expect(inEllipse(pos(p), MITO_INNER, 4), `stage2-site：丙酮酸应已迁入线粒体基质`).toBe(true);
    }
    s4.container.remove();
    // 第 2 阶段起彻底分解，此后全程不再出现
    for (const id of ["stage2-decarb", "stage3-site", "stage3-water", "aerobic-total"]) {
      const m = mountAt(id);
      expect(visibleCount(m.pyruvate), `${id}：丙酮酸应已被彻底分解`).toBe(0);
      m.container.remove();
    }
  });

  it("[H] 的全程轨迹：细胞质汇集槽 → 迁入线粒体内膜（幕间位移为单向、可解释）", () => {
    const pool = mountAt("stage1-yield");
    const poolPos = pos(pool.h[0]);
    expect(inRect(poolPos, { x: 190, y: 332, w: 260, h: 54 }, -6), "第 1 阶段的 [H] 应在汇集槽内").toBe(true);
    pool.container.remove();

    const mem = mountAt("stage3-site");
    // [H] 停靠在内膜线上：归一化距离 ≈1（pad 为负 = 允许骑在线上）
    for (const h of mem.h.filter(vis)) {
      expect(inEllipse(pos(h), MITO_INNER, -2), "第 3 阶段的 [H] 应已抵达内膜").toBe(true);
    }
    mem.container.remove();
  });
});

describe("细胞呼吸场景 · 无氧模式断言", () => {
  it("第 1 阶段与有氧完全共用：几何落点与有氧对应幕逐点一致", () => {
    const a2 = mountAt("stage1-split");   // 有氧 ①分解
    const a3 = mountAt("stage1-yield");   // 有氧 ①产物
    const n1 = mountAt("anaerobic-stage1");
    // 无氧第 1 幕 = 有氧「①分解 + ①产物」的合成快照
    for (let i = 0; i < 2; i++) {
      expect(pos(n1.pyruvate[i])).toEqual(pos(a2.pyruvate[i]));
      expect(pos(n1.h[i])).toEqual(pos(a3.h[i]));
    }
    a2.container.remove(); a3.container.remove(); n1.container.remove();
  });

  it("关键错点：无氧第 2 阶段不消耗 [H]（产物幕 [H] 数量与上一幕完全相同）", () => {
    const before = mountAt("anaerobic-site");
    const after = mountAt("anaerobic-products");
    expect(visibleCount(before.h)).toBe(2);
    expect(visibleCount(after.h)).toBe(2);
    for (let i = 0; i < 2; i++) expect(pos(after.h[i])).toEqual(pos(before.h[i]));
    before.container.remove(); after.container.remove();
  });

  it("无氧全程线粒体整体淡化（表达「不在线粒体中进行」）", () => {
    for (const s of ANAEROBIC) {
      const m = mountAt(s.id);
      const layer = m.svg.querySelector<G>(".mito-layer")!;
      expect(layer.style.opacity, s.id).toBe("0.2");
      m.container.remove();
    }
  });

  it("无氧模式 O₂ 全程不出现（没有氧就不参与）", () => {
    for (const s of ANAEROBIC) {
      const m = mountAt(s.id);
      expect(vis(m.o2), s.id).toBe(false);
      m.container.remove();
    }
  });

  it("无氧产物幕：丙酮酸消失、酒精与 CO₂ 各出现 2 粒（1 葡萄糖 → 2 丙酮酸 → 2+2）", () => {
    const m = mountAt("anaerobic-products");
    expect(visibleCount(m.pyruvate)).toBe(0);
    expect(visibleCount(m.alcohol)).toBe(2);
    expect(visibleCount(m.co2)).toBe(2);
    expect(visibleCount(m.atp), "无氧呼吸 ATP 维持少量，不随产物出现而猛增").toBe(2);
    m.container.remove();
  });

  it("无氧模式 ATP 量块全程不超过第 1 阶段的量（有氧远多于无氧的可视对比）", () => {
    let maxAnaerobic = 0;
    for (const s of ANAEROBIC) {
      const m = mountAt(s.id);
      maxAnaerobic = Math.max(maxAnaerobic, visibleCount(m.atp));
      m.container.remove();
    }
    const aerobicMax = Math.max(...AEROBIC.map((s) => {
      const m = mountAt(s.id);
      const n = visibleCount(m.atp);
      m.container.remove();
      return n;
    }));
    expect(maxAnaerobic).toBeLessThan(aerobicMax);
  });

  it("无氧模式反应式只在能量幕出现一次（早期版本 p0 显示 → p1~p3 消失 → p4 重现，属闪烁式节奏）", () => {
    // 全 5 幕逐一断言，把「只出现一次」锁死——只断言首末两幕会漏掉中间三幕的消失
    for (const s of ANAEROBIC) {
      const m = mountAt(s.id);
      expect(m.eqLayer.style.opacity, `${s.id}：反应式应只在能量幕出现`).toBe(
        s.id === "anaerobic-yield" ? "1" : "0",
      );
      m.container.remove();
    }
    // 出现的那一幕必须给出酒精发酵精确计量
    const m = mountAt("anaerobic-yield");
    const texts = [...m.eqLayer.querySelectorAll<T>("text")].map((t) => t.textContent);
    expect(texts).toEqual(["C₆H₁₂O₆", "2C₂H₅OH + 2CO₂ + 少量能量"]);
    m.container.remove();
  });
});

describe("细胞呼吸场景 · 布局可读性（几何断言）", () => {
  /** 元素在自身局部坐标系下的包围盒（合并内部图形与带 style.translate 的子组；文字不计） */
  function localBox(el: Element): Box {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const walk = (node: Element, ox: number, oy: number): void => {
      for (const c of [...node.children]) {
        const n = (k: string): number => Number(c.getAttribute(k) ?? 0);
        if (c.tagName === "rect") {
          x1 = Math.min(x1, ox + n("x")); y1 = Math.min(y1, oy + n("y"));
          x2 = Math.max(x2, ox + n("x") + n("width")); y2 = Math.max(y2, oy + n("y") + n("height"));
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
  /** 两盒在某一轴上留有 ≥ gap 的间距（等价于「不重叠且至少空出 gap」） */
  const separated = (a: Box, b: Box, gap: number): boolean =>
    a.x1 >= b.x2 + gap || a.x2 <= b.x1 - gap || a.y1 >= b.y2 + gap || a.y2 <= b.y1 - gap;

  it("同一幕内任意两个可见分子的包围盒之间至少空出 4px（无重叠、不粘连）", () => {
    for (const s of ALL_STAGES) {
      const m = mountAt(s.id);
      const groups: Array<[string, G[]]> = [
        ["葡萄糖", [m.glucose]], ["O₂", [m.o2]], ["丙酮酸", m.pyruvate],
        ["CO₂", m.co2], ["H₂O", m.h2o], ["酒精", m.alcohol], ["[H]", m.h],
        ["ATP", m.atp],
      ];
      const visible: Array<[string, Box]> = [];
      for (const [name, els] of groups) {
        for (const el of els) if (vis(el)) visible.push([name, absBox(el)]);
      }
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          const [n1, b1] = visible[i];
          const [n2, b2] = visible[j];
          // 同一分子族内部由专项用例校验（O₂ 三粒、[H] 四粒、ATP 六块本就是设计上的并排/堆叠）
          if (n1 === n2) continue;
          expect(separated(b1, b2, 4), `${s.id}：${n1} × ${n2} 包围盒未留出 4px`).toBe(true);
        }
      }
      m.container.remove();
    }
  });

  it("O₂ 三粒横向等距、互不重叠（间距 48 ≥ 直径 30 + 4）", () => {
    const m = mountAt("aerobic-overview");
    const balls = [...m.o2.children].filter((c) => (c as G).querySelector?.("circle")) as G[];
    expect(balls).toHaveLength(3);
    const ps = balls.map(pos);
    expect(ps[1].x - ps[0].x).toBe(48);
    expect(ps[2].x - ps[1].x).toBe(48);
    // 相邻两粒的包围盒之间至少空出 4px
    for (let i = 0; i < balls.length - 1; i++) {
      expect(absBox(balls[i]).x2 + 4).toBeLessThanOrEqual(absBox(balls[i + 1]).x1);
    }
    m.container.remove();
  });

  it("H₂O 两粒并排不叠放（叠放会读成 1 粒，破坏「2 粒水」的计量读数）", () => {
    const m = mountAt("stage3-water");
    const shown = m.h2o.filter(vis);
    expect(shown).toHaveLength(2);
    const [a, b] = shown.map(absBox);
    expect(a.x2 + 4).toBeLessThanOrEqual(b.x1);
    m.container.remove();
  });

  it("[H] 各粒两两不重叠（汇集槽内与内膜上都不粘连）", () => {
    for (const id of ["stage1-yield", "stage2-decarb", "stage3-site"]) {
      const m = mountAt(id);
      const boxes = m.h.filter(vis).map(absBox);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(
            boxes[i].x1 >= boxes[j].x2 + 4 || boxes[i].x2 <= boxes[j].x1 - 4 ||
            boxes[i].y1 >= boxes[j].y2 + 4 || boxes[i].y2 <= boxes[j].y1 - 4,
            `${id}：[H]${i} × [H]${j} 包围盒未留出 4px`
          ).toBe(true);
        }
      }
      m.container.remove();
    }
  });

  it("ATP 量块全部落在量框内（不溢出框外）", () => {
    for (const s of ALL_STAGES) {
      const m = mountAt(s.id);
      for (const b of m.atp) {
        const p = pos(b);
        expect(p.x, `${s.id}：ATP 量块 x 越界`).toBeGreaterThan(75);
        expect(p.x, `${s.id}：ATP 量块 x 越界`).toBeLessThan(125);
        expect(p.y, `${s.id}：ATP 量块 y 越界`).toBeGreaterThan(292);
        expect(p.y, `${s.id}：ATP 量块 y 越界`).toBeLessThan(354);
      }
      m.container.remove();
    }
  });

  it("可见分子的整体内容边界不超出 viewBox（0 0 960 500）", () => {
    // 用真实包围盒 absBox，而非「首个 rect/circle 的半宽」：O₂ 是 3 粒并排的组，
    // 旧写法只取第一粒 r=15，真实半宽 63（±48 + r15），多球组的溢出会被整段漏掉。
    for (const s of ALL_STAGES) {
      const m = mountAt(s.id);
      const all = [m.glucose, m.o2, ...m.pyruvate, ...m.co2, ...m.h2o, ...m.alcohol, ...m.h, ...m.atp];
      for (const el of all) {
        if (!vis(el)) continue;
        const b = absBox(el);
        const cls = el.getAttribute("class");
        expect(b.x1, `${s.id}：${cls} 左溢出`).toBeGreaterThanOrEqual(0);
        expect(b.x2, `${s.id}：${cls} 右溢出`).toBeLessThanOrEqual(960);
        expect(b.y1, `${s.id}：${cls} 上溢出`).toBeGreaterThanOrEqual(0);
        expect(b.y2, `${s.id}：${cls} 下溢出`).toBeLessThanOrEqual(500);
      }
      m.container.remove();
    }
  });

  it("图例配色：不同分子族的色块两两不同（同色会把两族读成同一物质）", () => {
    const scene = createRespirationScene();
    const legend = scene.legend ?? [];
    expect(legend.length, "呼吸场景应有图例").toBeGreaterThan(0);
    const dup = legend
      .map((l) => l.color.toLowerCase())
      .filter((c, i, arr) => arr.indexOf(c) !== i);
    expect(dup, `图例存在同色项：${legend.map((l) => `${l.label}=${l.color}`).join(", ")}`).toEqual([]);
  });
});

describe("细胞呼吸场景 · 排版审计（全幕）", () => {
  /**
   * 背景 / 结构图元豁免：这些图元本身不是「可读内容」，压在分子文字上属设计意图——
   * - site-hl 场所高亮衬底（半透明色块，标出「当前阶段发生在哪」）
   * - h-pool [H] 汇集槽（虚线框，其 [H] 标注就写在框内，是槽的自带标签）
   * - mito-outer / mito-inner 线粒体两层膜轮廓（分子本就画在其内部或膜上）
   * - crista 内膜嵴（第 3 阶段 [H] 刻意停靠在嵴上 =「在内膜上传电子」）
   * - atp-frame / eq-arrow / cell-outline 量框、反应式箭头、细胞轮廓
   * 「文字压文字」「文字压分子」仍由审计器本体强制，未被豁免。
   */
  const BG_SHAPES = new Set([
    "site-hl", "h-pool", "mito-outer", "mito-inner",
    "crista", "atp-frame", "eq-arrow", "cell-outline",
  ]);

  it("两种模式共 14 幕均无文字遮挡（共享 textAudit 启发式）", () => {
    const scene = createRespirationScene();
    let host: HTMLElement | null = null;
    const conflicts = runSceneAudit({
      name: "resp",
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
      stages: ALL_STAGES.map((s) => ({ id: s.id, state: { stage: s.sceneState.stage } })),
    });
    expect(conflicts).toEqual([]);
  });
});
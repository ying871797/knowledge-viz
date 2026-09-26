/**
 * PCR 场景几何/数量/颜色不变式（v5「统一行模型」，方案 .proposals/2026-09-26-001-pcr-rebuild.html）。
 * 机械门禁的一部分；直观性/语义类留给用户目检。
 *
 * v5 语义（vs v4.5「母链在上/槽位=角色」）：
 * - 一行 = 一个分子；泳道两条链都是母链/模板（无论新旧，半保留着色旧链灰/合成链蓝）；
 * - 变性 = 行内两条链原位纯垂直位移分开；退火 = 每条链下方挂 1 支引物；延伸 = 新链从引物 3′ 端锚点长出；
 * - 引物内嵌式（用户裁决延续 v4.4）：PRIMER_W=50、L 264..314 / R 546..596（5′ 内缩 14px 全在带内、3′ 端钉 314/546）；
 * - 每分子 2 枚 Taq（用户裁决）：taq1 守新链锚点（y=18）、taq2 守模板 3′ 端（y=-8）；
 * - 泳道净距 124−2×(45+7)=20；8 行档行距 52 → 链带/新链/引物净距 13。
 *
 * 元素类名约定：
 *   .pcr-row         每泳道/分子行容器（opacity 0/1 行显隐，transform translateY 行位）
 *   .pcr-band        bandT=上链（泳道=母链上支 / 延伸=模板恒在上）；bandB 仅在泳道时可见（=母链下支）
 *   .pcr-new         延伸中的新生链带（蓝，目标为绿短带；恒在 +18，不越母链上方）
 *   .pcr-primer-L/R  橙引物带（内嵌式：L 264..314 / R 546..596，3′ 端钉 314/546）
 *   .pcr-taq         紫球聚合酶（taq1 守锚点 y=18、taq2 守模板 3′ 端 y=-8；仅延伸步骤可见）
 *   .pcr-dir         5′/3′ 方向标注（data-side=aL|aR|bL|bR，文本随链真实朝向）——全程不省略
 *   .temp-tab        温度牌（data-temp=95|55|72）｜ .pcr-target-badge 目标角标 ｜ .pcr-clear-badge 计数徽章
 */
import { describe, it, expect } from "vitest";
import { createPcrScene } from "../scene";
import { pcrCourse, type PcrState } from "../data";

type DirEl = SVGTextElement;
type RowEl = SVGGElement;
type RectEl = SVGRectElement;

const GRAY = "#64748b";
const BLUE = "#2563eb";
const GREEN = "#22c55e";
const TAQ = "#8b5cf6";

function mountAt(id: string) {
  const stage = pcrCourse.stages.find((s) => s.id === id)!;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const scene = createPcrScene();
  scene.mount(container);
  scene.render(stage.sceneState);
  const svg = container.querySelector("svg")!;
  return {
    container,
    scene,
    stage,
    rows: [...svg.querySelectorAll<RowEl>(".pcr-row")],
    dirs: [...svg.querySelectorAll<DirEl>(".pcr-dir")],
    temps: [...svg.querySelectorAll<SVGGElement>(".temp-tab")],
    badges: [...svg.querySelectorAll<SVGGElement>(".pcr-target-badge")],
    clearBadge: container.querySelector<HTMLElement>(".pcr-clear-badge"),
    state: stage.sceneState as PcrState,
  };
}

/** 以给定 extensionProgress 重渲染（锚点生长中间帧），返回同一行元素引用 */
function renderAt(m: ReturnType<typeof mountAt>, p: number): void {
  m.scene.render({ ...m.stage.sceneState, extensionProgress: p });
}

/** 可见行：行容器 opacity=1 */
function visibleRows(rows: RowEl[]): RowEl[] {
  return rows.filter((r) => r.style.opacity === "1");
}

function rowY(g: RowEl): number {
  const m = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec(g.style.transform);
  return m ? Number(m[1]) : 0;
}

function elY(e: Element | null): number {
  if (!e) return 0;
  const m = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec((e as unknown as ElementCSSInlineStyle).style.transform);
  return m ? Number(m[1]) : 0;
}

function byeO(e: Element | null): boolean {
  return !!e && (e as unknown as ElementCSSInlineStyle).style.opacity === "1";
}

/** 行内可见链带（泳道两条 bandT+bandB；延伸行仅 bandT） */
function onBands(row: RowEl): RectEl[] {
  return [...row.querySelectorAll<RectEl>(".pcr-band")].filter((b) => byeO(b));
}

/** 行内可见新生链（.pcr-new 中 on 者）；延伸/目标行必有，其余为空 */
function visNew(row: RowEl): RectEl | null {
  return [...row.querySelectorAll<RectEl>(".pcr-new")].find((n) => byeO(n)) ?? null;
}

/** 上槽链带（elY<0）与下槽链带（elY>0） */
function slotBands(row: RowEl): { up: RectEl; down: RectEl } {
  const [a, b] = onBands(row).sort((x, y) => elY(x) - elY(y));
  return { up: a, down: b };
}

/** 行内方向标注：data-side → 文本 */
function dirMap(row: RowEl): Record<string, string> {
  return Object.fromEntries([...row.querySelectorAll<DirEl>(".pcr-dir")].map((t) => [t.getAttribute("data-side"), t.textContent]));
}

/** 行内可见引物的 translateY 列表 */
function primerYs(row: RowEl): number[] {
  return [...row.querySelectorAll<RectEl>(".pcr-primer-L, .pcr-primer-R")].filter((p) => byeO(p)).map((p) => elY(p)).sort((a, b) => a - b);
}

/** 可见 Taq 的位置（translateX, translateY）——y=18 为守锚点者(taq1)、y=-8 为守模板 3′ 端者(taq2) */
function taqPos(m: ReturnType<typeof mountAt>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const r of visibleRows(m.rows)) {
    for (const t of [...r.querySelectorAll<SVGGElement>(".pcr-taq")]) {
      if (!byeO(t)) continue;
      const mm = /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/.exec((t as unknown as ElementCSSInlineStyle).style.transform);
      if (mm) out.push([Number(mm[1]), Number(mm[2])]);
    }
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

describe("PCR 场景（v5 统一行模型）", () => {
  it("元素池零增删：s0 与 s10 两次渲染后 SVG 元素总数不变", () => {
    const stage0 = pcrCourse.stages[0];
    const stage10 = pcrCourse.stages[10];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const scene = createPcrScene();
    scene.mount(container);
    scene.render(stage0.sceneState);
    const count0 = container.querySelectorAll("svg *").length;
    scene.render(stage10.sceneState);
    const count10 = container.querySelectorAll("svg *").length;
    expect(count10).toBe(count0);
    expect(count0).toBeGreaterThan(90);
  });

  it("阵列行数逐幕正确：1→1→1→2→2→2→4→4→4→8→8 个可见行", () => {
    const expects: Array<[string, number]> = [
      ["s0-template", 1], ["s1-denature-1", 1], ["s2-anneal-1", 1], ["s3-extend-1", 2],
      ["s4-denature-2", 2], ["s5-anneal-2", 2], ["s6-extend-2", 4],
      ["s7-denature-3", 4], ["s8-anneal-3", 4], ["s9-extend-3", 8], ["s10-result", 8],
    ];
    for (const [id, want] of expects) {
      const { rows } = mountAt(id);
      expect(visibleRows(rows).length, id).toBe(want);
    }
  });

  it("第 3 轮 8 行行距紧凑但不重叠：可见行相邻 y 差 ≥ 44", () => {
    const { rows } = mountAt("s10-result");
    const ys = visibleRows(rows).map(rowY).sort((a, b) => a - b);
    expect(ys.length).toBe(8);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1], `row ${i - 1}->${i}`).toBeGreaterThanOrEqual(44);
    }
  });

  it("温度牌三枚常驻；s1 高亮 95、s5 高亮 55、s10 全灭", () => {
    const tempBy = (id: string) => {
      const { temps } = mountAt(id);
      return Object.fromEntries(temps.map((t) => [t.getAttribute("data-temp"), byeO(t)]));
    };
    expect(tempBy("s0-template")).toEqual({ "95": false, "55": false, "72": false });
    expect(tempBy("s1-denature-1")).toEqual({ "95": true, "55": false, "72": false });
    expect(tempBy("s5-anneal-2")).toEqual({ "95": false, "55": true, "72": false });
    expect(tempBy("s3-extend-1")).toEqual({ "95": false, "55": false, "72": true });
    expect(tempBy("s10-result")).toEqual({ "95": false, "55": false, "72": false });
  });

  it("5′/3′ 标注全程不省略：s0 可见行含 4 枚且反平行（上 5′左/下 3′左）；s10 全 8 行 32 枚可见", () => {
    const m0 = mountAt("s0-template");
    const rows0 = visibleRows(m0.rows);
    expect(rows0.length).toBe(1);
    const dirs0 = [...rows0[0].querySelectorAll<DirEl>(".pcr-dir")];
    expect(dirs0.length).toBe(4);
    const sideOf = Object.fromEntries(dirs0.map((t) => [t.getAttribute("data-side"), t.textContent]));
    expect(sideOf).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" });
    const allOn = m0.dirs.filter((t) => byeO(t));
    expect(allOn.length).toBe(4);

    const m10 = mountAt("s10-result");
    const onDirs10 = m10.rows.flatMap((r) => [...r.querySelectorAll<DirEl>(".pcr-dir")]).filter((t) => byeO(t));
    expect(onDirs10.length).toBe(8 * 4);
  });

  it("标注随链真实朝向翻转：母链 5′ 右（灰B/M1）→ 上标 3′左/5′右", () => {
    const laneRows = (id: string) => visibleRows(mountAt(id).rows).sort((a, b) => rowY(a) - rowY(b));
    const e3 = laneRows("s3-extend-1");
    expect(dirMap(e3[0])).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" }); // 灰A 5′左
    expect(dirMap(e3[1])).toEqual({ aL: "3′", aR: "5′", bL: "5′", bR: "3′" }); // 灰B 5′右 → 翻转
    const e4 = laneRows("s4-denature-2");
    expect(dirMap(e4[0])).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" }); // 灰A + M1
    expect(dirMap(e4[1])).toEqual({ aL: "3′", aR: "5′", bL: "5′", bR: "3′" }); // 灰B(上,5′右) + M2(下,5′左)
    const e7 = laneRows("s7-denature-3");
    expect(dirMap(e7[0])).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" });
    expect(dirMap(e7[1])).toEqual({ aL: "3′", aR: "5′", bL: "5′", bR: "3′" }); // M1(上,5′右) + S1
    expect(dirMap(e7[2])).toEqual({ aL: "3′", aR: "5′", bL: "5′", bR: "3′" }); // 灰B(上,5′右) + M2′
  });

  it("泳道两条链都是母链/模板：s1 双灰长（无新旧之分）±45 位移分开；s4/s7 下链为半保留合成链（蓝）", () => {
    // s1：两条原母链同为灰长（v5 核心：泳道两链皆模板，非「上母下新」）
    const s1 = mountAt("s1-denature-1");
    const vis1 = visibleRows(s1.rows);
    expect(vis1.length).toBe(1);
    const { up, down } = slotBands(vis1[0]);
    expect(up.getAttribute("fill")).toBe(GRAY);
    expect(down.getAttribute("fill")).toBe(GRAY);
    expect(Number(up.getAttribute("width"))).toBe(360);
    expect(Number(down.getAttribute("width"))).toBe(360);
    expect(Number(up.getAttribute("x"))).toBe(250);
    expect(elY(up)).toBe(-45);
    expect(elY(down)).toBe(45);
    expect(byeO(vis1[0].querySelector(".pcr-new"))).toBe(false); // 泳道无新链

    // s4：上链仍灰长、下链是上一轮新链（蓝中，作本轮模板），两条链都是模板
    const s4 = mountAt("s4-denature-2");
    const vis4 = visibleRows(s4.rows);
    const downXs: number[] = [];
    for (const r of vis4) {
      const sb = slotBands(r);
      expect(sb.up.getAttribute("fill")).toBe(GRAY);
      expect(Number(sb.up.getAttribute("width"))).toBe(360);
      expect(elY(sb.up)).toBe(-45);
      expect(sb.down.getAttribute("fill")).toBe(BLUE);
      expect(Number(sb.down.getAttribute("width"))).toBe(296);
      expect(elY(sb.down)).toBe(45);
      downXs.push(Number(sb.down.getAttribute("x")));
    }
    expect(downXs.sort((a, b) => a - b)).toEqual([250, 314]); // M1(左伸) 与 M2(右伸) 各一
  });

  it("泳道 s7：下链为上一轮新链（2 蓝中 + 2 蓝短），上链为模板（2 灰长 + 2 蓝中）；两链皆模板", () => {
    const { rows } = mountAt("s7-denature-3");
    const vis = visibleRows(rows).sort((a, b) => rowY(a) - rowY(b));
    expect(vis.length).toBe(4);
    const upW = vis.map((r) => Number(slotBands(r).up.getAttribute("width")));
    const downW = vis.map((r) => Number(slotBands(r).down.getAttribute("width")));
    expect(upW).toEqual([360, 296, 360, 296]);
    expect(downW).toEqual([296, 232, 296, 232]);
    const all = vis.flatMap(onBands);
    expect(all.length).toBe(8);
    expect(all.filter((b) => b.getAttribute("fill") === GRAY).length).toBe(2);
    expect(all.filter((b) => b.getAttribute("fill") === BLUE).length).toBe(6);
  });

  it("泳道原位纯垂直：变性池中心 = 上一轮延伸行中心（s3==s4、s6==s7、s0==s1）", () => {
    const centers = (id: string) => visibleRows(mountAt(id).rows).map(rowY).sort((a, b) => a - b);
    expect(centers("s3-extend-1")).toEqual(centers("s4-denature-2"));
    expect(centers("s6-extend-2")).toEqual(centers("s7-denature-3"));
    expect(centers("s0-template")).toEqual(centers("s1-denature-1"));
  });

  it("泳道净距：s7 相邻泳道链带边缘净距 ≥ 20（无重叠）", () => {
    const { rows } = mountAt("s7-denature-3");
    const vis = visibleRows(rows).sort((a, b) => rowY(a) - rowY(b));
    for (let i = 1; i < vis.length; i++) {
      const bandYs = (r: RowEl) => onBands(r).map((b) => rowY(r) + elY(b));
      const curMax = Math.max(...bandYs(vis[i - 1])) + 7;
      const nxtMin = Math.min(...bandYs(vis[i])) - 7;
      expect(nxtMin - curMax, `lane ${i - 1}->${i}`).toBeGreaterThanOrEqual(20);
    }
  });

  it("退火引物内嵌式：每链恰 1 支（s2=2/s5=4/s8=8）、几何 50px、5′ 内缩全在带内、3′ 端钉 314/546、贴各自链下方 14px", () => {
    for (const [id, want, lanes] of [["s2-anneal-1", 2, 1], ["s5-anneal-2", 4, 2], ["s8-anneal-3", 8, 4]] as const) {
      const { rows } = mountAt(id);
      const vis = visibleRows(rows);
      expect(vis.length).toBe(lanes);
      const onP = vis.flatMap((r) => [...r.querySelectorAll<RectEl>(".pcr-primer-L, .pcr-primer-R")].filter((p) => byeO(p)));
      expect(onP.length, id).toBe(want);
      for (const p of onP) {
        expect(Number(p.getAttribute("width")), "引物宽 50px").toBe(50);
        expect(Number(p.getAttribute("height")), "引物高 10px").toBe(10);
        const x = Number(p.getAttribute("x"));
        // 内嵌式（用户裁决延续 v4.4）：5′ 端全部在母链带内（250..610 内），不等悬垂
        expect(x, "引物 5′ 端 ≥ 带左缘 250").toBeGreaterThanOrEqual(250);
        expect(x + 50, "引物 5′ 端 ≤ 带右缘 610").toBeLessThanOrEqual(610);
        // 3′ 端钉在引物界定区：L 右缘 314 / R 右缘 596（内嵌式 5′ 端 264/546，全在带内）
        expect(x + 50 === 314 || x + 50 === 596, "3′ 端钉 314 或 596").toBe(true);
      }
      // 每泳道 2 支：一支贴上链下方(-31)、一支贴下链下方(+59)
      for (const r of vis) {
        expect(primerYs(r)).toEqual([-31, 59]);
      }
    }
    // 3′ 端钉锚：L 右缘=314、R 左缘=546；5′ 内缩 14px（L 左缘=264=250+14，R 右缘=596=610−14）
    const { rows } = mountAt("s2-anneal-1");
    const pL = rows[0].querySelector<RectEl>(".pcr-primer-L")!;
    const pR = rows[0].querySelector<RectEl>(".pcr-primer-R")!;
    expect(Number(pL.getAttribute("x"))).toBe(264);
    expect(Number(pL.getAttribute("x")) + Number(pL.getAttribute("width"))).toBe(314); // L 3′ 端
    expect(Number(pR.getAttribute("x"))).toBe(546); // R 3′ 端左缘
    expect(Number(pR.getAttribute("x")) + Number(pR.getAttribute("width"))).toBe(596); // 5′ 端 596 ≤ 610（内嵌）
    // s2 单泳道：上链灰A(5′左)→R 挂上侧下方、下链灰B(5′右)→L 挂下侧下方
    expect(byeO(pR)).toBe(true);
    expect(elY(pR)).toBe(-31);
    expect(byeO(pL)).toBe(true);
    expect(elY(pL)).toBe(59);
    // s5 row2（下槽 M2 5′左）：R 在下侧下方 +59
    const rows5 = visibleRows(mountAt("s5-anneal-2").rows).sort((a, b) => rowY(a) - rowY(b));
    expect(byeO(rows5[1].querySelector(".pcr-primer-L"))).toBe(true);
    expect(elY(rows5[1].querySelector(".pcr-primer-L")!)).toBe(-31);
    expect(byeO(rows5[1].querySelector(".pcr-primer-R"))).toBe(true);
    expect(elY(rows5[1].querySelector(".pcr-primer-R")!)).toBe(59);
  });

  it("延伸行「模板恒在 bandT(−8)、新链恒在下(+18)」锁死：s3/s6/s9/s10 每可见行 bandB 不可见", () => {
    for (const id of ["s3-extend-1", "s6-extend-2", "s9-extend-3", "s10-result"]) {
      const { rows } = mountAt(id);
      for (const r of visibleRows(rows)) {
        const bands = onBands(r);
        expect(bands.length, id + " 延伸行仅 bandT 可见").toBe(1);
        expect(elY(bands[0]), id).toBe(-8);
        const neu = visNew(r);
        expect(neu, id).toBeTruthy();
        expect(elY(neu!), id + " 新链在模板下方").toBe(18);
        expect(elY(neu!) > elY(bands[0]!), "新链不得出现在母链上方").toBe(true);
      }
    }
  });

  it("锚点生长：新链以引物 3′ 端为固定锚点、向母链 5′ 端方向宽度 0→全长", () => {
    const s3 = mountAt("s3-extend-1");
    const rows3 = visibleRows(s3.rows).sort((a, b) => rowY(a) - rowY(b));
    const span = (r: RowEl) => { const n = visNew(r)!; return [Number(n.getAttribute("x")), Number(n.getAttribute("width"))] as const; };
    // p=1 全宽：左伸 250..546 / 右伸 314..610（远端=母链 5′ 端）
    expect(span(rows3[0])).toEqual([250, 296]);
    expect(span(rows3[1])).toEqual([314, 296]);
    // p=0.5：锚点边固定（5′ 左锚 546 右端不变、5′ 右锚 314 左端不变），远端向 5′ 走一半
    renderAt(s3, 0.5);
    expect(span(rows3[0])[0] + span(rows3[0])[1]).toBe(546);
    expect(span(rows3[1])[0]).toBe(314);
    expect(span(rows3[0])[1]).toBe(148);
    // p=0：宽度 0，锚点位置保持（5′ 左锚边 x+w=546、5′ 右锚边 x=314）
    renderAt(s3, 0);
    expect(span(rows3[0])).toEqual([546, 0]);
    expect(span(rows3[1])).toEqual([314, 0]);

    // s6 短链：两中链模板（M1/M2，rows[1]/rows[3]）新链 314..546；p=0.5 锚边固定
    const s6 = mountAt("s6-extend-2");
    const rows6 = visibleRows(s6.rows).sort((a, b) => rowY(a) - rowY(b));
    renderAt(s6, 1);
    for (const r of [rows6[1], rows6[3]]) {
      const [x, w] = span(r);
      expect(x, "短链左缘").toBe(314);
      expect(x + w, "短链右缘").toBe(546);
    }
    renderAt(s6, 0.5);
    const x0 = span(rows6[1])[0];   // M1(5′右型) 锚 314
    const x1 = span(rows6[3])[0];   // M2(5′左型) 锚 546 右端
    expect(x0).toBe(314);
    expect(x1 + span(rows6[3])[1]).toBe(546);

    // 目标绿链同样锚点生长：p=1 → 314..546
    const s9 = mountAt("s9-extend-3");
    const target = visibleRows(s9.rows).find((r) => byeO(r.querySelector(".pcr-target-badge")))!;
    renderAt(s9, 1);
    const g = visNew(target)!;
    expect(g.getAttribute("fill")).toBe(GREEN);
    expect(Number(g.getAttribute("x"))).toBe(314);
    expect(Number(g.getAttribute("width"))).toBe(232);
  });

  it("中间产物链长：s3 两行灰长模板 + 蓝中新链（左伸/右伸各一）；s6 = 2 灰长→中 + 2 蓝中模板→短", () => {
    const { rows } = mountAt("s3-extend-1");
    const vis = visibleRows(rows).sort((a, b) => rowY(a) - rowY(b));
    expect(vis.length).toBe(2);
    for (const r of vis) {
      const [temp] = onBands(r);
      const neu = visNew(r)!;
      expect(temp!.getAttribute("fill")).toBe(GRAY);
      expect(Number(temp!.getAttribute("width"))).toBe(360);
      expect(neu.getAttribute("fill")).toBe(BLUE);
      expect(Number(neu.getAttribute("width"))).toBe(296);
    }
    const xs = vis.map((r) => Number(visNew(r)!.getAttribute("x"))).sort((a, b) => a - b);
    expect(xs).toEqual([250, 314]);

    const m6 = mountAt("s6-extend-2");
    const vis6 = visibleRows(m6.rows).sort((a, b) => rowY(a) - rowY(b));
    expect(vis6.length).toBe(4);
    const kinds = vis6.map((r) => {
      const [t] = onBands(r);
      return [t!.getAttribute("fill"), Number(t!.getAttribute("width")), Number(visNew(r)!.getAttribute("width"))] as const;
    });
    expect(kinds.filter((k) => k[0] === GRAY && k[1] === 360).length).toBe(2);       // 灰长→中
    const blueTemps = kinds.filter((k) => k[0] === BLUE && k[1] === 296);
    expect(blueTemps.length).toBe(2);
    for (const k of blueTemps) expect(k[2]).toBe(232);                               // 蓝中模板→短
  });

  it("目标行（s9/s10）：蓝短模板上 + 绿短下 + 双引物 + 角标", () => {
    for (const id of ["s9-extend-3", "s10-result"]) {
      const { rows, state } = mountAt(id);
      const targets = rows.filter((r) => byeO(r.querySelector(".pcr-target-badge")));
      expect(targets.length).toBe(state.targetCount);
      for (const r of targets) {
        const up = r.querySelector<RectEl>(".pcr-band")!; // bandT（bandB 关闭）
        const down = visNew(r)!; // 目标绿短链（.pcr-new）
        expect(up.getAttribute("fill")).toBe(BLUE);
        expect(Number(up.getAttribute("x"))).toBe(314);
        expect(Number(up.getAttribute("width"))).toBe(232);
        expect(elY(up)).toBe(-8);
        expect(down.getAttribute("fill")).toBe(GREEN);
        expect(Number(down.getAttribute("x"))).toBe(314);
        expect(Number(down.getAttribute("width"))).toBe(232);
        expect(elY(down)).toBe(18);
        expect(byeO(r.querySelector(".pcr-primer-L"))).toBe(true);
        expect(byeO(r.querySelector(".pcr-primer-R"))).toBe(true);
        expect(elY(r.querySelector(".pcr-primer-L")!)).toBe(6);
        expect(elY(r.querySelector(".pcr-primer-R")!)).toBe(6);
      }
    }
  });

  it("过渡产物数 s9：存在仅挂 L、仅挂 R 的延伸行，双双限定的目标行 = 2", () => {
    const { rows } = mountAt("s9-extend-3");
    const vis = visibleRows(rows);
    const extL = vis.filter((r) => byeO(r.querySelector(".pcr-primer-L")) && !byeO(r.querySelector(".pcr-primer-R")));
    const extR = vis.filter((r) => !byeO(r.querySelector(".pcr-primer-L")) && byeO(r.querySelector(".pcr-primer-R")));
    expect(extL.length).toBeGreaterThanOrEqual(1);
    expect(extR.length).toBeGreaterThanOrEqual(1);
    const both = vis.filter((r) => byeO(r.querySelector(".pcr-primer-L")) && byeO(r.querySelector(".pcr-primer-R")));
    expect(both.length).toBe(2);
  });

  it("目标行 5′/3′ 标注不重叠：s9 extBoth 行 aL/bL、aR/bR 上下错开 ≥ 24px", () => {
    const { rows } = mountAt("s9-extend-3");
    const both = rows.find((r) => byeO(r.querySelector(".pcr-target-badge")));
    expect(both).toBeTruthy();
    const yOf = (side: string) => elY(both!.querySelector(`[data-side="${side}"]`));
    expect(Math.abs(yOf("aL") - yOf("bL")), "左端 5′/3′ 错开").toBeGreaterThanOrEqual(24);
    expect(Math.abs(yOf("aR") - yOf("bR")), "右端 3′/5′ 错开").toBeGreaterThanOrEqual(24);
  });

  it("8 行档层位不互咬：s10 相邻行可见带外沿净距 ≥ 6px", () => {
    const { rows } = mountAt("s10-result");
    const vis = visibleRows(rows).sort((a, b) => rowY(a) - rowY(b));
    const spanLocal = (r: RowEl): [number, number] => {
      // 注意：badge 组的 rect 不做 opacity 自身显隐（由 g 控制），byeO 天然剔除——只算链带/新链/引物
      const rects = [...r.querySelectorAll<RectEl>(".pcr-band, .pcr-new, .pcr-primer-L, .pcr-primer-R")].filter((e) => byeO(e));
      const center = (e: RectEl) => Number(e.getAttribute("y")) + elY(e);
      const top = Math.min(...rects.map((e) => center(e) - Number(e.getAttribute("height")) / 2));
      const bot = Math.max(...rects.map((e) => center(e) + Number(e.getAttribute("height")) / 2));
      return [top, bot];
    };
    for (let i = 1; i < vis.length; i++) {
      const prevBot = rowY(vis[i - 1]) + spanLocal(vis[i - 1])[1];
      const nextTop = rowY(vis[i]) + spanLocal(vis[i])[0];
      expect(nextTop - prevBot, `8 行 row ${i - 1}->${i}`).toBeGreaterThanOrEqual(6);
    }
  });

  it("Taq 每分子 2 枚且只在延伸步骤：s2=0、s10=0；s3=4、s6=8、s9=16（taq1 守锚点 y=18、taq2 守模板 3′ 端 y=-8）", () => {
    expect(taqPos(mountAt("s2-anneal-1")).length).toBe(0);
    expect(taqPos(mountAt("s10-result")).length).toBe(0);
    for (const [id, want] of [["s3-extend-1", 4], ["s6-extend-2", 8], ["s9-extend-3", 16]] as const) {
      const pos = taqPos(mountAt(id));
      expect(pos.length, id).toBe(want);
      // 每行 2 枚：一枚守新链锚点（x∈{314,546}、y=18），一枚守模板 3′ 端（y=-8，x=锚点侧 ±16 或带缘）
      const byY: Record<string, number[]> = { "18": [], "-8": [] };
      for (const [x, y] of pos) byY[String(y)].push(x);
      expect(byY["18"].length, id + " taq1 数").toBe(want / 2);
      expect(byY["-8"].length, id + " taq2 数").toBe(want / 2);
      for (const x of byY["18"]) {
        expect([314, 546].includes(x), "taq1 守新链锚点").toBe(true);
      }
      // taq2 位于对应模板 3′ 端：5′ 左型(锚546) → 模板右缘 610+16=626 或 546+16=562；5′ 右型(锚314) → 左缘 250-16=234 或 314-16=298
      for (const x of byY["-8"]) {
        expect([234, 298, 562, 626].includes(x), "taq2 守模板 3′ 端带外").toBe(true);
      }
    }
  });

  it("图例计五项含 Taq 聚合酶：#8b5cf6 紫色（课本图 3-5，色相预算豁免）", () => {
    const { scene } = mountAt("s0-template");
    const legend = scene.legend ?? [];
    expect(legend.length).toBe(5);
    const taq = legend.find((l) => l.label === "Taq 聚合酶");
    expect(taq?.color).toBe(TAQ);
    const { container } = mountAt("s3-extend-1");
    const circ = container.querySelector(".pcr-taq circle");
    expect(circ?.getAttribute("fill")).toBe(TAQ);
  });

  it("目标产物：角标数 = targetCount（s9/s10 为 2、s8 为 0），目标带绿色", () => {
    expect(visibleRows(mountAt("s8-anneal-3").rows).flatMap((r) => [...r.querySelectorAll(".pcr-target-badge")]).filter((b) => byeO(b)).length).toBe(0);
    for (const id of ["s9-extend-3", "s10-result"]) {
      const m = mountAt(id);
      const onBadges = m.rows.flatMap((r) => [...r.querySelectorAll(".pcr-target-badge")]).filter((b) => byeO(b));
      expect(onBadges.length).toBe(m.state.targetCount);
    }
    const m9 = mountAt("s9-extend-3");
    const targetBand = visibleRows(m9.rows).flatMap((r) => [...r.querySelectorAll<RectEl>(".pcr-new")].filter((b) => byeO(b))).find((b) => byeO(b) && b.getAttribute("fill") === GREEN);
    expect(targetBand).toBeTruthy();
  });

  it("计数徽章：s9/s10 显示「目标产物 ×2」，s0 隐藏", () => {
    for (const id of ["s9-extend-3", "s10-result"]) {
      const { clearBadge, state } = mountAt(id);
      expect(clearBadge!.style.display).not.toBe("none");
      expect(clearBadge!.textContent).toContain(`×${state.targetCount}`);
    }
    const s0 = mountAt("s0-template");
    expect(s0.clearBadge!.style.display).toBe("none");
  });

  it("温度牌走 opacity 通道（无 display 硬切）", () => {
    const { temps } = mountAt("s1-denature-1");
    for (const t of temps) expect(t.style.display).not.toBe("none");
  });
});
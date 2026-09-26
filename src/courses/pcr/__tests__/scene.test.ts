/**
 * PCR 场景测试（v6 反平行语义版，方案 .proposals/2026-09-26-002-pcr-v6-rebuild.html，已批准）。
 *
 * 测试职责分工：几何/数量/颜色类由断言强制；直观性/语义类（反平行观感、切换无瞬切）以用户目检为准。
 * 本文件不测：addEvent 无关的样式细节（颜色仅测 fill 色值）、Taq（v6 已彻底移除，另有专项用例）。
 */
import { describe, expect, it } from "vitest";
import { createPcrScene } from "../scene";
import { pcrCourse } from "../data";

const GRAY = "#64748b";
const BLUE = "#2563eb";
const ORANGE = "#f59e0b";
const GREEN = "#22c55e";

type RowEl = SVGGElement;
type RectEl = SVGRectElement;
type DirEl = SVGTextElement;

/** 挂载某 stage 并渲染，返回句柄 */
function mountAt(id: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const scene = createPcrScene();
  scene.mount(container);
  const svg = container.querySelector("svg")!;
  const stage = pcrCourse.stages.find((s) => s.id === id)!;
  scene.render(stage.sceneState);
  return {
    scene,
    container,
    svg,
    rows: [...svg.querySelectorAll<RowEl>(".pcr-row")],
    dirs: [...svg.querySelectorAll<DirEl>(".pcr-dir")],
    temps: [...svg.querySelectorAll<SVGGElement>(".temp-tab")],
    markers: [...svg.querySelectorAll<SVGGElement>(".pcr-target-mark")],
    clearBadge: container.querySelector<HTMLElement>(".pcr-clear-badge"),
    state: stage.sceneState,
  };
}

/** 以给定 extensionProgress 重渲染（锚点生长中间帧），返回同一行元素引用 */
function renderAt(m: ReturnType<typeof mountAt>, p: number): void {
  m.scene.render({ ...m.state, extensionProgress: p });
}

/** 可见行：行容器 opacity=1 */
function visibleRows(rows: RowEl[]): RowEl[] {
  return rows.filter((r) => r.style.opacity === "1");
}

function rowY(g: RowEl): number {
  const mm = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec(g.style.transform);
  return mm ? Number(mm[1]) : 0;
}

function elY(e: Element | null): number {
  if (!e) return 0;
  const mm = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec((e as unknown as ElementCSSInlineStyle).style.transform);
  return mm ? Number(mm[1]) : 0;
}

function byeO(e: Element | null): boolean {
  return !!e && (e as unknown as ElementCSSInlineStyle).style.opacity === "1";
}

/** 行内可见链带（.pcr-band）——不含引物/合成段/橙段 cap */
function onBands(row: RowEl): RectEl[] {
  return [...row.querySelectorAll<RectEl>(".pcr-band")].filter((b) => byeO(b));
}

/** 行内可见新生链（.pcr-new 中 on 者）；延伸行必有，其余为空 */
function visNew(row: RowEl): RectEl | null {
  return [...row.querySelectorAll<RectEl>(".pcr-new")].find((n) => byeO(n)) ?? null;
}

/** 行内可见橙段 cap（.pcr-cap 中 on 者）——合成链 5′ 端橙段 */
function visCaps(row: RowEl): RectEl[] {
  return [...row.querySelectorAll<RectEl>(".pcr-cap")].filter((c) => byeO(c));
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

/** 行内可见引物的 translateY 列表（升序） */
function primerYs(row: RowEl): number[] {
  return [...row.querySelectorAll<RectEl>(".pcr-primer-L, .pcr-primer-R")].filter((p) => byeO(p)).map((p) => elY(p)).sort((a, b) => a - b);
}

/** 可见引物几何：{x, w, five}，five = 5′ 端坐标（L 引物 = x、R 引物 = x+w） */
function primerGeos(row: RowEl): Array<{ x: number; w: number; five: number }> {
  return [...row.querySelectorAll<RectEl>(".pcr-primer-L, .pcr-primer-R")]
    .filter((p) => byeO(p))
    .map((p) => {
      const x = Number(p.getAttribute("x"));
      const w = Number(p.getAttribute("width"));
      const five = p.classList.contains("pcr-primer-L") ? x : x + w;
      return { x, w, five };
    });
}

/** 可见目标框（.pcr-target-mark g 中 on 者）→ 所在行 */
function visTargets(m: ReturnType<typeof mountAt>): RowEl[] {
  return visibleRows(m.rows).filter((r) => byeO(r.querySelector(".pcr-target-mark")));
}

/** 每行可见元素垂直包络 [top, bottom]（相对行中心）；含 marker 框（其 y/h 是绝对属性） */
function rowSpan(row: RowEl): [number, number] {
  const parts: Array<[number, number]> = [];
  const own = [...row.querySelectorAll<RectEl>(".pcr-band, .pcr-cap, .pcr-new, .pcr-primer-L, .pcr-primer-R")].filter((e) => byeO(e));
  for (const e of own) parts.push([elY(e) - Number(e.getAttribute("height")) / 2, elY(e) + Number(e.getAttribute("height")) / 2]);
  const mg = row.querySelector<SVGGElement>(".pcr-target-mark");
  if (mg && byeO(mg)) {
    const mr = mg.querySelector<RectEl>("rect")!;
    parts.push([Number(mr.getAttribute("y")), Number(mr.getAttribute("y")) + Number(mr.getAttribute("height"))]);
  }
  return [Math.min(...parts.map((p) => p[0])), Math.max(...parts.map((p) => p[1]))];
}

describe("PCR 场景（v6 反平行语义）", () => {
  it("元素池零增删：s0 与 s10 两次渲染后 SVG 元素总数不变且 > 90", () => {
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

  it("温度牌三枚常驻；s1 高亮 95、s5 高亮 55、s3 高亮 72、s10 全灭", () => {
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

  it("5′/3′ 标注全程不省略：s0 可见行 4 枚且反平行（上 5′左/下 3′左）；s10 全 8 行 32 枚可见", () => {
    const step = pcrCourse.stages.find((s) => s.id === "s0-template")!; // 0.1s 播放不动画，仅验证静态帧
    expect(step).toBeTruthy();
    const m0 = mountAt("s0-template");
    const rows0 = visibleRows(m0.rows);
    expect(rows0.length).toBe(1);
    const dirs0 = [...rows0[0].querySelectorAll<DirEl>(".pcr-dir")];
    expect(dirs0.length).toBe(4);
    const sideOf = Object.fromEntries(dirs0.map((t) => [t.getAttribute("data-side"), t.textContent]));
    expect(sideOf).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" }); // A 5′ 左 / B 3′ 左（反平行）
    expect(m0.dirs.filter((t) => byeO(t)).length).toBe(4);

    const m10 = mountAt("s10-result");
    const onDirs10 = m10.rows.flatMap((r) => [...r.querySelectorAll<DirEl>(".pcr-dir")]).filter((t) => byeO(t));
    expect(onDirs10.length).toBe(8 * 4);
  });

  it("标注随链真实朝向翻转（反平行核心）：母链 5′ 右 → 上标 3′左/5′右；新链反平行、随模板几何", () => {
    const laneRows = (id: string) => visibleRows(mountAt(id).rows).sort((a, b) => rowY(a) - rowY(b));
    const e3 = laneRows("s3-extend-1");
    // 第 1 轮：A（5′ 左）模板 → 新链 A′ 3′ 在左（贴模板 5′ 端 224）；B（5′ 右）→ 新链 B′ 5′ 在左
    expect(dirMap(e3[0])).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" });
    expect(dirMap(e3[1])).toEqual({ aL: "3′", aR: "5′", bL: "5′", bR: "3′" });
    const e4 = laneRows("s4-denature-2");
    expect(dirMap(e4[0])).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" }); // A + A′
    expect(dirMap(e4[1])).toEqual({ aL: "3′", aR: "5′", bL: "5′", bR: "3′" }); // B + B′
    const e7 = laneRows("s7-denature-3");
    expect(dirMap(e7[0])).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" }); // A + A²
    expect(dirMap(e7[1])).toEqual({ aL: "3′", aR: "5′", bL: "5′", bR: "3′" }); // A′ + A″
    expect(dirMap(e7[2])).toEqual({ aL: "3′", aR: "5′", bL: "5′", bR: "3′" }); // B + B²
    expect(dirMap(e7[3])).toEqual({ aL: "5′", aR: "3′", bL: "3′", bR: "5′" }); // B′ + B″
  });

  it("泳道两条链都是母链/模板：s1 双灰长（无新旧之分）±45 位移分开；s4 下链为半保留合成链（蓝段+橙段）", () => {
    const s1 = mountAt("s1-denature-1");
    const vis1 = visibleRows(s1.rows);
    expect(vis1.length).toBe(1);
    const { up, down } = slotBands(vis1[0]);
    expect(up.getAttribute("fill")).toBe(GRAY);
    expect(down.getAttribute("fill")).toBe(GRAY);
    expect(Number(up.getAttribute("x"))).toBe(224);
    expect(Number(up.getAttribute("width"))).toBe(392);
    expect(elY(up)).toBe(-45);
    expect(elY(down)).toBe(45);
    expect(visNew(vis1[0])).toBeNull();

    const s4 = mountAt("s4-denature-2");
    const vis4 = visibleRows(s4.rows).sort((a, b) => rowY(a) - rowY(b));
    // 行 1：A（上，灰）+ A′（下，橙 568..592 + 蓝 224..568）
    const r1 = slotBands(vis4[0]);
    expect(r1.up.getAttribute("fill")).toBe(GRAY);
    expect(r1.down.getAttribute("fill")).toBe(BLUE);
    expect(Number(r1.down.getAttribute("x"))).toBe(224);
    expect(Number(r1.down.getAttribute("width"))).toBe(344);
    const caps1 = visCaps(vis4[0]);
    expect(caps1.length).toBe(1);
    expect(Number(caps1[0].getAttribute("x"))).toBe(568);
    // 行 2：B（上，灰）+ B′（下，橙 248..272 + 蓝 272..616）
    const r2 = slotBands(vis4[1]);
    expect(r2.up.getAttribute("fill")).toBe(GRAY);
    expect(r2.down.getAttribute("fill")).toBe(BLUE);
    expect(Number(r2.down.getAttribute("x"))).toBe(272);
    expect(Number(r2.down.getAttribute("width"))).toBe(344);
    const caps2 = visCaps(vis4[1]);
    expect(Number(caps2[0].getAttribute("x"))).toBe(248);
  });

  it("泳道原位纯垂直：退火不位移链（s1==s2、s4==s5、s7==s8 同层）；s3==s4、s6==s7 行中心不移动", () => {
    const pairOf = (id: string) => {
      const { rows } = mountAt(id);
      return visibleRows(rows).sort((a, b) => rowY(a) - rowY(b)).map((r) => {
        const { up, down } = slotBands(r);
        return [elY(up), elY(down)];
      });
    };
    expect(pairOf("s1-denature-1")).toEqual(pairOf("s2-anneal-1"));
    expect(pairOf("s4-denature-2")).toEqual(pairOf("s5-anneal-2"));
    expect(pairOf("s7-denature-3")).toEqual(pairOf("s8-anneal-3"));

    const cy = (id: string) => visibleRows(mountAt(id).rows).map(rowY).sort((a, b) => a - b);
    expect(cy("s3-extend-1")).toEqual(cy("s4-denature-2"));
    expect(cy("s6-extend-2")).toEqual(cy("s7-denature-3"));
    expect(cy("s0-template")).toEqual(cy("s1-denature-1"));
  });

  it("泳道净距 ≥ 20：4 行档上下带（±45）相邻行跨行间距不咬合", () => {
    for (const id of ["s7-denature-3", "s8-anneal-3"]) {
      const rows = visibleRows(mountAt(id).rows).sort((a, b) => rowY(a) - rowY(b));
      for (let i = 1; i < rows.length; i++) {
        const { down } = slotBands(rows[i - 1]);
        const { up } = slotBands(rows[i]);
        const gap = rowY(rows[i]) + elY(up) - Number(up.getAttribute("height")) / 2 - (rowY(rows[i - 1]) + elY(down) + Number(down.getAttribute("height")) / 2);
        expect(gap, `${id} row ${i - 1}->${i}`).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("退火引物反平行减短：总数 2→4→8（s2/s5/s8）；5′ 端贴模板 3′ 端内侧 24px、3′ 端朝内", () => {
    const countOf = (id: string) => {
      const { rows } = mountAt(id);
      return visibleRows(rows).flatMap((r) => primerGeos(r));
    };
    expect(countOf("s2-anneal-1").length).toBe(2);
    expect(countOf("s5-anneal-2").length).toBe(4);
    expect(countOf("s8-anneal-3").length).toBe(8);

    const s2 = mountAt("s2-anneal-1");
    const row0 = visibleRows(s2.rows)[0];
    expect(primerYs(row0)).toEqual([-31, 59]); // ±45+14：贴链下方
    const geos = primerGeos(row0).sort((a, b) => a.x - b.x);
    // B 链（下，3′ 端 224）→ 引物 L 248..272，5′ 端 248 = 224+24
    expect(geos[0]).toEqual({ x: 248, w: 24, five: 248 });
    // A 链（上，3′ 端 616）→ 引物 R 568..592，5′ 端 592 = 616−24
    expect(geos[1]).toEqual({ x: 568, w: 24, five: 592 });
  });

  it("延伸行锁死：模板 bandT(−8)、新链/引物 (+18)、bandB 不可见；锚点生长锚=引物 3′ 端", () => {
    const m = mountAt("s3-extend-1");
    const rows = visibleRows(m.rows).sort((a, b) => rowY(a) - rowY(b));
    for (const r of rows) {
      expect(byeO(r.querySelector(".pcr-band"))).toBe(true);
      expect(elY(r.querySelector(".pcr-band"))).toBe(-8);
      expect(byeO(r.querySelector(".pcr-new"))).toBe(true);
      expect(elY(r.querySelector(".pcr-new"))).toBe(18);
      const onPrimers = [...r.querySelectorAll<RectEl>(".pcr-primer-L, .pcr-primer-R")].filter((p) => byeO(p));
      expect(onPrimers.length).toBe(1);
      expect(elY(onPrimers[0])).toBe(18);
      expect(onBands(r).length).toBe(1); // 无 bandB
      expect(visNew(r)).not.toBeNull();
      expect(r.querySelectorAll(".pcr-taq").length).toBe(0);
    }
  });

  it("锚点生长 + 反平行：引物 3′ 端锚点固定（A 行锚 568 左伸、B 行锚 272 右伸）→ p=1 配满全长", () => {
    const m = mountAt("s3-extend-1");
    const rows = visibleRows(m.rows).sort((a, b) => rowY(a) - rowY(b));
    const aNew = visNew(rows[0])!; // A 行
    const bNew = visNew(rows[1])!; // B 行

    renderAt(m, 0.5);
    expect(Number(aNew.getAttribute("x"))).toBe(568 - Math.round(344 * 0.5)); // 锚 568，左伸
    expect(Number(bNew.getAttribute("x"))).toBe(272); // 锚 272，右伸
    expect(Number(aNew.getAttribute("width"))).toBe(Math.round(344 * 0.5));
    expect(Number(bNew.getAttribute("width"))).toBe(Math.round(344 * 0.5));

    renderAt(m, 0);
    expect(Number(aNew.getAttribute("width"))).toBe(0);
    expect(Number(aNew.getAttribute("x"))).toBe(568); // 零长仍钉在锚点（引物 3′ 端）
    expect(Number(bNew.getAttribute("width"))).toBe(0);
    expect(Number(bNew.getAttribute("x"))).toBe(272);

    renderAt(m, 1);
    expect(Number(aNew.getAttribute("x"))).toBe(224);
    expect(Number(aNew.getAttribute("width"))).toBe(344);
    expect(Number(bNew.getAttribute("x"))).toBe(272);
    expect(Number(bNew.getAttribute("width"))).toBe(344);
  });

  it("中间产物（s3/s6/s9 链组成）：全部配满模板全长；s6/s9 各模板行蓝段长度与位置正确", () => {
    // s3：A→A′ 蓝 224..568（344）、B→B′ 蓝 272..616（344）
    const s3 = mountAt("s3-extend-1");
    const s3r = visibleRows(s3.rows).sort((a, b) => rowY(a) - rowY(b));
    expect(Number(visNew(s3r[0])!.getAttribute("x"))).toBe(224);
    expect(Number(visNew(s3r[0])!.getAttribute("width"))).toBe(344);
    expect(Number(visNew(s3r[1])!.getAttribute("x"))).toBe(272);
    expect(Number(visNew(s3r[1])!.getAttribute("width"))).toBe(344);

    // s6：4 行 A、A′、B、B′ → A²、A″、B²、B″
    const s6 = mountAt("s6-extend-2");
    const s6r = visibleRows(s6.rows).sort((a, b) => rowY(a) - rowY(b));
    const expS6: Array<[number, number]> = [
      [224, 344], // A→A²
      [272, 320], // A′→A″（正确长度）
      [272, 344], // B→B²
      [248, 320], // B′→B″（正确长度）
    ];
    expS6.forEach(([x, w], i) => {
      expect(Number(visNew(s6r[i])!.getAttribute("x")), `s6 row ${i}`).toBe(x);
      expect(Number(visNew(s6r[i])!.getAttribute("width")), `s6 row ${i}`).toBe(w);
    });
    // s6 合成链模板橙段位置：A′ 行 cap 568（右侧）、B′ 行 cap 248（左侧）
    expect(visCaps(s6r[1]).map((c) => Number(c.getAttribute("x")))).toEqual([568]);
    expect(visCaps(s6r[3]).map((c) => Number(c.getAttribute("x")))).toEqual([248]);
  });

  it("目标产物（绿虚线框）：仅 s9/s10 出现 2 个，位于行 4（A″）与行 8（B″）；s8 无框", () => {
    const markersAt = (id: string) => {
      const m = mountAt(id);
      return visTargets(m).map((r) => rowY(r)).sort((a, b) => a - b);
    };
    expect(markersAt("s8-anneal-3").length).toBe(0);
    const ys9 = markersAt("s9-extend-3");
    expect(ys9.length).toBe(2);
    expect(ys9[0]).toBe(208); // 8 行档 [52..416 步 52]，行 4 = 52+3×52 = 208（A″）
    expect(ys9[1]).toBe(416); // 行 8 = B″
    expect(markersAt("s10-result")).toEqual(ys9);

    // 框几何：240..600 包住靶区 248..592，垂直 −16..25 包住模板(−8)与新链(+18)
    const m9 = mountAt("s9-extend-3");
    const rows9 = visibleRows(m9.rows).sort((a, b) => rowY(a) - rowY(b));
    const targetRows = rows9.filter((r) => byeO(r.querySelector(".pcr-target-mark")));
    for (const r of targetRows) {
      const rect = r.querySelector<RectEl>(".pcr-target-mark rect")!;
      expect(Number(rect.getAttribute("x"))).toBe(240);
      expect(Number(rect.getAttribute("width"))).toBe(360);
      expect(Number(rect.getAttribute("y"))).toBe(-16);
      expect(Number(rect.getAttribute("height"))).toBe(41);
      expect(rect.getAttribute("stroke")).toBe(GREEN);
      expect(rect.getAttribute("stroke-dasharray")).toBe("7 4");
    }
  });

  it("目标判据（v6 核心）：目标行模板 = 橙段 248..272 + 蓝段 272..592（A″）/ 橙段 568..592 + 蓝段 248..568（B″）；新链配满后两端恰好到两引物 5′ 端", () => {
    const m = mountAt("s9-extend-3");
    const rows = visibleRows(m.rows).sort((a, b) => rowY(a) - rowY(b));
    const aD = rows[3]; // A″ 行
    const bD = rows[7]; // B″ 行

    // A″ 模板：bandT 蓝 272..592、cap 橙 248..272；引物 R（568..592）
    expect(Number(aD.querySelector(".pcr-band")!.getAttribute("x"))).toBe(272);
    expect(Number(aD.querySelector(".pcr-band")!.getAttribute("width"))).toBe(320);
    expect(visCaps(aD).map((c) => Number(c.getAttribute("x")))).toEqual([248]);
    const aP = primerGeos(aD);
    expect(aP.length).toBe(1);
    expect(aP[0].x).toBe(568);
    const aN = visNew(aD)!; // 蓝 248..568
    expect(Number(aN.getAttribute("x"))).toBe(248);
    expect(Number(aN.getAttribute("width"))).toBe(320);
    // A″ 分子两端 = 248（引物 L 5′ 端）与 592（蓝段右 568 + 引物 R 宽 24）→ 正确长度判据
    expect(Number(aN.getAttribute("x"))).toBe(248);
    expect(Number(aN.getAttribute("x")) + Number(aN.getAttribute("width")) + 24).toBe(592);

    // B″ 模板：bandT 蓝 248..568、cap 橙 568..592；引物 L（248..272）
    expect(Number(bD.querySelector(".pcr-band")!.getAttribute("x"))).toBe(248);
    expect(Number(bD.querySelector(".pcr-band")!.getAttribute("width"))).toBe(320);
    expect(visCaps(bD).map((c) => Number(c.getAttribute("x")))).toEqual([568]);
    const bP = primerGeos(bD);
    expect(bP.length).toBe(1);
    expect(bP[0].x).toBe(248);
    const bN = visNew(bD)!; // 蓝 272..592
    expect(Number(bN.getAttribute("x"))).toBe(272);
    expect(Number(bN.getAttribute("width"))).toBe(320);
    // B″ 分子两端 = 248（引物 L 5′）与 592（蓝段右端）——正确长度
    expect(Number(bN.getAttribute("x")) - 24).toBe(248);
    expect(Number(bN.getAttribute("x")) + Number(bN.getAttribute("width"))).toBe(592);
  });

  it("方向标注 x 贴链端：5′/3′ 文本中心距链端 11px，翻转向随链真实朝向", () => {
    const m = mountAt("s3-extend-1");
    const rows = visibleRows(m.rows).sort((a, b) => rowY(a) - rowY(b));
    const rA = rows[0]; // A：5′ 224 / 3′ 616 → aL=5′@235、aR=3′@605
    const dA = [...rA.querySelectorAll<DirEl>(".pcr-dir")];
    const mA = Object.fromEntries(dA.map((t) => [t.getAttribute("data-side"), { t: t.textContent, x: Number(t.getAttribute("x")) }]));
    expect(mA.aL).toEqual({ t: "5′", x: 224 + 11 });
    expect(mA.aR).toEqual({ t: "3′", x: 616 - 11 });
    // 新链 A′：5′ 592（引物 R 5′ 端）/ 3′ 224（模板 5′ 端同侧）→ bL=3′@235、bR=5′@581
    expect(mA.bL).toEqual({ t: "3′", x: 224 + 11 });
    expect(mA.bR).toEqual({ t: "5′", x: 592 - 11 });
    // B 行翻转：bL=5′@259（248+11）、bR=3′@605（616−11）
    const dB = [...rows[1].querySelectorAll<DirEl>(".pcr-dir")];
    const mB = Object.fromEntries(dB.map((t) => [t.getAttribute("data-side"), { t: t.textContent, x: Number(t.getAttribute("x")) }]));
    expect(mB.bL).toEqual({ t: "5′", x: 248 + 11 });
    expect(mB.bR).toEqual({ t: "3′", x: 616 - 11 });
  });

  it("反平行定量：每行可见引物 5′ 端与模板（下链/模板）3′ 端差恰 24px（内缩贴端）", () => {
    const m = mountAt("s6-extend-2");
    const rows = visibleRows(m.rows).sort((a, b) => rowY(a) - rowY(b));
    const e = primerGeos(rows[0])[0]; // A（3′ 616）→ R 引物 5′ 端 592
    expect(e.five).toBe(616 - 24);
    const e2 = primerGeos(rows[1])[0]; // A′（3′ 224）→ L 引物 5′ 端 248
    expect(e2.five).toBe(224 + 24);
  });

  it("新链 3′ 端与模板 5′ 端同侧（p=1 远端 = 模板 fiveOf）：A→224、B→616、A′→592、B′→248", () => {
    const m6 = mountAt("s6-extend-2");
    const rows = visibleRows(m6.rows).sort((a, b) => rowY(a) - rowY(b));
    // A_SPEC: five 224 → 新链 3′ 端在左缘 224（A 行向后即左伸锚 568）
    const nA = visNew(rows[0])!;
    expect(Number(nA.getAttribute("x"))).toBe(224);
    // B_SPEC: five 616 → 新链 3′ 端在右缘 616
    const nB = visNew(rows[2])!;
    expect(Number(nB.getAttribute("x")) + Number(nB.getAttribute("width"))).toBe(616);
    // A′: five 592 → 新链 3′ 端在右缘 592
    const nAp = visNew(rows[1])!;
    expect(Number(nAp.getAttribute("x")) + Number(nAp.getAttribute("width"))).toBe(592);
    // B′: five 248 → 新链 3′ 端在左缘 248
    const nBp = visNew(rows[3])!;
    expect(Number(nBp.getAttribute("x"))).toBe(248);
  });

  it("8 行档层位不互咬 ≥ 6：含目标框/marker、橙段 cap、引物、合成段（s9）", () => {
    const m = mountAt("s9-extend-3");
    const rows = visibleRows(m.rows).sort((a, b) => rowY(a) - rowY(b));
    for (let i = 1; i < rows.length; i++) {
      const [, prevBot] = rowSpan(rows[i - 1]);
      const [nextTop] = rowSpan(rows[i]);
      const gap = rowY(rows[i]) + nextTop - (rowY(rows[i - 1]) + prevBot);
      expect(gap, `row ${i - 1}->${i}`).toBeGreaterThanOrEqual(6);
    }
  });

  it("Taq 彻底移除：无 .pcr-taq 元素、场景内无紫色 (#8b5cf6)；其他课程紫色不受影响（不查 DOM）", () => {
    const m = mountAt("s9-extend-3");
    expect(m.container.querySelectorAll(".pcr-taq").length).toBe(0);
    const fills = [...m.container.querySelectorAll<SVGElement>("svg *")].map((e) => e.getAttribute("fill")).filter(Boolean);
    expect(fills.some((f) => f === "#8b5cf6")).toBe(false);
  });

  it("计数徽章：s3/s6/s9/s10 显示「目标产物 0（2¹−2）/0（2²−4）/2（2³−2×3）」，s0 隐藏", () => {
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
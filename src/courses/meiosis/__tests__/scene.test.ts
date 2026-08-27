/**
 * 减数分裂场景测试（固定 8 杆模型 · 段 1）：
 * 元素模型、阶段 1~2（未复制/复制 X 形）、交互与布局不变式。
 * 段 2/3/4 将逐阶段追加槽位断言与不变式矩阵。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMeiosisScene, slotsFor, usableRadius, CELL_CENTERS, CELL_RADIUS } from "../scene";
import { meiosisCourse, oogenesisCourse } from "../data";
import type { MeiosisState } from "../data";

/** 构造场景状态（默认精原细胞；stage 必填以驱动槽位表） */
const st = (over: Partial<MeiosisState> & { stage: string }): MeiosisState => ({
  cells: 1, replicated: false, pairing: false, crossingOver: false,
  equatorial: "none", separating: "none", spermShape: false,
  ...over,
});

describe("减数分裂场景（固定 8 杆模型）", () => {
  let host: HTMLDivElement;
  const scene = createMeiosisScene();

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    scene.mount(host);
  });
  afterEach(() => {
    scene.destroy();
    host.remove();
    location.hash = "";
  });

  /** 取指定单体的组元素 */
  const chromatid = (key: string) =>
    host.querySelector<SVGGElement>(`.chromatid.chromo-${key}`)!;

  it("挂载后包含 8 根染色单体，每根 = 杆 + 着丝点 + 标注（零增删元素模型）", () => {
    expect(host.querySelectorAll(".chromatid").length).toBe(8);
    host.querySelectorAll<SVGGElement>(".chromatid").forEach((g) => {
      expect(g.querySelectorAll("path").length).toBe(1);
      expect(g.querySelector("circle.centro")).toBeTruthy();
      expect(g.querySelector("text.gene-label")).toBeTruthy();
    });
    expect(host.querySelector(".scene-controls")).toBeTruthy();
  });

  it("阶段 1 精原细胞：姐妹单体完全重叠（未复制 = 同位同角）", () => {
    scene.render(st({ stage: "spermatogonium" }));
    const a = chromatid("A1a");
    const b = chromatid("A1b");
    // 姐妹两杆 transform 完全一致（重叠），且无旋转
    expect(a.style.transform).toBe(b.style.transform);
    expect(a.style.transform).toContain("rotate(0deg)");
    // 四条染色体分居四象限：极坐标分量 ±40 → A1 左下(360,240)、A2 右下(440,240)、B1 左上(360,160)、B2 右上(440,160)
    expect(a.style.transform).toContain("translate(360px, 240px)");
    expect(chromatid("A2a").style.transform).toContain("translate(440px, 240px)");
    expect(chromatid("B1a").style.transform).toContain("translate(360px, 160px)");
    expect(chromatid("B2a").style.transform).toContain("translate(440px, 160px)");
  });

  it("阶段 2 间期：姐妹单体原地张开成 X（±11° 同位）", () => {
    scene.render(st({ stage: "interphase" }));
    const a = chromatid("A1a");
    const b = chromatid("A1b");
    expect(a.style.transform).toContain("rotate(-11deg)");
    expect(b.style.transform).toContain("rotate(11deg)");
    // 同位：translate 部分完全一致
    expect(a.style.transform.split("rotate")[0]).toBe(b.style.transform.split("rotate")[0]);
    // 四对 X 均在原散布位
    expect(a.style.transform).toContain("translate(360px, 240px)");
  });

  it("基因标注开关：本体显隐同步（副本元素已合并为单标注）", () => {
    scene.render(st({ stage: "interphase" }));
    const input = host.querySelector<HTMLInputElement>(".scene-controls input")!;
    input.checked = true;
    input.dispatchEvent(new Event("change"));
    expect(chromatid("A1a").querySelector("text.gene-label")!.getAttribute("visibility")).toBe("visible");
    input.checked = false;
    input.dispatchEvent(new Event("change"));
    expect(chromatid("A1a").querySelector("text.gene-label")!.getAttribute("visibility")).toBe("hidden");
  });

  it("点击染色体显示气泡，再次 render 后隐藏", () => {
    scene.render(st({ stage: "interphase", replicated: true }));
    const bubble = host.querySelector<HTMLDivElement>(".chromo-bubble")!;
    expect(bubble.style.display).toBe("none");
    chromatid("A1a").dispatchEvent(new Event("click"));
    expect(bubble.style.display).toBe("block");
    expect(bubble.textContent).toContain("姐妹染色单体");
    scene.render(st({ stage: "spermatogonium" }));
    expect(bubble.style.display).toBe("none");
  });

  it("场景控件栏提供模式切换按钮", () => {
    expect(host.querySelector<HTMLButtonElement>(".mode-switch")!.textContent).toBe("切换到卵细胞形成");
  });

  it("阶段7 减Ⅱ中期：两细胞各 2 个 X 并排居中赤道板", () => {
    scene.render(st({ stage: "metaphase-II", replicated: true, cells: 2, equatorial: "single" }));
    // 左细胞 (215,200)：A1(202,200) B2(228,200)；右细胞 (585,200)：B1(572,200) A2(598,200)
    expect(chromatid("A1a").style.transform).toContain("translate(202px, 200px)");
    expect(chromatid("A1a").style.transform).toContain("rotate(-11deg)");
    expect(chromatid("B2a").style.transform).toContain("translate(228px, 200px)");
    expect(chromatid("B1a").style.transform).toContain("translate(572px, 200px)");
    expect(chromatid("A2a").style.transform).toContain("translate(598px, 200px)");
  });

  it("阶段8 减Ⅱ后期：着丝点分裂——姐妹分赴本细胞上/下两极（垂直分离）", () => {
    scene.render(st({ stage: "anaphase-II", replicated: false, cells: 2, separating: "sister" }));
    // 左细胞 (215,200)：A1a(202,130) A1b(202,270) B2a(228,130) B2b(228,270)，全部竖直
    expect(chromatid("A1a").style.transform).toBe("translate(202px, 130px) rotate(0deg) scale(1)");
    expect(chromatid("A1b").style.transform).toBe("translate(202px, 270px) rotate(0deg) scale(1)");
    expect(chromatid("B2a").style.transform).toBe("translate(228px, 130px) rotate(0deg) scale(1)");
    expect(chromatid("B2b").style.transform).toBe("translate(228px, 270px) rotate(0deg) scale(1)");
    // 右细胞 (585,200)：B1a(572,130) B1b(572,270) A2a(598,130) A2b(598,270)
    expect(chromatid("B1a").style.transform).toContain("translate(572px, 130px)");
    expect(chromatid("A2b").style.transform).toContain("translate(598px, 270px)");
  });

  it("阶段9 减Ⅱ末期：四细胞各 2 竖杆——各极姐妹居同列上下格", () => {
    scene.render(st({ stage: "telophase-II", replicated: false, cells: 4 }));
    // 左上格 (175,98)：A1a(162,85) B2a(188,85)；右上格 (480,98)：B1a(467,85) A2a(493,85)
    expect(chromatid("A1a").style.transform).toContain("translate(162px, 85px)");
    expect(chromatid("B2a").style.transform).toContain("translate(188px, 85px)");
    expect(chromatid("B1a").style.transform).toContain("translate(467px, 85px)");
    expect(chromatid("A2a").style.transform).toContain("translate(493px, 85px)");
    // 左下格 (175,302)：A1b(162,315) B2b(188,315)；右下格：B1b(467,315) A2b(493,315)
    expect(chromatid("A1b").style.transform).toContain("translate(162px, 315px)");
    expect(chromatid("B2b").style.transform).toContain("translate(188px, 315px)");
    expect(chromatid("B1b").style.transform).toContain("translate(467px, 315px)");
    expect(chromatid("A2b").style.transform).toContain("translate(493px, 315px)");
  });

  it("阶段10 变形期：分配同末期，头部浓缩 + 尾部", () => {
    scene.render(st({ stage: "sperm", replicated: false, cells: 4, spermShape: true }));
    expect(chromatid("A1a").style.transform).toContain("translate(162px, 85px)");
    expect(chromatid("A1a").style.transform).toContain("rotate(0deg)");
    // 背景元素预声明池：计数可见（opacity=1）的精子尾和细胞轮廓
    const visibleTails = [...host.querySelectorAll<SVGElement>(".sperm-tail")].filter((e) => e.style.opacity === "1");
    const visibleOutlines = [...host.querySelectorAll<SVGElement>(".cell-outline")].filter((e) => e.style.opacity === "1");
    expect(visibleTails.length).toBe(4);
    expect(visibleOutlines.length).toBe(4);
  });

  it("卵细胞阶段6 减Ⅰ末期：大细胞+极体①不均等分配", () => {
    scene.render(st({ stage: "oo-telophase-I", replicated: true, cells: 2, unequal: true, polarBodies: 1 }));
    // 大细胞 {A1,B1}、极体① {A2,B2}（X 形）
    expect(chromatid("A1a").style.transform).toContain("translate(227px, 200px)");
    expect(chromatid("B1a").style.transform).toContain("translate(253px, 200px)");
    expect(chromatid("A2a").style.transform).toContain("translate(341px, 61px)");
    expect(chromatid("B2b").style.transform).toContain("translate(365px, 61px)");
    const visiblePBs = [...host.querySelectorAll<SVGElement>(".polar-body")].filter((e) => e.style.opacity === "1");
    expect(visiblePBs.length).toBe(1);
  });

  it("卵细胞阶段8 减Ⅱ后期：次级卵母细胞姐妹分赴两极 + 第一极体同步分裂", () => {
    scene.render(st({ stage: "oo-anaphase-II", replicated: false, cells: 2, unequal: true, polarBodies: 1 }));
    // 大细胞 OO_CENTER(240,200) ±84 垂直分离：A1(227,116/284) B1(253,116/284)
    expect(chromatid("A1a").style.transform).toBe("translate(227px, 116px) rotate(0deg) scale(1)");
    expect(chromatid("A1b").style.transform).toBe("translate(227px, 284px) rotate(0deg) scale(1)");
    expect(chromatid("B1b").style.transform).toBe("translate(253px, 284px) rotate(0deg) scale(1)");
    // 第一极体① 同步着丝粒分裂：A2a 上、A2b 下（缩放 0.45）
    expect(chromatid("A2a").style.transform).toContain("translate(344px, 46px)");
    expect(chromatid("A2b").style.transform).toContain("translate(344px, 76px)");
    expect(chromatid("A2a").style.transform).toContain("rotate(0deg)");
    expect(chromatid("A2a").style.transform).toContain("scale(0.45)");
  });

  it("卵细胞单细胞期：细胞膜单一（ellipse 兼作，减Ⅰ后期直接拉伸、无圆形残留）", () => {
    const visibleOutlines = () =>
      [...host.querySelectorAll<SVGElement>(".cell-outline")].filter((e) => e.style.opacity === "1");

    // 减Ⅰ中期：膜为圆形 ellipse（rx=ry=150），无 circle 残留
    scene.render(st({ stage: "oo-metaphase-I", replicated: true, pairing: true, crossingOver: true, equatorial: "paired" }));
    const mid = visibleOutlines();
    expect(mid.length).toBe(1);
    expect(mid[0].tagName).toBe("ellipse");
    const eccMid = mid[0] as SVGEllipseElement;
    expect(eccMid.getAttribute("rx")).toBe("150");
    expect(eccMid.getAttribute("ry")).toBe("150");
    expect(eccMid.getAttribute("cy")).toBe("200");

    // 减Ⅰ后期：同一 ellipse 直接拉伸（rx≠ry），仍无圆形残留（无双膜重叠）
    scene.render(st({ stage: "oo-anaphase-I", replicated: true, pairing: true, crossingOver: true, separating: "homolog", unequal: true }));
    const ana = visibleOutlines();
    expect(ana.length).toBe(1);
    expect(ana[0].tagName).toBe("ellipse");
    const eccAna = ana[0] as SVGEllipseElement;
    expect(eccAna.getAttribute("rx")).toBe("138");
    expect(eccAna.getAttribute("ry")).toBe("159");
    expect(eccAna.getAttribute("cy")).toBe("212");
  });

  it("卵细胞阶段9/10：8 根杆守恒分配——每细胞恰 2 条", () => {
    for (const stage of ["oo-telophase-II", "oo-egg"]) {
      scene.render(st({ stage, replicated: false, cells: 2, unequal: true, polarBodies: 3 }));
      // 卵 {A1a,B1a}（不缩放）
      expect(chromatid("A1a").style.transform).toContain("translate(227px, 200px)");
      expect(chromatid("B1a").style.transform).toContain("translate(253px, 200px)");
      expect(chromatid("A1a").style.transform).toContain("scale(1)");
      // 极体① {A2a,B2a}（缩放 0.45，杆不越出极体）
      expect(chromatid("A2a").style.transform).toContain("translate(341px, 61px)");
      expect(chromatid("B2a").style.transform).toContain("translate(365px, 61px)");
      expect(chromatid("A2a").style.transform).toContain("scale(0.45)");
      // 极体② {A2b,B2b}
      expect(chromatid("A2b").style.transform).toContain("translate(413px, 184px)");
      expect(chromatid("B2b").style.transform).toContain("translate(429px, 184px)");
      expect(chromatid("A2b").style.transform).toContain("scale(0.45)");
      // 极体③ {A1b,B1b}
      expect(chromatid("A1b").style.transform).toContain("translate(371px, 317px)");
      expect(chromatid("B1b").style.transform).toContain("translate(387px, 317px)");
      expect(chromatid("A1b").style.transform).toContain("scale(0.45)");
      const visiblePBs = [...host.querySelectorAll<SVGElement>(".polar-body")].filter((e) => e.style.opacity === "1");
      expect(visiblePBs.length).toBe(3);
    }
  });

  it("阶段3 联会：同源对并排靠拢（{A1,A2} 左上、{B1,B2} 右下）", () => {
    scene.render(st({ stage: "prophase-I", replicated: true, pairing: true }));
    // gx=42, gy=27 → A1(345,173) A2(371,173) B1(429,227) B2(455,227)
    expect(chromatid("A1a").style.transform).toContain("translate(345px, 173px)");
    expect(chromatid("A2a").style.transform).toContain("translate(371px, 173px)");
    expect(chromatid("B1a").style.transform).toContain("translate(429px, 227px)");
    expect(chromatid("B2a").style.transform).toContain("translate(455px, 227px)");
  });

  it("阶段4 减Ⅰ中期：两对分列赤道板左右", () => {
    scene.render(st({ stage: "metaphase-I", replicated: true, pairing: true, equatorial: "paired" }));
    // 每对 ±66 → A 对 (334,187/213)、B 对 (466,187/213)
    expect(chromatid("A1a").style.transform).toContain("translate(334px, 187px)");
    expect(chromatid("A2a").style.transform).toContain("translate(334px, 213px)");
    expect(chromatid("B1a").style.transform).toContain("translate(466px, 187px)");
    expect(chromatid("B2a").style.transform).toContain("translate(466px, 213px)");
  });

  it("阶段5 减Ⅰ后期：同源分离两极；自由组合点击切换 B 对极性", () => {
    scene.render(st({ stage: "anaphase-I", replicated: true, separating: "homolog" }));
    // 默认组合：A1+B1 上极、A2+B2 下极（sx=53, sy=38）
    expect(chromatid("A1a").style.transform).toContain("translate(347px, 162px)");
    expect(chromatid("B1a").style.transform).toContain("translate(453px, 162px)");
    expect(chromatid("A2a").style.transform).toContain("translate(453px, 238px)");
    expect(chromatid("B2a").style.transform).toContain("translate(347px, 238px)");
    // 自由组合按钮可用；点击后 B 对对调极性（A1 与 B2 同极）
    const btn = host.querySelector<HTMLButtonElement>(".scene-controls button")!;
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(chromatid("B2a").style.transform).toContain("translate(373px, 162px)");
    expect(chromatid("B1a").style.transform).toContain("translate(427px, 238px)");
    const hint = host.querySelector<HTMLDivElement>(".combo-hint")!;
    expect(hint.style.display).toBe("inline-block");
    expect(hint.textContent).toContain("方式二");
    // 再点一次还原
    btn.click();
    expect(chromatid("B2a").style.transform).toContain("translate(347px, 238px)");
  });

  it("非减Ⅰ后期阶段：自由组合按钮禁用", () => {
    scene.render(st({ stage: "metaphase-I", replicated: true, pairing: true, equatorial: "paired" }));
    const btn = host.querySelector<HTMLButtonElement>(".scene-controls button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("自由组合（减Ⅰ后期可用）");
  });

  it("阶段6 减Ⅰ末期：两细胞各 2 个 X 并排居中", () => {
    scene.render(st({ stage: "telophase-I", replicated: true, cells: 2 }));
    // 左细胞 (215,200)：A1(202,200) B2(228,200)；右细胞 (585,200)：A2(572,200) B1(598,200)
    expect(chromatid("A1a").style.transform).toContain("translate(202px, 200px)");
    expect(chromatid("B2a").style.transform).toContain("translate(228px, 200px)");
    expect(chromatid("A2a").style.transform).toContain("translate(572px, 200px)");
    expect(chromatid("B1a").style.transform).toContain("translate(598px, 200px)");
  });

  it("布局常量：两细胞横排 R=150、四细胞左移 R=95", () => {
    expect(CELL_CENTERS[2]).toEqual([[215, 200], [585, 200]]);
    expect(CELL_CENTERS[4]).toEqual([[175, 98], [480, 98], [175, 302], [480, 302]]);
    expect(CELL_RADIUS[2]).toBe(150);
    expect(CELL_RADIUS[4]).toBe(95);
  });
});

/** 两点间欧氏距离 */
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** 段 1 不变式矩阵：精子/卵细胞模式的阶段 1~2（染色体级两两间距 ≥ 20，单体 ≤ Ru） */
describe.each([
  ["sperm:spermatogonium", meiosisCourse.stages[0].sceneState],
  ["sperm:interphase", meiosisCourse.stages[1].sceneState],
  ["sperm:prophase-I", meiosisCourse.stages[2].sceneState],
  ["sperm:metaphase-I", meiosisCourse.stages[3].sceneState],
  ["sperm:anaphase-I", meiosisCourse.stages[4].sceneState],
  ["sperm:telophase-I", meiosisCourse.stages[5].sceneState],
  ["sperm:metaphase-II", meiosisCourse.stages[6].sceneState],
  ["sperm:anaphase-II", meiosisCourse.stages[7].sceneState],
  ["sperm:telophase-II", meiosisCourse.stages[8].sceneState],
  ["sperm:telophase-II", meiosisCourse.stages[8].sceneState],
  ["sperm:sperm", meiosisCourse.stages[9].sceneState],
  ["oo:oo-spermatogonium", oogenesisCourse.stages[0].sceneState],
  ["oo:oo-interphase", oogenesisCourse.stages[1].sceneState],
  ["oo:oo-prophase-I", oogenesisCourse.stages[2].sceneState],
  ["oo:oo-metaphase-I", oogenesisCourse.stages[3].sceneState],
  ["oo:oo-anaphase-I", oogenesisCourse.stages[4].sceneState],
] as [string, Record<string, unknown>][])(
  "阶段「%s」布局不变式",
  (_id, rawState) => {
    const state = rawState as unknown as MeiosisState;
    const slots = slotsFor(state, false);

    it("不变式1：每根单体的槽位偏移量 ≤ 所属细胞 Ru（槽位为相对细胞中心的偏移）", () => {
      const ru = usableRadius(state.cells);
      for (const spec of Object.keys(slots)) {
        const s = slots[spec];
        expect(dist([s.x, s.y], [0, 0])).toBeLessThanOrEqual(ru);
      }
    });

    it("不变式2：同一细胞内不同染色体之间距 ≥ 20（姐妹重叠豁免；跨细胞不比较）", () => {
      const byCell: Record<number, Record<string, [number, number][]>> = {};
      for (const [key, s] of Object.entries(slots)) {
        const chrom = key.slice(0, -1);
        const cellMap = (byCell[s.cell] ??= {});
        (cellMap[chrom] ??= []).push([s.x, s.y]);
      }
      for (const cellMap of Object.values(byCell)) {
        const chroms = Object.keys(cellMap);
        for (let i = 0; i < chroms.length; i++) {
          for (let j = i + 1; j < chroms.length; j++) {
            const minDist = Math.min(
              ...cellMap[chroms[i]].flatMap((p) => cellMap[chroms[j]].map((q) => dist(p, q))),
            );
            expect(minDist).toBeGreaterThanOrEqual(20);
          }
        }
      }
    });
  },
);

// ============ 纺锤丝断言 ============
describe("纺锤丝显隐与池隔离", () => {
  let host: HTMLDivElement;
  const scene = createMeiosisScene();
  /** 计算可见 spindle-line 数量 */
  const visibleSpindleCount = () =>
    [...host.querySelectorAll<SVGLineElement>(".spindle-line")].filter(
      (el) => parseFloat(el.style.opacity || "0") > 0,
    ).length;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    scene.mount(host);
  });
  afterEach(() => {
    scene.destroy();
    host.remove();
  });

  // 精子模式：6 个可见阶段（数量精确断言）
  it("精子模式：减Ⅰ前/中/后各4根、减Ⅱ中/后各8根（双定向）；其余隐藏", () => {
    const visible: [string, number][] = [
      ["prophase-I", 4], ["metaphase-I", 4], ["anaphase-I", 4],
      ["metaphase-II", 8], ["anaphase-II", 8],
    ];
    const hidden = ["spermatogonium", "interphase", "telophase-I", "telophase-II", "sperm"];
    for (const [id, count] of visible) {
      scene.render(st({ stage: id, cells: id.includes("II") ? 2 : 1, replicated: true, pairing: id.includes("prophase"), crossingOver: id !== "spermatogonium", equatorial: id.includes("metaphase") ? (id.includes("II") ? "single" : "paired") : "none", separating: id.includes("anaphase") ? (id.includes("II") ? "sister" : "homolog") : "none", spermShape: id === "sperm" }));
      expect(visibleSpindleCount(), id).toBe(count);
    }
    for (const id of hidden) {
      scene.render(st({ stage: id, cells: id.includes("II") ? (id === "telophase-II" || id === "sperm" ? 4 : 2) : 1, replicated: id !== "spermatogonium", spermShape: id === "sperm" }));
      expect(visibleSpindleCount(), id).toBe(0);
    }
  });

  // 几何：纺锤丝必须是斜向汇聚（x2 ≠ 极点 x1），不是竖直棍
  it("减Ⅰ后期：纺锤丝斜向汇聚染色体（x2 ≠ 极点 x）", () => {
    scene.render(st({ stage: "anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog" }));
    const lines = [...host.querySelectorAll<SVGLineElement>(".spindle-line")];
    const visible = lines.filter((l) => parseFloat(l.style.opacity || "0") > 0);
    expect(visible.length).toBe(4);
    for (const l of visible) {
      expect(Math.abs(Number(l.getAttribute("x2")))).toBeGreaterThan(0);
      // 极点端与染色体端 x 不同 → 斜向汇聚（非竖直棍）
      expect(Number(l.getAttribute("x2"))).not.toBe(Number(l.getAttribute("x1")));
    }
  });

  // 极点锚定：极点端必须固定在两极（x1/y1 = 极点坐标）
  it("减Ⅰ后期：纺锤丝极点端固定于两极（A1a→上极、A2a→下极）", () => {
    scene.render(st({ stage: "anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog" }));
    const lines = [...host.querySelectorAll<SVGLineElement>(".spindle-line")];
    const visible = lines.filter((l) => parseFloat(l.style.opacity || "0") > 0);
    expect(visible.length).toBe(4);
    // MI_FIBERS 顺序：A1a top, B1a top, A2a bottom, B2a bottom
    // 上极 (400, 90)，下极 (400, 310)
    expect(visible[0].getAttribute("x1")).toBe("400");
    expect(visible[0].getAttribute("y1")).toBe("90");
    expect(visible[1].getAttribute("x1")).toBe("400");
    expect(visible[1].getAttribute("y1")).toBe("90");
    expect(visible[2].getAttribute("x1")).toBe("400");
    expect(visible[2].getAttribute("y1")).toBe("310");
    expect(visible[3].getAttribute("x1")).toBe("400");
    expect(visible[3].getAttribute("y1")).toBe("310");
  });

  // 池隔离：两次 mount 后丝数不累积
  it("池隔离：重新 mount 后纺锤丝数不累积", () => {
    scene.render(st({ stage: "metaphase-I" }));
    const count1 = visibleSpindleCount();
    scene.destroy();
    host.remove();
    host = document.createElement("div");
    document.body.appendChild(host);
    scene.mount(host);
    scene.render(st({ stage: "metaphase-I" }));
    expect(visibleSpindleCount()).toBe(count1);
  });

  // 减Ⅱ双定向：每条 X 的姐妹分连上/下两极（有丝分裂式），中期即如此
  it("减Ⅱ中期：每条 X 双定向——A1a 连上极、A1b 连下极", () => {
    scene.render(st({ stage: "metaphase-II", replicated: true, cells: 2, equatorial: "single" }));
    const lines = [...host.querySelectorAll<SVGLineElement>(".spindle-line")];
    const visible = lines.filter((l) => parseFloat(l.style.opacity || "0") > 0);
    expect(visible.length).toBe(8);
    // MII_SPERM 顺序：A1a top, A1b bottom, B2a top, B2b bottom, A2a top, A2b bottom, B1a top, B1b bottom
    // 细胞0 上极 (215,90)、下极 (215,310)；A1a 与 A1b 的 x2 均指向 A1 X 位置 (202,200)
    expect(visible[0].getAttribute("x1")).toBe("215");
    expect(visible[0].getAttribute("y1")).toBe("90");
    expect(visible[1].getAttribute("x1")).toBe("215");
    expect(visible[1].getAttribute("y1")).toBe("310");
    expect(visible[0].getAttribute("x2")).toBe("202");
    expect(visible[1].getAttribute("x2")).toBe("202");
  });

  // 卵细胞减Ⅱ：第一极体同步分裂带微纺锤丝（8 根，含极体纤维）
  it("卵细胞减Ⅱ后期：8 根纤维（大细胞 4 + 极体① 4），极体纤维极点=极体圆心", () => {
    scene.render(st({ stage: "oo-anaphase-II", replicated: false, cells: 2, unequal: true, polarBodies: 1 }));
    const lines = [...host.querySelectorAll<SVGLineElement>(".spindle-line")];
    const visible = lines.filter((l) => parseFloat(l.style.opacity || "0") > 0);
    expect(visible.length).toBe(8);
    // 顺序：A1a A1b B1a B1b（大细胞，极点 OO_CENTER±110-20）+ A2a A2b B2a B2b（极体①，极点 [357,61]±22）
    expect(visible[0].getAttribute("x1")).toBe("240");
    expect(visible[0].getAttribute("y1")).toBe("70");
    expect(visible[4].getAttribute("x1")).toBe("357");
    expect(visible[4].getAttribute("y1")).toBe("39");
    expect(visible[5].getAttribute("x1")).toBe("357");
    expect(visible[5].getAttribute("y1")).toBe("83");
    // A2a 纤维染色体端指向 A2a 分裂位 [344,46]
    expect(visible[4].getAttribute("x2")).toBe("344");
    expect(visible[4].getAttribute("y2")).toBe("46");
  });

  // 卵细胞模式：oo-anaphase-I 极点偏移 -20px
  it("卵细胞模式：oo-anaphase-I 极点偏移 -20px", () => {
    // 先渲染 anaphase-I（精子模式）获取基准极点
    scene.render(st({ stage: "anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog" }));
    const baseLine = host.querySelector(".spindle-line") as SVGLineElement;
    const baseY = Number(baseLine.getAttribute("y1"));

    // 渲染 oo-anaphase-I（卵细胞模式，unequal=true）
    scene.render(st({ stage: "oo-anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog", unequal: true }));
    const ooLine = host.querySelector(".spindle-line") as SVGLineElement;
    const ooY = Number(ooLine.getAttribute("y1"));

    // 极点 y 坐标应偏移 -20px
    expect(ooY - baseY).toBe(-20);
  });
});

/**
 * 减数分裂场景测试（固定 8 杆模型 · 段 1）：
 * 元素模型、阶段 1~2（未复制/复制 X 形）、交互与布局不变式。
 * 段 2/3/4 将逐阶段追加槽位断言与不变式矩阵。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMeiosisScene, slotsFor, usableRadius, CELL_CENTERS, CELL_RADIUS } from "../scene";
import type { Slot } from "../scene";
import { meiosisCourse, oogenesisCourse } from "../data";
import type { MeiosisState } from "../data";

/** 构造场景状态（默认精原细胞；stage 必填以驱动槽位表） */
const st = (over: Partial<MeiosisState> & { stage: string }): MeiosisState => ({
  cells: 1, replicated: false, pairing: false, crossingOver: false,
  equatorial: "none", separating: "none", spermShape: false,
  ...over,
});

/** 解析纺锤丝 path d（M 极点 L 着丝点）→ [极点[x,y], 着丝点[x,y]]（模块级，供各 describe 复用） */
const dPoints = (p: SVGPathElement): { pole: [number, number]; end: [number, number] } => {
  const d = p.getAttribute("d") || "";
  const m = /M\s+([\d.]+)\s+([\d.]+)\s+L\s+([\d.]+)\s+([\d.]+)/.exec(d);
  if (!m) throw new Error(`d 缺 M/L 指令: ${d}`);
  return { pole: [Number(m[1]), Number(m[2])], end: [Number(m[3]), Number(m[4])] };
};

/** 当前可见的纺锤丝（path），宿主由调用方传入（模块级） */
const visibleFibers = (host: HTMLDivElement) =>
  [...host.querySelectorAll<SVGPathElement>(".spindle-line")].filter((p) => parseFloat(p.style.opacity || "0") > 0);

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

  it("阶段10 变形期：分配同末期，头部浓缩 + 尾部（染色体随头部缩放 0.45）", () => {
    scene.render(st({ stage: "sperm", replicated: false, cells: 4, spermShape: true }));
    expect(chromatid("A1a").style.transform).toContain("translate(162px, 85px)");
    expect(chromatid("A1a").style.transform).toContain("rotate(0deg)");
    expect(chromatid("A1a").style.transform).toContain("scale(0.45)");
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
    // 大细胞 OO_CENTER(240,200) ±70 垂直分离：A1(227,130/270) B1(253,130/270)
    expect(chromatid("A1a").style.transform).toBe("translate(227px, 130px) rotate(0deg) scale(1)");
    expect(chromatid("A1b").style.transform).toBe("translate(227px, 270px) rotate(0deg) scale(1)");
    expect(chromatid("B1b").style.transform).toBe("translate(253px, 270px) rotate(0deg) scale(1)");
    // 第一极体① 同步着丝粒分裂：A2a 上、A2b 下（垂直 ±10，缩放 0.45）
    expect(chromatid("A2a").style.transform).toContain("translate(344px, 51px)");
    expect(chromatid("A2b").style.transform).toContain("translate(344px, 71px)");
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

  it("阶段4 减Ⅰ中期：同源染色体成对排列在赤道面（对内水平并排）", () => {
    scene.render(st({ stage: "metaphase-I", replicated: true, pairing: true, equatorial: "paired" }));
    // 对心距 60 → A 对 x=327/353、B 对 x=447/473，均 y=200（赤道面）
    expect(chromatid("A1a").style.transform).toContain("translate(327px, 200px)");
    expect(chromatid("A2a").style.transform).toContain("translate(353px, 200px)");
    expect(chromatid("B1a").style.transform).toContain("translate(447px, 200px)");
    expect(chromatid("B2a").style.transform).toContain("translate(473px, 200px)");
  });

  it("阶段5 减Ⅰ后期：同源分离——左右同列、上下拉开；自由组合切换 B 对极性", () => {
    scene.render(st({ stage: "anaphase-I", replicated: true, separating: "homolog" }));
    // 默认组合：A 对左列（上 347,162 / 下 347,238）、B 对右列（上 453,162 / 下 453,238）——同列不横穿
    expect(chromatid("A1a").style.transform).toContain("translate(347px, 162px)");
    expect(chromatid("A2a").style.transform).toContain("translate(347px, 238px)");
    expect(chromatid("B1a").style.transform).toContain("translate(453px, 162px)");
    expect(chromatid("B2a").style.transform).toContain("translate(453px, 238px)");
    // 自由组合按钮可用；点击后 B 对同一右列内对调极性（A1 与 B2 同极上、A2 与 B1 同极下）
    const btn = host.querySelector<HTMLButtonElement>(".scene-controls button")!;
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(chromatid("B2a").style.transform).toContain("translate(453px, 162px)");
    expect(chromatid("B1a").style.transform).toContain("translate(453px, 238px)");
    expect(chromatid("A1a").style.transform).toContain("translate(347px, 162px)");
    expect(chromatid("A2a").style.transform).toContain("translate(347px, 238px)");
    const hint = host.querySelector<HTMLDivElement>(".combo-hint")!;
    expect(hint.style.display).toBe("inline-block");
    expect(hint.textContent).toContain("方式二");
    // 再点一次还原
    btn.click();
    expect(chromatid("B2a").style.transform).toContain("translate(453px, 238px)");
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
  /** 计算可见 spindle 数量 */
  const visibleSpindleCount = () => visibleFibers(host).length;

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

  // 几何：纺锤丝必须是斜向汇聚（着丝点 x ≠ 极点 x），不是竖直棍
  it("减Ⅰ后期：纺锤丝斜向汇聚染色体（着丝点 ≠ 极点 x）", () => {
    scene.render(st({ stage: "anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog" }));
    const visible = visibleFibers(host);
    expect(visible.length).toBe(4);
    for (const l of visible) {
      const { pole, end } = dPoints(l);
      expect(Math.abs(end[0])).toBeGreaterThan(0);
      // 极点端与染色体端 x 不同 → 斜向汇聚（非竖直棍）
      expect(end[0]).not.toBe(pole[0]);
    }
  });

  // 极点锚定：极点端必须固定在两极（M 点 = 极点坐标）
  it("减Ⅰ后期：纺锤丝极点端固定于两极（A1a→上极、A2a→下极）", () => {
    scene.render(st({ stage: "anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog" }));
    const visible = visibleFibers(host);
    expect(visible.length).toBe(4);
    // MI_FIBERS 顺序：A1a top, B1a top, A2a bottom, B2a bottom
    // 上极 (400, 90)，下极 (400, 310)
    expect(dPoints(visible[0]).pole[0]).toBe(400);
    expect(dPoints(visible[0]).pole[1]).toBe(90);
    expect(dPoints(visible[1]).pole[0]).toBe(400);
    expect(dPoints(visible[1]).pole[1]).toBe(90);
    expect(dPoints(visible[2]).pole[0]).toBe(400);
    expect(dPoints(visible[2]).pole[1]).toBe(310);
    expect(dPoints(visible[3]).pole[0]).toBe(400);
    expect(dPoints(visible[3]).pole[1]).toBe(310);
  });

  // 后期同列分离语义：上极丝牵着上半区、下极丝牵着下半区（y 与极向一致）；
  // 且同极两条 y 相等（同一水平带）→ 同列上下拉开，无对角线横穿；默认与自由组合两态都成立
  it("减Ⅰ后期：同极丝端同水平带——上极 y<200、下极 y>200（默认与自由组合）", () => {
    const base = { stage: "anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog" } as const;
    scene.render(st(base));
    for (const combo of [false, true]) {
      const visible = visibleFibers(host);
      expect(visible.length).toBe(4);
      const ends = visible.map((l) => dPoints(l).end);
      // 上极两条 y<200、下极两条 y>200；同极两条横向各守半场、y 同带
      expect(ends[0][1]).toBeLessThan(200);
      expect(ends[1][1]).toBeLessThan(200);
      expect(ends[2][1]).toBeGreaterThan(200);
      expect(ends[3][1]).toBeGreaterThan(200);
      expect(ends[0][1]).toBe(ends[1][1]);
      expect(ends[2][1]).toBe(ends[3][1]);
      const btn = host.querySelector<HTMLButtonElement>(".scene-controls button")!;
      expect(btn.disabled).toBe(false);
      if (!combo) btn.click();
    }
  });

  // 卵细胞模式同样受 comboAlt 影响：oo-anaphase-I + 自由组合切换时 B 对右列内对调极性，
  // 槽位须与 fibersFor 返回的 MI_COMBO_ALT 极向一致（否则丝极向与染色体所赴半区相反会错连）
  it("卵细胞 oo-anaphase-I：同极丝端同水平带——默认与自由组合均为上 y<200、下 y>200，B 对右列内对调", () => {
    // 用独立 scene 实例隔离本测试的 comboAlt 初始态（共享闭包可能被前例点击污染）
    const s2 = createMeiosisScene();
    const h2 = document.createElement("div");
    document.body.appendChild(h2);
    s2.mount(h2);
    const base = { stage: "oo-anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog", unequal: true } as const;
    s2.render(st(base));
    const cg = (key: string) => h2.querySelector<SVGGElement>(`.chromatid.chromo-${key}`)!;
    const vis = () => visibleFibers(h2);
    // 默认：B1 上、B2 下（右列上下拉开；A 对左列不变）
    expect(cg("A1a").style.transform).toContain("translate(347px, 162px)");
    expect(cg("A2a").style.transform).toContain("translate(347px, 238px)");
    expect(cg("B1a").style.transform).toContain("translate(453px, 162px)");
    expect(cg("B2a").style.transform).toContain("translate(453px, 238px)");
    for (let combo = 0; combo < 2; combo++) {
      const visible = vis();
      expect(visible.length).toBe(4);
      const ends = visible.map((l) => dPoints(l).end);
      expect(ends[0][1]).toBeLessThan(200);
      expect(ends[1][1]).toBeLessThan(200);
      expect(ends[2][1]).toBeGreaterThan(200);
      expect(ends[3][1]).toBeGreaterThan(200);
      expect(ends[0][1]).toBe(ends[1][1]);
      expect(ends[2][1]).toBe(ends[3][1]);
      const btn = h2.querySelector<HTMLButtonElement>(".scene-controls button")!;
      expect(btn.disabled).toBe(false);
      if (combo === 0) btn.click();
    }
    // 自由组合：B2 上、B1 下（仍右列，与 MI_COMBO_ALT 极向对齐）
    expect(cg("B2a").style.transform).toContain("translate(453px, 162px)");
    expect(cg("B1a").style.transform).toContain("translate(453px, 238px)");
    expect(cg("A1a").style.transform).toContain("translate(347px, 162px)");
    expect(cg("A2a").style.transform).toContain("translate(347px, 238px)");
    s2.destroy();
    h2.remove();
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

  // 入场生长：隐藏→可见时走 dasharray 绘制（从极点绘向着丝点），d 已瞬切到正确位置
  it("纺锤丝入场：隐藏→可见 dasharray 0→1（极点长出）；再 tick 保留 dasharray、d 转过渡；隐藏重置", () => {
    // 挂载后未进入任何有丝阶段：全部隐藏、dasharray=0 1、pathLength=1
    scene.render(st({ stage: "spermatogonium" }));
    const allLines = [...host.querySelectorAll<SVGPathElement>(".spindle-line")];
    expect(allLines.length).toBe(16);
    expect(allLines.every((l) => l.style.strokeDasharray === "0 1")).toBe(true);
    expect(allLines.every((l) => l.getAttribute("pathLength") === "1")).toBe(true);

    // 首次进入有丝阶段：d 目标已瞬切到位（无 d 过渡飞插），走 grow 绘制
    scene.render(st({ stage: "metaphase-I" }));
    const first = visibleFibers(host);
    expect(first.length).toBe(4);
    for (const l of first) {
      expect(l.classList.contains("grow")).toBe(true);
      expect(l.style.strokeDasharray).toBe("1 1");
    }
    // 极点端已在两极（非画布原点），grow 期间丝由 M 极点绘向 L 着丝点
    expect(dPoints(first[0]).pole).toEqual([400, 90]);
    expect(dPoints(first[0]).end[0]).toBeGreaterThan(0);

    // 再次同阶段 render（进入可见期）：grow 撤销、dasharray 保持满绘
    scene.render(st({ stage: "metaphase-I" }));
    const steady = visibleFibers(host);
    expect(steady.length).toBe(4);
    for (const l of steady) {
      expect(l.classList.contains("grow")).toBe(false);
      expect(l.style.strokeDasharray).toBe("1 1");
    }

    // 隐藏重置：dasharray 归零
    scene.render(st({ stage: "telophase-I" }));
    expect(visibleSpindleCount()).toBe(0);
    for (const l of [...host.querySelectorAll<SVGPathElement>(".spindle-line")]) {
      expect(l.style.strokeDasharray).toBe("0 1");
    }
  });

  // 减Ⅱ双定向：每条 X 的姐妹分连上/下两极（有丝分裂式），中期即如此
  it("减Ⅱ中期：每条 X 双定向——A1a 连上极、A1b 连下极", () => {
    scene.render(st({ stage: "metaphase-II", replicated: true, cells: 2, equatorial: "single" }));
    const visible = visibleFibers(host);
    expect(visible.length).toBe(8);
    // MII_SPERM 顺序：A1a top, A1b bottom, B2a top, B2b bottom, A2a top, A2b bottom, B1a top, B1b bottom
    // 细胞0 上极 (215,90)、下极 (215,310)；A1a 与 A1b 的着丝点端均指向 A1 X 位置 (202,200)
    expect(dPoints(visible[0]).pole[0]).toBe(215);
    expect(dPoints(visible[0]).pole[1]).toBe(90);
    expect(dPoints(visible[1]).pole[0]).toBe(215);
    expect(dPoints(visible[1]).pole[1]).toBe(310);
    expect(dPoints(visible[0]).end[0]).toBe(202);
    expect(dPoints(visible[1]).end[0]).toBe(202);
  });

  // 卵细胞减Ⅱ：第一极体同步分裂带微纺锤丝（8 根，含极体纤维）
  it("卵细胞减Ⅱ后期：8 根纤维（大细胞 4 + 极体① 4），极体纤维极点=极体圆心", () => {
    scene.render(st({ stage: "oo-anaphase-II", replicated: false, cells: 2, unequal: true, polarBodies: 1 }));
    const visible = visibleFibers(host);
    expect(visible.length).toBe(8);
    // 顺序：A1a A1b B1a B1b（大细胞，极点 OO_CENTER±110-20）+ A2a A2b B2a B2b（极体①，极点 [357,61]±22）
    expect(dPoints(visible[0]).pole[0]).toBe(240);
    expect(dPoints(visible[0]).pole[1]).toBe(70);
    expect(dPoints(visible[4]).pole[0]).toBe(357);
    expect(dPoints(visible[4]).pole[1]).toBe(39);
    expect(dPoints(visible[5]).pole[0]).toBe(357);
    expect(dPoints(visible[5]).pole[1]).toBe(83);
    // A2a 纤维染色体端指向 A2a 分裂位 [344,51]
    expect(dPoints(visible[4]).end[0]).toBe(344);
    expect(dPoints(visible[4]).end[1]).toBe(51);
  });

  // 卵细胞模式：oo-anaphase-I 极点偏移 -20px
  it("卵细胞模式：oo-anaphase-I 极点偏移 -20px", () => {
    // 先渲染 anaphase-I（精子模式）获取基准极点
    scene.render(st({ stage: "anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog" }));
    const baseLine = host.querySelector(".spindle-line") as SVGPathElement;
    const baseY = dPoints(baseLine).pole[1];

    // 渲染 oo-anaphase-I（卵细胞模式，unequal=true）
    scene.render(st({ stage: "oo-anaphase-I", cells: 1, replicated: true, pairing: true, crossingOver: true, separating: "homolog", unequal: true }));
    const ooLine = host.querySelector(".spindle-line") as SVGPathElement;
    const ooY = dPoints(ooLine).pole[1];

    // 极点 y 坐标应偏移 -20px
    expect(ooY - baseY).toBe(-20);
  });
});

// ============ 越界回归：全部阶段两条杆端必须落在所属细胞膜内 ============
// 背景元素 stroke-width=2（半宽 1），safe = 边界 − 5（额外 4px 抗锯齿余量）。
// 覆盖：精子四种膜【圆 / 精子椭圆头】、卵细胞单细胞偏心椭圆、卵细胞两细胞大圆 + 极体圆。
describe("越界回归：所有阶段所有杆端均落在所属细胞膜内", () => {
  // 杆长信息（与 CHROMATIDS 对齐：A 半长 60、B 半长 35）
  const HALF: Record<string, number> = { A: 60, B: 35 };
  const CIRCLES: Record<number, [number, number][]> = {
    1: [[400, 200]], 2: [[215, 200], [585, 200]],
    4: [[175, 98], [480, 98], [175, 302], [480, 302]],
  };
  // 与 scene.ts 中的常量同步（避免重复导出时漂移）
  const OO_CENTER: [number, number] = [240, 200];
  const PB_R = 46;
  const PB_DIST = OO_CENTER[0] === 240 ? 140 + PB_R - 4 : 0;

  const pbCenter = (deg: number): [number, number] => [
    Math.round(OO_CENTER[0] + PB_DIST * Math.cos((deg * Math.PI) / 180)),
    Math.round(OO_CENTER[1] + PB_DIST * Math.sin((deg * Math.PI) / 180)),
  ];

  /** 两点欧氏距离 */
  const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /** 卵细胞两细胞期：槽位即绝对坐标；否则槽位是相对所属细胞中心偏移 */
  const absSlot = (s: MeiosisState, slot: Slot): [number, number] => {
    const abs = s.cells === 2 && s.unequal;
    if (abs) return [slot.x, slot.y];
    const base = CIRCLES[s.cells][slot.cell] ?? [0, 0];
    return [base[0] + slot.x, base[1] + slot.y];
  };

  /** 该槽位所属的细胞膜：圆或椭圆（rx=ry 即圆）。返回 {center, r|rx, ry, isEllipse} */
  const bodyFor = (s: MeiosisState, slot: Slot): { center: [number, number]; rx: number; ry: number; name: string } => {
    const isOo = s.stage.startsWith("oo-");
    // 卵细胞两细胞期：大圆 or 极体圆（槽位 = 绝对坐标）
    if (isOo && s.cells === 2 && s.unequal) {
      // 距染色体中心最近的细胞体（大圆或某极体）
      const bodies: { center: [number, number]; r: number }[] = [{ center: OO_CENTER, r: 140 }];
      const angles: Record<number, number[]> = { 1: [-50], 3: [-50, -5, 40] };
      for (const a of angles[s.polarBodies ?? 0] ?? []) bodies.push({ center: pbCenter(a), r: PB_R });
      let best = bodies[0];
      let bestDist = Infinity;
      for (const b of bodies) {
        const dist = d(b.center, [slot.x, slot.y]);
        if (dist < bestDist) { bestDist = dist; best = b; }
      }
      return { center: best.center, rx: best.r, ry: best.r, name: best.r === 140 ? "大圆" : "极体" };
    }
    // 卵细胞单细胞期：偏心椭圆（cy 偏移由 unequal 决定）
    if (isOo && s.cells === 1) {
      const cy = 200 + (s.unequal ? Math.round(150 * 0.08) : 0);
      const rx = Math.round(150 * (s.unequal ? 0.92 : 1));
      const ry = Math.round(150 * (s.unequal ? 1.06 : 1));
      return { center: [400, cy], rx, ry, name: "卵单细胞椭圆" };
    }
    // 精子模式：圆 or 精子椭圆头
    const c = CIRCLES[s.cells][slot.cell];
    if (s.spermShape) {
      const rx = Math.round((s.cells - 1 === 0 ? 150 : 95) * 0.6);
      const ry = Math.round((s.cells - 1 === 0 ? 150 : 95) * 0.52);
      return { center: c, rx, ry, name: "精子椭圆头" };
    }
    return { center: c, rx: s.cells === 4 ? 95 : 150, ry: s.cells === 4 ? 95 : 150, name: "精子圆" };
  };

  /** 旋转角度 a 后，杆端相对组中心偏移 = {±sin(a)·half·s, ∓cos(a)·half·s} */
  const offset = (a: number, halfPix: number, s: number): [number, number] => {
    const rad = (a * Math.PI) / 180;
    const len = halfPix * s;
    return [Math.sin(rad) * len, -Math.cos(rad) * len];
  };

  it("精子模式全部 10 阶段", () => {
    for (const stg of meiosisCourse.stages) {
      const sc = stg.sceneState as unknown as MeiosisState;
      if (!sc.stage) continue;
      const slots = slotsFor(sc, false);
      for (const [key, slot] of Object.entries(slots)) {
        const half = HALF[key.slice(0, 1)];
        const [cx, cy] = absSlot(sc, slot);
        const [ox, oy] = offset(slot.a, half, slot.s ?? 1);
        // 世界坐标两个杆端
        for (const sign of [1, -1]) {
          const tip: [number, number] = [cx + sign * ox, cy + sign * oy];
          const body = bodyFor(sc, slot);
          const t = Math.min(1, (body.rx - 5) / body.rx, (body.ry - 5) / body.ry);
          if (body.rx === body.ry) {
            expect(d(tip, body.center), `${sc.stage} ${key} 杆端离 ${body.name} 中心 ${d(tip, body.center).toFixed(1)}px（safe ${body.rx - 5}）`).toBeLessThanOrEqual(body.rx - 5);
          } else {
            const nx = (tip[0] - body.center[0]) / (body.rx * t);
            const ny = (tip[1] - body.center[1]) / (body.ry * t);
            expect(Math.hypot(nx, ny), `${sc.stage} ${key} 杆端椭圆归一化距离 ${Math.hypot(nx, ny).toFixed(3)}（safe 1）`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("卵细胞模式全部 10 阶段", () => {
    for (const stg of oogenesisCourse.stages) {
      const sc = stg.sceneState as unknown as MeiosisState;
      if (!sc.stage) continue;
      const slots = slotsFor(sc, false);
      for (const [key, slot] of Object.entries(slots)) {
        const half = HALF[key.slice(0, 1)];
        const [cx, cy] = absSlot(sc, slot);
        const [ox, oy] = offset(slot.a, half, slot.s ?? 1);
        for (const sign of [1, -1]) {
          const tip: [number, number] = [cx + sign * ox, cy + sign * oy];
          const body = bodyFor(sc, slot);
          if (body.rx === body.ry) {
            expect(d(tip, body.center), `${sc.stage} ${key} 杆端离 ${body.name} 中心 ${d(tip, body.center).toFixed(1)}px（safe ${body.rx - 5}）`).toBeLessThanOrEqual(body.rx - 5);
          } else {
            const t = Math.min(1, (body.rx - 5) / body.rx, (body.ry - 5) / body.ry);
            const nx = (tip[0] - body.center[0]) / (body.rx * t);
            const ny = (tip[1] - body.center[1]) / (body.ry * t);
            expect(Math.hypot(nx, ny), `${sc.stage} ${key} 杆端椭圆归一化距离 ${Math.hypot(nx, ny).toFixed(3)}（safe 1）`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

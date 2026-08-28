/** 有丝分裂场景测试（段 1+2）：元素模型、6 阶段渲染、背景元素、布局不变式 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMitosisScene, mitosisSlots } from "../scene";
import { mitosisCourse } from "../data";

/** 构造场景状态（stage 必填以驱动槽位表） */
const st = (over: { stage: string } & Record<string, unknown>): Record<string, unknown> => ({
  cells: 1, replicated: false, pairing: false, crossingOver: false,
  equatorial: "none", separating: "none", spermShape: false,
  ...over,
});

describe("有丝分裂场景", () => {
  let host: HTMLDivElement;
  const scene = createMitosisScene();
  /** 取指定单体的组元素 */
  const chromatid = (key: string) =>
    host.querySelector<SVGGElement>(`.chromatid.chromo-${key}`)!;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    scene.mount(host);
  });
  afterEach(() => {
    scene.destroy();
    host.remove();
  });
  const chr = (key: string) => host.querySelector<SVGGElement>(`.chromatid.chromo-${key}`)!;
  /** 计算可见元素数量（style.opacity > 0，优先于初始 attribute） */
  const visibleCount = (sel: string) =>
    [...host.querySelectorAll(sel)].filter((el) => parseFloat((el as SVGElement).style.opacity || el.getAttribute("opacity") || "1") > 0).length;

  it("挂载 8 单体（杆+着丝点+标注）", () => {
    expect(host.querySelectorAll(".chromatid").length).toBe(8);
    host.querySelectorAll(".chromatid").forEach((g) => {
      expect(g.querySelector("circle.centro")).toBeTruthy();
      expect(g.querySelector("text.gene-label")).toBeTruthy();
    });
  });

  it("间期：姐妹张开成 X + 核膜可见", () => {
    scene.render(st({ stage: "interphase" }));
    const a = chromatid("A1a"), b = chromatid("A1b");
    expect(a.style.transform).toContain("rotate(-11deg)");
    expect(b.style.transform).toContain("rotate(11deg)");
    expect(a.style.transform.split("rotate")[0]).toBe(b.style.transform.split("rotate")[0]);
    expect(visibleCount(".nuclear-membrane")).toBe(1);
  });

  it("前期：散乱 + 核膜消 + 纺锤丝现", () => {
    scene.render(st({ stage: "prophase", replicated: true }));
    expect(chromatid("A1a").style.transform).not.toBe(chromatid("A2a").style.transform);
    expect(visibleCount(".nuclear-membrane")).toBe(0);
    expect(visibleCount(".spindle-line")).toBe(8);
  });

  it("中期：赤道板横排", () => {
    scene.render(st({ stage: "metaphase", replicated: true }));
    expect(chromatid("A1a").style.transform).toContain("translate(280px, 200px)");
    expect(visibleCount(".spindle-line")).toBe(8);
  });

  // 几何：纺锤丝极点端固定在两极、斜向汇聚染色体（非竖直棍）
  it("前期：纺锤丝极点端固定于两极且斜向汇聚", () => {
    scene.render(st({ stage: "prophase", replicated: true }));
    const lines = [...host.querySelectorAll<SVGLineElement>(".spindle-line")];
    const visible = lines.filter((l) => parseFloat(l.style.opacity || "0") > 0);
    expect(visible.length).toBe(8);
    for (const l of visible) {
      // 极点端固定于上极或下极
      const y1 = Number(l.getAttribute("y1"));
      expect([60, 340]).toContain(y1);
      // 染色体端 x 与极点端 x 不同 → 斜向汇聚
      expect(Math.abs(Number(l.getAttribute("x2")))).toBeGreaterThan(0);
      expect(Number(l.getAttribute("x2"))).not.toBe(Number(l.getAttribute("x1")));
    }
  });

  it("后期：着丝点分裂——姐妹分赴两极", () => {
    scene.render(st({ stage: "anaphase" }));
    expect(chromatid("A1a").style.transform).toContain("translate(280px, 125px)");
    expect(chromatid("A1b").style.transform).toContain("translate(280px, 275px)");
    expect(chromatid("A1a").style.transform).toContain("rotate(0deg)");
  });

  it("末期：核膜重现 + 细胞板", () => {
    scene.render(st({ stage: "telophase" }));
    expect(visibleCount(".nuclear-membrane")).toBe(2);
    expect(visibleCount(".cell-plate")).toBe(1);
  });

  it("子细胞：两细胞各 4 条", () => {
    scene.render(st({ stage: "daughter" }));
    expect(visibleCount(".cell-wall")).toBe(2);
    expect(chromatid("A1a").style.transform).toContain("translate(280px, 110px)");
  });

  it("基因标注开关", () => {
    scene.render(st({ stage: "interphase", replicated: true }));
    const input = host.querySelector<HTMLInputElement>(".scene-controls input")!;
    input.checked = true;
    input.dispatchEvent(new Event("change"));
    expect(chromatid("A1a").querySelector("text.gene-label")!.getAttribute("visibility")).toBe("visible");
  });
});

/** 布局不变式 */
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe.each(
  mitosisCourse.stages.map((s) => [s.id, s.sceneState] as [string, Record<string, unknown>]),
)("阶段「%s」布局不变式", (_id, rawState) => {
  const state = rawState as unknown as Record<string, unknown>;
  const slots = mitosisSlots(String(state.stage));

  it("不变式：同细胞内不同染色体之间距 ≥ 20（姐妹重叠豁免）", () => {
    const byChrom: Record<string, [number, number][]> = {};
    for (const [key, s] of Object.entries(slots)) {
      const chrom = key.slice(0, -1);
      (byChrom[chrom] ??= []).push([s.x, s.y]);
    }
    const chroms = Object.keys(byChrom);
    for (let i = 0; i < chroms.length; i++) {
      for (let j = i + 1; j < chroms.length; j++) {
        const minDist = Math.min(
          ...byChrom[chroms[i]].flatMap((p) => byChrom[chroms[j]].map((q) => dist(p, q))),
        );
        expect(minDist).toBeGreaterThanOrEqual(20);
      }
    }
  });
});

describe("有丝分裂图表 n 表示法", () => {
  it("n=4：tickStep=4、刻度 0~2n 不出现真实条数", () => {
    const cfg = mitosisCourse.chartConfigs![0];
    expect(cfg.tickStep).toBe(4);
    // 有丝分裂 2n=4，DNA/染色体最大 8 → 刻度 0,4,8 → 0n,1n,2n
    const ticks = [0, 4, 8].map((v) => cfg.tickFormat!(v));
    expect(ticks).toEqual(["0n", "1n", "2n"]);
  });
});

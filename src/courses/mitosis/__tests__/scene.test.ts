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
    expect(host.querySelectorAll(".nuclear-membrane").length).toBe(1);
  });

  it("前期：散乱 + 核膜消 + 纺锤丝现", () => {
    scene.render(st({ stage: "prophase", replicated: true }));
    expect(chromatid("A1a").style.transform).not.toBe(chromatid("A2a").style.transform);
    expect(host.querySelectorAll(".nuclear-membrane").length).toBe(0);
    expect(host.querySelectorAll(".spindle-line").length).toBe(8);
  });

  it("中期：赤道板横排", () => {
    scene.render(st({ stage: "metaphase", replicated: true }));
    expect(chromatid("A1a").style.transform).toContain("translate(280px, 200px)");
    expect(host.querySelectorAll(".spindle-line").length).toBe(8);
  });

  it("后期：着丝点分裂——姐妹分赴两极", () => {
    scene.render(st({ stage: "anaphase" }));
    expect(chromatid("A1a").style.transform).toContain("translate(280px, 125px)");
    expect(chromatid("A1b").style.transform).toContain("translate(280px, 275px)");
    expect(chromatid("A1a").style.transform).toContain("rotate(0deg)");
  });

  it("末期：核膜重现 + 细胞板", () => {
    scene.render(st({ stage: "telophase" }));
    expect(host.querySelectorAll(".nuclear-membrane").length).toBe(2);
    expect(host.querySelectorAll(".cell-plate").length).toBe(1);
  });

  it("子细胞：两细胞各 4 条", () => {
    scene.render(st({ stage: "daughter" }));
    expect(host.querySelectorAll(".cell-wall").length).toBe(2);
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

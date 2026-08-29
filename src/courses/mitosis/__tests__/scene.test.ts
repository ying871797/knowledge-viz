/** 有丝分裂场景测试（段 1+2）：元素模型、6 阶段渲染、背景元素、布局不变式 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMitosisScene, mitosisSlots, MITOSIS_FIBERS } from "../scene";
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
    const ds = spindleD("prophase");
    expect(ds).toHaveLength(8);
    for (const d of ds) {
      const m = /M\s+([\d.]+)\s+([\d.]+)\s+L\s+([\d.]+)\s+([\d.]+)/.exec(d);
      if (!m) throw new Error(`d 缺 M/L 指令: ${d}`);
      const [px, py, tx, ty] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      // 极点端固定于上极 (400,60) 或下极 (400,340)
      expect([60, 340]).toContain(py);
      expect(px).toBe(400);
      // 染色体端 x 与极点端 x 不同 → 斜向汇聚
      expect(Math.abs(tx)).toBeGreaterThan(0);
      expect(tx).not.toBe(px);
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

/** 取指定阶段可见纺锤丝的 d 属性（path 格式：M 极点 L 着丝点） */
const spindleD = (stage: string): string[] => {
  const scene = createMitosisScene();
  const h = document.createElement("div");
  document.body.appendChild(h);
  scene.mount(h);
  scene.render(st({ stage, replicated: true }));
  const ds = [...h.querySelectorAll<SVGPathElement>(".spindle-line")].map((p) => p.getAttribute("d") || "");
  scene.destroy();
  h.remove();
  return ds;
};
/** 解析 path d 的 L 端点（着丝点端） */
const lEnd = (d: string): [number, number] => {
  const m = /L\s+([\d.]+)\s+([\d.]+)/.exec(d);
  if (!m) throw new Error(`d 无 L 指令: ${d}`);
  return [Number(m[1]), Number(m[2])];
};

describe("有丝分裂纺锤丝", () => {
  it("结构断言：纺锤丝数量 = 绑定表长度 8", () => {
    expect(MITOSIS_FIBERS.length).toBe(8);
  });

  it("结构断言：中期每根丝的着丝点端 == 绑定单体槽位坐标（丝接对染色体）", () => {
    for (const d of spindleD("metaphase")) {
      const [tx, ty] = lEnd(d);
      // 中期所有单体着丝点排列在赤道板 y=200，x 为各自槽位
      expect(ty).toBe(200);
      expect(tx).toBeGreaterThan(200);
      expect(tx).toBeLessThan(600);
    }
    // 精确：每根丝的 L 端必须等于某个单体槽位（结构不脱节）
    const slots = mitosisSlots("metaphase");
    for (const d of spindleD("metaphase")) {
      const [tx, ty] = lEnd(d);
      const hit = Object.values(slots).some((s) => s.x === tx - 400 && s.y === ty - 200);
      expect(hit).toBe(true);
    }
  });

  it("语义断言：后期上极丝连 y<200 单体、下极丝连 y>200 单体（无交叉错连）", () => {
    const ds = spindleD("anaphase");
    const slots = mitosisSlots("anaphase");
    MITOSIS_FIBERS.forEach((fib, i) => {
      const [tx, ty] = lEnd(ds[i]);
      // 先验：每根丝 L 端确实是其绑定单体的槽位
      const bound = slots[fib.key];
      expect(tx).toBe(400 + bound.x);
      expect(ty).toBe(200 + bound.y);
      // 语义：上极丝终点在上半区，下极丝终点在下半区
      if (fib.pole === "top") expect(ty).toBeLessThan(200);
      else expect(ty).toBeGreaterThan(200);
    });
  });

  it("语义断言：中期绑定表极点分配应两极各有 4 根（极向互补）", () => {
    const tops = MITOSIS_FIBERS.filter((f) => f.pole === "top").length;
    const bots = MITOSIS_FIBERS.filter((f) => f.pole === "bottom").length;
    expect(tops).toBe(4);
    expect(bots).toBe(4);
    // 且同一单体不会被同时指向上、下两极（物理不可能）
    const seen = new Map<string, string>();
    for (const f of MITOSIS_FIBERS) {
      expect(!seen.has(f.key)).toBe(true);
      seen.set(f.key, f.pole);
    }
  });

  // 入场生长：隐藏→可见 dasharray 0→1（从两极长出），d 已瞬切到位；再渲染保留 dasharray、隐藏重置
  it("入场：前期 dasharray 0→1 从两极长出（grow）/可见期转 d 过渡/末期隐藏重置", () => {
    const scene = createMitosisScene();
    const h = document.createElement("div");
    document.body.appendChild(h);
    scene.mount(h);
    const lines = () => [...h.querySelectorAll<SVGPathElement>(".spindle-line")];
    const visible = () => lines().filter((p) => parseFloat(p.style.opacity || "0") > 0);

    // 间期：全部隐藏、dasharray=0 1、pathLength=1
    scene.render(st({ stage: "interphase", replicated: true }));
    expect(lines().every((l) => l.style.strokeDasharray === "0 1")).toBe(true);
    expect(lines().every((l) => l.getAttribute("pathLength") === "1")).toBe(true);

    // 前期首现：走 grow，d 已到极点（400,60/340），非原点
    scene.render(st({ stage: "prophase", replicated: true }));
    const first = visible();
    expect(first.length).toBe(8);
    for (const l of first) {
      expect(l.classList.contains("grow")).toBe(true);
      expect(l.style.strokeDasharray).toBe("1 1");
    }
    const m = /M\s+([\d.]+)\s+([\d.]+)/.exec(first[0].getAttribute("d") || "")!;
    expect([Number(m[1]), Number(m[2])]).toEqual([400, 60]);

    // 中期（可见期）：grow 撤销、dasharray 满绘沿 d 贴近
    scene.render(st({ stage: "metaphase", replicated: true }));
    const steady = visible();
    expect(steady.length).toBe(8);
    for (const l of steady) {
      expect(l.classList.contains("grow")).toBe(false);
      expect(l.style.strokeDasharray).toBe("1 1");
    }

    // 末期：隐藏重置 dasharray 0 1
    scene.render(st({ stage: "telophase" }));
    expect(visible().length).toBe(0);
    expect(lines().every((l) => l.style.strokeDasharray === "0 1")).toBe(true);

    scene.destroy();
    h.remove();
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

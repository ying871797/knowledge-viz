import { describe, it, expect, vi } from "vitest";
import { NumberChart, spanX, spanCenterX, buildStepPath, yFor, W, M } from "../numberChart";
import { meiosisCourse, oogenesisCourse } from "../../courses/meiosis/data";
import { mitosisCourse } from "../../courses/mitosis/data";
import { pcrCourse } from "../../courses/pcr/data";
import { expectStageLabelsFit } from "../../test-utils/textAudit";

/**
 * 解析 buildStepPath 产出的 d，追踪笔位。
 * 返回途经点与全部垂直跳变（阶跃）位置——两者都是「时期段」语义的直接可观测量。
 */
function tracePath(d: string): { points: Array<[number, number]>; jumps: number[] } {
  const tokens = d.trim().split(/\s+/);
  const points: Array<[number, number]> = [];
  const jumps: number[] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") { x = +tokens[i++]; y = +tokens[i++]; }
    else if (cmd === "H") { x = +tokens[i++]; }
    else if (cmd === "V") { y = +tokens[i++]; jumps.push(x); }
    else if (cmd === "L") { x = +tokens[i++]; y = +tokens[i++]; }
    else throw new Error(`未预期的路径命令：${cmd}`);
    points.push([x, y]);
  }
  return { points, jumps };
}

describe("坐标映射", () => {
  it("spanX 给出 n+1 条等宽时期边界并覆盖绘图区", () => {
    const n = 5;
    expect(spanX(0, n)).toBe(M.left);
    expect(spanX(n, n)).toBeCloseTo(W - M.right, 6);
    // 段数 = 边界数 − 1，且各段等宽
    const widths = Array.from({ length: n }, (_, i) => spanX(i + 1, n) - spanX(i, n));
    widths.forEach((w) => expect(w).toBeCloseTo(widths[0], 6));
    expect(widths[0]).toBeCloseTo((W - M.left - M.right) / n, 6);
  });
  it("spanCenterX 落在各自时期段正中", () => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      expect(spanCenterX(i, n)).toBeCloseTo((spanX(i, n) + spanX(i + 1, n)) / 2, 6);
      expect(spanCenterX(i, n)).toBeGreaterThan(spanX(i, n));
      expect(spanCenterX(i, n)).toBeLessThan(spanX(i + 1, n));
    }
  });
  it("yFor 值越大越靠上", () => {
    expect(yFor(0, 8)).toBeGreaterThan(yFor(8, 8));
  });
});

describe("阶梯路径：期内恒定 + 边界阶跃", () => {
  // 4,4 → 8,8 → 2：两次真实的数量变化，落在段 2 与段 4 的左缘
  const values = [4, 4, 8, 8, 2];
  const n = values.length;
  const yMax = 8;
  const y = (v: number): number => yFor(v, yMax);
  const at = (points: Array<[number, number]>, x: number): number[] =>
    points.filter((p) => Math.abs(p[0] - x) < 1e-6).map((p) => p[1]);

  it("阶跃全部落在时期段边界上，不落在段内部", () => {
    const { jumps } = tracePath(buildStepPath(values, yMax, new Set()));
    expect(jumps).toEqual([spanX(2, n), spanX(4, n)]);
    // 反向校验：任一边界都不是段内点
    const boundaries = Array.from({ length: n + 1 }, (_, k) => spanX(k, n));
    jumps.forEach((jx) => expect(boundaries.some((b) => Math.abs(b - jx) < 1e-6)).toBe(true));
  });
  it("每个时期段的两端高度都等于本段值（段内恒定）", () => {
    const { points } = tracePath(buildStepPath(values, yMax, new Set()));
    for (let i = 0; i < n; i++) {
      expect(at(points, spanX(i, n))).toContain(y(values[i]));
      expect(at(points, spanX(i + 1, n))).toContain(y(values[i]));
    }
  });
  it("相邻两段值相同时不产生阶跃（平台跨段延续）", () => {
    // 段 2、段 3 同为 8 → 只在段 2 左缘跳一次
    const { jumps } = tracePath(buildStepPath(values, yMax, new Set()));
    expect(jumps).not.toContain(spanX(3, n));
  });
  it("路径覆盖整条绘图区（首点在左缘、末点在右缘）", () => {
    const { points } = tracePath(buildStepPath(values, yMax, new Set()));
    expect(points[0][0]).toBe(M.left);
    expect(points[points.length - 1][0]).toBeCloseTo(W - M.right, 6);
  });
  it("单点数据也铺满整段（n=1 不退化为空路径）", () => {
    const { points } = tracePath(buildStepPath([4], 8, new Set()));
    expect(points[0][0]).toBe(M.left);
    expect(points[points.length - 1][0]).toBeCloseTo(W - M.right, 6);
  });
  it("空数据返回空路径", () => {
    expect(buildStepPath([], 8, new Set())).toBe("");
  });
});

describe("渐变段：间期 DNA 复制为段内线性斜坡", () => {
  const values = [4, 8, 2, 2]; // index 1 = 间期（复制）：DNA 4→8
  const n = values.length;
  const yMax = 8;
  const y = (v: number): number => yFor(v, yMax);

  it("斜坡两端高度 = 上一段值 / 本段值，恰好填满该段", () => {
    const { points } = tracePath(buildStepPath(values, yMax, new Set([1])));
    expect(points.filter((p) => Math.abs(p[0] - spanX(1, n)) < 1e-6).map((p) => p[1])).toContain(y(values[0]));
    expect(points.filter((p) => Math.abs(p[0] - spanX(2, n)) < 1e-6).map((p) => p[1])).toContain(y(values[1]));
  });
  it("渐变段内不产生阶跃，其余段仍为阶跃", () => {
    const { jumps } = tracePath(buildStepPath(values, yMax, new Set([1])));
    expect(jumps).toEqual([spanX(2, n)]); // 段 3（2）仍靠阶跃，段 2 不再重复跳变
  });
  it("段内值不变的渐变段退化为水平线（染色体数在间期不变）", () => {
    const flat = [4, 4, 8];
    const { points, jumps } = tracePath(buildStepPath(flat, 8, new Set([1])));
    expect(jumps).toEqual([spanX(2, 3)]);
    // 全程只在 y(4) 与 y(8) 两个高度上
    expect(new Set(points.map((p) => p[1]))).toEqual(new Set([y(4), y(8)]));
  });
});

describe("课程数据的渐变段声明", () => {
  it.each([
    ["减数分裂（精子）", meiosisCourse],
    ["减数分裂（卵细胞）", oogenesisCourse],
    ["有丝分裂", mitosisCourse],
  ])("%s：两张图都声明间期（index 1）为渐变段", (_name, course) => {
    course.chartConfigs!.forEach((cfg) => expect(cfg.gradualSegments).toEqual([1]));
  });
  it("PCR 未声明渐变段（延伸段的连续过程属已登记的示意取舍，见 progress.md）", () => {
    pcrCourse.chartConfigs!.forEach((cfg) => expect(cfg.gradualSegments).toBeUndefined());
  });
});

describe("曲线图阶段标签间距（回归：标签互相遮挡）", () => {
  it.each([
    ["减数分裂（精子）", meiosisCourse],
    ["减数分裂（卵细胞）", oogenesisCourse],
    ["有丝分裂", mitosisCourse],
    ["PCR", pcrCourse],
  ])("%s：阶段标签在移动端字号 13px 下不互相遮挡", (_name, course) => {
    expectStageLabelsFit(course.stages.map((s) => s.chartLabel ?? s.title), { fontSize: 13 });
  });
  it("长标题在 13px 下应被 chartLabel 取代才会通过（验证门禁生效）", () => {
    // 数据层作用：chartLabel 缺省时会用到 13 字标题，间距必然不达标
    expect(meiosisCourse.stages[0].chartLabel).toBe("精原细胞");
    expect(oogenesisCourse.stages[1].chartLabel).toBe("间期复制");
    // PCR 11 个阶段 → 段宽仅 60px，完整标题必然挤爆，故逐段提供短标签
    expect(pcrCourse.stages.every((s) => s.chartLabel)).toBe(true);
  });
});

describe("NumberChart 渲染", () => {
  const mount = (labels: string[] = ["甲", "乙", "丙"], gradual: number[] = []) => {
    const container = document.createElement("div");
    return { container, chart: new NumberChart(container, labels, String, 1, gradual) };
  };
  const series = [
    { label: "DNA", values: [4, 8, 4] },
    { label: "染色体", values: [4, 4, 2], dashed: true },
  ];

  it("setSeries 后生成对应数量的阶梯曲线", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    expect(container.querySelectorAll("path.curve").length).toBe(2);
  });

  it("数据点圆的纵轴位置符合映射", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    const dot = container.querySelectorAll<SVGCircleElement>("circle.dot")[0];
    // 第一条系列第一个值 4，yMax=8 → 中点高度
    const expectedY = 16 /* top */ + (240 - 16 - 44) / 2;
    expect(Number(dot.getAttribute("cy"))).toBeCloseTo(expectedY, 5);
  });

  it("阶段标签与数据点同在各自时期段的中心", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    const n = 3;
    const labels = [...container.querySelectorAll<SVGTextElement>("text.stage-label")];
    const dots = [...container.querySelectorAll<SVGCircleElement>("circle.dot")];
    expect(labels.length).toBe(n);
    expect(dots.length).toBe(2 * n); // 两条系列各 n 个点
    for (let i = 0; i < n; i++) {
      const center = spanCenterX(i, n);
      expect(Number(labels[i].getAttribute("x"))).toBeCloseTo(center, 5);
      expect(Number(dots[i].getAttribute("cx"))).toBeCloseTo(center, 5);
      expect(Number(dots[n + i].getAttribute("cx"))).toBeCloseTo(center, 5);
    }
  });

  it("渐变段的数据点落在斜坡中点（该段无单一值，点必须落在曲线上）", () => {
    const { container, chart } = mount(["甲", "乙", "丙"], [1]);
    chart.setSeries([{ label: "DNA", values: [4, 8, 8] }]);
    const dots = [...container.querySelectorAll<SVGCircleElement>("circle.dot")];
    const y = (v: number): number => yFor(v, 8);
    expect(Number(dots[0].getAttribute("cy"))).toBeCloseTo(y(4), 5); // 普通段：本段值
    expect(Number(dots[1].getAttribute("cy"))).toBeCloseTo(y(6), 5); // 渐变段：斜坡中点
    expect(Number(dots[2].getAttribute("cy"))).toBeCloseTo(y(8), 5);
    // 点确实落在曲线上：斜坡线性 ⇒ 段中心 x 对应两端值的中点
    expect(spanCenterX(1, 3)).toBeCloseTo((spanX(1, 3) + spanX(2, 3)) / 2, 6);
  });

  it("setActive 把高亮改为覆盖整段宽度的色带", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    chart.setActive(2);
    const band = container.querySelector<SVGRectElement>("rect.marker")!;
    expect(Number(band.getAttribute("x"))).toBeCloseTo(spanX(2, 3), 5);
    expect(Number(band.getAttribute("width"))).toBeCloseTo(spanX(1, 3) - spanX(0, 3), 5);
    expect(band.getAttribute("visibility")).toBe("visible");
  });

  it("高亮色带位于曲线层之下（半透明底色不遮挡曲线）", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    const svg = container.querySelector("svg")!;
    const kids = [...svg.children];
    const band = svg.querySelector("rect.marker")!;
    const seriesLayer = svg.querySelector("path.curve")!.parentElement!;
    expect(kids.indexOf(band)).toBeLessThan(kids.indexOf(seriesLayer));
  });

  it("点击数据点触发回调并携带段索引", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    const cb = vi.fn();
    chart.onPointClick(cb);
    const dot = container.querySelectorAll<SVGCircleElement>("circle.dot")[4];
    dot.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cb).toHaveBeenCalledWith(1); // 第 5 个点 = 第 2 系列 × 第 2 段
  });

  it("tickFormat 自定义纵轴刻度文本（n 表示法）", () => {
    const container = document.createElement("div");
    const chart = new NumberChart(container, ["甲"], (v) => (v > 0 && v % 2 === 0 ? `${v / 2}n` : String(v)));
    chart.setSeries([{ label: "染色体", values: [4] }]);
    const texts = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts).toContain("1n");
    expect(texts).toContain("2n");
    expect(texts).not.toContain("4"); // 4 已被格式化为 2n
  });

  it("tickStep 刻度只取 step 的整数倍（配合 n 表示法去真实条数）", () => {
    const container = document.createElement("div");
    // n=2：刻度应为 0, 2, 4, 6, 8，而非逐整数 0~8
    const chart = new NumberChart(container, ["甲"], (v) => `${v / 2}n`, 2);
    chart.setSeries([{ label: "DNA", values: [8] }]);
    const texts = [...container.querySelectorAll("text.axis-text")].map((t) => t.textContent);
    expect(texts).toEqual(["0n", "1n", "2n", "3n", "4n"]);
  });

  it("练习模式隐藏曲线与图例", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    expect(container.querySelector(".chart-legend")).toBeTruthy();
    chart.setExamMode(true);
    expect(container.querySelectorAll("path.curve").length).toBe(0);
    expect((container.querySelector(".chart-legend") as HTMLElement).style.display).toBe("none");
    chart.setExamMode(false);
    expect(container.querySelectorAll("path.curve").length).toBe(2);
    expect((container.querySelector(".chart-legend") as HTMLElement).style.display).not.toBe("none");
  });

  it("练习模式下重建坐标轴仍保持阶段标签隐藏（回归 C1）", () => {
    const { container, chart } = mount();
    // 模拟真实路径：先进入练习模式，再因勾选曲线显隐触发 setSeries 重建
    chart.setSeries(series);
    chart.setExamMode(true);
    chart.setSeries(series);
    const labels = container.querySelectorAll<SVGTextElement>("text.stage-label");
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((t) => expect(t.getAttribute("visibility")).toBe("hidden"));
    // 曲线同样不应被重新绘制
    expect(container.querySelectorAll("path.curve").length).toBe(0);
    // 退出练习模式后恢复可见
    chart.setExamMode(false);
    container.querySelectorAll<SVGTextElement>("text.stage-label")
      .forEach((t) => expect(t.hasAttribute("visibility")).toBe(false));
  });
});

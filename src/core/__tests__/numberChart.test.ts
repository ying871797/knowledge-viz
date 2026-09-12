import { describe, it, expect, vi } from "vitest";
import { NumberChart, xFor, yFor, W, M } from "../numberChart";
import { meiosisCourse, oogenesisCourse } from "../../courses/meiosis/data";
import { mitosisCourse } from "../../courses/mitosis/data";
import { expectStageLabelsFit } from "../../test-utils/textAudit";

describe("坐标映射", () => {
  it("xFor 均匀分布且覆盖绘图区", () => {
    expect(xFor(0, 5)).toBe(M.left);
    expect(xFor(4, 5)).toBe(W - M.right);
  });
  it("yFor 值越大越靠上", () => {
    expect(yFor(0, 8)).toBeGreaterThan(yFor(8, 8));
  });
});

describe("曲线图阶段标签间距（回归：标签互相遮挡）", () => {
  it.each([
    ["减数分裂（精子）", meiosisCourse],
    ["减数分裂（卵细胞）", oogenesisCourse],
    ["有丝分裂", mitosisCourse],
  ])("%s：阶段标签在移动端字号 13px 下不互相遮挡", (_name, course) => {
    expectStageLabelsFit(course.stages.map((s) => s.chartLabel ?? s.title), { fontSize: 13 });
  });
  it("减数分裂长标题在 13px 下应被 chartLabel 取代才会通过（验证门禁生效）", () => {
    // 数据层作用：chartLabel 缺省时会用到 13 字标题，间距必然不达标
    expect(meiosisCourse.stages[0].chartLabel).toBe("精原细胞");
    expect(oogenesisCourse.stages[1].chartLabel).toBe("间期（复制）");
  });
});

describe("NumberChart 渲染", () => {
  const mount = () => {
    const container = document.createElement("div");
    return { container, chart: new NumberChart(container, ["甲", "乙", "丙"]) };
  };
  const series = [
    { label: "DNA", values: [4, 8, 4] },
    { label: "染色体", values: [4, 4, 2], dashed: true },
  ];

  it("setSeries 后生成对应数量的折线", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    expect(container.querySelectorAll("polyline").length).toBe(2);
  });

  it("数据点圆的纵轴位置符合映射", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    const dot = container.querySelectorAll<SVGCircleElement>("circle.dot")[0];
    // 第一条系列第一个值 4，yMax=8 → 中点高度
    const expectedY = 16 /* top */ + (240 - 16 - 44) / 2;
    expect(Number(dot.getAttribute("cy"))).toBeCloseTo(expectedY, 5);
  });

  it("setActive 移动高亮竖线", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    chart.setActive(2);
    const line = container.querySelector<SVGLineElement>("line.marker")!;
    expect(Number(line.getAttribute("x1"))).toBeCloseTo(xFor(2, 3), 5);
  });

  it("点击数据点触发回调并携带列索引", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    const cb = vi.fn();
    chart.onPointClick(cb);
    const dot = container.querySelectorAll<SVGCircleElement>("circle.dot")[4];
    dot.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cb).toHaveBeenCalledWith(1); // 第 5 个点 = 第 2 系列 × 第 2 列
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
    expect(container.querySelectorAll("polyline").length).toBe(0);
    expect((container.querySelector(".chart-legend") as HTMLElement).style.display).toBe("none");
    chart.setExamMode(false);
    expect(container.querySelectorAll("polyline").length).toBe(2);
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
    expect(container.querySelectorAll("polyline").length).toBe(0);
    // 退出练习模式后恢复可见
    chart.setExamMode(false);
    container.querySelectorAll<SVGTextElement>("text.stage-label")
      .forEach((t) => expect(t.hasAttribute("visibility")).toBe(false));
  });
});

import { describe, it, expect, vi } from "vitest";
import { NumberChart, xFor, yFor, W, M } from "../numberChart";

describe("坐标映射", () => {
  it("xFor 均匀分布且覆盖绘图区", () => {
    expect(xFor(0, 5)).toBe(M.left);
    expect(xFor(4, 5)).toBe(W - M.right);
  });
  it("yFor 值越大越靠上", () => {
    expect(yFor(0, 8)).toBeGreaterThan(yFor(8, 8));
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

  it("练习模式隐藏曲线与图例", () => {
    const { container, chart } = mount();
    chart.setSeries(series);
    chart.setExamMode(true);
    expect(container.querySelectorAll("polyline").length).toBe(0);
    chart.setExamMode(false);
    expect(container.querySelectorAll("polyline").length).toBe(2);
  });
});

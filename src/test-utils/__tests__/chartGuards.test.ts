import { describe, it, expect } from "vitest";
import { chartSeriesViolations, FALLBACK_SERIES_COLORS } from "../chartGuards";
import type { ChartConfig } from "../../core/types";

const cfg = (series: ChartConfig["series"]): ChartConfig => ({ title: "测试图", series });
const has = (v: string[], kw: string): boolean => v.some((s) => s.includes(kw));

describe("chartSeriesViolations（跨课程图表可辨性门禁）", () => {
  it("整条序列完全相同 → 报冗余", () => {
    const v = chartSeriesViolations(
      cfg([
        { label: "A", values: [1, 2, 2] },
        { label: "B", values: [1, 2, 2], color: "#dc2626" },
      ]),
      3,
    );
    expect(has(v, "冗余")).toBe(true);
  });

  it("同色同线型平台重合 ≥2 幕 → 报", () => {
    const v = chartSeriesViolations(
      cfg([
        { label: "A", values: [0, 3, 3, 0], color: "#2563eb" },
        { label: "B", values: [1, 3, 3, 1], color: "#2563eb" },
      ]),
      4,
    );
    expect(has(v, "连续重合")).toBe(true);
  });

  it("异色重合 → 不报（颜色是可辨通道）", () => {
    const v = chartSeriesViolations(
      cfg([
        { label: "A", values: [0, 3, 3, 0], color: "#2563eb" },
        { label: "B", values: [1, 3, 3, 1], color: "#dc2626" },
      ]),
      4,
    );
    expect(v).toEqual([]);
  });

  it("同色但线型不同 → 不报（线型是可辨通道）", () => {
    const v = chartSeriesViolations(
      cfg([
        { label: "A", values: [0, 3, 3, 0], color: "#2563eb" },
        { label: "B", values: [1, 3, 3, 1], color: "#2563eb", dashed: true },
      ]),
      4,
    );
    expect(v).toEqual([]);
  });

  it("y=0 的连续重合豁免（只报绘图区 y>0 内的重合）", () => {
    const v = chartSeriesViolations(
      cfg([
        { label: "A", values: [0, 0, 0, 4, 4], color: "#2563eb" },
        { label: "B", values: [1, 2, 0, 4, 4], color: "#2563eb" },
      ]),
      5,
    );
    expect(has(v, "连续重合")).toBe(true);
    expect(has(v, "y=0")).toBe(false);
  });

  it("未声明 color 时用兜底调色板判定（下标不同即可辨）", () => {
    const v = chartSeriesViolations(
      cfg([
        { label: "A", values: [0, 3, 3, 0] },
        { label: "B", values: [1, 3, 3, 1] },
      ]),
      4,
    );
    expect(v).toEqual([]);
    expect(FALLBACK_SERIES_COLORS[0]).not.toBe(FALLBACK_SERIES_COLORS[1]);
  });
});

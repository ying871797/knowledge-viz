/**
 * 有丝分裂课程数据测试：validateCourse 门禁 + 跨课程图表可辨性门禁。
 * 原先本课只有 scene.test.ts（无数据用例），P4 通用化时补齐数据侧门禁。
 */
import { describe, it, expect } from "vitest";
import { mitosisCourse } from "../data";
import { validateCourse } from "../../../core/types";
import { chartSeriesViolations } from "../../../test-utils/chartGuards";

describe("有丝分裂课程数据", () => {
  it("通过结构校验（含数目自洽性）", () => {
    expect(() => validateCourse(mitosisCourse)).not.toThrow();
  });

  it("图内无冗余序列、无可辨性平台重合（跨课程共享门禁）", () => {
    const bad = mitosisCourse.chartConfigs!.flatMap((cfg) =>
      chartSeriesViolations(cfg, mitosisCourse.stages.length),
    );
    expect(bad).toEqual([]);
  });
});

import type { ChartConfig } from "../core/types";

/** 未声明 color 时 NumberChart 的兜底调色板（须与 core/numberChart.ts 的 COLORS 保持一致） */
export const FALLBACK_SERIES_COLORS = ["#2563eb", "#dc2626", "#b45309"] as const;

/**
 * 单张图表的「序列可辨性」违规检测（跨课程共享门禁）。
 *
 * 两类违规会让读者无法回答「哪条线是哪个量」：
 *  1) 冗余：两条序列整条 values 完全相同 —— 同一条线被画了两遍；
 *  2) 平台重合：同 (颜色, 线型) 的两条线，在绘图区内（y>0）连续 ≥2 幕同值 ——
 *     后画的完全盖住先画的。
 *
 * 判定口径为「(颜色, 线型) 双通道」：颜色或线型任一不同即视为可辨，不报。
 * y=0 豁免：两线都还没出现、贴在轴上，不构成辨识冲突。
 *
 * @param cfg 单张图表配置
 * @param stageCount 阶段数（序列长度应等于它；用于限定重合扫描区间）
 * @param fallbackColors 未声明 color 时的兜底调色板（默认与 NumberChart 一致）
 */
export function chartSeriesViolations(
  cfg: ChartConfig,
  stageCount: number,
  fallbackColors: readonly string[] = FALLBACK_SERIES_COLORS,
): string[] {
  const palette = fallbackColors.length > 0 ? fallbackColors : FALLBACK_SERIES_COLORS;
  const violations: string[] = [];
  const S = cfg.series;
  const colorOf = (i: number): string =>
    (S[i].color ?? palette[i % palette.length]).toLowerCase();
  for (let a = 0; a < S.length; a++) {
    for (let b = a + 1; b < S.length; b++) {
      const tag = `${cfg.title} / ${S[a].label} ↔ ${S[b].label}`;
      // ① 冗余：整条序列数值完全相同
      if (S[a].values.join() === S[b].values.join()) {
        violations.push(`${tag}：两条序列数值完全相同（冗余）`);
        continue;
      }
      // ② 平台重合：颜色与线型都相同才不可辨
      if (colorOf(a) !== colorOf(b) || !!S[a].dashed !== !!S[b].dashed) continue;
      let run = 0;
      for (let i = 0; i < stageCount; i++) {
        const va = S[a].values[i];
        run = va > 0 && va === S[b].values[i] ? run + 1 : 0;
        // run===2 只在每段重合的首个帧报一次，避免长平台重复刷屏
        if (run === 2) {
          violations.push(`${tag}：第 ${i - 1}~${i} 幕起在 y=${va} 连续重合（颜色与线型均相同）`);
        }
      }
    }
  }
  return violations;
}

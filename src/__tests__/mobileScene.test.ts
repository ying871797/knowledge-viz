/**
 * 移动端动画区放大静态守卫：解析 style.css 的 ≤720px 媒体查询块，
 * 断言各场景 svg 的 aspect-ratio（高/宽）不超过各自内容边界实测上限 ×保险系数。
 * CSS 无法在 jsdom 计算布局，该用例以源码文本为断言对象，防止后人调大 ratio 裁到内容。
 * 上限来源：explore 子代理对 5 个场景 viewBox 内容边界实测（见 .proposals/2026-09-26-010 方案 Tab2）。
 */
import { describe, it, expect } from "vitest";
// 用 vite 的 ?raw 内联导入 style.css 源码（vite/client 已声明 *?raw 类型，避免引入 node:fs/@types/node）
import css from "../style.css?raw";

/** 各课程场景 svg 的 aspect-ratio 中分子（divisor，即高/宽比）安全上限 */
const R_LIMITS: Record<string, number> = {
  ".mito-scene": 0.99,   // 上限 0.99（左右余量 198px / 198px）
  ".pcr-scene": 1.18,    // 上限 1.18（余量 218px / 244px，viewBox 860×500）
  ".dna-scene": 0.625,   // 上限 0.625（余量 80px / 123px）
  ".meiosis-scene": 0.595, // 上限 0.595（余量 64px / 64px）
  ".gene-scene": 0.566,  // 上限 0.566（瓶颈课程，余量 46.5px / 46.5px）
  // 上限 0.55：viewBox 960×500 原生比 0.5208；ratio=0.55 时 slice 左右各裁 480×(1−0.5208/0.55)=25.5px，
  // 内容实测横向 x 36..907（细胞轮廓左边 36 / CO₂ 移至外膜后的最右缘 907），余量 10.5px / 27.5px
  ".resp-scene": 0.55,
};

/** 提取某选择器在 ≤720px 媒体查询块内的 aspect-ratio 数值（1 / r 语法） */
function ratioOf(selector: string): number {
  const block = css.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/g);
  const inBlock = block?.join("") ?? "";
  const re = new RegExp(`${selector.replace(".", "\\.")} svg \\{[^}]*aspect-ratio:\\s*1\\s*/\\s*([\\d.]+)`, "i");
  const m = inBlock.match(re);
  if (!m) throw new Error(`${selector} 未在移动端媒体查询内声明 aspect-ratio`);
  return Number(m[1]);
}

describe("style.css 移动端动画区放大", () => {
  it("横向留白压缩规则存在于媒体查询块内（body:not(.page-home) 隔离首页）", () => {
    const block = css.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/g)?.join("") ?? "";
    expect(block).toContain("body:not(.page-home) #app");
    expect(block).toMatch(/\.course-grid\s*\{[^}]*gap:\s*12px/);
    expect(block).toMatch(/\.course-grid section\s*\{[^}]*padding:\s*6px/);
  });

  it.each(Object.keys(R_LIMITS))("%s 的 aspect-ratio 高/宽比不超内容边界上限", (selector) => {
    const r = ratioOf(selector);
    expect(r).toBeLessThanOrEqual(R_LIMITS[selector]);
    expect(r).toBeGreaterThan(0.5); // 必须 >0.5：低于 0.5 会改成裁上下而非左右空白
  });
});
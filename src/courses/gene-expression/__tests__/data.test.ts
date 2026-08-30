/** 基因表达课程数据测试：幕结构 + 序列自洽 */
import { describe, it, expect } from "vitest";
import { validateCourse } from "../../../core/types";
import {
  geneExpressionCourse, SEQ_CODING, SEQ_TEMPLATE, SEQ_MRNA, ANTICODONS, CODON_COUNT,
} from "../data";

describe("基因的表达课程数据", () => {
  it("通过 validateCourse 门禁（无 numbers 课程）", () => {
    expect(() => validateCourse(geneExpressionCourse)).not.toThrow();
  });

  it("meta 与幕 id 序列符合方案（12 幕）", () => {
    expect(geneExpressionCourse.meta).toMatchObject({
      id: "gene-expression", chapter: "必修二 第4章第1节", difficulty: 3,
    });
    expect(geneExpressionCourse.chartConfigs).toBeUndefined();
    const ids = geneExpressionCourse.stages.map((s) => s.id);
    expect(ids).toEqual([
      "t0-helix", "t1-bind", "t2-elongate", "t3-release", "t4-exit",
      "l1-codons", "l2-assemble", "l3-peptide1", "l4-shift", "l5-peptide2", "l6-stop", "l7-fold",
    ]);
  });

  it("序列长度 = 12bp，编码链与模板链按 A-T/C-G 互补", () => {
    const COMP: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
    expect(SEQ_CODING.length).toBe(12);
    expect(SEQ_TEMPLATE.length).toBe(12);
    SEQ_CODING.forEach((b, i) => expect(COMP[b]).toBe(SEQ_TEMPLATE[i]));
  });

  it("mRNA 由模板链转录而来：A-U、C-G 配对，且含 U 不含 T", () => {
    const COMP: Record<string, string> = { A: "U", T: "A", C: "G", G: "C" };
    SEQ_TEMPLATE.forEach((b, i) => expect(COMP[b]).toBe(SEQ_MRNA[i]));
    expect(SEQ_MRNA.some((b) => b === "T")).toBe(false);
    expect(SEQ_MRNA.some((b) => b === "U")).toBe(true);
  });

  it("密码子结构：起始 AUG 打头、终止 UAG 收尾；反密码子与对应密码子互补", () => {
    const codons = [0, 1, 2, 3].map((k) => SEQ_MRNA.slice(k * 3, k * 3 + 3).join(""));
    expect(codons[0]).toBe("AUG");
    expect(codons[CODON_COUNT - 1]).toBe("UAG");
    // 反密码子与 mRNA 密码子反向平行互补（示意课程按正向互补呈现）
    const COMP: Record<string, string> = { A: "U", U: "A", C: "G", G: "C" };
    ANTICODONS.forEach((anti, k) => {
      [...anti].forEach((b, j) => expect(COMP[b]).toBe(codons[k][j]));
    });
  });
});

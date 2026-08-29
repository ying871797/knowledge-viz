import type { Course, Stage, StageIdState } from "../../core/types";

// ============ 序列常量（12bp = 4 密码子） ============
// 编码链（上行，不被读）；模板链（下行，被转录）；mRNA 为转录产物。
// 设计约束：含真实起始密码子 AUG 与终止密码子 UAG，中间两个有义密码子。
export const SEQ_CODING = ["A", "T", "G", "C", "C", "G", "T", "G", "T", "T", "A", "G"];
export const SEQ_TEMPLATE = ["T", "A", "C", "G", "G", "C", "A", "C", "A", "A", "T", "C"];
export const SEQ_MRNA = ["A", "U", "G", "C", "C", "G", "U", "G", "U", "U", "A", "G"];

// tRNA 反密码子（按进入顺序）：分别对 mRNA 密码子 AUG / CCG / UGU
export const ANTICODONS = ["UAC", "GGC", "ACA"];
// 每个密码子边界 x 坐标由场景按 STEP 计算，此处仅声明分组语义：4 组 × 3 碱基
export const CODON_COUNT = 4;

/** 构造阶段（无数目字段课程） */
const st = (id: string, title: string, narration: string[]): Stage<StageIdState> => ({
  id,
  title,
  narration,
  sceneState: { stage: id },
});

export const geneExpressionCourse: Course<StageIdState> = {
  meta: {
    id: "gene-expression",
    title: "基因的表达",
    chapter: "必修二 第4章第1节",
    difficulty: 3,
  },
  stages: [
    // —— 转录（5 幕） ——
    st("t0-helix", "基因与模板链", [
      "基因是有遗传效应的 DNA 片段：图中这段双链就是一个基因",
      "转录时只以其中一条链为模板——本基因以下方那条链作为模板链",
      "DNA 双链按碱基互补配对：A-T、C-G",
    ]),
    st("t1-bind", "聚合酶结合", [
      "RNA 聚合酶与基因的起始端结合，转录即将开始",
      "【拓展】聚合酶识别并结合的位点称为启动子",
    ]),
    st("t2-elongate", "延伸", [
      "RNA 聚合酶边移动边把 DNA 双链局部解开成转录泡",
      "以模板链为模板，按碱基互补配对合成 mRNA：模板 A-U、C-G 配对",
      "注意：RNA 中没有 T，与 A 配对的是 U",
    ]),
    st("t3-release", "终止与脱落", [
      "聚合酶到达基因末端，mRNA 合成完成并从 DNA 上脱落",
      "DNA 双链重新恢复双螺旋结构",
    ]),
    st("t4-exit", "出核", [
      "mRNA 通过核孔从细胞核出来，进入细胞质",
      "翻译的场所是细胞质中的核糖体",
    ]),
    // —— 翻译（7 幕） ——
    st("l1-codons", "密码子分组", [
      "mRNA 上每 3 个相邻碱基决定 1 个氨基酸，称为 1 个密码子",
      "12 个碱基 = 4 个密码子；密码子连续阅读、不重叠",
    ]),
    st("l2-assemble", "核糖体装配", [
      "核糖体与 mRNA 结合，罩住前两个密码子，翻译开始",
      "第一个 tRNA 携带氨基酸进入 P 位，反密码子 UAC 与密码子 AUG 互补配对",
    ]),
    st("l3-peptide1", "进位与成肽①", [
      "第二个 tRNA 携带氨基酸进入 A 位，反密码子 GGC 与密码子 CCG 配对",
      "P 位上的氨基酸转移到 A 位氨基酸上并形成肽键——肽链开始延伸",
    ]),
    st("l4-shift", "移位", [
      "核糖体沿着 mRNA 向右移动一个密码子的距离（3 个碱基）",
      "携带肽链的 tRNA 仍与原密码子配对、被套入 P 位；失去氨基酸的空 tRNA 随即离开",
    ]),
    st("l5-peptide2", "进位与成肽②", [
      "第三个 tRNA 进入 A 位，反密码子 ACA 与密码子 UGU 配对，同样方式成肽",
      "如此循环：进位 → 成肽 → 移位，肽链不断延长",
    ]),
    st("l6-stop", "终止与释放", [
      "核糖体继续前移，A 位对准终止密码子 UAG——没有 tRNA 能与之配对",
      "多肽链从核糖体上释放，翻译结束",
      "【拓展】终止密码子由释放因子识别，促使多肽脱离核糖体",
    ]),
    st("l7-fold", "折叠完成", [
      "多肽链盘曲折叠，形成具有一定空间结构的蛋白质",
      "从基因到蛋白质：转录把遗传信息传给 mRNA，翻译把它读成氨基酸序列",
    ]),
  ],
};

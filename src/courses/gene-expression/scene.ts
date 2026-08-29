import type { SceneComponent } from "../../core/types";
import { ANTICODONS, SEQ_CODING, SEQ_MRNA, SEQ_TEMPLATE } from "./data";

// ============ 画布几何 ============
const NS = "http://www.w3.org/2000/svg";
const VB_W = 800, VB_H = 400;
const X0 = 180, STEP = 40;            // 12 个碱基位：x = 180 + i×40（180~620）
const BAND_H = 24;                    // 链带视觉厚度（path 描边宽）
const Y_TOP = 150, Y_BOT = 250;       // DNA 贴合态纵坐标
const SEP_TOP = 110, SEP_BOT = 290;   // 转录泡张开时两链纵坐标
const DIAG = 34;                      // 泡缘斜坡水平跨度（落在两字母间隙内，不压字母）
const MRNA_H = 16;                    // mRNA 条带厚
const MRNA_Y_FREE = 330;              // 脱落/出核态 mRNA 纵坐标
const MRNA_Y_RIBO = 112;              // 翻译工作位 mRNA 纵坐标
// 泡内配对刻度纵坐标（t2：mRNA 带贴模板泡段上方 8px）
const MRNA_Y_BUBBLE = MRNA_Y_BUBBLE_CALC();
function MRNA_Y_BUBBLE_CALC(): number { return SEP_BOT - BAND_H / 2 - 8 - MRNA_H / 2; } // = 265
// 翻译区
const SEP_XS = [300, 420, 540];        // 密码子组界线 x（codon 边界）
const RIBO_W = 264;                    // 核糖体窗宽（罩住两个密码子）
const RIBO_P_OFF = 64, RIBO_A_OFF = 184; // P/A 位中心相对窗左缘偏移
const TRNA_BEAD_Y = 210;               // 肽链珠行 y（大亚基下缘）
const TRNA_ENTRY_DY = 90;              // 待入场 tRNA 与其氨基酸珠在锚点下方等候的位移（绑定上升入场）
// 核膜弧（两段留 90px 缺口 = 核孔）
const MEM_L = "M 50 236 Q 240 308 432 296";
const MEM_R = "M 524 294 Q 620 286 752 238";

// ============ 阶段几何状态（声明式槽位表） ============
interface Gx {
  bubble: number;                       // 已解离碱基数（-1 = 无泡/已复旋）
  dnaOp: number;                        // DNA 组件组透明度（翻译幕整体退场）
  roleLabels: boolean;                  // 「编码链/模板链」标签（仅 t0/t1）
  hbond: boolean[];                     // 12 条 DNA-DNA 氢键显隐
  mrnaLen: number;                      // mRNA 已合成碱基数（0 = 不可见）
  mrnaY: number | null;                 // mRNA 带中心 y（null = 隐藏）
  mrnaTicks: boolean;                   // 泡内模板-mRNA 配对刻度（仅延伸帧）
  polX: number | null;                  // RNA 聚合酶中心 x（null = 退场）
  membrane: boolean;                    // 核膜弧显隐（仅出核帧）
  groups: boolean;                      // 密码子组界线（l1 起）
  riboX: number | null;                 // 核糖体窗左缘 x（null = 退场）
  trnaX: (number | null)[];             // 三只 tRNA 中心 x（null = 该只不可见）
  trnaLeaving?: number[];               // 处于离场中的 tRNA 索引：下坠 96px 并半透明，下一帧彻底退场
  trnaEntry?: number[];                 // 处于待入场（下方等候）的 tRNA 索引：在各自锚点下方 +90px、透明度 0，下一帧绑定上升入场
  beads: ([number, number] | null)[];   // 肽链珠坐标（珠数 = 肽链长度）
  beadPark?: ([number, number] | null)[]; // 隐藏珠的停靠坐标（默认 0,0）：出场前落在槽位，避免从画布角落滑入
  folded: boolean;                      // 折叠完成态（珠聚拢成团）
}
const HB_ALL = Array.from({ length: 12 }, () => true);
const NONE_3 = [null, null, null];
const NO_BEADS = [null, null, null];

const GEOM: Record<string, Gx> = {
  "t0-helix": {
    bubble: -1, dnaOp: 1, roleLabels: true, hbond: [...HB_ALL],
    mrnaLen: 0, mrnaY: null, mrnaTicks: false, polX: null, membrane: false,
    groups: false, riboX: null, trnaX: [...NONE_3], beads: [...NO_BEADS], folded: false,
  },
  "t1-bind": {
    bubble: -1, dnaOp: 1, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 0, mrnaY: null, mrnaTicks: false, polX: 120, membrane: false,
    groups: false, riboX: null, trnaX: [...NONE_3], beads: [...NO_BEADS], folded: false,
  },
  "t2-elongate": {
    // 快照式转录泡：前 6 个碱基解离（codon1~2 区），mRNA 生长至 6bp，聚合酶骑在泡右缘
    bubble: 6, dnaOp: 1, roleLabels: false,
    hbond: [false, false, false, false, false, false, true, true, true, true, true, true],
    mrnaLen: 6, mrnaY: MRNA_Y_BUBBLE, mrnaTicks: true, polX: 470, membrane: false,
    groups: false, riboX: null, trnaX: [...NONE_3], beads: [...NO_BEADS], folded: false,
  },
  "t3-release": {
    // 完成：mRNA 全长脱落横陈下方，DNA 复旋、氢键复原，酶退场
    bubble: -1, dnaOp: 1, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_FREE, mrnaTicks: false, polX: null, membrane: false,
    groups: false, riboX: null, trnaX: [...NONE_3], beads: [...NO_BEADS], folded: false,
  },
  "t4-exit": {
    // 出核：核膜弧短暂出现（缺口=核孔），mRNA 已穿至弧下方细胞质区
    bubble: -1, dnaOp: 1, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_FREE, mrnaTicks: false, polX: null, membrane: true,
    groups: false, riboX: null, trnaX: [...NONE_3], beads: [...NO_BEADS], folded: false,
  },
  "l1-codons": {
    // 翻译开场：DNA 整组退场，mRNA 升至工作位，组界线显现；起始 tRNA① 在 P 位锚点（220）下方+90px 静候出场
    bubble: -1, dnaOp: 0, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_RIBO, mrnaTicks: false, polX: null, membrane: false,
    groups: true, riboX: null, trnaX: [220, null, null], trnaEntry: [0],
    beads: [...NO_BEADS], beadPark: [[220, TRNA_BEAD_Y + TRNA_ENTRY_DY], null, null], folded: false,
  },
  "l2-assemble": {
    // 起始 tRNA① 携甲硫氨酸珠一同上升入 P 位；第二个 tRNA② 携珠在 A 位锚点（340）下方等候
    bubble: -1, dnaOp: 0, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_RIBO, mrnaTicks: false, polX: null, membrane: false,
    groups: true, riboX: 156, trnaX: [220, 340, null], trnaEntry: [1],
    beads: [[220, TRNA_BEAD_Y], null, null], beadPark: [null, [340, TRNA_BEAD_Y + TRNA_ENTRY_DY], null], folded: false,
  },
  "l3-peptide1": {
    // 进位帧：新 tRNA② 携其氨基酸珠绑定上升入 A 位（锚点 156+184=340），两者同址同行程；
    // 旧链珠以 22px 间距向左排开（珠间距=键线可见区间），成肽后链挂在持链 tRNA② 上；tRNA③ 携珠在 460 下方等候
    bubble: -1, dnaOp: 0, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_RIBO, mrnaTicks: false, polX: null, membrane: false,
    groups: true, riboX: 156, trnaX: [220, 340, null], beads: [[318, TRNA_BEAD_Y], [340, TRNA_BEAD_Y], null],
    beadPark: [null, null, [460, TRNA_BEAD_Y + TRNA_ENTRY_DY]], folded: false,
  },
  "l4-shift": {
    // 移位：仅核糖体窗右移一格（+120 = 3×STEP）；tRNA 与密码子氢键结合、横向不动，
    // 原 A 位持链 tRNA② 被"套入"新 P 位锚点（276+64=340）——绝不回移（用户目检抓帧混淆 bug）；
    // tRNA③ 携珠在 A 位锚点（276+184=460）下方等候，下一帧绑定入场
    bubble: -1, dnaOp: 0, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_RIBO, mrnaTicks: false, polX: null, membrane: false,
    groups: true, riboX: 276, trnaX: [220, 340, 460], trnaLeaving: [0], trnaEntry: [2],
    beads: [[318, TRNA_BEAD_Y], [340, TRNA_BEAD_Y], null], beadPark: [null, null, [460, TRNA_BEAD_Y + TRNA_ENTRY_DY]], folded: false,
  },
  "l5-peptide2": {
    // 进位帧：新氨基酸珠③与新 tRNA③ 同位（A 位锚点 276+184=460，对 UGU），肽链延长为 3 珠
    bubble: -1, dnaOp: 0, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_RIBO, mrnaTicks: false, polX: null, membrane: false,
    groups: true, riboX: 276, trnaX: [null, 340, 460], beads: [[416, TRNA_BEAD_Y], [438, TRNA_BEAD_Y], [460, TRNA_BEAD_Y]], folded: false,
  },
  "l6-stop": {
    // 再移位后 A 位对准终止密码子（窗左缘 396 → A 位中心 580 = codon4 UAG），无 tRNA 对位
    bubble: -1, dnaOp: 0, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_RIBO, mrnaTicks: false, polX: null, membrane: false,
    groups: true, riboX: 396, trnaX: [null, 340, 460], trnaLeaving: [1], beads: [[416, TRNA_BEAD_Y], [438, TRNA_BEAD_Y], [460, TRNA_BEAD_Y]], folded: false,
  },
  "l7-fold": {
    // 完成：核糖体与 tRNA 退场，肽链珠盘曲成团示意功能蛋白
    bubble: -1, dnaOp: 0, roleLabels: false, hbond: [...HB_ALL],
    mrnaLen: 12, mrnaY: MRNA_Y_RIBO, mrnaTicks: false, polX: null, membrane: false,
    groups: false, riboX: null, trnaX: [...NONE_3], beads: [[382, 266], [406, 256], [398, 286]], folded: true,
  },
};
const FALLBACK = GEOM["t0-helix"];

// ============ 工具 ============
function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** DNA 单链折线路径：泡区平直于分离位，斜坡跨过字母间隙回到贴合位 */
function chainPath(ySep: number, yFlat: number, bubble: number): string {
  if (bubble <= 0) return `M 150 ${yFlat} L 650 ${yFlat}`;
  const lastOpen = X0 + (bubble - 1) * STEP;           // 最后一个已解离字母的 x
  return `M 150 ${ySep} L ${lastOpen} ${ySep} L ${lastOpen + DIAG} ${yFlat} L 650 ${yFlat}`;
}

// ============ 场景组件 ============
export function createGeneExpressionScene(): SceneComponent & { destroy(): void } {
  let root: SVGSVGElement | null = null;
  let wrap: HTMLDivElement | null = null;
  let dnaGroup: SVGGElement;
  let chainTop: SVGPathElement, chainBot: SVGPathElement;
  const topLetters: SVGTextElement[] = [];
  const botLetters: SVGTextElement[] = [];
  const hbonds: SVGLineElement[] = [];
  const roleLabels: SVGTextElement[] = [];
  let mrnaBand: SVGRectElement;
  const mrnaLetters: SVGTextElement[] = [];
  const mrnaTicks: SVGLineElement[] = [];
  let polIcon: SVGGElement;
  const membranes: SVGPathElement[] = [];
  const seps: SVGLineElement[] = [];
  let ribo: SVGGElement;
  let extBadge: HTMLDivElement;
  const trnas: SVGGElement[] = [];
  const beads: SVGCircleElement[] = [];
  const bonds: SVGLineElement[] = [];

  /** 逐元素查表布局 */
  function layout(s: Record<string, unknown>): void {
    if (!root) return;
    const g = GEOM[String(s.stage)] ?? FALLBACK;

    // —— DNA 组件组：链折线 + 字母 + 氢键 + 角色标签 ——
    dnaGroup.style.opacity = String(g.dnaOp);
    chainTop.setAttribute("d", chainPath(SEP_TOP, Y_TOP, g.bubble));
    chainBot.setAttribute("d", chainPath(SEP_BOT, Y_BOT, g.bubble));
    const topYAt = (i: number): number => (g.bubble > 0 && i < g.bubble ? SEP_TOP : Y_TOP);
    const botYAt = (i: number): number => (g.bubble > 0 && i < g.bubble ? SEP_BOT : Y_BOT);
    topLetters.forEach((t, i) => t.setAttribute("y", String(topYAt(i) + 5)));
    botLetters.forEach((t, i) => t.setAttribute("y", String(botYAt(i) + 5)));
    hbonds.forEach((line, i) => { line.style.opacity = g.hbond[i] ? "1" : "0"; });
    roleLabels.forEach((t) => { t.style.opacity = g.roleLabels ? "1" : "0"; });

    // —— mRNA 带：宽度随合成进度生长，位置逐阶段声明 ——
    if (g.mrnaY === null || g.mrnaLen === 0) {
      mrnaBand.style.opacity = "0";
      mrnaLetters.forEach((t) => { t.style.opacity = "0"; });
    } else {
      mrnaBand.style.opacity = "1";
      mrnaBand.setAttribute("x", String(X0 - 24));
      mrnaBand.setAttribute("y", String(g.mrnaY - MRNA_H / 2));
      // 带宽 = 首尾字母覆盖 + 左 24/右 8 余量：延伸帧右缘（388）不压已复平区模板链描边（x≥414）
      mrnaBand.setAttribute("width", String((g.mrnaLen - 1) * STEP + 32));
      mrnaLetters.forEach((t, i) => {
        const on = i < g.mrnaLen;
        t.style.opacity = on ? "1" : "0";
        if (on) t.setAttribute("y", String(g.mrnaY! + 5));
      });
    }
    // 泡内模板-mRNA 配对刻度：粗细按配对类型（模板 A ↔ mRNA U 为 2 键）
    mrnaTicks.forEach((line, i) => {
      const tv = SEQ_TEMPLATE[i], mv = SEQ_MRNA[i];
      const weak = (tv === "A" && mv === "U") || (tv === "T" && mv === "A");
      line.setAttribute("stroke-width", weak ? "2" : "3.5");
      line.setAttribute("y1", String(g.mrnaY! + MRNA_H / 2));
      line.setAttribute("y2", String(SEP_BOT - BAND_H / 2));
      line.style.opacity = g.mrnaTicks ? "1" : "0";
    });

    // —— 聚合酶 / 核膜 / 组界线 ——
    polIcon.style.opacity = g.polX === null ? "0" : "1";
    polIcon.style.transform = `translate(${g.polX ?? 0}px, 200px)`;
    membranes.forEach((p) => { p.style.opacity = g.membrane ? "1" : "0"; });
    seps.forEach((l) => { l.style.opacity = g.groups ? "1" : "0"; });

    // —— 核糖体（窗左缘定位；步进恒为一个密码子宽 3×STEP） ——
    ribo.style.opacity = g.riboX === null ? "0" : "1";
    ribo.style.transform = `translate(${g.riboX ?? 0}px, 0px)`;

    // —— tRNA ×3：倒 T 杆，底部反密码子对位当前密码子；离场者下坠并半透明（下一帧退场），
    //     待入场者在其锚点下方 +TRNA_ENTRY_DY 静候（半透明 0），下一帧与所携氨基酸珠一同绑定上升 ——
    const LEAVING_DY = 96;
    trnas.forEach((tgrp, k) => {
      const x = g.trnaX[k];
      const leaving = (g.trnaLeaving ?? []).includes(k);
      const entering = (g.trnaEntry ?? []).includes(k);
      tgrp.style.opacity = x === null ? "0" : leaving ? "0.45" : "1";
      tgrp.style.transform = `translate(${x ?? 0}px, ${leaving ? LEAVING_DY : entering ? TRNA_ENTRY_DY : 0}px)`;
    });

    // —— 肽链珠 + 肽键线（键线只在相邻两珠齐备且未折叠时显示） ——
    // 珠坐标每帧落位（含隐藏珠的 beadPark 停靠坐标）：出场时珠已停在槽位，淡入/上升不外滑不飞角
    beads.forEach((c, k) => {
      const p = g.beads[k];
      const park = g.beadPark?.[k];
      const pos = p ?? park;
      c.style.opacity = p ? "1" : "0";
      if (pos) {
        c.setAttribute("cx", String(pos[0]));
        c.setAttribute("cy", String(pos[1]));
      }
    });
    bonds.forEach((l, j) => {
      const a = g.beads[j], b = g.beads[j + 1];
      const on = !!(a && b) && !g.folded;
      l.style.opacity = on ? "1" : "0";
      if (a && b) {
        // 从珠缘连到珠缘（珠间距 22、半径 9 → 4px 可见短杆），方向随左右次序
        const dir = Math.sign(b[0] - a[0]) || 1;
        l.setAttribute("x1", String(a[0] + 9 * dir));
        l.setAttribute("y1", String(a[1]));
        l.setAttribute("x2", String(b[0] - 9 * dir));
        l.setAttribute("y2", String(b[1]));
      }
    });

    // 拓展角标：启动子（t1）/ 释放因子（l6）
    extBadge.style.display = ["t1-bind", "l6-stop"].includes(String(s.stage)) ? "block" : "none";
  }

  return {
    /** 挂载：创建固定元素池（零增删，阶段间仅插值）。可重入：先清空闭包数组 */
    mount(container: HTMLElement) {
      [topLetters, botLetters, hbonds, roleLabels, mrnaLetters, mrnaTicks, membranes, seps, trnas, beads, bonds]
        .forEach((a) => { a.length = 0; });
      wrap = document.createElement("div");
      wrap.className = "gene-scene";
      const svgRoot = el("svg", { viewBox: `0 0 ${VB_W} ${VB_H}`, width: "100%" });
      root = svgRoot;
      wrap.appendChild(svgRoot);

      // —— DNA 组件组（翻译幕整体淡出） ——
      dnaGroup = el("g", { class: "dna-group" });
      svgRoot.appendChild(dnaGroup);
      chainTop = el("path", { class: "dna-chain-top", fill: "none", stroke: "#64748b", "stroke-width": BAND_H, "stroke-linecap": "round", "stroke-linejoin": "round" });
      chainBot = el("path", { class: "dna-chain-bot", fill: "none", stroke: "#94a3b8", "stroke-width": BAND_H, "stroke-linecap": "round", "stroke-linejoin": "round" });
      dnaGroup.append(chainTop, chainBot);
      SEQ_CODING.forEach((base, i) => {
        const t = el("text", { class: "dna-letter-top", x: X0 + i * STEP, y: Y_TOP + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#ffffff" });
        t.textContent = base;
        topLetters.push(t);
        dnaGroup.appendChild(t);
      });
      SEQ_TEMPLATE.forEach((base, i) => {
        const t = el("text", { class: "dna-letter-bot", x: X0 + i * STEP, y: Y_BOT + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#ffffff" });
        t.textContent = base;
        botLetters.push(t);
        dnaGroup.appendChild(t);
      });
      // 氢键横杆（A-T 细 / C-G 粗，沿用复制课程语义）
      SEQ_CODING.forEach((top, i) => {
        const pairAT = (top === "A" && SEQ_TEMPLATE[i] === "T") || (top === "T" && SEQ_TEMPLATE[i] === "A");
        const line = el("line", {
          class: "hbond", x1: X0 + i * STEP, y1: Y_TOP + BAND_H / 2, x2: X0 + i * STEP, y2: Y_BOT - BAND_H / 2,
          stroke: "#94a3b8", "stroke-width": pairAT ? 2 : 3.5,
        });
        hbonds.push(line);
        dnaGroup.appendChild(line);
      });
      // 链角色标签（仅 t0 帧）：说破"读哪条链"
      const rl1 = el("text", { class: "role-label", x: 700, y: Y_TOP + 5, "text-anchor": "middle", "font-size": 13, fill: "#334155", opacity: 0 });
      rl1.textContent = "编码链";
      const rl2 = el("text", { class: "role-label", x: 700, y: Y_BOT + 5, "text-anchor": "middle", "font-size": 13, fill: "#334155", opacity: 0 });
      rl2.textContent = "模板链（被读）";
      roleLabels.push(rl1, rl2);
      dnaGroup.append(rl1, rl2);

      // —— mRNA 紫带 + 12 字母 ——
      mrnaBand = el("rect", { class: "mrna-band", x: X0 - 24, y: MRNA_Y_RIBO - MRNA_H / 2, width: 0, height: MRNA_H, rx: 6, fill: "#8b5cf6", opacity: 0 });
      svgRoot.appendChild(mrnaBand);
      SEQ_MRNA.forEach((base, i) => {
        const t = el("text", { class: "mrna-letter", x: X0 + i * STEP, y: MRNA_Y_RIBO + 5, "text-anchor": "middle", "font-size": 15, "font-weight": "bold", fill: "#ffffff", opacity: 0 });
        t.textContent = base;
        mrnaLetters.push(t);
        svgRoot.appendChild(t);
      });

      // —— 泡内配对刻度 ×6（仅延伸帧可见；粗细在 layout 中按配对类型设定） ——
      for (let i = 0; i < 6; i++) {
        const line = el("line", { class: "mrna-tick", x1: X0 + i * STEP, y1: 0, x2: X0 + i * STEP, y2: 0, stroke: "#94a3b8", "stroke-width": 2, opacity: 0 });
        mrnaTicks.push(line);
        svgRoot.appendChild(line);
      }

      // —— RNA 聚合酶（青，工具语义与复制课程聚合酶一致） ——
      polIcon = el("g", { class: "enzyme-pol", opacity: 0 });
      polIcon.appendChild(el("circle", { r: 26, fill: "#14b8a6", stroke: "#0f766e", "stroke-width": 2 }));
      const polText = el("text", { y: 5, "text-anchor": "middle", "font-size": 11, "font-weight": "bold", fill: "#ffffff" });
      polText.textContent = "RNA聚合酶";
      polIcon.appendChild(polText);
      svgRoot.appendChild(polIcon);

      // —— 核膜弧 ×2（缺口 = 核孔；仅出核帧可见） ——
      [MEM_L, MEM_R].forEach((d, i) => {
        const p = el("path", { class: `membrane mem-${i}`, d, fill: "none", stroke: "#475569", "stroke-width": 3, opacity: 0 });
        membranes.push(p);
        svgRoot.appendChild(p);
      });

      // —— 密码子组界线 ×3（虚线短杆，l1 起） ——
      SEP_XS.forEach((x) => {
        const l = el("line", { class: "codon-sep", x1: x, y1: 92, x2: x, y2: 132, stroke: "#94a3b8", "stroke-width": 1.5, "stroke-dasharray": "4 3", opacity: 0 });
        seps.push(l);
        svgRoot.appendChild(l);
      });

      // —— 核糖体（大小亚基 + P/A 位点标签；窗左缘经 transform 定位） ——
      ribo = el("g", { class: "ribosome", opacity: 0 });
      const ribSmall = el("rect", { class: "rib-small", x: 0, y: 74, width: RIBO_W, height: 24, rx: 10, fill: "#e2e8f0", "fill-opacity": 0.55, stroke: "#334155", "stroke-width": 1.5 });
      const ribLarge = el("rect", { class: "rib-large", x: 0, y: 126, width: RIBO_W, height: 84, rx: 14, fill: "#e2e8f0", "fill-opacity": 0.55, stroke: "#334155", "stroke-width": 1.5 });
      ribo.append(ribSmall, ribLarge);
      [["P", RIBO_P_OFF], ["A", RIBO_A_OFF]].forEach(([txt, off]) => {
        const t = el("text", { class: "pa-label", x: off as number, y: 91, "text-anchor": "middle", "font-size": 14, "font-weight": "bold", fill: "#334155" });
        t.textContent = txt as string;
        ribo.appendChild(t);
      });
      svgRoot.appendChild(ribo);

      // —— tRNA ×3：倒 T 杆（紫）+ 反密码子白字；氨基酸珠独立成池 ——
      ANTICODONS.forEach((anti, k) => {
        const grp = el("g", { class: `trna trna-${k}`, opacity: 0 });
        const antiText = el("text", { class: "anticodon", x: 0, y: 142, "text-anchor": "middle", "font-size": 13, "font-weight": "bold", fill: "#ffffff" });
        antiText.textContent = anti;
        const arm = el("rect", { class: "trna-arm", x: -26, y: 148, width: 52, height: 8, rx: 3, fill: "#8b5cf6" });
        const rod = el("rect", { class: "trna-rod", x: -5, y: 148, width: 10, height: 54, rx: 4, fill: "#8b5cf6" });
        grp.append(antiText, arm, rod);
        trnas.push(grp);
        svgRoot.appendChild(grp);
      });

      // —— 肽链珠 ×3 + 肽键线 ×2 ——
      for (let k = 0; k < 3; k++) {
        const c = el("circle", { class: `peptide-bead pb-${k}`, r: 9, fill: "#f59e0b", stroke: "#b45309", "stroke-width": 1.5, opacity: 0 });
        beads.push(c);
        svgRoot.appendChild(c);
      }
      for (let k = 0; k < 2; k++) {
        const l = el("line", { class: `peptide-bond bond-${k}`, stroke: "#b45309", "stroke-width": 3, opacity: 0 });
        bonds.push(l);
        svgRoot.appendChild(l);
      }
      // 图例由 app.ts 渲染为 HTML 覆盖层，不在 SVG 内绘制

      // 拓展角标（启动子 / 释放因子）
      extBadge = document.createElement("div");
      extBadge.className = "ext-badge";
      extBadge.textContent = "拓展知识点";
      wrap.appendChild(extBadge);

      container.appendChild(wrap);
    },

    render(state: Record<string, unknown>) {
      layout(state);
    },

    destroy() {
      wrap?.remove();
    },

    legend: [
      { color: "#64748b", label: "灰——DNA 双链" },
      { color: "#8b5cf6", label: "紫——mRNA / tRNA" },
      { color: "#14b8a6", label: "青——RNA 聚合酶" },
      { color: "#f59e0b", label: "橙——氨基酸" },
    ],
  };
}

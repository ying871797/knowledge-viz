/** 基因表达场景测试：元素池结构 / 转录泡快照 / 翻译循环 / 色相预算 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createGeneExpressionScene } from "../scene";
import { SEQ_TEMPLATE, SEQ_MRNA } from "../data";

describe("基因的表达场景（固定元素池）", () => {
  let host: HTMLDivElement;
  const scene = createGeneExpressionScene();

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    scene.mount(host);
  });
  afterEach(() => {
    scene.destroy();
    host.remove();
  });

  const trnaEl = (k: number) => host.querySelector<SVGGElement>(`.trna-${k}`)!;
  const bead = (k: number) => host.querySelector<SVGCircleElement>(`.pb-${k}`)!;
  const bond = (k: number) => host.querySelector<SVGLineElement>(`.bond-${k}`)!;
  const mrnaBand = () => host.querySelector<SVGRectElement>(".mrna-band")!;
  const ribo = () => host.querySelector<SVGGElement>(".ribosome")!;

  it("挂载：双链折线 + 24 字母 + 12 氢键 + mRNA 12 字母 + 刻度 6 + 核膜 2 + 组界线 3 + tRNA 3 + 珠 3 + 键 2", () => {
    expect(host.querySelectorAll(".dna-chain-top").length).toBe(1);
    expect(host.querySelectorAll(".dna-chain-bot").length).toBe(1);
    expect(host.querySelectorAll(".dna-letter-top").length).toBe(12);
    expect(host.querySelectorAll(".dna-letter-bot").length).toBe(12);
    expect(host.querySelectorAll("line.hbond").length).toBe(12);
    expect(host.querySelectorAll(".mrna-letter").length).toBe(12);
    expect(host.querySelectorAll("line.mrna-tick").length).toBe(6);
    expect(host.querySelectorAll("path.membrane").length).toBe(2);
    expect(host.querySelectorAll("line.codon-sep").length).toBe(3);
    expect(host.querySelectorAll("g.trna").length).toBe(3);
    expect(host.querySelectorAll("circle.peptide-bead").length).toBe(3);
    expect(host.querySelectorAll("line.peptide-bond").length).toBe(2);
    expect(host.querySelectorAll("text.pa-label").length).toBe(2);
  });

  it("t0：无泡直线双链 + 角色标签说破读下行", () => {
    scene.render({ stage: "t0-helix" });
    expect(host.querySelector<SVGPathElement>(".dna-chain-top")!.getAttribute("d")).toBe("M 150 150 L 650 150");
    expect(host.querySelector<SVGPathElement>(".dna-chain-bot")!.getAttribute("d")).toBe("M 150 250 L 650 250");
    const labels = [...host.querySelectorAll<SVGTextElement>(".role-label")];
    expect(labels.map((t) => t.textContent)).toEqual(["编码链", "模板链（被读）"]);
    labels.forEach((t) => expect(t.style.opacity).toBe("1"));
    host.querySelectorAll<SVGLineElement>("line.hbond").forEach((l) => {
      expect(l.style.opacity).toBe("1");
    });
  });

  it("t2 快照式转录泡：前 6bp 解离带斜坡，mRNA 生长至 6bp 并贴模板上方", () => {
    scene.render({ stage: "t2-elongate" });
    // 泡缘斜坡跨字母间隙（pos5@380 → pos6@420 之间），不压任何字母
    expect(host.querySelector<SVGPathElement>(".dna-chain-top")!.getAttribute("d"))
      .toBe("M 150 110 L 380 110 L 414 150 L 650 150");
    // mRNA 带宽 = 首尾字母覆盖 + 余量（右缘 388 不压复平区模板链描边 x≥414）
    expect(mrnaBand().getAttribute("width")).toBe(String(5 * 40 + 32));
    expect(mrnaBand().getAttribute("y")).toBe(String(262 - 8));
    // 聚合酶骑在泡右缘
    expect(host.querySelector<SVGGElement>(".enzyme-pol")!.getAttribute("transform")).toBe("translate(470, 200)");
    // 泡内配对刻度可见且粗细符合配对规则（模板 A↔mRNA U 细 / C-G 粗）
    const ticks = [...host.querySelectorAll<SVGLineElement>("line.mrna-tick")];
    ticks.forEach((t) => expect(t.style.opacity).toBe("1"));
    expect(ticks[0].getAttribute("stroke-width")).toBe("2");   // T-A
    expect(ticks[2].getAttribute("stroke-width")).toBe("3.5"); // C-G
    // 前 6 个 mRNA 字母与序列一致（含 U）
    const shown = [...host.querySelectorAll<SVGTextElement>(".mrna-letter")]
      .filter((t) => t.style.opacity === "1")
      .map((t) => t.textContent ?? "");
    expect(shown.join("")).toBe(SEQ_MRNA.slice(0, 6).join(""));
  });

  it("t3/t4：脱落复旋后出核——核膜仅此一帧在场", () => {
    scene.render({ stage: "t3-release" });
    expect(mrnaBand().getAttribute("y")).toBe(String(330 - 8));
    expect(mrnaBand().getAttribute("width")).toBe(String(11 * 40 + 32));
    host.querySelectorAll<SVGLineElement>("line.hbond").forEach((l) => expect(l.style.opacity).toBe("1"));
    scene.render({ stage: "t4-exit" });
    host.querySelectorAll<SVGPathElement>("path.membrane").forEach((p) => expect(p.style.opacity).toBe("1"));
    scene.render({ stage: "l1-codons" });
    host.querySelectorAll<SVGPathElement>("path.membrane").forEach((p) => expect(p.style.opacity).toBe("0"));
    // 翻译幕 DNA 整组退场、组界线就位
    expect(host.querySelector<SVGGElement>(".dna-group")!.style.opacity).toBe("0");
    const seps = [...host.querySelectorAll<SVGLineElement>("line.codon-sep")];
    expect(seps.map((l) => l.getAttribute("x1"))).toEqual(["300", "420", "540"]);
    seps.forEach((l) => expect(l.style.opacity).toBe("1"));
  });

  it("翻译装配：核糖体罩 codon1~2，起始 tRNA 入 P 位且反密码子对位", () => {
    scene.render({ stage: "l2-assemble" });
    expect(ribo().getAttribute("transform")).toBe("translate(156, 0)");
    expect(trnaEl(0).getAttribute("transform")).toBe("translate(220, 0)");
    expect(trnaEl(0).style.opacity).toBe("1");
    expect(trnaEl(0).querySelector("text.anticodon")!.textContent).toBe("UAC"); // 对 AUG
    expect(bead(0).getAttribute("cx")).toBe("220");
    expect(bead(0).getAttribute("cy")).toBe("210");
  });

  it("进位成肽①→移位：核糖体步距恰为一个密码子（120px），空载 tRNA 退场", () => {
    scene.render({ stage: "l3-peptide1" });
    expect(trnaEl(1).getAttribute("transform")).toBe("translate(340, 0)");
    expect(bead(1).style.opacity).toBe("1");
    expect(bond(0).style.opacity).toBe("1");
    scene.render({ stage: "l4-shift" });
    // 步距 = 276 − 156 = 120 = 3 × STEP
    expect(Number(/translate\((\d+)/.exec(ribo().getAttribute("transform")!)![1]) - 156).toBe(120);
    // 持链 tRNA 横向不动（钉在密码子上），由右移的核糖体框套入新 P 位锚点 276+64=340——
    // 若出现回移即参考系混淆回归（用户目检抓出过的 bug）
    expect(trnaEl(1).getAttribute("transform")).toBe("translate(340, 0)");
    expect(trnaEl(1).style.opacity).toBe("1");
    // 空载 tRNA① 不就地消失：下坠离场（半透明），下一帧才彻底退场
    expect(trnaEl(0).style.opacity).toBe("0.45");
    expect(trnaEl(0).getAttribute("transform")).toBe("translate(220, 96)");
  });

  it("第二轮成肽后终止：A 位对准终止密码子且无 tRNA 对位", () => {
    scene.render({ stage: "l5-peptide2" });
    // 第三只 tRNA 进位到新 A 位锚点（276+184=460，对 UGU）——不在旧位置 340
    expect(trnaEl(2).getAttribute("transform")).toBe("translate(460, 0)");
    expect(bead(2).style.opacity).toBe("1");
    expect(bond(1).style.opacity).toBe("1");
    scene.render({ stage: "l6-stop" });
    // 再移位一格：396 − 276 = 120
    expect(Number(/translate\((\d+)/.exec(ribo().getAttribute("transform")!)![1]) - 276).toBe(120);
    // P 位 tRNA③ 对 codon3（中心 460），A 位（580 = 终止密码子 UAG）空
    expect(trnaEl(2).getAttribute("transform")).toBe("translate(460, 0)");
    // 空载 tRNA② 同样以下坠离场呈现，tRNA① 已彻底退场
    expect(trnaEl(0).style.opacity).toBe("0");
    expect(trnaEl(1).style.opacity).toBe("0.45");
    expect(trnaEl(1).getAttribute("transform")).toBe("translate(340, 96)");
    // 反密码子 ACA 与密码子 UGU 配对（数据自洽的场景侧印证）
    expect(trnaEl(2).querySelector("text.anticodon")!.textContent).toBe("ACA");
    expect(`${SEQ_TEMPLATE[9]}${SEQ_TEMPLATE[10]}${SEQ_TEMPLATE[11]}`).toBe("ATC");
  });

  it("折叠完成：核糖体与 tRNA 全部退场，肽链珠聚拢成团、键线隐没", () => {
    scene.render({ stage: "l7-fold" });
    expect(ribo().style.opacity).toBe("0");
    [0, 1, 2].forEach((k) => expect(trnaEl(k).style.opacity).toBe("0"));
    expect(bead(0).getAttribute("cx")).toBe("382");
    expect(bead(2).getAttribute("cy")).toBe("286");
    [0, 1].forEach((k) => expect(bond(k).style.opacity).toBe("0"));
  });

  it("色相预算：全部填充/描边色落在白名单内（同屏 ≤3 编码色相的结构保证）", () => {
    scene.render({ stage: "l5-peptide2" });   // 同屏最拥挤帧：紫 mRNA+tRNA、青酶已退、橙珠、灰氢键
    scene.render({ stage: "t2-elongate" });   // 再查转录帧
    const ALLOWED = new Set([
      "#64748b", "#94a3b8", "#ffffff", "#334155", "#475569",
      "#8b5cf6", "#14b8a6", "#0f766e", "#e2e8f0", "#f59e0b", "#b45309", "none",
    ]);
    const shapes = host.querySelectorAll<SVGElement>("path, rect, circle, line");
    shapes.forEach((s) => {
      const fill = s.getAttribute("fill");
      const stroke = s.getAttribute("stroke");
      if (fill !== null) expect(ALLOWED.has(fill)).toBe(true);
      if (stroke !== null) expect(ALLOWED.has(stroke)).toBe(true);
    });
  });

  it("模板链-mRNA 配对自洽（场景刻度粗细的数据依据）", () => {
    const COMP: Record<string, string> = { A: "U", T: "A", C: "G", G: "C" };
    SEQ_TEMPLATE.forEach((b, i) => expect(COMP[b]).toBe(SEQ_MRNA[i]));
  });
});

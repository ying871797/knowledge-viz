/** DNA 复制场景测试（段 1）：元素池结构 + 阶段 1~2 几何状态 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDnaReplicationScene } from "../scene";
import { SEQ_TOP } from "../data";

describe("DNA 复制场景（固定元素池）", () => {
  let host: HTMLDivElement;
  const scene = createDnaReplicationScene();

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    scene.mount(host);
  });
  afterEach(() => {
    scene.destroy();
    host.remove();
  });

  it("挂载：2 条链带（各含 12 碱基字母 + 5′/3′ 标注）+ 12 氢键 + 2 解旋酶", () => {
    expect(host.querySelectorAll(".band-top").length).toBe(1);
    expect(host.querySelectorAll(".band-bot").length).toBe(1);
    expect(host.querySelectorAll(".band-top text").length).toBe(14);   // 12 碱基 + 2 端标
    expect(host.querySelectorAll(".band-bot text").length).toBe(14);
    expect(host.querySelectorAll("line.hbond").length).toBe(12);
    expect(host.querySelectorAll(".helicase-icon").length).toBe(2);
    // 端标注：上链 5′/3′，下链 3′/5′（反向平行）
    const topTexts = [...host.querySelectorAll<SVGTextElement>(".band-top text")].map((t) => t.textContent);
    expect(topTexts).toContain("5′");
    expect(topTexts).toContain("3′");
    const botTexts = [...host.querySelectorAll<SVGTextElement>(".band-bot text")].map((t) => t.textContent);
    expect(botTexts).toContain("3′");
    expect(botTexts).toContain("5′");
    // 碱基字母按序列排布
    const topBases = topTexts.filter((t) => t !== "5′" && t !== "3′");
    expect(topBases).toEqual(SEQ_TOP);
  });

  it("氢键粗细：C-G（3.5）粗于 A-T（2）——对应氢键数差异", () => {
    const lines = host.querySelectorAll<SVGLineElement>("line.hbond");
    // 序列 pos1 = C-G → 粗（3.5）；pos4 = A-T → 细（2）
    expect(lines[0].getAttribute("stroke-width")).toBe("3.5");
    expect(lines[3].getAttribute("stroke-width")).toBe("2");
  });

  it("解旋酶标注移动方向箭头：左叉←、右叉→（双向复制可视化）", () => {
    scene.render({ stage: "unwind" });
    const icons = host.querySelectorAll<SVGGElement>(".helicase-icon");
    const arrows = [...icons].map((g) => g.querySelector("text.helicase-arrow")!.textContent);
    expect(arrows).toEqual(["←", "→"]);
  });

  it("视图切换：螺旋视图显示双链曲线与横档，平面层隐藏；切回恢复", () => {
    const btn = host.querySelector<HTMLButtonElement>(".view-switch")!;
    expect(btn.textContent).toContain("螺旋视图");
    btn.click();
    // 螺旋层显现：两条链曲线 + 12 横档；平面层隐藏
    expect(host.querySelectorAll(".helix-layer path.helix-strand").length).toBe(2);
    expect(host.querySelectorAll(".helix-layer line.helix-rung").length).toBe(12);
    expect(host.querySelector<SVGGElement>(".helix-layer")!.style.display).toBe("");
    expect(host.querySelector<SVGGElement>(".flat-layer")!.style.display).toBe("none");
    // 阶段 2 解旋：中段横档淡出（解旋气泡）
    scene.render({ stage: "unwind" });
    const rungs = [...host.querySelectorAll<SVGLineElement>(".helix-layer line.helix-rung")];
    expect(rungs[0].style.opacity).toBe("1");
    expect(rungs[5].style.opacity).toBe("0");
    expect(rungs[11].style.opacity).toBe("1");
    // 切回平面视图
    btn.click();
    expect(host.querySelector<SVGGElement>(".flat-layer")!.style.display).toBe("");
    expect(host.querySelector<SVGGElement>(".helix-layer")!.style.display).toBe("none");
  });

  it("初始视图为平面（螺旋层经 style 隐藏而非属性，避免回退陷阱）", () => {
    const layer = host.querySelector<SVGGElement>(".helix-layer")!;
    expect(layer.hasAttribute("display")).toBe(false);
    expect(layer.style.display).toBe("none");
    // flat 层同理：显隐统一走 style 通道
    expect(host.querySelector<SVGGElement>(".flat-layer")!.hasAttribute("display")).toBe(false);
  });

  it("场景控件栏：DNA 专属控件（碱基字母开关+视图切换），无减数分裂控件串入", () => {
    // 减数分裂专属控件不得串入 DNA 课程
    expect(host.querySelector<HTMLButtonElement>(".mode-switch")).toBeNull();
    const buttons = [...host.querySelectorAll<HTMLButtonElement>(".scene-controls button")];
    expect(buttons.map((b) => b.textContent)).not.toContain("自由组合（减Ⅰ后期可用）");
    // DNA 专属：视图切换按钮
    expect(host.querySelector<HTMLButtonElement>(".view-switch")!.textContent).toContain("螺旋视图");
    // 碱基字母开关（语义适配 DNA 语境）
    const toggle = host.querySelector<HTMLInputElement>(".scene-controls input")!;
    expect(toggle.closest("label")!.textContent).toContain("碱基");
  });

  it("拓展角标：引物/冈崎/切除相关帧显示，其余帧隐藏", () => {
    const badge = host.querySelector<HTMLDivElement>(".ext-badge")!;
    scene.render({ stage: "priming" });
    expect(badge.style.display).toBe("block");
    scene.render({ stage: "lagging" });
    expect(badge.style.display).toBe("block");
    scene.render({ stage: "removal" });
    expect(badge.style.display).toBe("block");
    scene.render({ stage: "helix" });
    expect(badge.style.display).toBe("none");
  });

  it("阶段1 双螺旋：全部氢键可见，链带位于基础位置，解旋酶隐藏", () => {
    scene.render({ stage: "helix" });
    const lines = host.querySelectorAll<SVGLineElement>("line.hbond");
    lines.forEach((l) => expect(l.style.opacity).toBe("1"));
    expect(host.querySelector<SVGGElement>(".band-top")!.style.transform).toBe("translate(0px, 0px)");
    expect(host.querySelector<SVGGElement>(".helicase-group, g[opacity]")!.getAttribute("opacity")).toBe("0");
  });

  it("阶段2 解旋：中段氢键断开（下标 3~8），外侧拉伸连接；链带分离；解旋酶显现于两叉", () => {
    scene.render({ stage: "unwind" });
    const lines = host.querySelectorAll<SVGLineElement>("line.hbond");
    // 断开：下标 3~8
    for (let i = 0; i < 12; i++) {
      expect(lines[i].style.opacity).toBe(i >= 3 && i <= 8 ? "0" : "1");
    }
    // 外侧氢键随链带分离拉伸（y1 上移、y2 下移）
    expect(lines[0].getAttribute("y1")).toBe("122");
    expect(lines[0].getAttribute("y2")).toBe("278");
    // 链带分离：上移 40 / 下移 40
    expect(host.querySelector<SVGGElement>(".band-top")!.style.transform).toBe("translate(0px, -40px)");
    expect(host.querySelector<SVGGElement>(".band-bot")!.style.transform).toBe("translate(0px, 40px)");
    // 解旋酶显现于左右两叉（x = 290 / 530）；显隐走 style 通道
    const icons = host.querySelectorAll<SVGGElement>(".helicase-icon");
    expect(icons[0].getAttribute("transform")).toBe("translate(290, 200)");
    expect(icons[1].getAttribute("transform")).toBe("translate(530, 200)");
    expect(host.querySelector<SVGGElement>(".helicase-group")!.style.opacity).toBe("1");
  });

  it("未实现阶段回退到解旋态占位", () => {
    scene.render({ stage: "priming" });
    const lines = host.querySelectorAll<SVGLineElement>("line.hbond");
    expect(lines[3].style.opacity).toBe("0");
  });
});

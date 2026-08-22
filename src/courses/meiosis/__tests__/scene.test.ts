import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMeiosisScene } from "../scene";
import type { MeiosisState } from "../data";

/** 构造场景状态的便捷函数（缺省为散布基态） */
const st = (over: Partial<MeiosisState>): MeiosisState => ({
  cells: 1, replicated: false, pairing: false, crossingOver: false,
  equatorial: "none", separating: "none", spermShape: false,
  ...over,
});

describe("减数分裂场景组件", () => {
  let host: HTMLDivElement;
  const scene = createMeiosisScene();

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    scene.mount(host);
  });
  afterEach(() => {
    scene.destroy();
    host.remove();
  });

  /** 取指定 key 的染色体组元素 */
  const chromo = (key: string) =>
    host.querySelector<SVGGElement>(`.chromo-${key}`)!;

  it("mount 后包含 4 条染色体与控制开关栏", () => {
    expect(host.querySelectorAll(".chromo").length).toBe(4);
    expect(host.querySelector(".scene-controls")).toBeTruthy();
    // 初始未 render：互换标记与第二条臂均隐藏
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.querySelector("rect")!.style.display).toBe("none");
      expect(g.querySelectorAll("path")[1].style.display).toBe("none");
    });
  });

  it("减Ⅰ前期（联会+互换）：显示互换色带与 X 形，单个细胞轮廓", () => {
    scene.render(st({ replicated: true, pairing: true, crossingOver: true }));
    expect(host.querySelectorAll(".cell-outline").length).toBe(1);
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.querySelector("rect")!.style.display).toBe("");
      expect(g.querySelectorAll("path")[1].style.display).toBe("");
    });
  });

  it("减Ⅰ后期：同源分离，染色体位置镜像取决于自由组合方向", () => {
    scene.render(st({ replicated: true, pairing: true, separating: "homolog" }));
    const xA1 = chromo("A1").style.transform;
    const xB2 = chromo("B2").style.transform;
    // 默认组合下 A1 在左上、B2 在左下（cx-160）；镜像切换时二者 x 翻转
    expect(xA1).toBe("translate(240px, 150px)");
    expect(xB2).toBe("translate(240px, 250px)");
  });

  it("点击「切换自由组合方式」按钮：A1 位置镜像翻转，再点一次翻回", () => {
    // cells:1 + separating:"homolog" 走自由组合布局分支（comboAlt 决定左右）
    scene.render(st({ separating: "homolog" }));
    const before = chromo("A1").style.transform;
    // 默认组合下 A1 在左上（cx-160 = 400-160 = 240）
    expect(before).toBe("translate(240px, 150px)");
    const btn = host.querySelector<HTMLButtonElement>(".scene-controls button")!;
    btn.dispatchEvent(new Event("click"));
    // 翻转后 A1 镜像到右侧（cx+160 = 560），y 不变
    expect(chromo("A1").style.transform).toBe("translate(560px, 150px)");
    // 再点一次应恢复原位置
    btn.dispatchEvent(new Event("click"));
    expect(chromo("A1").style.transform).toBe(before);
  });

  it("减Ⅱ末期 4 细胞精子形态：4 个椭圆头部与 4 条尾部", () => {
    scene.render(st({ cells: 4, spermShape: true }));
    expect(host.querySelectorAll(".cell-outline").length).toBe(4);
    expect(host.querySelectorAll(".sperm-tail").length).toBe(4);
  });

  it("点击染色体显示气泡，再次 render 后隐藏", () => {
    scene.render(st({ replicated: true, pairing: true, crossingOver: true }));
    const bubble = host.querySelector<HTMLDivElement>(".chromo-bubble")!;
    expect(bubble.style.display).toBe("none");
    chromo("A1").dispatchEvent(new Event("click"));
    expect(bubble.style.display).toBe("block");
    expect(bubble.textContent).toContain("姐妹染色单体");
    scene.render(st({ replicated: true }));
    expect(bubble.style.display).toBe("none");
  });

  it("勾选「显示基因标注」后基因字样可见，取消后隐藏", () => {
    scene.render(st({ replicated: true, pairing: true }));
    const input = host.querySelector<HTMLInputElement>(".scene-controls input")!;
    input.checked = true;
    input.dispatchEvent(new Event("change"));
    expect(chromo("A1").querySelector("text")!.getAttribute("visibility")).toBe("visible");
    input.checked = false;
    input.dispatchEvent(new Event("change"));
    expect(chromo("A1").querySelector("text")!.getAttribute("visibility")).toBe("hidden");
  });

  it("replicated=false 时隐藏 X 形第二臂（如减Ⅱ后期）", () => {
    scene.render(st({ cells: 2, replicated: false, separating: "sister" }));
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.querySelectorAll("path")[1].style.display).toBe("none");
      expect(g.querySelector("rect")!.style.display).toBe("none");
    });
  });
});

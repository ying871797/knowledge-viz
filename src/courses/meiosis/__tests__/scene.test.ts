import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMeiosisScene, computeSlots, usableRadius, CELL_CENTERS, CELL_RADIUS } from "../scene";
import { meiosisCourse } from "../data";
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

  it("减Ⅰ后期：同源分离，默认组合方式一（A 与 B 同极）", () => {
    scene.render(st({ replicated: true, pairing: true, separating: "homolog" }));
    const xA1 = chromo("A1").style.transform;
    const xB2 = chromo("B2").style.transform;
    // 默认组合下 A1 在上极左侧、B2 在下极左侧（cx∓Ru*0.7 = 400∓53）；y 按 ±Ru*0.5 上下错开
    expect(xA1).toBe("translate(347px, 162px)");
    expect(xB2).toBe("translate(347px, 238px)");
  });

  it("点击「切换自由组合方式」：B 对对调极性（A 与 b 同极），再点一次还原", () => {
    // cells:1 + separating:"homolog" 走减Ⅰ后期布局分支
    scene.render(st({ separating: "homolog" }));
    // 默认组合方式一：A1 上极左（347,162）、B2 下极左（347,238）
    expect(chromo("A1").style.transform).toBe("translate(347px, 162px)");
    expect(chromo("B2").style.transform).toBe("translate(347px, 238px)");
    const btn = host.querySelector<HTMLButtonElement>(".scene-controls button")!;
    btn.dispatchEvent(new Event("click"));
    // 方式二：A 对不动，B2 对调到上极与 A1 紧贴（-53+26=-27 → x=373，y=162）
    expect(chromo("A1").style.transform).toBe("translate(347px, 162px)");
    expect(chromo("B2").style.transform).toBe("translate(373px, 162px)");
    // 说明文字随切换而变化且常驻显示
    const hint = host.querySelector<HTMLDivElement>(".combo-hint")!;
    expect(hint.style.display).toBe("inline-block");
    expect(hint.textContent).toContain("方式二");
    // 再点一次应恢复原位置
    btn.dispatchEvent(new Event("click"));
    expect(chromo("A1").style.transform).toBe("translate(347px, 162px)");
    expect(chromo("B2").style.transform).toBe("translate(347px, 238px)");
    expect(hint.textContent).toContain("方式一");
  });

  it("非减Ⅰ后期阶段：自由组合按钮禁用、文案提示可用时机、点击无效", () => {
    scene.render(st({ replicated: true, pairing: true })); // 减Ⅰ中期，非 homolog 分离
    const btn = host.querySelector<HTMLButtonElement>(".scene-controls button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("自由组合（减Ⅰ后期可用）");
    // 说明文字隐藏
    expect(host.querySelector<HTMLDivElement>(".combo-hint")!.style.display).toBe("none");
    btn.dispatchEvent(new Event("click")); // 被守卫忽略，comboAlt 保持 false
    // 之后进入减Ⅰ后期仍为默认组合方式一（B2 在下极），证明禁用期点击未生效
    scene.render(st({ separating: "homolog" }));
    expect(chromo("B2").style.transform).toBe("translate(347px, 238px)");
  });

  it("减Ⅱ末期 4 细胞精子形态：4 个椭圆头部与 4 条尾部", () => {
    scene.render(st({ cells: 4, spermShape: true }));
    expect(host.querySelectorAll(".cell-outline").length).toBe(4);
    expect(host.querySelectorAll(".sperm-tail").length).toBe(4);
    // 缩放适配：精子期每条染色体 transform 需含 scale(0.3)，避免穿出椭圆头部
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.style.transform).toContain("scale(0.3)");
    });
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

  it("渲染后的 transform 与 computeSlots 纯函数结果一致（以基态为例）", () => {
    scene.render(st({}));
    const { offsets } = computeSlots(st({}), false);
    for (const [key, [dx, dy]] of Object.entries(offsets)) {
      // 单细胞中心为 (400, 200)，槽位偏移取整后拼入 transform
      expect(chromo(key).style.transform).toBe(`translate(${400 + dx}px, ${200 + dy}px)`);
    }
  });

  it("分裂后布局自适应：两细胞上下排列、四细胞 2×2 网格、半径放大", () => {
    // 布局常量符合本轮设计规格
    expect(CELL_CENTERS[2]).toEqual([[400, 105], [400, 295]]);
    expect(CELL_CENTERS[4]).toEqual([[270, 115], [530, 115], [270, 285], [530, 285]]);
    expect(CELL_RADIUS[2]).toBe(95);
    expect(CELL_RADIUS[4]).toBe(82);
    // 两细胞期（减Ⅰ末期）：染色体跟随新中心 (400,105)，h=Ru*0.5=round(10.5)=11
    scene.render(st({ cells: 2, replicated: true }));
    expect(chromo("A1").style.transform).toBe("translate(389px, 105px)");
    // 四细胞期轮廓为四个圆（非精子形态）
    scene.render(st({ cells: 4 }));
    expect(host.querySelectorAll(".cell-outline").length).toBe(4);
    expect(host.querySelectorAll(".sperm-tail").length).toBe(0);
  });

  it("基因标注字号随所属细胞半径自适应", () => {
    // 单细胞 R=150 → max(13, round(150*0.16)=24) = 24
    scene.render(st({ replicated: true, pairing: true }));
    expect(chromo("A1").querySelector("text")!.getAttribute("font-size")).toBe("24");
    // 四细胞期 R=82 → max(13, round(82*0.16)=13) = 13
    scene.render(st({ cells: 4 }));
    expect(chromo("A1").querySelector("text")!.getAttribute("font-size")).toBe("13");
  });
});

/** 两点间欧氏距离 */
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// 遍历课程全部 10 个阶段，对槽位表断言布局不变式 1、2
describe.each(meiosisCourse.stages.map((s) => [s.id, s.sceneState] as const))(
  "阶段「%s」槽位不变式",
  (_id, rawState) => {
    // Stage.sceneState 为宽泛的 Record 类型，此处按课程约定收窄为 MeiosisState
    const state = rawState as unknown as MeiosisState;
    const table = computeSlots(state, false);
    const ru = usableRadius(state.cells);

    it("不变式1：任意染色体中心到所属细胞中心的距离 ≤ 该细胞 Ru", () => {
      for (const key of Object.keys(table.offsets)) {
        expect(dist(table.offsets[key], [0, 0])).toBeLessThanOrEqual(ru);
      }
    });

    it("不变式2：同一细胞内任意两条染色体的中心距 ≥ 20", () => {
      const keys = Object.keys(table.offsets);
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          // 不同细胞的染色体不参与比较
          if (table.cellOf[keys[i]] !== table.cellOf[keys[j]]) continue;
          expect(dist(table.offsets[keys[i]], table.offsets[keys[j]])).toBeGreaterThanOrEqual(20);
        }
      }
    });
  },
);

it("comboAlt 切换组合方式：A 对位置不变，B 对两成员对调极性；其余阶段不受影响", () => {
  // comboAlt 仅在减Ⅰ后期布局分支生效：A 对保持原位，B 对 y 取反（换到另一极）
  const anaphase = meiosisCourse.stages.find((s) => s.id === "anaphase-I")!.sceneState as unknown as MeiosisState;
  const base = computeSlots(anaphase, false).offsets;
  const alt = computeSlots(anaphase, true).offsets;
  for (const key of ["A1", "A2"]) {
    expect(alt[key]).toEqual(base[key]);
  }
  for (const key of ["B1", "B2"]) {
    // 方式二下 B 对成员换极（y 取反），并与同极的 A 对成员紧贴（x 向 A 对靠拢 PAIR_CENTER_DIST）
    expect(alt[key][1]).toBe(-base[key][1]);
    const partner = key === "B1" ? "A2" : "A1";
    expect(Math.abs(alt[key][0] - base[partner][0])).toBe(26); // = PAIR_CENTER_DIST
    expect(dist(alt[key], alt[partner])).toBeGreaterThanOrEqual(20);
  }
  // 其余阶段不受 comboAlt 影响：坐标完全一致
  for (const stage of meiosisCourse.stages) {
    if (stage.id === "anaphase-I") continue;
    const a = computeSlots(stage.sceneState as unknown as MeiosisState, false).offsets;
    const b = computeSlots(stage.sceneState as unknown as MeiosisState, true).offsets;
    for (const key of Object.keys(a)) {
      expect(b[key]).toEqual(a[key]);
    }
  }
});

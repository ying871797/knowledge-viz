import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMeiosisScene, computeSlots, usableRadius, CELL_CENTERS, CELL_RADIUS } from "../scene";
import { meiosisCourse, oogenesisCourse } from "../data";
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
    location.hash = "";   // 防止模式切换用例中途失败污染后续套件的路由状态
  });

  /** 取指定 key 的染色体组元素 */
  const chromo = (key: string) =>
    host.querySelector<SVGGElement>(`.chromo-${key}`)!;

  it("mount 后包含 4 条染色体与控制开关栏", () => {
    expect(host.querySelectorAll(".chromo").length).toBe(4);
    expect(host.querySelector(".scene-controls")).toBeTruthy();
    // 初始未 render：竖杆可见，对角臂与姊妹着丝点均隐藏；互换色带已整体移除
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.querySelector("rect")).toBeNull();
      expect(g.querySelectorAll("path")[0].style.display).toBe("");
      expect(g.querySelectorAll("path")[1].style.display).toBe("none");
      expect(g.querySelectorAll("path")[2].style.display).toBe("none");
    });
  });

  it("减Ⅰ前期（联会+互换）：X 形呈现，单个细胞轮廓（互换以文字叙述承载）", () => {
    scene.render(st({ replicated: true, pairing: true, crossingOver: true }));
    expect(host.querySelectorAll(".cell-outline").length).toBe(1);
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.querySelector("rect")).toBeNull();
      expect(g.querySelectorAll("path")[0].style.display).toBe("none"); // 竖杆隐藏
      expect(g.querySelectorAll("path")[1].style.display).toBe("");     // 对角臂 A
      expect(g.querySelectorAll("path")[2].style.display).toBe("");     // 对角臂 B
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

  it("减Ⅱ末期 4 细胞精子形态：4 个椭圆头部与 4 条尾部，染色体放大可读", () => {
    scene.render(st({ cells: 4, spermShape: true }));
    expect(host.querySelectorAll(".cell-outline").length).toBe(4);
    expect(host.querySelectorAll(".sperm-tail").length).toBe(4);
    // 缩放适配：精子期每条染色体 transform 需含放大后的 scale(0.45)，
    // 且头部椭圆同步加大（ry = R*0.52），保证 71*0.45≈32 ≤ ry*0.8≈34 不穿出轮廓
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.style.transform).toContain("scale(0.45)");
    });
    const heads = [...host.querySelectorAll<SVGEllipseElement>(".cell-outline")].filter(
      (e) => e.tagName === "ellipse",
    );
    expect(heads.length).toBe(4);
    for (const head of heads) {
      expect(Number(head.getAttribute("ry"))).toBeCloseTo(95 * 0.52, 5);
      expect(Number(head.getAttribute("rx"))).toBeCloseTo(95 * 0.6, 5);
    }
    // 基因标注随组缩放会变小，需反向补偿：round(round(95*0.16)=15 / 0.45) = 33
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.querySelector("text")!.getAttribute("font-size")).toBe("33");
    });
  });

  it("非精子形态下基因标注不做过补偿（保持半径自适应字号）", () => {
    scene.render(st({ cells: 4 }));
    expect(chromo("A1").querySelector("text")!.getAttribute("font-size")).toBe("15");
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

  it("基因标注为居中徽标式：写在染色体上半段，白字深描边", () => {
    scene.render(st({ replicated: true }));
    const label = chromo("A1").querySelector("text.gene-label")!;
    // A 对 len=120 → 上半段中点 y = -30+4 = -26；水平居中；白字+深描边保证任何底色可读
    expect(label.getAttribute("x")).toBe("0");
    expect(label.getAttribute("y")).toBe("-26");
    expect(label.getAttribute("text-anchor")).toBe("middle");
    expect(label.getAttribute("paint-order")).toBe("stroke");
    expect(label.getAttribute("fill")).toBe("#ffffff");
  });

  it("复制后的染色体为过着丝点的真 X 形（两条对角臂在原点交合）", () => {
    scene.render(st({ replicated: true }));
    const paths = chromo("A1").querySelectorAll("path");
    // 对角臂过原点：M -12 -60 L 12 60 与镜像 M 12 -60 L -12 60（A 对 len=120）
    expect(paths[1].getAttribute("d")).toBe("M -12 -60 L 12 60");
    expect(paths[2].getAttribute("d")).toBe("M 12 -60 L -12 60");
    expect(paths[0].style.display).toBe("none"); // 竖杆隐藏
  });

  it("未复制时染色体为竖直单杆，两条对角臂隐藏", () => {
    scene.render(st({}));
    const paths = chromo("A1").querySelectorAll("path");
    expect(paths[0].getAttribute("d")).toBe("M 0 -60 L 0 60");
    expect(paths[0].style.display).toBe("");
    expect(paths[1].style.display).toBe("none");
    expect(paths[2].style.display).toBe("none");
  });

  it("replicated=false 时隐藏 X 形对角臂（如减Ⅱ后期）", () => {
    scene.render(st({ cells: 2, replicated: false, separating: "sister" }));
    host.querySelectorAll<SVGGElement>(".chromo").forEach((g) => {
      expect(g.querySelectorAll("path")[1].style.display).toBe("none");
      expect(g.querySelectorAll("path")[2].style.display).toBe("none");
    });
  });

  it("卵细胞模式 cells=2（unequal）：可见对居大细胞两极，极体对槽位居中", () => {
    const ru = usableRadius(2);
    // 减Ⅰ末期默认态：h=Ru*0.5
    const tel = computeSlots(st({ cells: 2, replicated: true, unequal: true, polarBodies: 1 }), false);
    expect(tel.offsets.A1).toEqual([-Math.round(ru * 0.5), 0]);
    expect(tel.offsets.B1).toEqual([Math.round(ru * 0.5), 0]);
    // 进入极体的 A2/B2 槽位错开居中区域（渲染层缩小并锚定到极体；错开满足成对间距 ≥20）
    expect(tel.offsets.A2).toEqual([0, 24]);
    expect(tel.offsets.B2).toEqual([0, -24]);
    // 全部属于同一个大细胞
    expect(Object.values(tel.cellOf).every((c) => c === 0)).toBe(true);
    // 减Ⅱ后期姐妹分开：组中心错开排布（双杆分极由渲染层完成）
    const ana = computeSlots(st({ cells: 2, replicated: false, separating: "sister", unequal: true }), false);
    expect(ana.offsets.A1).toEqual([-13, -13]);
    expect(ana.offsets.B1).toEqual([13, 13]);
  });

  it("场景控件栏提供模式切换按钮：按当前路由参数决定目标与文案", () => {
    // 默认（精子模式）：点击跳转卵细胞模式
    location.hash = "#/course/meiosis";
    scene.destroy();
    scene.mount(host);
    const btn = host.querySelector<HTMLButtonElement>(".mode-switch")!;
    expect(btn.textContent).toBe("切换到卵细胞形成");
    btn.dispatchEvent(new Event("click"));
    expect(location.hash).toBe("#/course/meiosis?mode=oocyte");
    // 卵细胞模式下：文案反转，点击回到精子模式
    location.hash = "#/course/meiosis?mode=oocyte";
    scene.destroy();
    scene.mount(host);
    const btn2 = host.querySelector<HTMLButtonElement>(".mode-switch")!;
    expect(btn2.textContent).toBe("切换到精子形成");
    btn2.dispatchEvent(new Event("click"));
    expect(location.hash).toBe("#/course/meiosis");
    location.hash = "";
  });

  it("减Ⅱ后期：本体杆移向左极、姊妹杆显示并移向右极（双杆分极）", () => {
    scene.render(st({ cells: 2, replicated: false, separating: "sister" }));
    const paths = chromo("A1").querySelectorAll("path");
    // 本体杆（path[0]）经 transform 平移到左极：H=Ru*0.85=65；对角臂隐藏
    expect(paths[0].getAttribute("transform")).toBe("translate(-65,0)");
    expect(paths[0].style.display).toBe("");
    expect(paths[1].style.display).toBe("none");
    expect(paths[2].style.display).toBe("none");
    // 着丝点圆随本体杆同步平移（不滞留细胞中央成为游离伪影）
    expect(chromo("A1").querySelector("circle.centro")!.getAttribute("transform")).toBe("translate(-65,0)");
    // 姊妹杆（path[3]）此帧显示并平移到右极
    expect(paths[3].getAttribute("transform")).toBe("translate(65,0)");
    expect(paths[3].style.display).toBe("");
    // 组槽位改为中心错开排布（不再分居两极），满足成对间距不变式
    const slots = computeSlots(st({ cells: 2, replicated: false, separating: "sister" }), false);
    expect(slots.offsets.A1).toEqual([-13, -13]);
    expect(slots.offsets.A2).toEqual([-13, 13]);
  });

  it("卵细胞模式减Ⅱ后期：双杆分极幅度为大细胞内 H=84", () => {
    scene.render(st({ cells: 2, replicated: false, separating: "sister", unequal: true, polarBodies: 1 }));
    const paths = chromo("A1").querySelectorAll("path");
    expect(paths[0].getAttribute("transform")).toBe("translate(-84,0)");
    expect(paths[3].getAttribute("transform")).toBe("translate(84,0)");
  });

  it("减Ⅱ末期限：槽位两两成对、姊妹杆向量到兄弟子细胞，每格呈现 2 条", () => {
    // 槽位成对：A1+B2 同在左上格、B1+A2 同在右下格（错开 ±13）
    const slots = computeSlots(st({ cells: 4, replicated: false }), false);
    expect(slots.offsets.A1).toEqual([-13, -13]);
    expect(slots.offsets.B2).toEqual([13, -13]);
    expect(slots.offsets.B1).toEqual([-13, 13]);
    expect(slots.offsets.A2).toEqual([13, 13]);
    expect(slots.cellOf.A1).toBe(0);
    expect(slots.cellOf.B2).toBe(0);
    expect(slots.cellOf.B1).toBe(2);
    expect(slots.cellOf.A2).toBe(2);
    // 姊妹杆平移至同行兄弟子细胞：列间距 = 480-175 = 305
    scene.render(st({ cells: 4, replicated: false }));
    const paths = chromo("A1").querySelectorAll("path");
    expect(paths[3].style.display).toBe("");
    expect(paths[3].getAttribute("transform")).toBe("translate(305,0)");
    expect(paths[0].hasAttribute("transform")).toBe(false);
  });

  it("精子变形期：姊妹杆按组缩放补偿平移至兄弟头部，每头部仍呈现 2 条", () => {
    scene.render(st({ cells: 4, replicated: false, spermShape: true }));
    const paths = chromo("A1").querySelectorAll("path");
    expect(paths[3].style.display).toBe("");
    // 组级 scale(0.45) 下需补偿：round(305/0.45)=678
    expect(paths[3].getAttribute("transform")).toBe("translate(678,0)");
  });

  it("减Ⅱ后期：基因标注随本体杆移向左极（不滞留赤道板中央）", () => {
    scene.render(st({ cells: 2, replicated: false, separating: "sister" }));
    const label = chromo("A1").querySelector("text.gene-label")!;
    expect(label.getAttribute("transform")).toBe("translate(-65,0)");
    // 非分裂帧标注无平移残留
    scene.render(st({}));
    expect(chromo("A1").querySelector("text.gene-label")!.hasAttribute("transform")).toBe(false);
  });

  it("减Ⅱ中期：同源判定正确（气泡声明不存在同源染色体），赤道板字段被卵细胞分支消费", () => {
    // I3 回归：减Ⅱ中期细胞中已无同源染色体，气泡不得误报
    scene.render(st({ cells: 2, replicated: true, equatorial: "single" }));
    chromo("A1").dispatchEvent(new Event("click"));
    const bubble = host.querySelector<HTMLDivElement>(".chromo-bubble")!;
    expect(bubble.style.display).toBe("block");
    expect(bubble.textContent).toContain("不存在其同源染色体");
    scene.render(st({}));
    chromo("A1").dispatchEvent(new Event("click"));
    // 基态（减Ⅰ前）：同源染色体存在
    expect(host.querySelector<HTMLDivElement>(".chromo-bubble")!.textContent).toContain("存在它的同源染色体");
    // I4：卵细胞分支消费 equatorial:"single"——可见对并排于赤道板 ±13
    const oo = computeSlots(st({ cells: 2, replicated: true, equatorial: "single", unequal: true, polarBodies: 1 }), false);
    expect(oo.offsets.A1).toEqual([-13, 0]);
    expect(oo.offsets.B1).toEqual([13, 0]);
  });

  it("卵细胞减Ⅱ末期限：8 根杆守恒分配——姊妹杆按 EGG_MAP 进入对应极体", () => {
    scene.render(st({ cells: 2, replicated: false, unequal: true, polarBodies: 3 }));
    // 卵细胞保留 A1/B1 本体杆；A1 姊妹杆进入极体③(379,317) 左半，带 scale(0.35)
    // （末期可见对槽位为 ±38：A1 本体在 (202,200)，姊妹向量 = (371-202, 317-200)）
    const a1 = chromo("A1").querySelectorAll("path");
    expect(a1[3].style.display).toBe("");
    expect(a1[3].getAttribute("transform")).toBe("translate(169,117) scale(0.35)");
    expect(chromo("B1").querySelectorAll("path")[3].getAttribute("transform")).toBe("translate(109,117) scale(0.35)");
    // 第一极体均分：A2 本体杆在极体①左半(349,61)，姊妹杆进极体②左半；
    // 路径向量相对组实际锚位 (349,61)：((413-349)/0.35, (184-61)/0.35) ≈ (183,351)
    // 隐藏对组级已有 scale(0.35)，路径级倍率为恒等 scale(1)
    expect(chromo("A2").querySelectorAll("path")[3].getAttribute("transform")).toBe("translate(183,351) scale(1)");
    // B2 本体杆在极体①右半：组级 transform 锚定 (365,61) scale(0.35)；
    // 姊妹杆进极体②右半：((429-365)/0.35, (184-61)/0.35) ≈ (183,351)
    expect(chromo("B2").style.transform).toBe("translate(365px, 61px) scale(0.35)");
    expect(chromo("B2").querySelectorAll("path")[3].getAttribute("transform")).toBe("translate(183,351) scale(1)");
    // 着丝点全覆盖：进入极体的姊妹杆也有随行着丝点（transform 与姊妹杆一致）
    const a1CentroSis = chromo("A1").querySelector<SVGCircleElement>(".sister-centro")!;
    expect(a1CentroSis.style.display).toBe("");
    expect(a1CentroSis.getAttribute("transform")).toBe("translate(169,117) scale(0.35)");
  });

  it("减Ⅱ后期：姊妹着丝点随姊妹杆移向右极", () => {
    scene.render(st({ cells: 2, replicated: false, separating: "sister", crossingOver: true }));
    const g = chromo("A1");
    expect(g.querySelector<SVGCircleElement>(".sister-centro")!.style.display).toBe("");
    expect(g.querySelector<SVGCircleElement>(".sister-centro")!.getAttribute("transform")).toBe("translate(65,0)");
  });

  it("基态：姊妹着丝点隐藏", () => {
    scene.render(st({}));
    expect(chromo("A1").querySelector<SVGCircleElement>(".sister-centro")!.style.display).toBe("none");
  });

  it("分裂出的新染色体（姊妹杆）应携带基因标注副本", () => {
    // 末期限：姊妹杆进入兄弟子细胞，其标注副本 transform 与姊妹杆一致
    scene.render(st({ cells: 4, replicated: false }));
    const sibLabel = chromo("A1").querySelector("text.sister-label")!;
    expect(sibLabel.getAttribute("transform")).toBe("translate(305,0)");
    // 分极帧：姊妹标注随姊妹杆移向另一极（+65，与本体标注 -65 相对）
    scene.render(st({ cells: 2, replicated: false, separating: "sister" }));
    expect(chromo("A1").querySelector(".sister-label")!.getAttribute("transform")).toBe("translate(65,0)");
    // 卵细胞末期限：进极体的姊妹标注同样跟随（含缩放）
    scene.render(st({ cells: 2, replicated: false, unequal: true, polarBodies: 3 }));
    expect(chromo("A1").querySelector(".sister-label")!.getAttribute("transform")).toBe("translate(169,117) scale(0.35)");
  });

  it("减Ⅱ尾部三帧标记 no-tween（分极/分配瞬切，避免着丝点在途偏离）；其它帧保留补间", () => {
    scene.render(st({ cells: 2, replicated: false, separating: "sister" }));
    expect(chromo("A1").classList.contains("no-tween")).toBe(true);
    scene.render(st({ cells: 4, replicated: false }));
    expect(chromo("A1").classList.contains("no-tween")).toBe(true);
    scene.render(st({ cells: 4, replicated: false, spermShape: true }));
    expect(chromo("A1").classList.contains("no-tween")).toBe(true);
    // 卵细胞末期限同样瞬切
    scene.render(st({ cells: 2, replicated: false, unequal: true, polarBodies: 3 }));
    expect(chromo("A1").classList.contains("no-tween")).toBe(true);
    // 其它阶段恢复补间
    scene.render(st({}));
    expect(chromo("A1").classList.contains("no-tween")).toBe(false);
    scene.render(st({ cells: 2, replicated: true, separating: "sister", unequal: true }));
    expect(chromo("A1").classList.contains("no-tween")).toBe(false);
  });

  it("卵细胞减Ⅰ后期：轮廓偏心拉长暗示不均等分裂", () => {
    scene.render(st({ replicated: true, pairing: true, separating: "homolog", unequal: true }));
    const o = host.querySelector<SVGEllipseElement>(".cell-outline")!;
    // 单细胞 R=150 → ry=round(150*1.06)=159、rx=round(150*0.92)=138、cy 下移 round(150*0.08)=12
    expect(o.tagName).toBe("ellipse");
    expect(o.getAttribute("ry")).toBe("159");
    expect(o.getAttribute("rx")).toBe("138");
    expect(Number(o.getAttribute("cy"))).toBe(212);
  });

  it("卵细胞减Ⅰ末期：大细胞 + 贴边第一极体，极体内染色体缩小呈现", () => {
    scene.render(st({ cells: 2, replicated: true, unequal: true, polarBodies: 1 }));
    // 1 个大细胞轮廓 + 1 个极体小圆
    expect(host.querySelectorAll(".cell-outline").length).toBe(2);
    const pb = host.querySelector(".polar-body")!;
    expect(Number(pb.getAttribute("r"))).toBe(46);
    // 可见对 A1/B1 位于大细胞中心 (240,200) 两极：h=Ru*0.5=38
    expect(chromo("A1").style.transform).toBe("translate(202px, 200px)");
    expect(chromo("B1").style.transform).toBe("translate(278px, 200px)");
    // 极体对 A2/B2 缩小并锚定到极体位置（锚距 = 140+46-4 = 182，角 -50°；
    // 同一极体内两条横向错开 ±8：A2 在左 349）
    expect(chromo("A2").style.transform).toContain("scale(0.35)");
    expect(chromo("A2").style.transform).toContain("translate(349px, 61px)");
  });

  it("成熟卵细胞：3 个极体环绕", () => {
    scene.render(st({ cells: 2, replicated: false, unequal: true, polarBodies: 3 }));
    expect(host.querySelectorAll(".cell-outline").length).toBe(4);
    expect(host.querySelectorAll(".polar-body").length).toBe(3);
  });

  it("渲染后的 transform 与 computeSlots 纯函数结果一致（以基态为例）", () => {
    scene.render(st({}));
    const { offsets } = computeSlots(st({}), false);
    for (const [key, [dx, dy]] of Object.entries(offsets)) {
      // 单细胞中心为 (400, 200)，槽位偏移取整后拼入 transform
      expect(chromo(key).style.transform).toBe(`translate(${400 + dx}px, ${200 + dy}px)`);
    }
  });

  it("分裂后布局自适应：两细胞左右横排、四细胞 2×2 网格、半径放大", () => {
    // 布局常量符合本轮设计规格（四细胞列心左移，满幅利用画布宽度）
    expect(CELL_CENTERS[2]).toEqual([[215, 200], [585, 200]]);
    expect(CELL_CENTERS[4]).toEqual([[175, 98], [480, 98], [175, 302], [480, 302]]);
    expect(CELL_RADIUS[2]).toBe(150);
    expect(CELL_RADIUS[4]).toBe(95);
    // 两细胞期（减Ⅰ末期）：左细胞中心 (215,200)，h=Ru*0.5=round(38)=38
    scene.render(st({ cells: 2, replicated: true }));
    expect(chromo("A1").style.transform).toBe("translate(177px, 200px)");
    // 四细胞期轮廓为四个圆（非精子形态）
    scene.render(st({ cells: 4 }));
    expect(host.querySelectorAll(".cell-outline").length).toBe(4);
    expect(host.querySelectorAll(".sperm-tail").length).toBe(0);
  });

  it("基因标注字号随所属细胞半径自适应", () => {
    // 单细胞 R=150 → max(13, round(150*0.16)=24) = 24
    scene.render(st({ replicated: true, pairing: true }));
    expect(chromo("A1").querySelector("text")!.getAttribute("font-size")).toBe("24");
    // 四细胞期 R=95 → max(13, round(95*0.16)=15) = 15
    scene.render(st({ cells: 4 }));
    expect(chromo("A1").querySelector("text")!.getAttribute("font-size")).toBe("15");
  });
});

/** 两点间欧氏距离 */
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// 遍历两个模式全部 20 个阶段，对槽位表断言布局不变式 1、2（卵细胞模式同样受强制约束）
describe.each(
  [
    ...meiosisCourse.stages.map((s) => [`sperm:${s.id}`, s.sceneState] as const),
    ...oogenesisCourse.stages.map((s) => [`oo:${s.id}`, s.sceneState] as const),
  ],
)(
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

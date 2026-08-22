/**
 * 课程页装配冒烟测试（替代 Task 8 简报 Step 3 手动验收）：
 * 用最小 Course 数据 + stub 场景组件，验证布局结构、阶段应用、
 * 播放控制联动与练习模式行为。
 */
import { describe, it, expect, vi } from "vitest";
import { mountCoursePage } from "../app";
import type { Course, SceneComponent } from "../types";

// 构造最小可用课程：3 个阶段，数目满足校验自洽性
function makeCourse(): Course {
  const st = (id: string, title: string, chromosome: number, dnaPerChromosome: number) => ({
    id,
    title,
    narration: [`${title}要点`],
    sceneState: { id } as Record<string, unknown>,
    numbers: {
      chromosome,
      dna: chromosome * dnaPerChromosome,
      chromatid: dnaPerChromosome === 2 ? chromosome * 2 : 0,
      dnaPerChromosome,
    },
  });
  return {
    meta: { id: "mini", title: "迷你课程", chapter: "测试", difficulty: 1 },
    stages: [
      st("a", "阶段甲", 4, 1),
      st("b", "阶段乙", 4, 2),
      st("c", "阶段丙", 2, 1),
    ],
  };
}

// stub 场景：记录 mount/render/destroy 调用
function makeSceneStub() {
  const calls: Record<string, unknown>[] = [];
  const scene: SceneComponent & { destroy: () => void } = {
    mount: vi.fn(),
    render: vi.fn((state: Record<string, unknown>) => { calls.push(state); }),
    destroy: vi.fn(),
  };
  return { scene, calls };
}

// 挂载辅助：返回 root 与常用元素引用
function setup(course = makeCourse()) {
  const { scene, calls } = makeSceneStub();
  const root = document.createElement("div");
  document.body.appendChild(root);
  mountCoursePage(root, course, () => scene);
  return {
    root,
    scene,
    calls,
    // 阶段节点进度条上的全部圆点按钮
    nodes: [...root.querySelectorAll<HTMLButtonElement>(".controls .stage-node")]!,
    buttons: [...root.querySelectorAll<HTMLButtonElement>(".controls button")],
    examBox: root.querySelector<HTMLInputElement>(".exam-toggle input")!,
    speedSelect: root.querySelector<HTMLSelectElement>(".controls .speed-select")!,
  };
}

describe("mountCoursePage 装配", () => {
  it("生成完整布局结构：标题下控制条 + 网格 + 两张曲线卡片", () => {
    const { root } = setup();
    // DOM 顺序：返回链接 → 标题 → 控制条 → course-grid → 两张曲线卡片
    expect(root.querySelector(".controls")).toBeTruthy();
    const children = [...root.children].map((el) => el.className);
    expect(children.indexOf("course-title")).toBeLessThan(children.indexOf("controls"));
    expect(children.indexOf("controls")).toBeLessThan(children.indexOf("course-grid"));
    expect(root.querySelector(".course-grid")).toBeTruthy();
    expect(root.querySelectorAll(".chart-card").length).toBe(2);
  });

  it("阶段节点条渲染：节点数等于阶段数，且 aria-label 为对应标题", () => {
    const { nodes } = setup();
    expect(nodes.length).toBe(3);
    expect(nodes.map((n) => n.getAttribute("aria-label"))).toEqual(["阶段甲", "阶段乙", "阶段丙"]);
    // 初始状态：第一个节点 active，无 passed
    expect(nodes[0].classList.contains("active")).toBe(true);
    expect(nodes.some((n) => n.classList.contains("passed"))).toBe(false);
  });

  it("applyStage(0) 生效：讲解面板显示第一阶段标题，场景收到渲染", () => {
    const { root, scene, calls } = setup();
    // NotesPanel 标题为 h3
    expect(root.querySelector("aside h3")!.textContent).toBe("阶段甲");
    expect(scene.mount).toHaveBeenCalledTimes(1);
    expect(scene.render).toHaveBeenCalledWith(makeCourse().stages[0].sceneState);
    expect(calls.length).toBe(1);
  });

  it("点击下一步按钮后第 2 个节点变为 active，前一节点为 passed", () => {
    const { nodes, buttons } = setup();
    // 控制条按钮顺序：上一步 / 播放 / 下一步 / 揭晓答案
    buttons[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(nodes[1].classList.contains("active")).toBe(true);
    expect(nodes[0].classList.contains("passed")).toBe(true);
  });

  it("点击第 2 个节点后讲解面板显示对应阶段标题，其余节点弱高亮", () => {
    const { root, nodes } = setup();
    nodes[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector("aside h3")!.textContent).toBe("阶段乙");
    expect(nodes[0].classList.contains("passed")).toBe(true);
    expect(nodes[2].classList.contains("active")).toBe(false);
  });

  it("速度选择器切到 0.25× 后不报错且节点条仍正常工作", () => {
    const { speedSelect, nodes } = setup();
    // 切换到最慢档：jsdom 下不验证真实定时器间隔，只验证状态不被破坏
    speedSelect.value = "0.25";
    speedSelect.dispatchEvent(new Event("change", { bubbles: true }));
    // 切速后节点条仍可正常跳转并回写状态
    nodes[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(nodes[2].classList.contains("active")).toBe(true);
    expect(nodes[0].classList.contains("passed")).toBe(true);
  });

  it("勾选练习模式后讲解面板遮蔽、揭晓按钮显示；点揭晓恢复答案", () => {
    const { root, examBox, buttons } = setup();
    examBox.checked = true;
    examBox.dispatchEvent(new Event("change", { bubbles: true }));
    // 遮蔽文案以「？期」开头，不暴露阶段名
    expect(root.querySelector("aside h3")!.textContent).toContain("？期");
    // 揭晓按钮（display 由 none 变为空）
    const reveal = buttons.find((b) => b.textContent === "揭晓答案")!;
    expect(reveal.style.display).not.toBe("none");
    reveal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector("aside h3")!.textContent).toContain("答案：阶段甲");
  });

  it("取消勾选显隐开关后总数图曲线减少，重新勾选后恢复", () => {
    const { root } = setup();
    // 总数图是第一张曲线卡片；marker 是 line，polyline 仅来自系列曲线
    const totalsCard = root.querySelectorAll<HTMLElement>(".chart-card")[0];
    const countPolylines = () => totalsCard.querySelectorAll("svg polyline").length;
    expect(countPolylines()).toBe(3);
    // 取消勾选第一条（DNA数）曲线
    const box = totalsCard.querySelector<HTMLInputElement>(".series-toggles label:first-child input")!;
    box.checked = false;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(countPolylines()).toBe(2);
    // 重新勾选后恢复为三条
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(countPolylines()).toBe(3);
  });

  it("stages 为空时 fail-fast 渲染占位提示", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = document.createElement("div");
    document.body.appendChild(root);
    const bad = makeCourse();
    (bad as unknown as { stages: [] }).stages = [];
    mountCoursePage(root, bad, () => makeSceneStub().scene);
    expect(root.querySelector(".load-error")).toBeTruthy();
    expect(root.querySelector(".course-grid")).toBeNull();
    errSpy.mockRestore();
    root.remove();
  });
});

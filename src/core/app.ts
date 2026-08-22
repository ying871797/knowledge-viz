import type { Course, SceneComponent } from "./types";
import { Player } from "./player";
import { NumberChart, type Series } from "./numberChart";
import { NotesPanel } from "./notes";

/**
 * 课程页装配：布局 + 播放控制 + 曲线-场景双向联动 + 练习模式。
 * 由路由层（Task 9）调用；数据校验在注册侧经 validateCourse 完成，此处再做一层防御。
 */
export function mountCoursePage(
  root: HTMLElement,
  course: Course,
  createScene: () => SceneComponent & { destroy?: () => void },
): void {
  // 结构校验 fail-fast：不合格渲染占位提示，禁止静默渲染错误画面
  try {
    // validateCourse 已在导入侧执行；这里再次防御（如 stages 为空直接失败）
    if (!course.stages.length) throw new Error("stages 为空");
  } catch (err) {
    root.innerHTML = "";
    const fallback = document.createElement("p");
    fallback.className = "load-error";
    fallback.textContent = `课程数据异常：${(err as Error).message}`;
    root.appendChild(fallback);
    console.error("[course]", err);
    return;
  }

  // —— 静态骨架：返回链接、标题、两栏网格 ——
  const back = document.createElement("a");
  back.href = "#/";
  back.textContent = "← 返回目录";
  back.className = "back-link";

  const h2 = document.createElement("h2");
  h2.className = "course-title";
  h2.textContent = course.meta.title;

  const grid = document.createElement("div");
  grid.className = "course-grid";
  const notesBox = document.createElement("aside");
  const stageBox = document.createElement("section");
  grid.append(notesBox, stageBox);

  // —— 两张曲线卡片 ——
  const totalsCard = document.createElement("div");
  totalsCard.className = "chart-card";
  const perCard = document.createElement("div");
  perCard.className = "chart-card";
  const totalsTitle = document.createElement("h4");
  totalsTitle.textContent = "细胞内数目变化";
  const perTitle = document.createElement("h4");
  perTitle.textContent = "每条染色体上的 DNA 数";
  totalsCard.append(totalsTitle);
  perCard.append(perTitle);

  // —— 底部控制条：上一步 / 播放 / 下一步 / 进度条 / 练习开关 / 揭晓按钮 ——
  const controls = document.createElement("div");
  controls.className = "controls";
  const btnPrev = Object.assign(document.createElement("button"), { textContent: "⏮ 上一步" });
  const btnPlay = Object.assign(document.createElement("button"), { textContent: "▶ 播放" });
  const btnNext = Object.assign(document.createElement("button"), { textContent: "下一步 ⏭" });
  const slider = Object.assign(document.createElement("input"), { type: "range" }) as HTMLInputElement;
  slider.min = "0"; slider.max = String(course.stages.length - 1); slider.value = "0";
  const examToggle = Object.assign(document.createElement("label"), { className: "exam-toggle" });
  examToggle.innerHTML = `<input type="checkbox" /> 据图判断练习模式`;
  const revealBtn = Object.assign(document.createElement("button"), { textContent: "揭晓答案" });
  revealBtn.style.display = "none";
  controls.append(btnPrev, btnPlay, btnNext, slider, examToggle, revealBtn);

  root.append(back, h2, grid, totalsCard, perCard, controls);

  // —— 核心组件实例 ——
  const notes = new NotesPanel(notesBox);
  const scene = createScene();
  scene.mount(stageBox);

  const labels = course.stages.map((s) => s.title);
  const totals = new NumberChart(totalsCard, labels);
  const perChr = new NumberChart(perCard, labels);

  // 总数图三条曲线 + 显隐开关（可隐藏单条曲线让学生预测变化）
  const TOTAL_SERIES: Series[] = [
    { label: "DNA数", values: course.stages.map((s) => s.numbers.dna), color: "#2563eb" },
    { label: "染色体数", values: course.stages.map((s) => s.numbers.chromosome), color: "#dc2626" },
    { label: "染色单体数", values: course.stages.map((s) => s.numbers.chromatid), color: "#b45309", dashed: true },
  ];
  totals.setSeries(TOTAL_SERIES);
  perChr.setSeries([
    { label: "每条染色体DNA", values: course.stages.map((s) => s.numbers.dnaPerChromosome), color: "#059669" },
  ]);

  // 曲线显隐复选框组：取消勾选即从总数图中移除该系列
  const seriesToggles = document.createElement("div");
  seriesToggles.className = "series-toggles";
  TOTAL_SERIES.forEach((s, si) => {
    const lab = document.createElement("label");
    const box = Object.assign(document.createElement("input"), { type: "checkbox" }) as HTMLInputElement;
    box.checked = true;
    box.addEventListener("change", () => {
      // 按勾选状态过滤系列后重绘，并恢复高亮竖线位置
      totals.setSeries(TOTAL_SERIES.filter((_, i) => i === si || (seriesToggles.children[i] as HTMLElement).querySelector("input")!.checked));
      totals.setActive(player.current);
    });
    lab.append(box, document.createTextNode(` ${s.label}`));
    seriesToggles.appendChild(lab);
  });
  totalsCard.appendChild(seriesToggles);

  // 拐点气泡：进入含 callout 的阶段时显示关键数目变化说明
  const callout = document.createElement("div");
  callout.className = "callout";
  callout.style.display = "none";
  root.appendChild(callout);

  let examMode = false;
  const player = new Player(course.stages.length, applyStage, 1500);

  /** 统一的阶段应用入口：驱动滑块、讲解面板、场景、两条曲线与气泡 */
  function applyStage(i: number): void {
    const stage = course.stages[i];
    slider.value = String(i);
    if (examMode) {
      // 练习模式遮蔽答案，仅给提示
      notes.renderMasked("看主场景画面，判断这是哪个时期，再揭晓答案");
    } else {
      notes.render(stage.title, stage.narration);
    }
    scene.render(stage.sceneState);
    totals.setActive(i);
    perChr.setActive(i);
    if (stage.callout && !examMode) {
      callout.textContent = `💡 ${stage.callout}`;
      callout.style.display = "block";
    } else {
      callout.style.display = "none";
    }
    btnPlay.textContent = player.isPlaying ? "⏸ 暂停" : "▶ 播放";
  }

  // 双向联动：曲线数据点点击 → 跳转该阶段（先暂停自动播放）
  totals.onPointClick((i) => { player.pause(); player.goTo(i); });
  perChr.onPointClick((i) => { player.pause(); player.goTo(i); });

  btnPrev.addEventListener("click", () => { player.pause(); player.prev(); });
  btnNext.addEventListener("click", () => { player.pause(); player.next(); });
  btnPlay.addEventListener("click", () => { player.toggle(); applyStage(player.current); });
  slider.addEventListener("input", () => { player.pause(); player.goTo(Number(slider.value)); });

  // 练习模式开关：隐藏曲线 + 遮蔽讲解面板，显示揭晓按钮
  examToggle.querySelector("input")!.addEventListener("change", (e) => {
    examMode = (e.target as HTMLInputElement).checked;
    totals.setExamMode(examMode);
    perChr.setExamMode(examMode);
    revealBtn.style.display = examMode ? "" : "none";
    applyStage(player.current);
  });
  // 揭晓答案：恢复讲解面板但保持练习模式其余状态
  revealBtn.addEventListener("click", () => {
    const stage = course.stages[player.current];
    notes.render(`答案：${stage.title}`, stage.narration);
  });

  // 初始渲染第一阶段
  applyStage(0);
}

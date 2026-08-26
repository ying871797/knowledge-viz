import type { Course, SceneComponent } from "./types";
import { Player } from "./player";
import { NumberChart, type Series } from "./numberChart";
import { NotesPanel } from "./notes";

/** 课程页清理句柄：路由离开课程页时销毁播放器定时器与场景资源，避免 interval 泄漏 */
export interface CoursePageHandle {
  destroy(): void;
}

/**
 * 课程页装配：布局 + 播放控制 + 曲线-场景双向联动 + 练习模式。
 * 由路由层（Task 9）调用；数据校验在注册侧经 validateCourse 完成，此处再做一层防御。
 * 返回清理句柄，调用方须在卸载/重渲染前执行 destroy()。
 */
export function mountCoursePage(
  root: HTMLElement,
  course: Course,
  createScene: () => SceneComponent & { destroy?: () => void },
): CoursePageHandle {
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
    // 数据异常路径无资源需释放，返回空清理句柄保持接口一致
    return { destroy() {} };
  }

  // —— 静态骨架：返回链接、标题、两栏网格 ——
  const chartsEnabled = !course.meta.hideCharts;   // 无数目语义的课程（如 DNA 复制）隐藏曲线图表
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

  // —— 控制条（位于标题正下方）：上一步 / 播放 / 下一步 / 调速 / 阶段节点条 / 练习开关 / 揭晓按钮 ——
  // 导航键为「图标+文字」双 span 结构：窄屏媒体查询隐藏文字只留图标，aria-label 兜底语义
  function navButton(icon: string, text: string, cls: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = cls;
    const ic = document.createElement("span");
    ic.className = "btn-icon";
    ic.textContent = icon;
    const tx = document.createElement("span");
    tx.className = "btn-text";
    tx.textContent = text;
    b.append(ic, tx);
    b.setAttribute("aria-label", `${text}`);
    return b;
  }
  const btnPrev = navButton("⏮", "上一步", "btn-ghost");
  const btnPlay = navButton("▶", "播放", "btn-primary");
  const btnNext = navButton("⏭", "下一步", "btn-ghost");

  const controls = document.createElement("div");
  controls.className = "controls";

  // 五档速度选择器：value 为倍率字符串，基准间隔 1500ms 除以倍率
  const speedSelect = document.createElement("select") as HTMLSelectElement;
  speedSelect.className = "speed-select";
  speedSelect.setAttribute("aria-label", "播放速度");
  for (const rate of ["0.25", "0.5", "1", "1.5", "2"]) {
    const opt = Object.assign(document.createElement("option"), {
      value: rate,
      textContent: `${rate}×`,
    }) as HTMLOptionElement;
    if (rate === "1") opt.selected = true; // 默认 1×（即原始 1500ms）
    speedSelect.appendChild(opt);
  }

  // 阶段节点进度条：每个阶段一个可点击圆点，替代原 input[type=range]
  const stageNodes = document.createElement("div");
  stageNodes.className = "stage-nodes";
  const nodeButtons = course.stages.map((s) => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "stage-node";
    node.title = s.title;
    node.setAttribute("aria-label", s.title);
    stageNodes.appendChild(node);
    return node;
  });

  const examToggle = Object.assign(document.createElement("label"), { className: "exam-toggle" });
  examToggle.innerHTML = `<input type="checkbox" /> 据图判断练习模式`;
  const revealBtn = Object.assign(document.createElement("button"), { textContent: "揭晓答案" });
  revealBtn.className = "btn-primary";
  revealBtn.style.display = "none";
  // 高频播放控件归入 .player-bar 子容器：窄屏吸底且只放三个导航按钮（宽度有限），
  // 调速器留在页内控制区；桌面端两者同排、视觉不变
  const playerBar = document.createElement("div");
  playerBar.className = "player-bar";
  playerBar.append(btnPrev, btnPlay, btnNext);
  controls.append(playerBar, speedSelect, stageNodes);
  if (chartsEnabled) controls.append(examToggle, revealBtn);

  root.append(back, h2, controls, grid);
  if (chartsEnabled) root.append(totalsCard, perCard);

  // —— 核心组件实例 ——
  const notes = new NotesPanel(notesBox);
  const scene = createScene();
  scene.mount(stageBox);

  // 场景区右上角步数徽标：通用 UI 组件（不侵入 SceneComponent 接口），applyStage 随阶段更新
  const stepBadge = document.createElement("div");
  stepBadge.className = "step-badge";
  stageBox.appendChild(stepBadge);

  // 曲线图表：仅对有数目语义的课程装配（hideCharts 课程跳过，避免空图表占位）
  let totals: NumberChart | null = null;
  let perChr: NumberChart | null = null;
  if (chartsEnabled) {
    const labels = course.stages.map((s) => s.title);
    // 纵轴 n 表示法：n 取课程最后阶段的染色体数（即配子 n，本课程为 2）；
    // 刻度在 v 为 n 的整数倍（且非 0）时显示为「1n / 2n / …」，其余保持原数值
    const gameteN = course.stages[course.stages.length - 1].numbers!.chromosome;
    totals = new NumberChart(totalsCard, labels, (v) =>
      v > 0 && v % gameteN === 0 ? `${v / gameteN}n` : String(v),
    );
    perChr = new NumberChart(perCard, labels);

    // 总数图三条曲线 + 显隐开关（可隐藏单条曲线让学生预测变化）
    const TOTAL_SERIES: Series[] = [
      { label: "DNA数", values: course.stages.map((s) => s.numbers!.dna), color: "#2563eb" },
      { label: "染色体数", values: course.stages.map((s) => s.numbers!.chromosome), color: "#dc2626" },
      { label: "染色单体数", values: course.stages.map((s) => s.numbers!.chromatid), color: "#b45309", dashed: true },
    ];
    totals.setSeries(TOTAL_SERIES);
    perChr.setSeries([
      { label: "每条染色体DNA", values: course.stages.map((s) => s.numbers!.dnaPerChromosome), color: "#059669" },
    ]);

    // 曲线显隐复选框组：取消勾选即从总数图中移除该系列
    const seriesToggles = document.createElement("div");
    seriesToggles.className = "series-toggles";
    // 创建每个开关时闭包捕获其 checkbox 引用，避免依赖 children 索引的隐式耦合
    const toggleBoxes: HTMLInputElement[] = [];
    TOTAL_SERIES.forEach((s) => {
      const lab = document.createElement("label");
      const box = Object.assign(document.createElement("input"), { type: "checkbox" }) as HTMLInputElement;
      box.checked = true;
      toggleBoxes.push(box);
      box.addEventListener("change", () => {
        // 仅按各复选框勾选状态过滤系列后重绘，并恢复高亮竖线位置
        totals!.setSeries(TOTAL_SERIES.filter((_, i) => toggleBoxes[i].checked));
      totals!.setActive(player.current);
    });
    lab.append(box, document.createTextNode(` ${s.label}`));
    seriesToggles.appendChild(lab);
  });
  totalsCard.appendChild(seriesToggles);
  }

  // 拐点气泡：进入含 callout 的阶段时显示关键数目变化说明
  const callout = document.createElement("div");
  callout.className = "callout";
  callout.style.display = "none";
  root.appendChild(callout);

  let examMode = false;
  const player = new Player(course.stages.length, applyStage, 1500);

  /** 统一的阶段应用入口：驱动节点条、讲解面板、场景、两条曲线与气泡 */
  function applyStage(i: number): void {
    const stage = course.stages[i];
    // 节点条状态回写：当前节点高亮，已过节点弱高亮（替代原 slider.value 回写）
    nodeButtons.forEach((node, j) => {
      node.classList.toggle("active", j === i);
      node.classList.toggle("passed", j < i);
    });
    if (examMode) {
      // 练习模式遮蔽答案，仅给提示
      notes.renderMasked("看主场景画面，判断这是哪个时期，再揭晓答案");
    } else {
      notes.render(stage.title, stage.narration);
    }
    scene.render(stage.sceneState);
    // 步数徽标：第 x/N 步
    stepBadge.textContent = `第${i + 1}/${course.stages.length}步`;
    if (chartsEnabled) {
      totals!.setActive(i);
      perChr!.setActive(i);
    }
    if (stage.callout && !examMode) {
      callout.textContent = `💡 ${stage.callout}`;
      callout.style.display = "block";
    } else {
      callout.style.display = "none";
    }
    // 播放键文案切分更新：图标与文字分属不同 span（窄屏仅显示图标）
    const playIcon = btnPlay.querySelector(".btn-icon") as HTMLElement;
    const playText = btnPlay.querySelector(".btn-text") as HTMLElement;
    playIcon.textContent = player.isPlaying ? "⏸" : "▶";
    playText.textContent = player.isPlaying ? "暂停" : "播放";
  }

  // 双向联动：曲线数据点点击 → 跳转该阶段（先暂停自动播放）
  if (chartsEnabled) {
    totals!.onPointClick((i) => { player.pause(); player.goTo(i); });
    perChr!.onPointClick((i) => { player.pause(); player.goTo(i); });
  }

  btnPrev.addEventListener("click", () => { player.pause(); player.prev(); });
  btnNext.addEventListener("click", () => { player.pause(); player.next(); });
  btnPlay.addEventListener("click", () => { player.toggle(); applyStage(player.current); });
  // 点击节点 = 跳转该阶段（先暂停自动播放，与曲线点联动语义一致）
  nodeButtons.forEach((node, i) => {
    node.addEventListener("click", () => { player.pause(); player.goTo(i); });
  });

  // 速度切换：更新播放器间隔，并同步补间动画时长 CSS 变量（间隔的 90%）
  speedSelect.addEventListener("change", () => {
    const rate = Number(speedSelect.value);
    const intervalMs = Math.round(1500 / rate);
    player.setIntervalMs(intervalMs);
    root.style.setProperty("--tween-ms", Math.round(intervalMs * 0.9) + "ms");
  });

  // 练习模式开关：隐藏曲线 + 遮蔽讲解面板，显示揭晓按钮（仅图表课程）
  if (chartsEnabled) {
    examToggle.querySelector("input")!.addEventListener("change", (e) => {
      examMode = (e.target as HTMLInputElement).checked;
      totals!.setExamMode(examMode);
      perChr!.setExamMode(examMode);
      revealBtn.style.display = examMode ? "" : "none";
      applyStage(player.current);
    });
    // 揭晓答案：恢复讲解面板但保持练习模式其余状态
    revealBtn.addEventListener("click", () => {
      const stage = course.stages[player.current];
      notes.render(`答案：${stage.title}`, stage.narration);
    });
  }

  // 初始渲染第一阶段
  applyStage(0);

  // 卸载清理：先暂停播放器定时器，再释放场景资源（如动画/监听器）
  return {
    destroy() {
      player.destroy();
      scene.destroy?.();
    },
  };
}

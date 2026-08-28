// 入口：hash 路由 + 课程注册表（Task 9）
// 路由规则：#/ 目录页；#/course/<id> 课程页
import "./style.css";
import { mountCoursePage, type CoursePageHandle } from "./core/app";
import { validateCourse } from "./core/types";
import type { Course, SceneComponent } from "./core/types";
import { meiosisCourse, oogenesisCourse } from "./courses/meiosis/data";
import { createMeiosisScene } from "./courses/meiosis/scene";
import { dnaReplicationCourse } from "./courses/dna-replication/data";
import { createDnaReplicationScene } from "./courses/dna-replication/scene";
import { mitosisCourse } from "./courses/mitosis/data";
import { createMitosisScene } from "./courses/mitosis/scene";
import { geneExpressionCourse } from "./courses/gene-expression/data";
import { createGeneExpressionScene } from "./courses/gene-expression/scene";

/** 课程注册表条目：新增知识点时在此登记即可；load 可按模式参数返回对应课程数据 */
interface CourseEntry {
  meta: Course["meta"];
  load: (mode?: string) => Course;
  createScene: () => SceneComponent & { destroy?: () => void };
}

const registry: CourseEntry[] = [];

// 注册时经 validateCourse 校验，不合格 fail-fast（仅记录并跳过该课程，不阻塞其它课程）
// 两种模式的数据都须过校验门禁——运行时 load() 返回的课程同样要有部署期保证
try {
  const course = validateCourse(meiosisCourse);
  const ooCourse = validateCourse(oogenesisCourse);
  // 减数分裂页内双模式：精子形成 / 卵细胞形成，由路由参数 ?mode=oocyte 区分
  registry.push({
    meta: course.meta,
    load: (mode?: string) => (mode === "oocyte" ? ooCourse : meiosisCourse),
    createScene: createMeiosisScene,
  });
} catch (err) {
  console.error("[registry]", err);
}

// DNA 分子复制：独立课程（hideCharts，无数目曲线）
try {
  const dnaCourse = validateCourse(dnaReplicationCourse);
  registry.push({
    meta: dnaCourse.meta,
    load: () => dnaCourse,
    createScene: createDnaReplicationScene,
  });
} catch (err) {
  console.error("[registry]", err);
}

// 有丝分裂：独立课程（复用 8 杆染色体模型）
try {
  const mitoCourse = validateCourse(mitosisCourse);
  registry.push({
    meta: mitoCourse.meta,
    load: () => mitoCourse,
    createScene: createMitosisScene,
  });
} catch (err) {
  console.error("[registry]", err);
}

// 基因的表达：转录 + 翻译全程（hideCharts，无数目曲线）
try {
  const geCourse = validateCourse(geneExpressionCourse);
  registry.push({
    meta: geCourse.meta,
    load: () => geCourse,
    createScene: createGeneExpressionScene,
  });
} catch (err) {
  console.error("[registry]", err);
}

const root = document.getElementById("app")!;

// 当前课程页的清理句柄：离开/重进课程页前必须销毁，避免播放器 interval 泄漏
let cleanup: CoursePageHandle | null = null;

// 反馈接收邮箱：填入你的邮箱后，「反馈」按钮会把邮件发到这里；留空则只唤起邮件客户端
const FEEDBACK_EMAIL = "";
// 课程页描述通用后缀：与课程 title/chapter 拼接，供分享卡片与搜索引擎使用
const COURSE_DESC_SUFFIX =
  "分步动画演示，可逐步播放、调速、任意阶段暂停；对齐教材与考纲，免费在线使用。";
const HOME_TITLE = "生物概念可视化讲解 — 高中生物过程动画演示";
const HOME_DESC =
  "高中生物多过程知识点分步动画演示：减数分裂、有丝分裂、DNA复制、基因表达、PCR。可分步播放、调速、任意阶段暂停，对齐教材与考纲，免费在线使用。";

/** 依据路由更新页面 title / description（分享卡片、搜索结果可见） */
function applySeo(title: string, description: string): void {
  document.title = title;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = description;
}

/** 构建反馈 mailto 链接：预填主题与页面上下文，学生/老师无需注册即可反馈 */
export function buildFeedbackUrl(): string {
  const subject = encodeURIComponent("生物过程动画 · 反馈/建议");
  const body = encodeURIComponent(`当前页面：${location.hash}\n完整地址：${location.href}\n\n反馈内容：\n`);
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}

/** 渲染目录页（首页） */
function renderHome(): void {
  cleanup?.destroy();
  cleanup = null;
  root.innerHTML = "";
  applySeo(HOME_TITLE, HOME_DESC);
  const h1 = document.createElement("h1");
  h1.textContent = "生物概念可视化讲解";
  const ul = document.createElement("ul");
  ul.className = "home-list";
  registry.forEach((entry) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#/course/${entry.meta.id}`;
    a.textContent = `${entry.meta.title}（${entry.meta.chapter}）`;
    li.appendChild(a);
    ul.appendChild(li);
  });
  root.append(h1, ul);
}

/** 渲染课程页；未知 id 回退目录页。mode 为可选路由参数（如减数分裂页的卵细胞模式） */
function renderCourse(id: string, mode?: string): void {
  const entry = registry.find((e) => e.meta.id === id);
  if (!entry) { renderHome(); return; }
  const course = entry.load(mode);
  // SEO：课程页 title/description 带关键词，便于搜索命中与分享卡片展示（mode 切换同步更新）
  applySeo(
    `${course.meta.title} 分步动画 — 生物概念可视化讲解`,
    `${course.meta.title}（${course.meta.chapter}）${COURSE_DESC_SUFFIX}`,
  );
  // 先清理上一次课程页资源，再整体重建 DOM（切换模式即重挂载 → 自然重置到第 0 步）
  cleanup?.destroy();
  cleanup = null;
  root.innerHTML = "";
  cleanup = mountCoursePage(root, course, entry.createScene);
}

/** 路由分发：解析 hash 决定渲染目录页或课程页（支持 ?mode= 查询参数） */
function route(): void {
  const hash = location.hash || "#/";
  const match = /^#\/course\/([\w-]+)(?:\?mode=(\w+))?/.exec(hash);
  if (match) renderCourse(match[1], match[2]);
  else renderHome();
}

// 全局反馈入口：固定于右下角，点击唤起预填邮件（含当前页面上下文）
const feedbackBtn = document.createElement("a");
feedbackBtn.className = "feedback-btn";
feedbackBtn.href = "#";
feedbackBtn.textContent = "反馈";
feedbackBtn.title = "提建议 / 报告问题";
feedbackBtn.addEventListener("click", (ev) => {
  ev.preventDefault();
  location.href = buildFeedbackUrl();
});
document.body.appendChild(feedbackBtn);

window.addEventListener("hashchange", route);
route();

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

const root = document.getElementById("app")!;

// 当前课程页的清理句柄：离开/重进课程页前必须销毁，避免播放器 interval 泄漏
let cleanup: CoursePageHandle | null = null;

/** 渲染目录页（首页） */
function renderHome(): void {
  cleanup?.destroy();
  cleanup = null;
  root.innerHTML = "";
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
  // 先清理上一次课程页资源，再整体重建 DOM（切换模式即重挂载 → 自然重置到第 0 步）
  cleanup?.destroy();
  cleanup = null;
  root.innerHTML = "";
  cleanup = mountCoursePage(root, entry.load(mode), entry.createScene);
}

/** 路由分发：解析 hash 决定渲染目录页或课程页（支持 ?mode= 查询参数） */
function route(): void {
  const hash = location.hash || "#/";
  const match = /^#\/course\/([\w-]+)(?:\?mode=(\w+))?/.exec(hash);
  if (match) renderCourse(match[1], match[2]);
  else renderHome();
}

window.addEventListener("hashchange", route);
route();

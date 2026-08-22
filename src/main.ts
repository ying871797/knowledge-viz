// 入口：hash 路由 + 课程注册表（Task 9）
// 路由规则：#/ 目录页；#/course/<id> 课程页
import "./style.css";
import { mountCoursePage, type CoursePageHandle } from "./core/app";
import { validateCourse } from "./core/types";
import type { Course, SceneComponent } from "./core/types";
import { meiosisCourse } from "./courses/meiosis/data";
import { createMeiosisScene } from "./courses/meiosis/scene";

/** 课程注册表条目：新增知识点时在此登记即可 */
interface CourseEntry {
  meta: Course["meta"];
  load: () => Course;
  createScene: () => SceneComponent & { destroy?: () => void };
}

const registry: CourseEntry[] = [];

// 注册时经 validateCourse 校验，不合格 fail-fast（仅记录并跳过该课程，不阻塞其它课程）
try {
  const course = validateCourse(meiosisCourse);
  registry.push({ meta: course.meta, load: () => course, createScene: createMeiosisScene });
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

/** 渲染课程页；未知 id 回退目录页 */
function renderCourse(id: string): void {
  const entry = registry.find((e) => e.meta.id === id);
  if (!entry) { renderHome(); return; }
  // 先清理上一次课程页资源，再整体重建 DOM
  cleanup?.destroy();
  cleanup = null;
  root.innerHTML = "";
  cleanup = mountCoursePage(root, entry.load(), entry.createScene);
}

/** 路由分发：解析 hash 决定渲染目录页或课程页 */
function route(): void {
  const hash = location.hash || "#/";
  const match = /^#\/course\/([\w-]+)/.exec(hash);
  if (match) renderCourse(match[1]);
  else renderHome();
}

window.addEventListener("hashchange", route);
route();

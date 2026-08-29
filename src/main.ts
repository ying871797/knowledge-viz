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

// DNA 分子复制：独立课程（无数目字段、无曲线图）
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

// 基因的表达：转录 + 翻译全程（无数目字段、无曲线图）
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

// 反馈问卷链接：填入你创建的问卷星/腾讯问卷地址后，「反馈」按钮会在新标签页打开它；
// 留空则按钮不生效（不发邮件、不跳转）
export const FEEDBACK_URL = "https://wj.qq.com/s2/27708003/9m68/";
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

/** 首页课程卡补充信息（文案 + 标本图）；id 未命中时走通用兜底 */
interface HomeCardInfo { desc: string; tag: string; }
const HOME_CARDS: Record<string, HomeCardInfo> = {
  meiosis: {
    desc: "同源染色体联会、分离与自由组合的完整过程，含精子 / 卵细胞两种模式。",
    tag: "精子 · 卵细胞",
  },
  "dna-replication": {
    desc: "DNA 双螺旋解旋、半保留复制到连接完成的分子级细节。",
    tag: "半保留复制",
  },
  mitosis: {
    desc: "间期准备到末期分裂，姐妹染色单体准确分离的整个过程。",
    tag: "细胞增殖",
  },
  "gene-expression": {
    desc: "DNA 转录生成 mRNA，再到核糖体翻译合成蛋白质的全程。",
    tag: "转录 · 翻译",
  },
};

/** 课程标本缩略图（荧光显微风格 SVG，viewBox 0 0 120 120） */
function homeArt(id: string): string {  const g = (stroke: string) => `stroke="${stroke}" fill="none" stroke-width="3" stroke-linecap="round"`;
  switch (id) {
    case "meiosis":
      return `<svg class="art" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M40 28 L80 92" ${g("var(--a1)")} stroke-opacity=".75"/>
        <path d="M80 28 L40 92" ${g("var(--a1)")} stroke-opacity=".75"/>
        <path d="M48 44 L72 76 M72 44 L48 76" ${g("var(--a2)")} stroke-opacity=".55"/>
        <circle cx="60" cy="60" r="4" fill="var(--a1)"/>
        <circle cx="56" cy="36" r="3" fill="var(--a2)"/>
        <circle cx="64" cy="84" r="3" fill="var(--a2)"/>
      </svg>`;
    case "dna-replication":
      return `<svg class="art" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M26 20 q18 20 0 40 q-18 20 0 40" ${g("var(--a1)")}/>
        <path d="M94 20 q-18 20 0 40 q18 20 0 40" ${g("var(--a1)")}/>
        <path d="M32 28 L88 28 M28 48 L92 48 M28 72 L92 72 M32 92 L88 92"
              ${g("var(--a2)")} stroke-opacity=".6" stroke-width="2.5"/>
      </svg>`;
    case "mitosis":
      return `<svg class="art" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="42" ${g("var(--a1)")} stroke-opacity=".7"/>
        <circle cx="60" cy="60" r="26" ${g("var(--a2)")} stroke-opacity=".6"/>
        <path d="M52 52 L68 68 M68 52 L52 68" ${g("var(--a2)")} stroke-width="4"/>
        <circle cx="38" cy="42" r="3" fill="var(--a1)"/><circle cx="82" cy="78" r="3" fill="var(--a1)"/>
      </svg>`;
    case "gene-expression":
      return `<svg class="art" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M16 60 q22 -14 44 0 q22 14 44 0" ${g("var(--a1)")}/>
        <circle cx="60" cy="52" r="16" ${g("var(--a2)")} stroke-width="4"/>
        <circle cx="60" cy="52" r="4" fill="var(--a1)"/>
        <circle cx="45" cy="78" r="7" ${g("var(--a2)")} stroke-width="3" stroke-opacity=".7"/>
        <circle cx="75" cy="78" r="7" ${g("var(--a2)")} stroke-width="3" stroke-opacity=".7"/>
      </svg>`;
    default:
      return `<svg class="art" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="30" ${g("var(--a1)")} stroke-opacity=".7"/>
      </svg>`;
  }
}

/** 教材章节排序：按「册 → 章 → 节」比较（如 必修一 < 必修二 < 选必三）。
    章/节号兼容中文（第一章）与阿拉伯（第6章）两种写法 */
function chapterRank(chapter: string): [number, number, number] {
  const book: Record<string, number> = { "必修一": 1, "必修二": 2, "选必一": 3, "选必二": 4, "选必三": 5 };
  const bookKey = Object.keys(book).find((b) => chapter.includes(b)) ?? "";
  const cn: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
    十: 10, 十一: 11, 十二: 12, 十三: 13, 十四: 14, 十五: 15, 十六: 16,
    十七: 17, 十八: 18, 十九: 19, 二十: 20,
  };
  const num = (raw: string | undefined): number => {
    if (!raw) return 0;
    if (/^\d$/.test(raw)) return Number(raw);
    return cn[raw] ?? 0;
  };
  const chap = /第([一二三四五六七八九十]+|\d+)章/.exec(chapter);
  const sec = /第([一二三四五六七八九十]+|\d+)节/.exec(chapter);
  return [book[bookKey] ?? 9, num(chap?.[1]), num(sec?.[1])];
}

/** 渲染目录页（首页）：教科书 × 实验室——米白纸底 + 显微载玻片课程卡 */
function renderHome(): void {
  cleanup?.destroy();
  cleanup = null;
  root.innerHTML = "";
  document.body.classList.add("page-home");
  applySeo(HOME_TITLE, HOME_DESC);

  const home = document.createElement("div");
  home.className = "home";

  // Hero：教科书眉题 + 标题 + 页边装订装饰
  const hero = document.createElement("header");
  hero.className = "hero";
  const kicker = document.createElement("p");
  kicker.className = "hero-kicker";
  kicker.textContent = "高中生物 · 过程动画演示";
  const h1 = document.createElement("h1");
  h1.textContent = "生物概念可视化讲解";
  const sub = document.createElement("p");
  sub.className = "hero-sub";
  sub.textContent = "把抽象的细胞过程，拆成一帧帧看得懂的动画。可逐步播放、任意暂停，对齐教材与考纲。";
  const heroMeta = document.createElement("p");
  heroMeta.className = "hero-meta";
  heroMeta.textContent = `${registry.length} 大主题 · 免费 · 无需注册`;
  hero.append(kicker, h1, sub, heroMeta);

  // 标本目录
  const catalog = document.createElement("section");
  catalog.className = "catalog";
  const head = document.createElement("div");
  head.className = "catalog-head";
  const headTitle = document.createElement("h2");
  headTitle.textContent = "课程标本";
  const headNote = document.createElement("p");
  headNote.textContent = "点击任一载玻片，开始逐帧观察";
  head.append(headTitle, headNote);
  catalog.appendChild(head);

  const ul = document.createElement("ul");
  ul.className = "home-list";
  // 各课程荧光色对（青绿 / 琥珀 / 珊瑚 / 蓝紫），差异化标本图
  const ACCENTS: [string, string][] = [
    ["#7fd8be", "#f2c14e"],   // 减数分裂
    ["#8ab8ff", "#c9a2ff"],   // DNA 复制
    ["#ff9d7a", "#ffd27a"],   // 有丝分裂
    ["#ff8fab", "#7fd8be"],   // 基因表达
  ];
  // 按教材章节排序（册→章→节），同章节保持注册顺序（稳定排序）
  const ordered = [...registry].sort((x, y) => {
    const [x1, x2, x3] = chapterRank(x.meta.chapter);
    const [y1, y2, y3] = chapterRank(y.meta.chapter);
    return x1 - y1 || x2 - y2 || x3 - y3;
  });
  ordered.forEach((entry, i) => {
    const info = HOME_CARDS[entry.meta.id];
    const li = document.createElement("li");
    li.className = "card";
    li.style.setProperty("--i", String(i));
    const [a1, a2] = ACCENTS[i % ACCENTS.length];
    li.style.setProperty("--a1", a1);
    li.style.setProperty("--a2", a2);
    const a = document.createElement("a");
    a.href = `#/course/${entry.meta.id}`;
    a.className = "card-link";
    a.setAttribute("aria-label", `进入课程：${entry.meta.title}`);

    const art = document.createElement("span");
    art.className = "card-art";
    art.innerHTML = homeArt(entry.meta.id);

    const infoEl = document.createElement("span");
    infoEl.className = "card-info";
    const chapter = document.createElement("span");
    chapter.className = "card-chapter";
    chapter.textContent = entry.meta.chapter;
    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = entry.meta.title;
    const desc = document.createElement("span");
    desc.className = "card-desc";
    desc.textContent = info?.desc ?? "分步动画演示，可逐步播放、任意阶段暂停。";
    const foot = document.createElement("span");
    foot.className = "card-foot";
    const diff = document.createElement("span");
    diff.className = "card-diff";
    diff.textContent = `难度 ${"●".repeat(entry.meta.difficulty)}${"○".repeat(4 - entry.meta.difficulty)}`;
    const tag = document.createElement("span");
    tag.className = "card-tag";
    tag.textContent = info?.tag ?? "分步动画";
    const arrow = document.createElement("span");
    arrow.className = "card-arrow";
    arrow.textContent = "→";
    foot.append(diff, tag);
    infoEl.append(chapter, title, desc, foot);
    a.append(art, infoEl, arrow);
    li.appendChild(a);
    ul.appendChild(li);
  });
  catalog.appendChild(ul);
  home.append(hero, catalog);
  root.appendChild(home);
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
  document.body.classList.remove("page-home");
  cleanup = mountCoursePage(root, course, entry.createScene);
}

/** 路由分发：解析 hash 决定渲染目录页或课程页（支持 ?mode= 查询参数） */
function route(): void {
  const hash = location.hash || "#/";
  const match = /^#\/course\/([\w-]+)(?:\?mode=(\w+))?/.exec(hash);
  if (match) renderCourse(match[1], match[2]);
  else renderHome();
}

// 全局反馈入口：固定于右下角，点击在新标签页打开反馈问卷（外部链接，学生无需注册）
const feedbackBtn = document.createElement("a");
feedbackBtn.className = "feedback-btn";
const feedbackIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
feedbackIcon.setAttribute("viewBox", "0 0 20 20");
feedbackIcon.setAttribute("width", "15");
feedbackIcon.setAttribute("height", "15");
feedbackIcon.setAttribute("aria-hidden", "true");
feedbackIcon.innerHTML = `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3 6.5h14v8H6l-3 2.5v-10.5z"/>`;
feedbackBtn.append(feedbackIcon, document.createTextNode("反馈"));
feedbackBtn.title = "提建议 / 报告问题";
if (FEEDBACK_URL) {
  feedbackBtn.href = FEEDBACK_URL;
  feedbackBtn.target = "_blank";
  feedbackBtn.rel = "noopener";
} else {
  // 未配置问卷链接前不跳转，避免死按钮（RAT 上线前必须配置）
  feedbackBtn.href = "#";
  feedbackBtn.addEventListener("click", (ev) => ev.preventDefault());
}
document.body.appendChild(feedbackBtn);

window.addEventListener("hashchange", route);
route();

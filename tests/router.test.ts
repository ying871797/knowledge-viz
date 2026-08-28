// 路由冒烟测试（Task 9 手动验收的自动化替代）：
// jsdom 中设置 location.hash 并手动派发 hashchange，断言首页/课程页切换与清理函数生效。
// 注意：jsdom 对 location.hash 赋值的 hashchange 自动派发是异步且不可靠的，这里统一手动派发。
import { describe, it, expect, beforeEach } from "vitest";

/** 确保入口挂载点存在：main.ts 在导入时会立即执行 route() */
function ensureAppRoot(): void {
  if (!document.getElementById("app")) {
    const div = document.createElement("div");
    div.id = "app";
    document.body.appendChild(div);
  }
}

/** 切换 hash 并同步触发路由（手动派发 hashchange 事件） */
function go(hash: string): void {
  location.hash = hash;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

describe("hash 路由", () => {
  beforeEach(() => {
    ensureAppRoot();
    // 归位到目录页，保证每个用例从已知状态开始
    go("#/");
  });

  it("导入入口模块后初始渲染目录页，列出减数分裂条目", async () => {
    await import("../src/main");
    const app = document.getElementById("app")!;
    expect(app.querySelector("h1")?.textContent).toBe("生物概念可视化讲解");
    const link = app.querySelector<HTMLAnchorElement>('.home-list a[href="#/course/meiosis"]');
    expect(link?.textContent).toContain("减数分裂");
  });

  it("进入课程页 → 返回首页 → 再次进入均正常（清理函数生效）", async () => {
    await import("../src/main");
    const app = document.getElementById("app")!;

    // 进入课程页
    go("#/course/meiosis");
    expect(app.querySelector(".course-title")?.textContent).toContain("减数分裂");
    expect(app.querySelector(".back-link")).toBeTruthy();

    // 返回首页：课程页 DOM 被整体重建为目录页（清理句柄已在 renderHome 内执行）
    go("#/");
    expect(app.querySelector(".home-list")).toBeTruthy();
    expect(app.querySelector(".course-title")).toBeNull();

    // 再次进入课程页仍正常渲染（验证销毁后可重复装配）
    go("#/course/meiosis");
    expect(app.querySelector(".course-title")?.textContent).toContain("减数分裂");

    // 浏览器后退等价场景：hash 变化回目录页
    go("#/");
    expect(app.querySelector(".home-list")).toBeTruthy();
  });

  it("未知课程 id 回退到目录页", async () => {
    await import("../src/main");
    const app = document.getElementById("app")!;
    go("#/course/nonexistent");
    expect(app.querySelector(".home-list")).toBeTruthy();
  });

  it("课程页按路由更新 SEO title/description（分享卡片可见）", async () => {
    await import("../src/main");
    // 目录页：默认 SEO 文案
    go("#/");
    expect(document.title).toContain("高中生物过程动画");
    // 课程页：title/description 带课程名与章节
    go("#/course/meiosis");
    expect(document.title).toContain("减数分裂");
    expect(document.title).toContain("分步动画");
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    expect(meta?.content).toContain("减数分裂");
    expect(meta?.content).toContain("必修二");
  });

  it("反馈按钮存在；配置问卷链接后以新标签页打开", async () => {
    const { FEEDBACK_URL } = await import("../src/main");
    const btn = document.body.querySelector<HTMLAnchorElement>(".feedback-btn");
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toContain("反馈");
    // 未配置问卷时按钮不跳转（href 为 #）；配置后为外链且新标签页打开
    if (FEEDBACK_URL) {
      expect(btn?.href).toBe(FEEDBACK_URL);
      expect(btn?.target).toBe("_blank");
      expect(btn?.rel).toContain("noopener");
    } else {
      expect(btn?.getAttribute("href")).toBe("#");
    }
  });
});

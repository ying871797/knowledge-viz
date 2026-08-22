import { describe, it, expect } from "vitest";

describe("工程冒烟测试", () => {
  it("jsdom 环境可用且断言生效", () => {
    const el = document.createElement("div");
    el.textContent = "ok";
    expect(el.textContent).toBe("ok");
  });
});

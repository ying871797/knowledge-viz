import { describe, it, expect } from "vitest";
import { NotesPanel } from "../notes";

describe("NotesPanel", () => {
  it("render 展示标题与全部要点", () => {
    const c = document.createElement("div");
    const n = new NotesPanel(c);
    n.render("减Ⅰ前期", ["联会形成四分体", "可发生交叉互换"]);
    expect(c.querySelector("h3")!.textContent).toBe("减Ⅰ前期");
    expect(c.querySelectorAll("li").length).toBe(2);
  });
  it("renderMasked 隐藏真实标题", () => {
    const c = document.createElement("div");
    const n = new NotesPanel(c);
    n.renderMasked("判断当前时期");
    expect(c.querySelector("h3")!.textContent).toContain("？");
    expect(c.querySelectorAll("li").length).toBe(0);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ZoomController, MIN_ZOOM, MAX_ZOOM } from "../zoomController";

function makeSvg(viewBox = "0 0 800 400") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  if (viewBox) svg.setAttribute("viewBox", viewBox);
  svg.getBoundingClientRect = () => ({
    left: 0, top: 0, width: 800, height: 400,
    right: 800, bottom: 400, x: 0, y: 0, toJSON: () => {},
  });
  return svg;
}

function makeContainer() {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

describe("ZoomController", () => {
  let svg: SVGSVGElement;
  let container: HTMLElement;
  let ctrl: ZoomController;

  beforeEach(() => {
    svg = makeSvg();
    container = makeContainer();
    container.appendChild(svg);
    ctrl = new ZoomController(svg, container);
  });

  afterEach(() => {
    ctrl.destroy();
    container.remove();
  });

  it("初始 viewBox 正确", () => {
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 400");
  });

  it("zoom(2) 放大 2×：宽高减半、中心不动", () => {
    ctrl.zoom(2);
    const vb = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
    expect(vb[2]).toBeCloseTo(400);
    expect(vb[3]).toBeCloseTo(200);
    // 默认锚定中心 → 中心仍为 (400, 200)
    expect(vb[0] + vb[2] / 2).toBeCloseTo(400);
    expect(vb[1] + vb[3] / 2).toBeCloseTo(200);
  });

  it("zoom(2, 200, 100) 锚定指定点", () => {
    ctrl.zoom(2, 200, 100);
    const vb = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
    // 锚定点在视口中的相对位置应保持不变
    const relX = (200 - vb[0]) / vb[2];
    const relY = (100 - vb[1]) / vb[3];
    expect(relX).toBeCloseTo(200 / 800);
    expect(relY).toBeCloseTo(100 / 400);
  });

  it("zoom(0.5) 缩小 0.5×：宽高翻倍", () => {
    ctrl.zoom(0.5);
    const vb = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
    expect(vb[2]).toBeCloseTo(1600);
    expect(vb[3]).toBeCloseTo(800);
  });

  it("pan 平移 viewBox", () => {
    ctrl.pan(100, 50);
    const vb = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
    expect(vb[0]).toBeCloseTo(-100);
    expect(vb[1]).toBeCloseTo(-50);
  });

  it("zoom + pan 组合后 reset 恢复", () => {
    ctrl.zoom(3, 200, 100);
    ctrl.pan(30, 20);
    ctrl.reset();
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 400");
  });

  it("zoomLevel 返回当前缩放倍率", () => {
    expect(ctrl.zoomLevel).toBeCloseTo(1);
    ctrl.zoom(2);
    expect(ctrl.zoomLevel).toBeCloseTo(2);
    ctrl.zoom(2);
    expect(ctrl.zoomLevel).toBeCloseTo(4);
  });

  it("无 viewBox 属性时 fallback 到 0 0 800 400", () => {
    const badSvg = makeSvg("");
    badSvg.removeAttribute("viewBox");
    const c2 = makeContainer();
    c2.appendChild(badSvg);
    const ctrl2 = new ZoomController(badSvg, c2);
    // fallback 时内部 vb 为 800×400，zoom 验证即可
    ctrl2.zoom(2);
    const vb = badSvg.getAttribute("viewBox")!.split(/\s+/).map(Number);
    expect(vb[2]).toBeCloseTo(400);
    expect(vb[3]).toBeCloseTo(200);
    ctrl2.destroy();
    c2.remove();
  });

  it("zoom 超过上限 MAX_ZOOM 夹在 4×", () => {
    ctrl.zoom(8);
    expect(ctrl.zoomLevel).toBeCloseTo(MAX_ZOOM);
    const vb = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
    expect(vb[2]).toBeCloseTo(800 / MAX_ZOOM);
  });

  it("zoom 低于下限 MIN_ZOOM 夹在 0.5×", () => {
    ctrl.zoom(0.1);
    expect(ctrl.zoomLevel).toBeCloseTo(MIN_ZOOM);
    const vb = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
    expect(vb[2]).toBeCloseTo(800 / MIN_ZOOM);
  });

  it("已达到上限后再放大不越界（滚轮连滚）", () => {
    ctrl.zoom(4);
    ctrl.zoom(2);
    expect(ctrl.zoomLevel).toBeCloseTo(MAX_ZOOM);
  });

  it("pan 夹取：视口中心不越出初始视野（初始 800×400）", () => {
    ctrl.zoom(2);   // 视口缩到 400×200
    ctrl.pan(10000, 10000);
    const vb = svg.getAttribute("viewBox")!.split(/\s+/).map(Number);
    const cx = vb[0] + vb[2] / 2;
    const cy = vb[1] + vb[3] / 2;
    expect(cx).toBeGreaterThanOrEqual(0);
    expect(cx).toBeLessThanOrEqual(800);
    expect(cy).toBeGreaterThanOrEqual(0);
    expect(cy).toBeLessThanOrEqual(400);
    // 已推到边界：中心贴到初始视野的左/上边缘
    expect(cx).toBeCloseTo(0);
    expect(cy).toBeCloseTo(0);
  });

  it("zoom 参数非法（0/负数/NaN/Infinity）为 no-op", () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      ctrl.zoom(bad);
      expect(svg.getAttribute("viewBox")).toBe("0 0 800 400");
    }
  });

  it("destroy 后不再响应事件（拖动无效）", () => {
    ctrl.destroy();
    container.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 200, clientY: 200, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 400");
  });
});

/**
 * 场景画布缩放控制器：通过操控 SVG viewBox 实现自由缩放+平移。
 * 不侵入场景代码，适用于所有课程的 SVG 场景。
 *
 * 交互映射：
 *   桌面 — 拖动平移 + 滚轮缩放（锚定光标）
 *   移动端 — 单指平移 + 双指捏合缩放
 *   兜底 — 调用方可在控制条加 +/−/⊙ 按钮调用 zoom/pan/reset
 */

/** 缩放倍率下限（0.5×：可整体缩小看全局，不再继续缩小） */
export const MIN_ZOOM = 0.5;
/** 缩放倍率上限（4×：贴近看细节，不再继续放大） */
export const MAX_ZOOM = 4;

export class ZoomController {
  private svg: SVGSVGElement;
  private container: HTMLElement;
  private initial: { x: number; y: number; w: number; h: number };
  private vb: { x: number; y: number; w: number; h: number };
  private cleanup: (() => void)[] = [];

  // 鼠标拖动
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  // 触摸
  private touchCount = 0;
  private pinchDist0 = 0;
  private pinchCenter0: [number, number] = [0, 0];

  constructor(svg: SVGSVGElement, container: HTMLElement) {
    this.svg = svg;
    this.container = container;

    const raw = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
    const init =
      raw && raw.length === 4
        ? { x: raw[0], y: raw[1], w: raw[2], h: raw[3] }
        : { x: 0, y: 0, w: 800, h: 400 };
    this.initial = init;
    this.vb = { ...init };

    this.setupEvents();
  }

  // —— 公共 API ——

  /** 围绕 (cx, cy) 缩放；factor > 1 放大，< 1 缩小；倍率夹取在 [MIN_ZOOM, MAX_ZOOM] */
  zoom(factor: number, cx?: number, cy?: number): void {
    const { vb, initial } = this;
    if (cx === undefined) cx = vb.x + vb.w / 2;
    if (cy === undefined) cy = vb.y + vb.h / 2;
    const nw0 = vb.w / factor;
    // 倍率夹取：到边界后继续缩放不再越界
    const nw = Math.min(initial.w / MIN_ZOOM, Math.max(initial.w / MAX_ZOOM, nw0));
    const nh = vb.h * (nw / vb.w);
    vb.x = cx - (cx - vb.x) * (nw / vb.w);
    vb.y = cy - (cy - vb.y) * (nh / vb.h);
    vb.w = nw;
    vb.h = nh;
    this.clampPan();
    this.apply();
  }

  /** 平移（SVG 坐标系增量）；视口中心不越出初始视野 */
  pan(dx: number, dy: number): void {
    this.vb.x -= dx;
    this.vb.y -= dy;
    this.clampPan();
    this.apply();
  }

  /** 平移夹取：视口中心始终落在初始视野范围内 */
  private clampPan(): void {
    const { vb, initial } = this;
    const halfW = vb.w / 2;
    const halfH = vb.h / 2;
    vb.x = Math.min(initial.x + initial.w - halfW, Math.max(initial.x - halfW, vb.x));
    vb.y = Math.min(initial.y + initial.h - halfH, Math.max(initial.y - halfH, vb.y));
  }

  /** 重置到初始 viewBox */
  reset(): void {
    Object.assign(this.vb, this.initial);
    this.apply();
  }

  /** 当前缩放倍率 */
  get zoomLevel(): number {
    return this.initial.w / this.vb.w;
  }

  /** 销毁：移除所有事件监听 */
  destroy(): void {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
  }

  // —— 内部 ——

  private apply(): void {
    const { x, y, w, h } = this.vb;
    this.svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  }

  /** 屏幕坐标 → SVG 坐标 */
  private s2s(cx: number, cy: number): [number, number] {
    const r = this.svg.getBoundingClientRect();
    return [
      this.vb.x + (cx - r.left) / r.width * this.vb.w,
      this.vb.y + (cy - r.top) / r.height * this.vb.h,
    ];
  }

  private on(
    target: EventTarget,
    type: string,
    fn: EventListener,
    opts?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, fn, opts);
    this.cleanup.push(() => target.removeEventListener(type, fn));
  }

  private setupEvents(): void {
    const c = this.container;

    // —— 鼠标拖动平移 ——
    this.on(c, "mousedown", ((e: MouseEvent) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      c.style.cursor = "grabbing";
    }) as EventListener);

    this.on(document, "mousemove", ((e: MouseEvent) => {
      if (!this.dragging) return;
      const r = this.svg.getBoundingClientRect();
      this.pan(
        (e.clientX - this.lastX) / r.width * this.vb.w,
        (e.clientY - this.lastY) / r.height * this.vb.h,
      );
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }) as EventListener);

    this.on(document, "mouseup", (() => {
      if (this.dragging) {
        this.dragging = false;
        c.style.cursor = "";
      }
    }) as EventListener);

    // —— 滚轮缩放 ——
    this.on(c, "wheel", ((e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom(f, ...this.s2s(e.clientX, e.clientY));
    }) as EventListener, { passive: false });

    // —— 触摸：单指平移 / 双指捏合缩放 ——
    this.on(c, "touchstart", ((e: TouchEvent) => {
      this.touchCount = e.touches.length;
      if (this.touchCount === 1) {
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      } else if (this.touchCount === 2) {
        [this.pinchDist0, this.pinchCenter0] = this.fingerMetrics(e.touches);
      }
    }) as EventListener);

    this.on(c, "touchmove", ((e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.touchCount === 1) {
        const t = e.touches[0];
        const r = this.svg.getBoundingClientRect();
        this.pan(
          (t.clientX - this.lastX) / r.width * this.vb.w,
          (t.clientY - this.lastY) / r.height * this.vb.h,
        );
        this.lastX = t.clientX;
        this.lastY = t.clientY;
      } else if (e.touches.length === 2) {
        const [dist, center] = this.fingerMetrics(e.touches);
        const r = this.svg.getBoundingClientRect();
        this.zoom(dist / this.pinchDist0, ...this.s2s(center[0], center[1]));
        this.pan(
          (center[0] - this.pinchCenter0[0]) / r.width * this.vb.w,
          (center[1] - this.pinchCenter0[1]) / r.height * this.vb.h,
        );
        this.pinchDist0 = dist;
        this.pinchCenter0 = center;
      }
    }) as EventListener, { passive: false });

    this.on(c, "touchend", (() => {
      this.touchCount = 0;
    }) as EventListener);
  }

  private fingerMetrics(ts: TouchList): [number, [number, number]] {
    const [a, b] = [ts[0], ts[1]];
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;
    return [
      Math.hypot(dx, dy),
      [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2],
    ];
  }
}

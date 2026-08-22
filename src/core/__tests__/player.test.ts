import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Player } from "../player";

describe("Player", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const onChange = vi.fn();
    return { onChange, p: new Player(4, onChange, 1000) };
  };

  it("初始索引为 0 且不触发回调", () => {
    const { onChange, p } = make();
    expect(p.current).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("首步 prev 为 no-op", () => {
    const { onChange, p } = make();
    p.prev();
    expect(p.current).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("末步 next 为 no-op", () => {
    const { p } = make();
    p.goTo(3);
    p.next();
    expect(p.current).toBe(3);
  });
  it("goTo 越界时夹取到有效范围", () => {
    const { p } = make();
    p.goTo(-5);
    expect(p.current).toBe(0);
    p.goTo(99);
    expect(p.current).toBe(3);
  });
  it("play 按间隔推进并在末步自动停止", () => {
    const { p } = make();
    p.play();
    expect(p.isPlaying).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(p.current).toBe(3);
    vi.advanceTimersByTime(1000); // 下一个 tick 触发末步自动暂停
    expect(p.isPlaying).toBe(false);
  });
  it("toggle 在播放/暂停间切换", () => {
    const { p } = make();
    p.toggle();
    expect(p.isPlaying).toBe(true);
    p.toggle();
    expect(p.isPlaying).toBe(false);
  });
  it("destroy 后不再推进", () => {
    const { p } = make();
    p.play();
    p.destroy();
    vi.advanceTimersByTime(5000);
    expect(p.current).toBe(0);
  });
});

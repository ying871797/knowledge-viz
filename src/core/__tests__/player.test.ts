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

  it("暂停状态下调整间隔后按新间隔推进", () => {
    const { onChange, p } = make();
    p.setIntervalMs(500);
    p.play();
    vi.advanceTimersByTime(500);
    // 旧间隔为 1000ms，若未生效则此刻不应推进
    expect(p.current).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("播放中切换间隔立即以新间隔重启且不改变状态", () => {
    const { onChange, p } = make();
    p.play();
    vi.advanceTimersByTime(1000); // 推进到索引 1
    onChange.mockClear();
    p.setIntervalMs(200);
    // 切换瞬间：不触发回调、索引不变
    expect(onChange).not.toHaveBeenCalled();
    expect(p.current).toBe(1);
    // 400ms 内按新间隔应推进约 2 步（而非旧间隔的 0 步）
    vi.advanceTimersByTime(400);
    expect(p.current).toBe(3);
  });

  it.each([0, -100, NaN])("非法参数 %p 被忽略，节奏保持原间隔", (bad) => {
    const { p } = make();
    p.play();
    p.setIntervalMs(bad as number);
    // 1000ms（原间隔）恰好推进 1 步；若间隔被改为非法值导致异常则此断言失败
    vi.advanceTimersByTime(1000);
    expect(p.current).toBe(1);
    expect(p.isPlaying).toBe(true);
  });
});

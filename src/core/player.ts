/**
 * 分步播放器：纯逻辑状态机，不依赖 DOM。
 * 边界规则：首步后退/末步前进为 no-op；自动播放到末步自动暂停。
 */
export class Player {
  private index = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private stageCount: number,
    private onChange: (index: number) => void,
    private intervalMs = 1500,
  ) {}

  get current(): number {
    return this.index;
  }

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  /** 跳转并夹取范围；相同索引不触发回调 */
  goTo(i: number): void {
    const target = Math.max(0, Math.min(this.stageCount - 1, Math.round(i)));
    if (target === this.index) return;
    this.index = target;
    this.onChange(this.index);
  }

  next(): void {
    this.goTo(this.index + 1);
  }

  prev(): void {
    this.goTo(this.index - 1);
  }

  play(): void {
    if (this.timer !== null || this.index >= this.stageCount - 1) return;
    this.timer = setInterval(() => {
      // 到达末步时，下一个 tick 自动暂停
      if (this.index >= this.stageCount - 1) {
        this.pause();
        return;
      }
      this.next();
    }, this.intervalMs);
  }

  pause(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  toggle(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  /** 调整自动播放间隔；播放中切换时以新间隔立即重启，不改变当前索引 */
  setIntervalMs(ms: number): void {
    // 参数非法（非有限数或 <= 0）时忽略：不抛错、不改变状态
    if (!Number.isFinite(ms) || ms <= 0) return;
    if (this.timer !== null) {
      // 播放中：销毁旧定时器 → 更新间隔 → 以新间隔重启（索引不变、不触发 onChange）
      this.pause();
      this.intervalMs = ms;
      this.play();
    } else {
      this.intervalMs = ms;
    }
  }

  destroy(): void {
    this.pause();
  }
}

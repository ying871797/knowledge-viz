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

  destroy(): void {
    this.pause();
  }
}

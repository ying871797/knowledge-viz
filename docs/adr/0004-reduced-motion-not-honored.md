# 动效不响应系统「减少动效」偏好

状态：accepted

本项目所有动效（课程场景补间 + 首页卡片等装饰）**刻意不响应** `prefers-reduced-motion: reduce`，`src/style.css` 不保留任何 reduce 降级块。

背景：`@media (prefers-reduced-motion: reduce)` 会依据操作系统无障碍设置（如 Windows 关闭「动画效果」）把课程场景的 `transition: transform …/opacity …` 覆盖为 `opacity 200ms`，使阶段切换只剩淡变、失去位移。这违反《AGENTS.md 动画设计准则》的「观感平滑优先（尽量不瞬切）」与「运动即语义（分离要有被拉开的方向感）」，并旁路 `--tween-ms` 补间时长机制。该降级最初（提交 `04c3657`）只针对首页卡片，后被扩展到全部课程场景，导致关闭系统动画的用户所有动画失去平滑感。

## Considered Options

- **课程场景豁免、装饰仍降级**（否决）：改动最小，但保留的卡片降级对系统开 reduce 的用户（含本项目所有者）仍生效，治标不治本，且课程/装饰两套口径徒增复杂度。
- **保留响应、课程场景改为缩短时长**（否决）：仍是运动、仍受系统影响，未解决「不该由系统决定教学动效是否展示」的诉求。
- **页内「动效」开关（不读系统）**（否决，保留为备选）：兼顾 motion-sensitive 用户，但需新增 UI 元素与持久化逻辑，超出本次修复范围；将来确有真实无障碍需求时另行决策。
- **整体删除 reduce 降级**（采纳）：课程补间是教学信息（WCAG 允许必要动效豁免），删除后所有环境下动效表现一致，且与准则相符。

## Consequences

- 真正因健康原因启用系统 reduce 的用户也会看到全部动效；这是经所有者确认的有意取舍。
- `src/__tests__/mobileScene.test.ts` 由「reduce 块必须覆盖全部场景选择器」反转为「style.css 不得出现 `prefers-reduced-motion`」正向锁，防止被当作 bug 加回。
- 如需为 motion-sensitive 用户提供降级，应先更新本 ADR（或标记为 superseded）并同步修改该断言，不得静默加回 reduce 媒体查询。

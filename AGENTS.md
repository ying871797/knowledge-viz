# AGENTS.md

## 常用命令

```bash
npm test                      # vitest run 全套测试
npx vitest run <文件路径>      # 跑单个测试文件
npx tsc --noEmit              # 仅类型检查（build 已包含）
npm run dev                   # 开发服务器 http://localhost:5173（HMR）
npm run build                 # 先 tsc --noEmit 再 vite build，产物 dist/
```

无 lint/format 配置；验证 = 测试 + 类型检查。

测试位置两处：core/courses 用例与源码同目录放 `__tests__/`；顶层 `tests/` 只放 router/smoke。

## 架构：数据与渲染分离

纯静态站点（Vite + TS，无框架，原生 SVG/DOM），部署到 GitHub Pages。

- `src/main.ts` —— 入口：hash 路由（`#/` 目录页、`#/course/<id>?mode=<m>` 课程页，未知 id 回退目录页）+ 课程注册表
- `src/core/` —— 通用引擎，**与具体知识点无关**：
  - `player.ts` 分步播放器状态机（边界约定：首步后退/末步前进为 no-op；自动播放到末步自动停止；`setIntervalMs` 播放中切换会重启定时器）
  - `numberChart.ts` SVG 曲线图；jsdom 无布局计算，坐标由组件自行计算，测试断言的是属性值
  - `app.ts` `mountCoursePage` 返回清理句柄，重渲染前必须 `destroy()`（否则播放器 interval 泄漏）；装配链路：player 索引 → applyStage → scene.render + 两图 setActive 双向联动；`notes.ts` 讲解面板支持练习模式遮蔽答案
- `src/courses/<id>/` —— 每个知识点一个模块：`data.ts`（阶段数据）+ `scene.ts`（SVG 场景，实现 `SceneComponent` 接口）；一个模块可承载多模式（减数分裂模块同时导出 meiosis/oogenesis 两套课程，靠路由参数切换）

**新增知识点的唯一路径**：新建课程模块 → 在 `src/main.ts` 注册表登记一条（meta + `load(mode)` + createScene，注册时过 validateCourse 门禁）。禁止为单个知识点改 core 引擎。

## 关键约束

- 课程数据必须过 `validateCourse`（fail-fast 抛错 + 占位提示），它校验数目自洽：`dna = dnaPerChromosome × chromosome`、有单体时 dpc=2、无单体时 dna=chromosome。改 data.ts 的 numbers 时这三条会被测试强制。
- **染色体布局不变式**（`scene.test.ts` 强制）：槽位是相对细胞中心的偏移，须满足 `usableRadius = CELL_RADIUS[cells] − 14 − 60`；同细胞内**不同染色体**两两中心距 ≥ 20（姐妹单体重叠豁免、跨细胞不比较）。改布局常量前先算 Ru——4 细胞时 R=95 → Ru=21，仅比下限大 1px，余量极小。卵细胞模式 oo-6~10 用绝对坐标（不走相对槽位），由独立用例覆盖。
- 数目表述用 n 表示法（本课程 n=2）：曲线纵轴刻度 `1n~4n`、讲解文案与 callout 用「2n→n」而非具体数字。这是用户明确的偏好。
- `comboAlt`（自由组合切换）语义是真实的组合变化（A+B 同极 ↔ A+b 同极），不是镜像；仅减Ⅰ后期可用。

## 动画设计准则

优先级：直观 > 简单。适用于内容画面（课程场景、图表组件）；交互控件只受可用性规范（触控热区、图标语义）；路由/页面切换不做转场动画（重挂载即重置是特性）。修改前逐条自查：

**直观性**
- 一阶段一信息：帧=阶段目标快照，补间中间态不承担信息义务；暂停任意阶段，画面本身能答出"正在发生什么"，需依赖讲解文案才能看懂 = 画面失败
- 运动即语义：分离要有"被拉开"的方向感，复制要有复制的过程感；只动参与当前阶段的元素，静止元素保持绝对不动（视线引导）

**元素纪律**
- 元素 = 拥有独立位置/角度/透明度的最小 SVG 插值单元，单体杆/着丝点/标注各算一个（术语见 `CONTEXT.md`）
- 删除测试：去掉某元素后理解成本不上升 → 必删（赤道板/纺锤丝被有意裁剪即先例）；新增常驻装饰元素默认拒绝；刻意不设元素总数上限
- 固定元素集零增删，阶段切换只做位置/角度/透明度插值；用颜色编码代替新标注元素，色相 ≤3 且颜色不得是唯一区分通道（兼顾位置区分）

**工程约束**
- 一切新布局/可读性约束（间距、避让、对齐、刻度防重叠）必须落为对应测试断言（场景 → scene.test.ts，图表 → numberChart.test.ts），禁止只靠目检
- 验收分工：几何/数量/颜色类由断言强制；直观性/语义类无法断言，以用户目检为准——agent 提交前跑机械项并附「待目检清单」
- 按 stage id 的 switch/case 声明槽位表 = 合法数据；layout/render 内按 stage id 分支改变行为或结构 = 模型选错的信号，修模型而非加分支
- 示意取舍须过两道门：①真实结构画出来噪音>信息；②不制造错误概念。红线：简化产生的误解必须可由讲解文案纠正，否则禁止。每个取舍（隐藏/夸大了什么、为什么）登记到 `.superpowers/sdd/progress.md`，防止后人当 bug 修复

**动效**
- 时长反映语义权重（重大重组慢、稳定态过渡快），复用播放器五档调速，不做逐段变速
- 默认同步动画；交错（stagger）须给出教学理由
- **过渡机制**：CSS transition（`transform` + `opacity`）为唯一过渡机制，禁止用 JS requestAnimationFrame 做补间（除 Safari 上 CSS `d` 属性的 JS 回退外）。所有场景元素的位置/角度/透明度变化均通过 `style.transform` / `style.opacity` 通道，不走 SVG attribute（`setAttribute("transform")` 不触发 CSS transition）
- **easing 曲线**：`transform` 用 `ease-out`（快启动缓到位，元素归位感）；`opacity` 用 `ease-in-out`（淡入淡出两端缓冲，柔和自然）。全局统一，不做逐场景微调
- **SVG path d 过渡**：路径点数归一化后（同命令数、同命令类型），CSS `d` 属性过渡在 Chrome/Edge/Firefox 自动生效；Safari 不支持（WebKit 性能问题搁置），采用渐进增强——路径变化在 Safari 上瞬切，设计时确保每帧路径变化幅度小、瞬切不突兀
- **背景元素持久化**：所有课程场景的背景元素（细胞轮廓、纺锤丝、核膜等）必须在 `mount()` 中预声明为 DOM 池，`layout()` 通过 opacity/transform 控制显隐和位置。禁止每帧 remove+reappend（DOM 重建会导致闪烁和过渡中断）

## 环境与工作流

- Windows / PowerShell 5.1 环境。git diff 输出经 PowerShell 管道会 GBK 乱码——生成 diff 文件用 `cmd /c "git diff ... > %TEMP%\x.txt"` 再按 UTF-8 读入。
- 本仓库采用子代理开发流程：进度账本在 `.superpowers/sdd/progress.md`（含各任务完成记录与遗留 minor findings），接手时先读它和 `git log`。
- 领域术语表在 `CONTEXT.md`（阶段/元素/槽位/示意取舍等定义以它为准）；架构决策记录在 `docs/adr/`。
- 实施方案文档放 `.proposals/*.html`（自包含 HTML，需用户审批后才能动手）；`.my_proposals/` 为历史目录勿混用。
- 部署：push 到 main 触发 `.github/workflows/deploy.yml`（CI 先跑 `npm test` + build，测试挂则不部署）；首次部署需在仓库 Settings → Pages 把 Source 设为 "GitHub Actions"。`base: './'` 勿改为绝对路径。
- 根目录的 docx 是内容素材（用户文件），不入库、不要提交。

## **分支与集成流程**（最高优先级，强制遵守）

> 完整规范见全局 AGENTS.md「分支与集成流程」章节，以下为本项目强制补充。

1. **每个功能/修复必须走 feat 分支**：`git worktree add .worktrees/<主题> -b feat/<主题> main`，禁止直接在 main 上开发。

2. **双门禁收工**（缺一不合）：
   - **机械门禁**：`npm test` + `npx tsc --noEmit` 全绿（agent 执行）。
   - **人工门禁**：agent 附「待目检清单」→ **等待用户明确确认** → 用户说「同意/可以/没问题」后，方可 merge main + push。

3. **禁止跳过人工门禁**：即使测试全绿、代码看起来没问题，也必须等用户确认后再 merge。不得以「时间紧迫」「改动很小」等理由擅自合并。

4. **发车顺序**：
   ```
   git checkout main
   git merge --no-ff feat/<主题> -m "merge: feat/<主题> — <摘要>"
   git push origin main          # 需用户手动执行（网络环境差异）
   git worktree remove .worktrees/<主题>
   git branch -d feat/<主题>
   ```

5. **推送由用户执行**：因网络/代理环境差异，`git push origin main` 由用户手动完成，agent 不自动推送。

6. **例外（可直接在 main 操作）**：
   - 修复明显的语法错误或拼写错误
   - 运行用户明确要求的测试命令
   - 用户已提前授权的标准化操作（如 lint、format）
   - 纯文档微调

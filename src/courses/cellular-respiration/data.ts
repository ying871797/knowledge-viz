/**
 * 细胞呼吸（必修一 1-5.3）课程数据
 *
 * 双模式：一个模块导出两套课程对象，靠路由参数 `?mode=` 切换（沿用减数分裂 meiosis/oogenesis 范式）。
 *   - aerobic   有氧呼吸：三个阶段依次在线粒体内完成（教材事实），9 幕
 *   - anaerobic 无氧呼吸：与有氧共用第 1 阶段，只在细胞质基质中完成，5 幕
 *
 * 不写 numbers 字段：StageNumbers 的自洽校验只对「染色体/DNA/染色单体」这类数目有意义，
 * 本课目的量纲是「分子数」，用显式 chartConfigs 承载（PCR 课程同此先例）。
 *
 * 【曲线图的横轴语义】NumberChart 的横轴是「时期段轴」：每一幕占一整段等宽区间，
 * 段内形态本身承担信息义务（期内恒定 + 段边界阶跃），不画速率（速率是连续量，
 * 画成阶梯会暗示「幕内恒定、幕间跳变」= 事实性误导）。
 *
 * 【与教材的数字边界】docx 给的是「少量/大量能量」「少量/大量[H]」，没给具体数字；
 * 因此本课不把 [H] 与 ATP 写进曲线图，也不标 ATP 具体个数。
 * 曲线图只画总反应式唯一确定的三种物质（葡萄糖 / O₂ / CO₂）的精确计量。
 */
import type { Course, Stage, ChartConfig } from "../../core/types";

/** 场景状态：按幕查槽位表，render 内不做 stage id 分支 */
export interface RespirationState {
  stage: string;
}

/** 曲线图配色：与场景中该物质的颜色一致（图例可对照） */
const C_GLUCOSE = "#f59e0b"; // 琥珀：葡萄糖
const C_O2 = "#38bdf8";      // 天蓝：O₂（及其产物 H₂O）
const C_CO2 = "#94a3b8";     // 灰蓝：CO₂
const C_H2O = "#22d3ee";     // 青：净增 H₂O

/** 有氧模式幕 id（场景槽位表与测试共用这两个清单） */
export const AEROBIC_STAGE_IDS = [
  "aerobic-overview",  // 0 反应物总览
  "stage1-site",       // 1 第 1 阶段场所
  "stage1-split",      // 2 第 1 阶段分解
  "stage1-yield",      // 3 第 1 阶段产物
  "stage2-site",       // 4 第 2 阶段场所
  "stage2-decarb",     // 5 第 2 阶段脱羧
  "stage3-site",       // 6 第 3 阶段场所
  "stage3-water",      // 7 第 3 阶段生成水
  "aerobic-total",     // 8 总反应式核对
] as const;

/** 无氧模式幕 id */
export const ANAEROBIC_STAGE_IDS = [
  "anaerobic-condition",  // 0 条件：无氧
  "anaerobic-stage1",     // 1 第 1 阶段（与有氧共用）
  "anaerobic-site",       // 2 第 2 阶段场所
  "anaerobic-products",   // 3 产物
  "anaerobic-yield",      // 4 能量去向
] as const;

// —— 有氧呼吸 ——

/**
 * 有氧呼吸曲线图（两张）：只画总反应式唯一确定计量的物质 + 水的净增量。
 *
 * 【为何拆成两张】原为「1 张 4 序列」，但三条高值序列的平台段彼此重合：
 * O₂ 与 CO₂ 在第 6~7 幕（1 起数）同为 6，CO₂ 与 H₂O 在第 8~9 幕同为 6，
 * 后画的把先画的完全盖住——9 幕里没有任何一幕是四条线分开的，色相也涨到 4 个（超「色相 ≤3」）。
 * 故按代谢课唯一的二元结构（进什么 → 出什么）正交切分，图内两条线方向一致，
 * 图例由 4 项降到 2 项，唯一残留的跨序列重合是图②的 CO₂ 与 H₂O。
 *
 * 【CO₂ 与 H₂O 的重合是事实，用虚线而非拆图处理】第 3 阶段完成后累计 6 CO₂ 与净增 6 H₂O
 * 同时成立，这正是总反应式 C₆H₁₂O₆ + 6O₂ + 6H₂O → 6CO₂ + 12H₂O 的配平状态，
 * 拆成两张单线图会把这个「进 6 出 6」的对照拆散。故给 H₂O 加 dashed：
 * NumberChart 会同时给路径加 stroke-dasharray 并把图例色块改成虚线（numberChart.ts:173/198），
 * 于是实线 CO₂ 从虚线缝隙中透出，图形与图例都不靠颜色单独区分——零 core 改动。
 *
 * 【纵轴取舍】图①纵轴由 O₂ 决定（yMax=6），葡萄糖恒在 1、仅占绘图高度 17%，是一条贴地矮线。
 * 这不是缺陷而是事实：只有同轴对比才看得出「葡萄糖第 1 阶段就耗尽、O₂ 撑到第 3 阶段」。
 * 单设 yMax 需改 NumberChart 构造签名（共享组件，影响 6 门课），代价大于收益，故不拆第三条轴。
 * 上述性质由 __tests__/data.test.ts 的「图内无冗余序列、无平台重合」门禁锁死。
 */
const aerobicCharts: ChartConfig[] = [
  {
    title: "反应物的存留（1 分子葡萄糖为基准）",
    series: [
      { label: "剩余葡萄糖", color: C_GLUCOSE, values: [1, 1, 0, 0, 0, 0, 0, 0, 0] },
      { label: "剩余 O₂", color: C_O2, values: [6, 6, 6, 6, 6, 6, 6, 0, 0] },
    ],
  },
  {
    title: "产物的累计（1 分子葡萄糖为基准）",
    series: [
      { label: "累计产出 CO₂", color: C_CO2, values: [0, 0, 0, 0, 0, 6, 6, 6, 6] },
      // dashed：与上一条的累计值在第 8~9 幕同为 6（配平事实），用虚线让两者在图形与图例上都可区分
      { label: "净增 H₂O", color: C_H2O, values: [0, 0, 0, 0, 0, 0, 0, 6, 6], dashed: true },
    ],
  },
];

const aerobicStages: Stage<RespirationState>[] = [
  {
    id: "aerobic-overview",
    title: "有氧呼吸：总览",
    chartLabel: "总览",
    narration: [
      "有氧呼吸是细胞呼吸的主要形式，指细胞在氧的参与下分解有机物，把有机物中的化学能释放出来，并转移到 ATP 中的过程。",
      "总反应式：C₆H₁₂O₆ + 6O₂ + 6H₂O → 6CO₂ + 12H₂O + 能量。",
      "最常用的反应物是糖类中的葡萄糖。",
      "下面按教材顺序，把这一过程拆成三个阶段一步步看：每一阶段在哪个场所、发生什么、得到什么。",
    ],
    sceneState: { stage: "aerobic-overview" },
  },
  {
    id: "stage1-site",
    title: "第 1 阶段：场所",
    chartLabel: "①场所",
    narration: [
      "有氧呼吸的第一个阶段在细胞质基质中进行，不需要氧气参与。",
      "这一阶段的主要产物是丙酮酸，丙酮酸里还含有大量化学能。",
      "注意场所是「细胞质基质」——它属于细胞质，不在线粒体里。",
    ],
    sceneState: { stage: "stage1-site" },
  },
  {
    id: "stage1-split",
    title: "第 1 阶段：葡萄糖分解为丙酮酸",
    chartLabel: "①分解",
    narration: [
      "在酶的作用下，1 分子葡萄糖分解成 2 分子丙酮酸，并释放出少量能量。",
      "「1 变 2」是有氧呼吸第 1 阶段最关键的计量关系，后面所有 CO₂ 和 H₂O 的数目都由它决定。",
      "画面中的分子是示意计数，精确计量见本页的总反应式与曲线图。",
    ],
    sceneState: { stage: "stage1-split" },
    callout: "1 分子葡萄糖 → 2 分子丙酮酸（第 1 阶段的计量起点）",
  },
  {
    id: "stage1-yield",
    title: "第 1 阶段：产生少量 [H]",
    chartLabel: "①产物",
    narration: [
      "[H] 是 NADH 的简写形式，教材用小方括号表示它是载体分子，附着在 NADH 上，不是一个自由原子。",
      "第 1 阶段产生的 [H] 很少，产生的能量也只是少量。",
      "少部分能量被转移到 ATP 中，ATP 的量柱只有一点点。",
      "这时的 [H] 就在细胞质基质里，它要到后面几个阶段才被用掉。",
    ],
    sceneState: { stage: "stage1-yield" },
  },
  {
    id: "stage2-site",
    title: "第 2 阶段：场所",
    chartLabel: "②场所",
    narration: [
      "第 1 阶段产生的丙酮酸进入线粒体，在线粒体基质中继续被分解。",
      "所以第 2 阶段的场所是线粒体基质，不是线粒体内膜——这两个位置经常被混在一起。",
    ],
    sceneState: { stage: "stage2-site" },
  },
  {
    id: "stage2-decarb",
    title: "第 2 阶段：脱羧，产大量 [H]",
    chartLabel: "②脱羧",
    narration: [
      "在线粒体基质中，丙酮酸和水彻底分解成二氧化碳，同时释放出大量 [H] 和少量能量。",
      "这一步叫「脱羧」：含碳的丙酮酸把碳以 CO₂ 的形式脱下来，1 分子葡萄糖最终一共脱掉 6 个碳，全以 CO₂ 释放。",
      "画面上的 2 粒 CO₂ 是示意；精确数目是 6 个 CO₂（见曲线图）。",
      "另一路产物是大量 [H]——它们被汇集起来，准备去线粒体内膜参加第 3 阶段。",
    ],
    sceneState: { stage: "stage2-decarb" },
    callout: "第 1、2 阶段产生的 [H] 全部运到线粒体内膜，供第 3 阶段使用",
  },
  {
    id: "stage3-site",
    title: "第 3 阶段：场所",
    chartLabel: "③场所",
    narration: [
      "第 3 阶段在线粒体内膜上进行。",
      "内膜上分布着大量与有氧呼吸有关的酶——这就是为什么场所是「内膜」而不是「基质」。",
      "前面两阶段产生的 [H] 在这里与氧结合。",
    ],
    sceneState: { stage: "stage3-site" },
  },
  {
    id: "stage3-water",
    title: "第 3 阶段：结合氧，生成水",
    chartLabel: "③生成水",
    narration: [
      "[H] 与氧结合生成水，同时释放出大量的能量。",
      "这一步把前两个阶段存下的 [H] 一次性用掉——所以这一幕之后，[H] 归零。",
      "大量能量中的少部分被转移到 ATP 中，ATP 的量柱一下升到最高；其余能量以热能形式散失。",
      "这里的 H₂O 是示意计数，精确数目见总反应式。",
    ],
    sceneState: { stage: "stage3-water" },
    callout: "[H] 全部与 O₂ 结合 → 生成水 + 大量能量（第 3 阶段是释放能量的主力）",
  },
  {
    id: "aerobic-total",
    title: "核对总反应式",
    chartLabel: "总反应式",
    narration: [
      "三个阶段合起来，得到教材的总反应式：C₆H₁₂O₆ + 6O₂ + 6H₂O → 6CO₂ + 12H₂O + 能量。",
      "要点一：参与反应的氧气全部来自外界，所以有氧呼吸第 3 阶段必须有 O₂。",
      "要点二：水有两个来源——反应物一侧消耗 6 个水，产物一侧生成 12 个水；",
      "因为第 2 阶段生成的水先被第 3 阶段用掉了，所以最后净生成 6 个水。",
      "要点三：产物中的氧来自哪里？是被消耗的氧气，而不是二氧化碳。",
      "本课曲线图只画总反应式唯一确定计量的物质，所以画不出 [H] 与 ATP 的数目曲线——",
      "教材只给「少量/大量」的定性表述，具体个数请以老师课堂与教材附录为准。",
    ],
    sceneState: { stage: "aerobic-total" },
  },
];

export const cellularRespirationAerobic: Course<RespirationState> = {
  meta: {
    id: "cellular-respiration",
    title: "细胞呼吸",
    chapter: "必修一 第5章第3节",
    difficulty: 4,
  },
  stages: aerobicStages,
  chartConfigs: aerobicCharts,
  formulas: [
    {
      name: "有氧总反应式",
      expr: "C₆H₁₂O₆ + 6O₂ + 6H₂O → 6CO₂ + 12H₂O + 能量",
      example: "三个阶段都完成后才成立",
    },
    {
      name: "三阶段场所",
      expr: "①细胞质基质 → ②线粒体基质 → ③线粒体内膜",
      example: "记住 2 是基质、3 是内膜",
    },
    {
      name: "第 1 阶段计量",
      expr: "1 葡萄糖 → 2 丙酮酸 + 少量 [H] + 少量能量",
      example: "后面 CO₂ 与 H₂O 的数目都从「1 变 2」起算",
    },
    {
      name: "水的收支",
      expr: "消耗 6H₂O，生成 12H₂O → 净增 6H₂O",
      example: "第 2 阶段生成的 6 个水在第 3 阶段被用掉",
    },
    {
      name: "能量分配",
      expr: "释放的能量 = 转移入 ATP 的少量 + 散失的热能",
      example: "教材不给 ATP 具体个数，只说少部分存 ATP",
    },
  ],
};

// —— 无氧呼吸 ——

/**
 * 无氧呼吸曲线图：1 葡萄糖 → 2 丙酮酸 → 2 酒精 + 2 CO₂。
 * 第 1 阶段与有氧完全相同，所以「剩余葡萄糖」归零发生在第 2 幕。
 *
 * 【示意取舍】酒精与 CO₂ 严格 1:1 且同时产出，原来两条序列数值完全相同、
 * 连颜色都用同一个 C_CO2 —— 等于把同一条线画了两遍，两遍之间没有任何视觉差异，
 * 且 NumberChart 无去重逻辑（逐条画 path + circle），于是两组数据点叠在同一处。
 * 合并为一条，把「各 2 分子」的配平关系写进图例：既保住「无氧也放 CO₂」这个高频错点
 * 澄清点，又让图上不可能再出现两条重合线。颜色沿用 C_CO2（呼吸主线以 CO₂ 计量），
 * 物质归属以图例文字为准，颜色不作为唯一区分通道。
 */
const anaerobicChart: ChartConfig = {
  title: "物质存留与产出（1 分子葡萄糖为基准）",
  series: [
    { label: "剩余葡萄糖", color: C_GLUCOSE, values: [1, 0, 0, 0, 0] },
    { label: "产物：酒精 + CO₂（各 2 分子）", color: C_CO2, values: [0, 0, 0, 2, 2] },
  ],
};

const anaerobicStages: Stage<RespirationState>[] = [
  {
    id: "anaerobic-condition",
    title: "无氧呼吸：条件与总式",
    chartLabel: "条件",
    narration: [
      "当细胞缺少 O₂ 时，细胞呼吸就转成无氧呼吸。无氧呼吸同样把有机物分解，并释放其中的能量。",
      "常用的反应物同样是葡萄糖，总反应式是：C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂ + 少量能量（酒精发酵）。",
      "人和动物细胞、乳酸菌等在没有氧气时进行的是乳酸发酵：C₆H₁₂O₆ → 2C₃H₆O₃ + 少量能量，不产生 CO₂。",
      "画面里线粒体变淡：这一整套反应从头到尾都不在线粒体中进行。",
    ],
    sceneState: { stage: "anaerobic-condition" },
  },
  {
    id: "anaerobic-stage1",
    title: "第 1 阶段：与有氧呼吸完全相同",
    chartLabel: "①共用",
    narration: [
      "无氧呼吸的第 1 阶段和有氧呼吸完全相同：1 分子葡萄糖在细胞质基质中分解成 2 分子丙酮酸，并释放少量能量。",
      "这一点务必记住：无氧呼吸并不是另起炉灶，它复用了有氧呼吸的第 1 阶段。",
    ],
    sceneState: { stage: "anaerobic-stage1" },
  },
  {
    id: "anaerobic-site",
    title: "第 2 阶段：仍在细胞质基质",
    chartLabel: "②场所",
    narration: [
      "分岔就在第 2 阶段：无氧呼吸的丙酮酸不进入线粒体，仍然在细胞质基质中被分解。",
      "所以无氧呼吸全程只在细胞质基质中进行，涉及的酶也都在细胞质基质里。",
    ],
    sceneState: { stage: "anaerobic-site" },
  },
  {
    id: "anaerobic-products",
    title: "第 2 阶段：产物是酒精（乳酸）和 CO₂",
    chartLabel: "②产物",
    narration: [
      "本幕按酒精发酵演示：丙酮酸在细胞质基质中分解成酒精和二氧化碳。",
      "乳酸发酵是另一条路线：同样从丙酮酸出发，但产物是乳酸，不产生 CO₂。",
      "酒精发酵每分解 1 粒丙酮酸，同时得到 1 粒酒精和 1 粒 CO₂；所以 2 粒丙酮酸对应各 2 粒。",
      "注意看 [H] 的数量：它与上一幕完全一样。无氧呼吸全程不把 [H] 用掉——",
      "[H] 的去处只有在第 3 阶段（与氧结合生成水），而这一步根本没有发生。",
      "画面中的酒精与 CO₂ 是示意计数，精确数目见曲线图与总反应式。",
    ],
    sceneState: { stage: "anaerobic-products" },
    callout: "无氧呼吸不消耗 [H]——这里 [H] 的数量与上一幕完全一样",
  },
  {
    id: "anaerobic-yield",
    title: "能量去向",
    chartLabel: "能量去向",
    narration: [
      "对比两种呼吸的结果：同样是分解 1 分子葡萄糖，有氧呼吸释放的能量远多于无氧呼吸。",
      "所以无氧呼吸产生的 ATP 只有很少，量柱几乎不升高。",
      "葡萄糖中的能量并没有消失：大部分仍然储存在酒精或乳酸里，只有一小部分转移到 ATP，其余以热能形式散失。",
      "曲线图不画 ATP 的原因是教材只给了「少量/大量」的定性表述；"
        + "ATP 的量柱表示的是这种定性对比，不是具体分子数。",
    ],
    sceneState: { stage: "anaerobic-yield" },
  },
];

export const cellularRespirationAnaerobic: Course<RespirationState> = {
  meta: {
    id: "cellular-respiration",
    title: "细胞呼吸",
    chapter: "必修一 第5章第3节",
    difficulty: 4,
  },
  stages: anaerobicStages,
  chartConfigs: [anaerobicChart],
  formulas: [
    {
      name: "酒精发酵总式",
      expr: "C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂ + 少量能量",
      example: "植物、酵母菌",
    },
    {
      name: "乳酸发酵总式",
      expr: "C₆H₁₂O₆ → 2C₃H₆O₃ + 少量能量",
      example: "人、动物细胞、乳酸菌",
    },
    {
      name: "场所",
      expr: "全程在细胞质基质",
      example: "不进线粒体、不需要酶以外的膜结构",
    },
    {
      name: "与有氧的关系",
      expr: "第 1 阶段共用 → 第 2 阶段分岔",
      example: "1 葡萄糖 → 2 丙酮酸 之后才分道扬镳",
    },
  ],
};
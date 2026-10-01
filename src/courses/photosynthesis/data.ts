/**
 * 光合作用（必修一 1-5.4）课程数据
 *
 * 单课程、单模式：9 幕沿「光反应 → 暗反应」连续推进，但两个场所（类囊体薄膜 /
 * 叶绿体基质）全程同时可见，逐幕只高亮其一——避免把「光照下同时进行」画成
 * 「先光后暗」的线性误读（见 scene.ts 的双视图 opacity 保底）。
 *
 * 不写 numbers 字段：StageNumbers 的自洽校验只对染色体/DNA 这类数目有意义；
 * 本课目的量纲是「分子数」，为示意计数，不进入任何曲线图。
 *
 * 【不设曲线图】本课不声明 chartConfigs。教材对 ATP / [H] 只给「少量/大量」的
 * 定性表述（不给具体个数），C₅/C₃ 的循环也不是随幕次单调的存量曲线；强行画
 * 时期段曲线会制造「线内恒定、线间跳变」的事实性误导。代价是本课无练习模式
 * （练习开关由 chartConfigs 存在与否控制），已登记为方案偏离。
 *
 * 【与教材的数字边界】docx 1-5.4 未给 ATP / [H] 的具体个数；因此本课不把 ATP
 * 与 [H] 写进任何计量断言，画面分子一律为示意计数，精确计量只由总反应式承载。
 *
 * 【反误导三重设计】(1) 两场所全程可见 + 逐幕高亮其一（非高亮场所 opacity 保底
 * 0.25）；(2) p7 双向箭头同时点亮，正面表达「同时进行、循环依存」；(3) 断言
 * 「任意幕两场所 opacity 之和 ≥ 1」把保底锁死。
 */
import type { Course, Stage } from "../../core/types";

/**
 * 场景状态：按幕查槽位表，render 内不做 stage id 分支。
 * 用 type 别名（而非 interface）：与 core/types.ts 的 StageIdState 同理，
 * 保证结构类型可赋给注册表要求的 Record<string, unknown>，免隐式索引签名门坎。
 */
export type PhotosynthesisState = { stage: string };

/** 幕 id（场景槽位表与测试共用这一份清单） */
export const PHOTOSYNTHESIS_STAGE_IDS = [
  "photo-overview",      // 0 场所总览：叶绿体
  "photo-thylakoid-site", // 1 光反应场所：类囊体薄膜
  "photo-water-split",   // 2 水的光解
  "photo-atp-synth",     // 3 ATP 的合成
  "photo-stroma-site",   // 4 暗反应场所：叶绿体基质
  "photo-co2-fix",       // 5 CO₂ 的固定
  "photo-c3-reduce",     // 6 C₃ 的还原
  "photo-relation",      // 7 光反应与暗反应的联系
  "photo-total",         // 8 总反应式
] as const;

const stages: Stage<PhotosynthesisState>[] = [
  {
    id: "photo-overview",
    title: "光合作用：总览",
    narration: [
      "光合作用指绿色植物通过叶绿体，利用光能，把二氧化碳和水转化成储存着能量的有机物，并且释放出氧气的过程。",
      "它的实质是：合成有机物，储存能量。",
      "叶绿体的结构包括外膜、内膜、基质和基粒；基粒由类囊体堆叠而成。",
      "整个过程分光反应和暗反应两个阶段，分别在叶绿体的两个不同部位进行。",
      "画面里这两个部位同时可见——它们不是先后关系，而是同时进行。下面逐幕看清每个部位各自做什么。",
    ],
    sceneState: { stage: "photo-overview" },
    callout: "两个场所同时存在：光反应在类囊体薄膜，暗反应在叶绿体基质",
  },
  {
    id: "photo-thylakoid-site",
    title: "光反应：场所",
    narration: [
      "光反应的场所是类囊体薄膜上。",
      "光反应的条件是：光、色素和酶。",
      "与光合作用有关的色素分布在类囊体薄膜上，作用是吸收、传递和转换光能；与光反应有关的酶也分布在这里。",
      "注意：另一侧的叶绿体基质仍然存在，只是这一阶段的主角是类囊体薄膜。",
    ],
    sceneState: { stage: "photo-thylakoid-site" },
  },
  {
    id: "photo-water-split",
    title: "水的光解",
    narration: [
      "在类囊体薄膜上，水在光下被分解，产生氧气和 [H]。",
      "反应可以写成：H₂O → O₂ + H⁺；随后 NADP⁺ 与 H⁺ 结合生成 NADPH。",
      "[H] 是 NADPH 的简写形式，教材用方括号表示它是载体分子，不是一个自由的氢原子。",
      "产生的氧气释放出去；[H] 则留在叶绿体内，准备送往叶绿体基质供暗反应使用。",
      "画面中的分子为示意计数，精确关系见总反应式与公式卡。",
    ],
    sceneState: { stage: "photo-water-split" },
    callout: "水的光解：H₂O → O₂ + [H]（[H] 即 NADPH）",
  },
  {
    id: "photo-atp-synth",
    title: "ATP 的合成",
    narration: [
      "同样在类囊体薄膜上，ADP 和 Pi 利用光能合成 ATP。",
      "反应可以写成：ADP + Pi + 光能 → ATP。",
      "到这里，光反应把光能转化并储存到 ATP 和 NADPH（[H]）中——这就是光反应的能量变化。",
      "ATP 和 [H] 都可以从类囊体薄膜向叶绿体基质移动。",
    ],
    sceneState: { stage: "photo-atp-synth" },
    callout: "光能 → ATP 和 NADPH 中的化学能（光反应的能量变化）",
  },
  {
    id: "photo-stroma-site",
    title: "暗反应：场所",
    narration: [
      "暗反应的场所是叶绿体基质。",
      "暗反应的条件是多种酶；它不需要光，有光无光都能进行——这正是它叫「暗反应」的原因。",
      "与暗反应有关的酶分布在叶绿体基质中。",
      "注意：叶绿体基质和类囊体薄膜始终同时存在，暗反应并不是等光反应结束后才开始。",
    ],
    sceneState: { stage: "photo-stroma-site" },
  },
  {
    id: "photo-co2-fix",
    title: "CO₂ 的固定",
    narration: [
      "在叶绿体基质中，二氧化碳与 C₅ 结合，生成 2 个 C₃。这一步叫 CO₂ 的固定。",
      "反应可以写成：CO₂ + C₅ → 2C₃。",
      "关键：CO₂ 的固定不消耗能量——它既不消耗 ATP，也不消耗 [H]。",
      "画面上 CO₂、C₅ 与生成的 C₃ 同时呈现，用于对照「反应物 → 产物」；分子数目为示意计数。",
    ],
    sceneState: { stage: "photo-co2-fix" },
    callout: "CO₂ + C₅ → 2C₃（CO₂ 的固定不耗能）",
  },
  {
    id: "photo-c3-reduce",
    title: "C₃ 的还原",
    narration: [
      "接着，C₃ 在 ATP 和 [H]（NADPH）的参与下被还原，生成糖类，同时再生出 C₅。",
      "反应可以写成：2C₃ → (CH₂O) + C₅；这一过程消耗 ATP（ATP → ADP + Pi + 能量）和 NADPH。",
      "所以 C₃ 的还原会消耗 ATP 和 [H]，而 CO₂ 的固定不消耗——这是本节最容易混淆的一点。",
      "能量变化：ATP 和 NADPH 中的化学能转化为有机物中稳定的化学能。",
      "再生的 C₅ 回到原来的位置，可以继续参与下一轮的 CO₂ 固定（这一循环称为卡尔文循环）。",
      "画面中的糖类用「(CH₂O)」表示，主要是淀粉和蔗糖。",
    ],
    sceneState: { stage: "photo-c3-reduce" },
    callout: "2C₃ + ATP + [H] → (CH₂O) + C₅（C₃ 的还原消耗 ATP 和 [H]）",
  },
  {
    id: "photo-relation",
    title: "光反应与暗反应的联系",
    narration: [
      "两个反应不是先后关系，而是同时进行、彼此依存。",
      "光反应为暗反应提供 ATP 和 NADPH（[H]）。",
      "暗反应为光反应提供 ADP、Pi 和 NADP⁺。",
      "物质就这样在两个部位之间循环流动：ATP 和 NADPH 从类囊体薄膜向叶绿体基质移动，ADP 和 NADP⁺ 从叶绿体基质向类囊体薄膜移动。",
      "画面中两个场所同时点亮、双向箭头同时出现，表达的就是「同时进行、循环依存」。",
    ],
    sceneState: { stage: "photo-relation" },
    callout: "光反应 → 暗反应：ATP、[H]；暗反应 → 光反应：ADP、Pi、NADP⁺（同时进行，非依次）",
  },
  {
    id: "photo-total",
    title: "总反应式",
    narration: [
      "把两个反应合起来，得到光合作用的总反应式：CO₂ + H₂O → (CH₂O) + O₂。",
      "其中 (CH₂O) 表示糖类，主要是淀粉和蔗糖；蔗糖可以通过韧皮部中的筛管运输到植株各处。",
      "从能量看：光能先转变成 ATP 和 NADPH 中的化学能，再转变成有机物中稳定的化学能。",
      "从物质看：光合作用利用 CO₂ 和 H₂O，释放 O₂，合成有机物——实质是合成有机物、储存能量。",
    ],
    sceneState: { stage: "photo-total" },
  },
];

export const photosynthesisCourse: Course<PhotosynthesisState> = {
  meta: {
    id: "photosynthesis",
    title: "光合作用",
    chapter: "必修一 第5章第4节",
    difficulty: 4,
  },
  stages,
  formulas: [
    {
      name: "总反应式",
      expr: "CO₂ + H₂O → (CH₂O) + O₂",
      example: "(CH₂O) 表示糖类，主要是淀粉和蔗糖",
    },
    {
      name: "光反应",
      expr: "H₂O → O₂ + [H]；ADP + Pi + 光能 → ATP",
      example: "场所：类囊体薄膜；条件：光、色素、酶",
    },
    {
      name: "暗反应",
      expr: "CO₂ + C₅ → 2C₃；2C₃ → (CH₂O) + C₅",
      example: "场所：叶绿体基质；条件：多种酶，有光无光都能进行",
    },
    {
      name: "两反应的联系",
      expr: "光反应 → 暗反应：ATP、[H]；暗反应 → 光反应：ADP、Pi、NADP⁺",
      example: "同时进行、循环依存，不是先后关系",
    },
    {
      name: "场所与酶",
      expr: "色素在类囊体薄膜；光反应的酶在类囊体薄膜；暗反应的酶在叶绿体基质",
      example: "两个场所始终同时存在",
    },
  ],
};

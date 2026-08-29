/** DNA 复制场景测试（绑定不变式）：聚合酶-片段复合体成员「同现、对位、绑定退场」 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDnaReplicationScene, BINDINGS, RIGHT_FORK, LEADING_KEYS } from "../scene";

// 片段 → 聚合酶（复合体成员）。与 scene.ts BINDINGS 镜像一致——下方首个用例用断言强制两者相等，
// 防止改 BINDINGS 时本镜像表失同步。
const PAIRS: Record<string, string> = {
  "da-r1": "pol-lag3", "da-r2": "pol-lag1", "da-r3": "pol-lag2",
  "da-l1": "pol-lag-L1", "da-l2": "pol-lag-L2", "da-l3": "pol-lag-L3",
  "da-rb": "pol-lead", "da-lt": "pol-lead-L",
};
// 绑定「活动窗口」：复合体成员同现对位的阶段（显式开列，非「凡可见都绑」——
// 片段在待连接/完成阶段不受绑定约束）。阶段 id 见 data.ts：
// helix/unwind/priming/leading/lagging/removal/filling/ligation/done
const ACTIVE = ["leading", "lagging", "removal", "filling"];

describe("DNA 复制场景（绑定不变式：聚合酶-片段复合体）", () => {
  let host: HTMLDivElement;
  const scene = createDnaReplicationScene();

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    scene.mount(host);
  });
  afterEach(() => {
    scene.destroy();
    host.remove();
  });

  const daughter = (key: string) => host.querySelector<SVGRectElement>(`.daughter-${key}`)!;
  const enzyme = (key: string) => host.querySelector<SVGGElement>(`.enzyme-${key}`)!;

  it("结构：本测试镜像表 PAIRS 与权威表 BINDINGS 完全一致（防绑定结对漂移）", () => {
    expect(BINDINGS).toEqual(PAIRS);
  });

  it("结构：侧别分类自洽——前导键与后随键两两互斥，RIGHT_FORK 与键名（da-r/da-l）约定一致", () => {
    const lagging = Object.keys(BINDINGS).filter((f) => !LEADING_KEYS.has(f));
    // 前导（连续链）与后随（冈崎片段）互斥：一个片片段不能同时是两者
    for (const k of LEADING_KEYS) {
      expect(lagging, `${k} 不应既是前导又是后随`).not.toContain(k);
    }
    // 每个绑定片片段的侧别分类（RIGHT_FORK）与其键名约定一致：右叉 = da-r*、左叉 = da-l*
    for (const frag of Object.keys(BINDINGS)) {
      const inRight = RIGHT_FORK.has(frag);
      expect(frag.startsWith("da-r"), `${frag} 应归右叉却不在 RIGHT_FORK 或命名相反`).toBe(inRight);
    }
  });

  it("活动窗口内：全部绑定对「片段可见 ⇔ 酶可见 + 对位」", () => {
    for (const stage of ACTIVE) {
      scene.render({ stage });
      for (const [frag, enz] of Object.entries(PAIRS)) {
        const d = daughter(frag);
        const e = enzyme(enz);
        const fragVisible = d.style.opacity === "1";
        expect(e.style.opacity, `${stage}: ${enz} 应${fragVisible ? "随" : "不随"}片段 ${frag} 显隐`)
          .toBe(fragVisible ? "1" : "0");
        if (fragVisible) {
          // 对位：酶 x 落在片片段区间或其生长端小余量（前导聚合酶停在叉口生长端、
          // 后随聚合酶嵌入片段内）；余量 6px(> ENZ_MARGIN=5) 容忍两叉朝向
          const x = Number(d.getAttribute("x"));
          const w = Number(d.getAttribute("width"));
          const m = e.style.transform.match(/translate\((-?\d+)px/);
          const ex = Number(m![1]);
          expect(ex, `${stage}: ${enz} x 应在片段 ${frag} 区间或其生长端内`).toBeGreaterThanOrEqual(x - 6);
          expect(ex, `${stage}: ${enz} x 应在片段 ${frag} 区间或其生长端内`).toBeLessThanOrEqual(x + w + 6);
        }
      }
    }
  });

  it("活动窗口外：片段可见也不呈现聚合酶（阶段8 连接仅连接酶、阶段9 完成无酶）", () => {
    // ligation：片段全部在场，但无绑定聚合酶、仅连接酶
    scene.render({ stage: "ligation" });
    for (const [frag, enz] of Object.entries(PAIRS)) {
      expect(daughter(frag).style.opacity).toBe("1");
      expect(enzyme(enz).style.opacity, `${enz} 在连接阶段应退场`).toBe("0");
    }
    // done：全部片段在场且酶全退
    scene.render({ stage: "done" });
    for (const enz of Object.values(PAIRS)) {
      expect(enzyme(enz).style.opacity).toBe("0");
    }
  });

  it("回归：阶段6 引物切除 pol-lag3 不再消失（绑定 r1，随 r1 保留）", () => {
    scene.render({ stage: "removal" });
    expect(daughter("da-r1").style.opacity).toBe("1");
    expect(enzyme("pol-lag3").style.opacity).toBe("1");
    expect(enzyme("pol-lag3").style.transform).toBe("translate(586px, 48px)");
  });

  it("回归：阶段7 缺口填补——聚合酶全部保留（含 r1 的 pol-lag3），待连接阶段才统一退场", () => {
    scene.render({ stage: "filling" });
    for (const enz of Object.values(PAIRS)) {
      expect(enzyme(enz).style.opacity, `${enz} 填补阶段应保留`).toBe("1");
    }
    expect(enzyme("pol-lag3").style.opacity).toBe("1");   // 右上 r1 的聚合酶不再消失
    scene.render({ stage: "ligation" });
    for (const enz of Object.values(PAIRS)) {
      expect(enzyme(enz).style.opacity, `${enz} 连接阶段应退场`).toBe("0");
    }
  });

  it("回归：阶段4 合成已起始——首两片段在其真培育位、各自配酶，且阶段5不移动", () => {
    scene.render({ stage: "leading" });
    // 首两片片段在真培育位并各自绑定（右 r3/r2、左 l3/l2）
    const visible = {
      "da-r3": "pol-lag2", "da-r2": "pol-lag1", "da-l3": "pol-lag-L3", "da-l2": "pol-lag-L2",
    };
    for (const [frag, enz] of Object.entries(visible)) {
      expect(daughter(frag).style.opacity).toBe("1");
      expect(enzyme(enz).style.opacity).toBe("1");
    }
    // 阶段5 新出现的 r1/l1 及酶此帧不现
    expect(daughter("da-r1").style.opacity).toBe("0");
    expect(enzyme("pol-lag3").style.opacity).toBe("0");
    expect(daughter("da-l1").style.opacity).toBe("0");
    expect(enzyme("pol-lag-L1").style.opacity).toBe("0");
    // 第4→5步：已起始片片段坐标不移动（与其阶段5槽位一致），只见前导链生长
    scene.render({ stage: "lagging" });
    expect(daughter("da-r3").getAttribute("x")).toBe("404");
    expect(daughter("da-r2").getAttribute("x")).toBe("480");
    expect(daughter("da-l3").getAttribute("x")).toBe("324");
    expect(daughter("da-l2").getAttribute("x")).toBe("252");
  });

  it("引物酶/连接酶为独立元素，不入绑定表（活动窗口内仍按自身槽位显隐）", () => {
    // 引物酶仅引物合成阶段出现
    scene.render({ stage: "priming" });
    expect(enzyme("primase").style.opacity).toBe("1");
    expect(enzyme("primase-L").style.opacity).toBe("1");
    scene.render({ stage: "leading" });
    expect(enzyme("primase").style.opacity).toBe("0");
    // 连接酶仅连接阶段出现
    scene.render({ stage: "ligation" });
    expect(enzyme("ligase").style.opacity).toBe("1");
    expect(enzyme("ligase-L").style.opacity).toBe("1");
    scene.render({ stage: "done" });
    expect(enzyme("ligase").style.opacity).toBe("0");
  });
});

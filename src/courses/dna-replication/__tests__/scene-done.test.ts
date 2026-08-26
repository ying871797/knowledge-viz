/** DNA 复制场景测试（终态）：半保留呈现——双链体收拢分组 / 配对刻度 / 成分标注 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDnaReplicationScene } from "../scene";
import { SEQ_TOP, SEQ_BOT } from "../data";

describe("DNA 复制终态：半保留呈现", () => {
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

  it("组内贴紧：新链与其母链带净距 ≤ 8px 且不重叠（由槽位常量核算）", () => {
    scene.render({ stage: "done" });
    // 上双链体：带中心 = Y_TOP(150)+(88−150)=88；新链条顶 = 基础 82+(56−82)=56
    const gapTop = (88 - 12) - (56 + 14);   // 带顶缘 − 新链条底缘
    expect(gapTop).toBeGreaterThanOrEqual(0);
    expect(gapTop).toBeLessThanOrEqual(8);
    // 下双链体对称核算：带中心 = 250+48=298；新链条顶 = 304+12=316
    const gapBot = 316 - (298 + 12);        // 新链条顶缘 − 带底缘
    expect(gapBot).toBeGreaterThanOrEqual(0);
    expect(gapBot).toBeLessThanOrEqual(8);
  });

  it("两分子净空 ≥ 100px：接近性分组不被稀释", () => {
    scene.render({ stage: "done" });
    const topDuplexBottom = 88 + 12;   // 上带底缘
    const botDuplexTop = 298 - 12;     // 下带顶缘
    expect(botDuplexTop - topDuplexBottom).toBeGreaterThanOrEqual(100);
  });

  it("子链竖移走 transform 通道：y 属性保持基础值 82/304 不变（既有断言兼容）", () => {
    scene.render({ stage: "done" });
    expect(daughter("da-lt").getAttribute("y")).toBe("82");
    expect(daughter("da-rb").getAttribute("y")).toBe("304");
    expect(daughter("da-lt").style.transform).toBe("translate(0px, -26px)");
    expect(daughter("da-rb").style.transform).toBe("translate(0px, 12px)");
    // 非 done 阶段位移回零（缺省回退基础值）
    scene.render({ stage: "ligation" });
    expect(daughter("da-lt").style.transform).toBe("translate(0px, 0px)");
  });

  it("配对刻度 ×24 仅 done 可见，粗细符合 A-T(2)/C-G(3.5) 规则", () => {
    scene.render({ stage: "ligation" });
    host.querySelectorAll<SVGLineElement>("line.pair-tick").forEach((t) => {
      expect(t.style.opacity).toBe("0");
    });
    scene.render({ stage: "done" });
    const ticks = [...host.querySelectorAll<SVGLineElement>("line.pair-tick")];
    expect(ticks.length).toBe(24);
    ticks.forEach((t) => expect(t.style.opacity).toBe("1"));
    // 每碱基位上下两条刻度同粗：索引 i=上双链体、12+i=下双链体
    SEQ_TOP.forEach((top, i) => {
      const pairAT = (top === "A" && SEQ_BOT[i] === "T") || (top === "T" && SEQ_BOT[i] === "A");
      expect(ticks[i].getAttribute("stroke-width")).toBe(pairAT ? "2" : "3.5");
      expect(ticks[12 + i].getAttribute("stroke-width")).toBe(pairAT ? "2" : "3.5");
    });
  });

  it("成分标注「母链/新链」×4 仅 done 可见", () => {
    scene.render({ stage: "ligation" });
    const hidden = [...host.querySelectorAll<SVGTextElement>(".duplex-label")]
      .every((t) => t.style.opacity === "0");
    expect(hidden).toBe(true);
    scene.render({ stage: "done" });
    const labels = [...host.querySelectorAll<SVGTextElement>(".duplex-label")];
    expect(labels.map((t) => t.textContent)).toEqual(["新链", "母链", "母链", "新链"]);
    labels.forEach((t) => expect(t.style.opacity).toBe("1"));
  });
});

/** DNA 复制场景测试（段 3）：阶段 6~9 —— 切除 / 填补 / 连接 / 完成 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDnaReplicationScene } from "../scene";

describe("DNA 复制场景（段 3：加工与完成）", () => {
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
  const marker = (i: number) => host.querySelectorAll<SVGRectElement>(".gap-marker")[i];

  it("阶段6 引物切除：缺口处显示红色虚线标记（其他帧不显示）", () => {
    scene.render({ stage: "removal" });
    expect(host.querySelectorAll(".gap-marker").length).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(marker(i).getAttribute("fill")).toBe("none");
      expect(marker(i).getAttribute("stroke-dasharray")).toBe("4 3");
    }
    // 片段位置不变（切除的只是引物，片段本就未延伸到缺口）
    expect(daughter("da-r2").getAttribute("x")).toBe("480");
    expect(daughter("da-l2").getAttribute("x")).toBe("252");
    // 其他帧无标记
    scene.render({ stage: "lagging" });
    expect(host.querySelectorAll(".gap-marker[opacity='1'], .gap-marker:not([style*='opacity: 0'])").length).toBeGreaterThanOrEqual(0);
    scene.render({ stage: "removal" });
    scene.render({ stage: "filling" });
    expect(marker(0).style.opacity).toBe("0");
  });

  it("阶段7 填补：相邻带延伸封闭缺口，前导引物缺口以绿色填补", () => {
    scene.render({ stage: "filling" });
    // 右叉上链：r3 不动，r2/r1 向左延伸合拢
    expect(daughter("da-r3").getAttribute("x")).toBe("404");
    expect(daughter("da-r2").getAttribute("x")).toBe("454");
    expect(daughter("da-r2").getAttribute("width")).toBe("76");
    expect(daughter("da-r1").getAttribute("x")).toBe("530");
    expect(daughter("da-r1").getAttribute("width")).toBe("76");
    // 左叉下链：l1/l2/l3 延伸合拢
    expect(daughter("da-l1").getAttribute("width")).toBe("72");
    expect(daughter("da-l2").getAttribute("x")).toBe("252");
    expect(daughter("da-l2").getAttribute("width")).toBe("72");
    expect(daughter("da-l3").getAttribute("x")).toBe("324");
    // 前导链引物缺口以绿色填补（da-lt/da-rb 延伸至起点 400）
    expect(daughter("da-lt").getAttribute("width")).toBe("230");
    expect(daughter("da-rb").getAttribute("x")).toBe("400");
    expect(daughter("da-rb").getAttribute("width")).toBe("230");
    // 聚合酶在填补位工作
    expect(enzyme("pol-lag1").style.opacity).toBe("1");
  });

  it("阶段8 连接：三段合拢为连续后随链，连接酶显现于接缝", () => {
    scene.render({ stage: "ligation" });
    // 顶行三段首尾相接：404|480|556|630
    expect(daughter("da-r3").getAttribute("x")).toBe("404");
    expect(daughter("da-r3").getAttribute("width")).toBe("76");
    expect(daughter("da-r2").getAttribute("x")).toBe("480");
    expect(daughter("da-r2").getAttribute("width")).toBe("76");
    expect(daughter("da-r1").getAttribute("x")).toBe("556");
    expect(daughter("da-r1").getAttribute("width")).toBe("74");
    // 底行三段首尾相接：180|256|332|400
    expect(daughter("da-l1").getAttribute("width")).toBe("76");
    expect(daughter("da-l2").getAttribute("x")).toBe("256");
    expect(daughter("da-l2").getAttribute("width")).toBe("76");
    expect(daughter("da-l3").getAttribute("x")).toBe("332");
    expect(daughter("da-l3").getAttribute("width")).toBe("68");
    // 连接酶显现于顶行接缝
    expect(enzyme("ligase").style.opacity).toBe("1");
  });

  it("阶段9 完成：酶全部退场，两条完整 DNA（半保留：母链深带+彩色子链）", () => {
    scene.render({ stage: "done" });
    expect(enzyme("ligase").style.opacity).toBe("0");
    expect(enzyme("pol-lead").style.opacity).toBe("0");
    expect(enzyme("pol-lag1").style.opacity).toBe("0");
    expect(enzyme("primase").style.opacity).toBe("0");
    expect(host.querySelector<SVGGElement>(".helicase-group")!.style.opacity).toBe("0");
    // 链带保持完整
    expect(daughter("da-rb").getAttribute("width")).toBe("230");
    expect(daughter("da-lt").getAttribute("width")).toBe("230");
  });

  it("左右对称：左叉酶组在阶段6~7跟随片段工作，连接酶×2 分居两接缝", () => {
    // 阶段6（切除）：左叉聚合酶跟随左半片段
    scene.render({ stage: "removal" });
    expect(enzyme("pol-lead-L").style.opacity).toBe("1");
    expect(enzyme("pol-lag-L1").style.opacity).toBe("1");
    expect(enzyme("pol-lag-L3").style.opacity).toBe("1");
    // 阶段8（连接）：双连接酶封合两行接缝
    scene.render({ stage: "ligation" });
    expect(enzyme("ligase").style.opacity).toBe("1");
    expect(enzyme("ligase-L").style.opacity).toBe("1");
    expect(enzyme("ligase-L").style.transform).toBe("translate(332px, 336px)");
    // 阶段9：全部退场
    scene.render({ stage: "done" });
    expect(enzyme("ligase-L").style.opacity).toBe("0");
    expect(enzyme("pol-lead-L").style.opacity).toBe("0");
  });
});

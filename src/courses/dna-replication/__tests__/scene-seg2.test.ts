/** DNA 复制场景测试（段 2）：阶段 3~5 —— 引物酶示意 / 前导链 / 后随链冈崎片段（双色区分） */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDnaReplicationScene } from "../scene";

describe("DNA 复制场景（段 2：合成）", () => {
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

  it("RNA 引物红条已从动画移除（引物知识仅由文字承载）", () => {
    expect(host.querySelectorAll("rect.primer").length).toBe(0);
  });

  it("图例：绿=前导链连续合成、橙=冈崎片段分段合成（拓展）、灰=亲代母链", () => {
    // 图例已迁移到 HTML 覆盖层，通过 scene.legend 属性验证数据
    expect(scene.legend).toBeDefined();
    expect(scene.legend!.length).toBe(3);
    expect(scene.legend!.map((l) => l.label)).toEqual(["前导链——连续合成", "冈崎片段——分段合成（拓展）", "灰色长带——亲代母链"]);
  });

  it("左叉酶组：与右叉对称补全（引物酶/前导聚合酶/片段聚合酶×3）", () => {
    // 阶段3：左叉引物酶显现（避开左叉解旋酶 r18：圆心距 230-170=60 > 38）
    scene.render({ stage: "priming" });
    expect(enzyme("primase-L").style.opacity).toBe("1");
    expect(enzyme("primase-L").getAttribute("transform")).toBe("translate(230, 170)");
    // 阶段4：左叉前导聚合酶 + 片段1聚合酶显现，片段2/3聚合酶未现
    scene.render({ stage: "leading" });
    expect(enzyme("pol-lead-L").style.opacity).toBe("1");
    expect(enzyme("pol-lag-L1").style.opacity).toBe("1");
    expect(enzyme("pol-lag-L2").style.opacity).toBe("0");
    expect(enzyme("pol-lag-L3").style.opacity).toBe("0");
    // 阶段5：三片段聚合酶齐备，各自对位片段中心
    scene.render({ stage: "lagging" });
    expect(enzyme("pol-lag-L1").getAttribute("transform")).toBe("translate(205, 336)");
    expect(enzyme("pol-lag-L2").getAttribute("transform")).toBe("translate(277, 336)");
    expect(enzyme("pol-lag-L3").getAttribute("transform")).toBe("translate(349, 336)");
    expect(enzyme("pol-lead-L").getAttribute("transform")).toBe("translate(220, 48)");
  });

  it("阶段3 引物合成：仅引物酶图标显现，无引物红条", () => {
    scene.render({ stage: "priming" });
    expect(enzyme("primase").style.opacity).toBe("1");
    expect(enzyme("primase").getAttribute("transform")).toBe("translate(575, 170)");
    // 子链带尚未合成
    expect(daughter("da-rb").getAttribute("width")).toBe("0");
    expect(host.querySelector<SVGGElement>(".helicase-group")!.style.opacity).toBe("1");
  });

  it("阶段4 前导链合成：子带自起点向两叉生长，后随链首两片段起头", () => {
    scene.render({ stage: "leading" });
    // 前导链（右叉下链）：x=430, w=180，绿色；左叉镜像（上链）：x=190, w=182
    expect(daughter("da-rb").getAttribute("x")).toBe("430");
    expect(daughter("da-rb").getAttribute("width")).toBe("180");
    expect(daughter("da-rb").getAttribute("fill")).toBe("#10b981");
    expect(daughter("da-lt").getAttribute("x")).toBe("190");
    expect(daughter("da-lt").getAttribute("width")).toBe("182");
    // 后随链首两片段（右叉上链 r3 404~454、r2 480~530），橙色
    expect(daughter("da-r3").getAttribute("x")).toBe("404");
    expect(daughter("da-r2").getAttribute("x")).toBe("480");
    expect(daughter("da-r3").getAttribute("fill")).toBe("#f59e0b");
    expect(daughter("da-l1").getAttribute("fill")).toBe("#f59e0b");
    // 聚合酶 ×2 显现；引物酶退场
    expect(enzyme("pol-lead").style.opacity).toBe("1");
    expect(enzyme("pol-lag1").style.opacity).toBe("1");
    expect(enzyme("primase").style.opacity).toBe("0");
  });

  it("阶段5 后随链冈崎片段：半区归属——上链片段全在右半区、下链片段全在左半区", () => {
    scene.render({ stage: "lagging" });
    // 叉到达两端 170/630；复制起点 = 400（画布中心）
    expect(host.querySelector<SVGGElement>(".helicase-group")!.style.opacity).toBe("1");
    // 上链：左半绿色连续（左叉前导 170~372 + 引物 374~398），右半橙色冈崎片段 ×3
    expect(daughter("da-lt").getAttribute("x")).toBe("170");
    expect(daughter("da-lt").getAttribute("width")).toBe("202");
    expect(daughter("da-r3").getAttribute("x")).toBe("404");
    expect(daughter("da-r2").getAttribute("x")).toBe("480");
    expect(daughter("da-r1").getAttribute("x")).toBe("556");
    // 下链：左半橙色冈崎片段 ×3，右半绿色连续（右叉前导 430~630）
    expect(daughter("da-l1").getAttribute("x")).toBe("180");
    expect(daughter("da-l2").getAttribute("x")).toBe("252");
    expect(daughter("da-l3").getAttribute("x")).toBe("324");
    expect(daughter("da-rb").getAttribute("x")).toBe("430");
    expect(daughter("da-rb").getAttribute("width")).toBe("200");
    // 半区守恒：上链片段全部 ≥404（起点右侧），下链片段全部 ≤382（起点左侧）
    for (const key of ["da-r1", "da-r2", "da-r3"]) {
      expect(Number(daughter(key).getAttribute("x"))).toBeGreaterThanOrEqual(404);
    }
    for (const key of ["da-l1", "da-l2", "da-l3"]) {
      expect(Number(daughter(key).getAttribute("x")) + Number(daughter(key).getAttribute("width"))).toBeLessThanOrEqual(400);
    }
    // 聚合酶 ×4：前导 1 + 后随 3（每个冈崎片段各配一个）
    expect(enzyme("pol-lead").style.opacity).toBe("1");
    expect(enzyme("pol-lag1").style.opacity).toBe("1");
    expect(enzyme("pol-lag2").style.opacity).toBe("1");
    expect(enzyme("pol-lag3").style.opacity).toBe("1");
    // pol-lag3 对位最新片段 r1（叉口侧 556~606 的中点 ≈ 581）
    expect(enzyme("pol-lag3").getAttribute("transform")).toBe("translate(581, 150)");
    // 对位核查：每个后随聚合酶的 x 都落在其对应片段区间内
    const fragOf: Record<string, [number, number]> = {
      "pol-lag3": [556, 606], "pol-lag1": [480, 530], "pol-lag2": [404, 454],
    };
    for (const [enz, [lo, hi]] of Object.entries(fragOf)) {
      const m = enzyme(enz).getAttribute("transform")!.match(/translate\((-?\d+)/)!;
      const px = Number(m[1]);
      expect(px).toBeGreaterThanOrEqual(lo);
      expect(px).toBeLessThanOrEqual(hi);
    }
  });

  it("阶段4 仅两片段：第三个后随聚合酶尚未显现", () => {
    scene.render({ stage: "leading" });
    expect(enzyme("pol-lag3").style.opacity).toBe("0");
  });

  it("阶段4 前导链合成：子带自起点向两叉生长（半区雏形）", () => {
    scene.render({ stage: "leading" });
    // 前导链自起点（400）向叉生长：左叉前导 190~372、右叉前导 430~610
    expect(daughter("da-lt").getAttribute("x")).toBe("190");
    expect(daughter("da-lt").getAttribute("width")).toBe("182");
    expect(daughter("da-rb").getAttribute("x")).toBe("430");
    expect(daughter("da-rb").getAttribute("width")).toBe("180");
    // 后随链已起始两片段（r3 最近起点 404~454、r2 480~530）；r1 最近叉口、此帧未起始
    expect(daughter("da-r3").getAttribute("x")).toBe("404");
    expect(daughter("da-r2").getAttribute("x")).toBe("480");
  });

  it("行归属：右叉上链冈崎片段系（r1/r2/r3）在顶行，左叉下链系在底行", () => {
    scene.render({ stage: "lagging" });
    // 顶行（上链）：右叉冈崎片段
    expect(daughter("da-r1").getAttribute("y")).toBe("82");
    expect(daughter("da-r2").getAttribute("y")).toBe("82");
    expect(daughter("da-r3").getAttribute("y")).toBe("82");
    // 底行（下链）：左叉镜像片段
    expect(daughter("da-l1").getAttribute("y")).toBe("304");
    expect(daughter("da-l2").getAttribute("y")).toBe("304");
    expect(daughter("da-l3").getAttribute("y")).toBe("304");
  });
});

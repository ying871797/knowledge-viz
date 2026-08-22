/** 左侧阶段讲解面板：正常态展示标题+要点；练习模式遮蔽答案 */
export class NotesPanel {
  private titleEl: HTMLElement;
  private listEl: HTMLUListElement;

  constructor(private container: HTMLElement) {
    container.classList.add("notes-panel");
    this.titleEl = document.createElement("h3");
    this.listEl = document.createElement("ul");
    container.append(this.titleEl, this.listEl);
  }

  render(title: string, items: string[]): void {
    this.titleEl.textContent = title;
    this.listEl.replaceChildren(
      ...items.map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      }),
    );
  }

  /** 练习模式：不暴露当前阶段名 */
  renderMasked(hint: string): void {
    this.titleEl.textContent = `？期 —— ${hint}`;
    this.listEl.replaceChildren();
  }
}

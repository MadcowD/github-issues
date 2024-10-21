import * as vscode from 'vscode';

export class GitHubIssue extends vscode.TreeItem {
  public children: GitHubIssue[] = [];
  public progress: number = 0;
  public progressBar: GitHubIssue | undefined;

  constructor(
    label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly issue: any,
    public readonly type: 'issue' | 'pullRequest' | 'progressBar',
    public readonly parent?: GitHubIssue,
    public isCheckbox: boolean = false,
    public checked: boolean = false
  ) {
    super(label, collapsibleState);
    
    if (this.type !== 'progressBar') {
      this.tooltip = `#${issue.number}: ${issue.title}`;
      this.description = `#${issue.number}`;
      this.command = {
        command: 'github-issues.openIssue',
        title: 'Open Issue',
        arguments: [issue]
      };

      // Ensure issue.body is always a string
      this.issue.body = this.issue.body || '';

      // Set the icon based on the issue state and type
      this.iconPath = this.getIcon();

      // Set checkbox state for checkbox items
      if (this.isCheckbox) {
        this.checkboxState = this.getCheckboxState();
        this.contextValue = 'checkbox';
        this.description = ''; // Remove the issue number for checkboxes
      }

      // Parse checkboxes and create child items
      this.parseCheckboxes();

      // Set collapsible state based on whether there are children
      this.collapsibleState = this.children.length > 0 
        ? vscode.TreeItemCollapsibleState.Expanded 
        : vscode.TreeItemCollapsibleState.None;

      // Calculate progress if there are children
      if (this.children.length > 0) {
        this.calculateProgress();
      }
    } else {
      // For progress bar items, set a custom tooltip
      this.tooltip = `Progress: ${Math.round(this.progress)}%`;
    }
  }

  private getIcon(): vscode.ThemeIcon | undefined {
    if (this.isCheckbox) {
      return undefined; // No icon for checkboxes
    }

    if (this.type === 'pullRequest') {
      return this.issue.state === 'open' 
        ? new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.purple'));
    } else {
      return this.issue.state === 'open' 
        ? new vscode.ThemeIcon('issues', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('issue-closed', new vscode.ThemeColor('charts.red'));
    }
  }

  private getCheckboxState(): vscode.TreeItemCheckboxState {
    return this.checked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
  }

  private parseCheckboxes(): void {
    const checkboxRegex = /^(\s*)-\s*\[([ x])\]\s*(.+)$/gm;
    let match;
    let index = 0;

    while ((match = checkboxRegex.exec(this.issue.body)) !== null) {
      const [, , checked, text] = match;
      const childIssue = {
        ...this.issue,
        title: text,
        body: '',
        number: `${this.issue.number}.${index + 1}`,
        state: checked === 'x' ? 'closed' : 'open'
      };

      const child = new GitHubIssue(
        text,
        vscode.TreeItemCollapsibleState.None,
        childIssue,
        'issue',
        this,
        true,
        checked === 'x'
      );

      this.children.push(child);
      index++;
    }
  }

  public calculateProgress(): void {
    const totalCheckboxes = this.children.length;
    const checkedCheckboxes = this.children.filter(child => child.checked).length;
    this.progress = totalCheckboxes > 0 ? (checkedCheckboxes / totalCheckboxes) * 100 : 0;
    
    // Create or update the progress bar
    this.updateProgressBar();
  }

  private updateProgressBar(): void {
    const svgProgressBar = this.createSvgProgressBar(this.progress);
    if (!this.progressBar) {
      this.progressBar = new GitHubIssue(
        'Progress',
        vscode.TreeItemCollapsibleState.None,
        { number: `${this.issue.number}.progress` },
        'progressBar',
        this
      );
      this.children.unshift(this.progressBar);
    }
    this.progressBar.progress = this.progress;
    this.progressBar.tooltip = `Progress: ${Math.round(this.progress)}%`;
    (this.progressBar as any).svgProgress = svgProgressBar; // Store SVG as a custom property
  }

  private createSvgProgressBar(progress: number): string {
    const width = 200;
    const height = 10;
    const fillWidth = Math.round((progress / 100) * width);
    return `<svg width="${width}" height="${height}">
              <rect width="${width}" height="${height}" fill="#e0e0e0" />
              <rect width="${fillWidth}" height="${height}" fill="#4CAF50" />
            </svg>`;
  }

  public toggleCheckbox(): void {
    if (this.isCheckbox) {
      this.checked = !this.checked;
      this.checkboxState = this.getCheckboxState();
      if (this.parent) {
        this.parent.calculateProgress();
      }
    }
  }
}

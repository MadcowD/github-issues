import * as vscode from 'vscode';
import { GitHubIssueService } from './GitHubIssueService';
import { IssueViewProvider } from './IssueViewProvider';
import { GitHubIssue } from './GitHubIssue';

// Add this at the top of the file
let outputChannel: vscode.OutputChannel;
let issueService: GitHubIssueService | undefined;

class IssueTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly items?: (IssueTreeItem | GitHubIssue)[]
  ) {
    super(label, collapsibleState);
  }
}

class GitHubIssuesProvider implements vscode.TreeDataProvider<IssueTreeItem | GitHubIssue> {
  private _onDidChangeTreeData: vscode.EventEmitter<IssueTreeItem | GitHubIssue | undefined | null | void> = new vscode.EventEmitter<IssueTreeItem | GitHubIssue | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IssueTreeItem | GitHubIssue | undefined | null | void> = this._onDidChangeTreeData.event;

  private _onDidChangeCheckboxState: vscode.EventEmitter<vscode.TreeCheckboxChangeEvent<IssueTreeItem | GitHubIssue>> = new vscode.EventEmitter<vscode.TreeCheckboxChangeEvent<IssueTreeItem | GitHubIssue>>();
  readonly onDidChangeCheckboxState: vscode.Event<vscode.TreeCheckboxChangeEvent<IssueTreeItem | GitHubIssue>> = this._onDidChangeCheckboxState.event;

  private issues: GitHubIssue[] = [];
  private pullRequests: GitHubIssue[] = [];
  private searchQuery: string = '';

  private issueViewProvider: IssueViewProvider | undefined;

  constructor(
    private issueService: GitHubIssueService
  ) {
    // Set up the checkbox change event handler
    this.onDidChangeCheckboxState(this.handleCheckboxChange.bind(this));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IssueTreeItem | GitHubIssue): vscode.TreeItem {
    if (element instanceof GitHubIssue && element.type === 'progressBar') {
      // Create a custom TreeItem for progress bars
      const treeItem = new vscode.TreeItem('', vscode.TreeItemCollapsibleState.None);
      treeItem.tooltip = element.tooltip;
      
      // Create a visual progress bar
      const progressBar = this.createProgressBar(element.progress);
      treeItem.description = progressBar;
      
      // Use a custom context value to identify progress bar items
      treeItem.contextValue = 'progressBar';
      
      return treeItem;
    }
    return element;
  }

  private createProgressBar(progress: number): string {
    const width = 15; // Total width of the progress bar
    const filledWidth = Math.round((progress / 100) * width);
    const emptyWidth = width - filledWidth;
    
    const filledChar = '█'; // Unicode full block
    const emptyChar =  ' '; // Unicode light shade
    
    const progressBar = filledChar.repeat(filledWidth) + emptyChar.repeat(emptyWidth);
    const percentage = `${Math.round(progress)}%`;
    
    return `[${progressBar}] ${percentage}`;
  }

  async getChildren(element?: IssueTreeItem | GitHubIssue): Promise<(IssueTreeItem | GitHubIssue)[]> {
    if (!element) {
      await this.fetchIssues();
      return this.getRootItems();
    } else if (element instanceof IssueTreeItem && element.items) {
      return element.items.filter(item => this.matchesSearch(item));
    } else if (element instanceof GitHubIssue) {
      return element.children;
    }
    return [];
  }

  private async fetchIssues(): Promise<void> {
    const fetchedItems = await this.issueService.getCachedOrFetchIssues();
    this.issues = fetchedItems.issues.map(issue => 
      new GitHubIssue(issue.title, vscode.TreeItemCollapsibleState.None, issue, 'issue')
    );
    this.pullRequests = fetchedItems.pullRequests.map(pr => 
      new GitHubIssue(pr.title, vscode.TreeItemCollapsibleState.None, pr, 'pullRequest')
    );
  }

  private getRootItems(): IssueTreeItem[] {
    if (this.searchQuery) {
      const filteredIssues = this.issues.filter(issue => this.matchesSearch(issue));
      const filteredPRs = this.pullRequests.filter(pr => this.matchesSearch(pr));
      return [
        new IssueTreeItem(
          `Search Results for "${this.searchQuery}" (${filteredIssues.length + filteredPRs.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          [...filteredIssues, ...filteredPRs]
        )
      ];
    }

    const openIssues = this.issues.filter(issue => issue.issue.state === 'open');
    const closedIssues = this.issues.filter(issue => issue.issue.state === 'closed');
    const openPRs = this.pullRequests.filter(pr => pr.issue.state === 'open');
    const closedPRs = this.pullRequests.filter(pr => pr.issue.state === 'closed');

    return [
      new IssueTreeItem(`Issues (${this.issues.length})`, vscode.TreeItemCollapsibleState.Expanded, [
        new IssueTreeItem(`Open Issues (${openIssues.length})`, vscode.TreeItemCollapsibleState.Expanded, openIssues),
        new IssueTreeItem(`Closed Issues (${closedIssues.length})`, vscode.TreeItemCollapsibleState.Collapsed, closedIssues)
      ]),
      new IssueTreeItem(`Pull Requests (${this.pullRequests.length})`, vscode.TreeItemCollapsibleState.Collapsed, [
        new IssueTreeItem(`Open Pull Requests (${openPRs.length})`, vscode.TreeItemCollapsibleState.Collapsed, openPRs),
        new IssueTreeItem(`Closed Pull Requests (${closedPRs.length})`, vscode.TreeItemCollapsibleState.Collapsed, closedPRs)
      ])
    ];
  }

  private matchesSearch(item: IssueTreeItem | GitHubIssue): boolean {
    if (!this.searchQuery) return true;
    if (item instanceof IssueTreeItem) return true; // Always show IssueTreeItems when searching

    const lowercaseQuery = this.searchQuery.toLowerCase();
    
    const matchesTitle = typeof item.label === 'string' 
      ? item.label.toLowerCase().includes(lowercaseQuery)
      : item.label?.label.toLowerCase().includes(lowercaseQuery) || false;
    
    const matchesBody = item.issue && 
                        item.issue.body && 
                        item.issue.body.toLowerCase().includes(lowercaseQuery);
    const matchesChildren = item.children.some(child => this.matchesSearch(child));
    
    return matchesTitle || matchesBody || matchesChildren;
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    vscode.commands.executeCommand('setContext', 'github-issues:hasSearchQuery', true);
    this.refresh();
  }

  clearSearch(): void {
    this.searchQuery = '';
    vscode.commands.executeCommand('setContext', 'github-issues:hasSearchQuery', false);
    this.refresh();
  }

  setIssueViewProvider(provider: IssueViewProvider): void {
    this.issueViewProvider = provider;
  }

  public async handleCheckboxChange(e: vscode.TreeCheckboxChangeEvent<IssueTreeItem | GitHubIssue>): Promise<void> {
    for (const [item, state] of e.items) {
      if (item instanceof GitHubIssue && item.isCheckbox && item.parent) {
        const checked = state === vscode.TreeItemCheckboxState.Checked;
        const parentBody = item.parent.issue.body;
        const itemLabel = typeof item.label === 'string' ? item.label : item.label?.label || '';
        const updatedBody = parentBody.replace(
          new RegExp(`- \\[${checked ? ' ' : 'x'}\\] ${itemLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gm'),
          `- [${checked ? 'x' : ' '}] ${itemLabel}`
        );
        
        if (issueService) {
          const { owner, repo } = await issueService.getGitHubRepoInfo();
          await issueService.updateIssueBody(owner, repo, item.parent.issue.number, updatedBody);
          item.parent.issue.body = updatedBody;
          item.checked = checked;
          item.parent.calculateProgress();
          this._onDidChangeTreeData.fire(item.parent);
          
          // Update the issue in the IssueViewProvider
          if (this.issueViewProvider) {
            this.issueViewProvider.updateIssue(item.parent.issue);
          }
        } else {
          vscode.window.showErrorMessage('GitHub Issue Service is not initialized');
        }
      }
    }
  }

  setIssues(issues: any[], pullRequests: any[]): void {
    this.issues = issues.map(issue => 
      new GitHubIssue(issue.title, vscode.TreeItemCollapsibleState.None, issue, 'issue')
    );
    this.pullRequests = pullRequests.map(pr => 
      new GitHubIssue(pr.title, vscode.TreeItemCollapsibleState.None, pr, 'pullRequest')
    );
  }
}

export async function activate(context: vscode.ExtensionContext) {
  // Create and show output channel
  outputChannel = vscode.window.createOutputChannel('GitHub Issues');
  outputChannel.show();

  outputChannel.appendLine('Activating GitHub Issues extension');

  const workspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : undefined;

  outputChannel.appendLine(`Workspace root: ${workspaceRoot}`);

  try {
    issueService = new GitHubIssueService(workspaceRoot, context, outputChannel);
    const githubIssuesProvider = new GitHubIssuesProvider(issueService);
    const issueViewProvider = new IssueViewProvider(outputChannel);
    
    // Register the TreeDataProvider
    const treeView = vscode.window.createTreeView('githubIssuesExplorer', {
      treeDataProvider: githubIssuesProvider,
      showCollapseAll: true,
      canSelectMany: false
    });
    
    // Pass issueViewProvider to the GitHubIssuesProvider
    githubIssuesProvider.setIssueViewProvider(issueViewProvider);
    
    // Enable checkbox state change events
    treeView.onDidChangeCheckboxState(githubIssuesProvider.handleCheckboxChange.bind(githubIssuesProvider));
    
    context.subscriptions.push(treeView);

    // Load cached issues, render immediately, and then fetch updates
    const initialData = await issueService.loadCacheAndFetch();
    githubIssuesProvider.setIssues(initialData.issues, initialData.pullRequests);
    githubIssuesProvider.refresh();

    // Listen for updates and refresh the tree view when new data arrives
    issueService.onDataUpdated(({ issues, pullRequests }) => {
      githubIssuesProvider.setIssues(issues, pullRequests);
      githubIssuesProvider.refresh();
    });

    // Initialize the service in the background
    await issueService.initialize();

    // Register the refresh command
    context.subscriptions.push(vscode.commands.registerCommand('github-issues.refreshIssues', async () => {
      outputChannel.appendLine('Manually refreshing GitHub issues');
      if (issueService) {
        await issueService.clearCache();
        githubIssuesProvider.refresh();
      } else {
        outputChannel.appendLine('Error: Issue service is not initialized');
        vscode.window.showErrorMessage('Unable to refresh issues. Issue service is not initialized.');
      }
    }));

    // Register the open issue command
    context.subscriptions.push(vscode.commands.registerCommand('github-issues.openIssue', (issue) => {
      issueViewProvider.showIssue(issue);
    }));

    // Register the search command
    context.subscriptions.push(vscode.commands.registerCommand('github-issues.searchIssues', async () => {
      const query = await vscode.window.showInputBox({ 
        prompt: 'Search issues',
        placeHolder: 'Enter search query'
      });
      if (query !== undefined) {
        githubIssuesProvider.setSearchQuery(query);
      }
    }));

    // Register the clear search command
    context.subscriptions.push(vscode.commands.registerCommand('github-issues.clearSearch', () => {
      githubIssuesProvider.clearSearch();
    }));

    // Add a new command to edit an issue
    context.subscriptions.push(vscode.commands.registerCommand('github-issues.editIssue', async (issue: GitHubIssue) => {
      if (issueService) {
        const { owner, repo } = await issueService.getGitHubRepoInfo();
        const newTitle = await vscode.window.showInputBox({ prompt: 'Enter new title', value: issue.issue.title });
        if (newTitle !== undefined) {
          await issueService.updateIssue(owner, repo, issue.issue.number, { title: newTitle });
          githubIssuesProvider.refresh();
        }
      } else {
        vscode.window.showErrorMessage('GitHub Issue Service is not initialized');
      }
    }));

    outputChannel.appendLine('GitHub Issues extension activated successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Error activating GitHub Issues extension: ${errorMessage}`);
    vscode.window.showErrorMessage(`Failed to activate GitHub Issues extension: ${errorMessage}`);
  }
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
  if (issueService) {
    issueService.dispose();
  }
}

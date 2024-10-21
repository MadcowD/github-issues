import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';
import simpleGit from 'simple-git';

// Interface for our cached data
export interface CachedIssues {
  timestamp: number;
  issues: any[];
  pullRequests: any[];
}

export class GitHubIssueService {
  private octokit: Octokit | null = null;
  private outputChannel: vscode.OutputChannel;
  private refreshInterval: NodeJS.Timeout | null = null;
  private workspaceState: vscode.Memento;

  constructor(
    private workspaceRoot: string | undefined,
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ) {
    this.outputChannel = outputChannel;
    this.workspaceState = context.workspaceState;
    this.startBackgroundRefresh();
  }

  async initialize(): Promise<void> {
    this.initializeInBackground();
  }

  private async initializeInBackground(): Promise<void> {
    try {
      const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
      this.octokit = new Octokit({ auth: session.accessToken });
      this.outputChannel.appendLine('Successfully authenticated with GitHub');

      // Print out the scopes/permissions we have
      this.outputChannel.appendLine(`Authenticated with the following scopes: ${session.scopes.join(', ')}`);

      // Optionally, you can also print more detailed information about the user
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      this.outputChannel.appendLine(`Authenticated as: ${user.login}`);
      this.outputChannel.appendLine(`User ID: ${user.id}`);
      this.outputChannel.appendLine(`Account type: ${user.type}`);

      // Fetch and cache issues after successful authentication
      await this.fetchAndCacheIssues();
    } catch (error) {
      this.handleError('Failed to authenticate with GitHub', error);
    }
  }

  async getCachedOrFetchIssues(): Promise<{ issues: any[], pullRequests: any[] }> {
    const cacheKey = await this.getCacheKey();
    const cachedData = this.workspaceState.get<CachedIssues>(cacheKey);
    
    if (cachedData) {
      const now = Date.now();
      const cacheAge = now - cachedData.timestamp;
      const cacheExpirationTime = 30 * 60 * 1000; // 30 minutes

      if (cacheAge < cacheExpirationTime) {
        this.outputChannel.appendLine('Using cached GitHub issues and pull requests');
        // Trigger a background refresh if the cache is older than 5 minutes
        if (cacheAge > 5 * 60 * 1000) {
          this.refreshInBackground();
        }
        return { issues: cachedData.issues, pullRequests: cachedData.pullRequests };
      }
    }

    // If there's no cache or it's expired, and we're not authenticated yet, return an empty result
    if (!this.octokit) {
      this.outputChannel.appendLine('Not authenticated yet, returning empty result');
      return { issues: [], pullRequests: [] };
    }

    return this.fetchAndCacheIssues();
  }

  private async fetchAndCacheIssues(): Promise<{ issues: any[], pullRequests: any[] }> {
    try {
      const { owner, repo } = await this.getGitHubRepoInfo();
      const openItems = await this.fetchItems(owner, repo, 'open');
      const closedItems = await this.fetchItems(owner, repo, 'closed');

      const allItems = [...openItems, ...closedItems];
      const issues = allItems.filter(item => !item.pull_request);
      const pullRequests = allItems.filter(item => item.pull_request);

      const cachedData: CachedIssues = {
        timestamp: Date.now(),
        issues,
        pullRequests
      };

      const cacheKey = await this.getCacheKey();
      await this.workspaceState.update(cacheKey, cachedData);
      this.outputChannel.appendLine(`Fetched and cached ${issues.length} GitHub issues and ${pullRequests.length} pull requests for ${owner}/${repo}`);

      // Emit the updated data
      this._onDataUpdated.fire({ issues, pullRequests });

      return { issues, pullRequests };
    } catch (error) {
      this.handleError('Error fetching GitHub issues and pull requests', error);
      return this.getFallbackItems();
    }
  }

  private async fetchItems(owner: string, repo: string, state: 'open' | 'closed'): Promise<any[]> {
    if (!this.octokit) {
      throw new Error('GitHub API is not initialized');
    }
    const response = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state,
      per_page: 100 // Adjust this value based on your needs
    });
    return response.data;
  }

  public async getGitHubRepoInfo(): Promise<{ owner: string; repo: string }> {
    if (!this.workspaceRoot) {
      throw new Error('No workspace root found');
    }

    const git = simpleGit(this.workspaceRoot);
    const remotes = await git.getRemotes(true);
    const originRemote = remotes.find((remote) => remote.name === 'origin');

    if (!originRemote) {
      throw new Error('No origin remote found');
    }

    const match = originRemote.refs.fetch.match(/github\.com[:/](.+)\/(.+)\.git/);
    if (!match) {
      throw new Error('Unable to parse GitHub repository information');
    }

    return { owner: match[1], repo: match[2] };
  }

  async clearCache(): Promise<void> {
    const cacheKey = await this.getCacheKey();
    await this.workspaceState.update(cacheKey, undefined);
    this.outputChannel.appendLine('Cleared GitHub issues cache for the current workspace');
  }

  private startBackgroundRefresh(): void {
    // Refresh cache every 30 minutes
    this.refreshInterval = setInterval(() => this.refreshInBackground(), 30 * 60 * 1000);
  }

  private async refreshInBackground(): Promise<void> {
    this.outputChannel.appendLine('Starting background refresh of GitHub issues');
    await this.fetchAndCacheIssues();
  }

  private handleError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`${message}: ${errorMessage}`);
    vscode.window.showErrorMessage(`${message}. Check output for details.`);
  }

  private async getFallbackItems(): Promise<{ issues: any[], pullRequests: any[] }> {
    const cacheKey = await this.getCacheKey();
    const cachedData = this.workspaceState.get<CachedIssues>(cacheKey);
    if (cachedData) {
      this.outputChannel.appendLine('Using fallback cached issues and pull requests due to fetch error');
      return { issues: cachedData.issues, pullRequests: cachedData.pullRequests };
    }
    return { issues: [], pullRequests: [] };
  }

  dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async updateIssue(owner: string, repo: string, issueNumber: number, update: any): Promise<void> {
    if (!this.octokit) {
      throw new Error('GitHub API is not initialized');
    }

    try {
      await this.octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        ...update
      });
      this.outputChannel.appendLine(`Updated issue #${issueNumber}`);
    } catch (error) {
      this.handleError(`Failed to update issue #${issueNumber}`, error);
      throw error;
    }
  }

  async updateIssueBody(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
    if (!this.octokit) {
      throw new Error('GitHub API is not initialized');
    }

    try {
      await this.octokit.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        body
      });
      this.outputChannel.appendLine(`Updated body of issue #${issueNumber}`);
    } catch (error) {
      this.handleError(`Failed to update body of issue #${issueNumber}`, error);
      throw error;
    }
  }

  async getCachedIssues(): Promise<{ issues: any[], pullRequests: any[] }> {
    const cacheKey = await this.getCacheKey();
    const cachedData = this.workspaceState.get<CachedIssues>(cacheKey);
    if (cachedData) {
      this.outputChannel.appendLine('Using cached GitHub issues and pull requests');
      return { issues: cachedData.issues, pullRequests: cachedData.pullRequests };
    }
    return { issues: [], pullRequests: [] };
  }

  // Add this method to the GitHubIssueService class
  async loadCacheAndFetch(): Promise<{ issues: any[], pullRequests: any[] }> {
    // First, load and return the cached data
    const cachedData = await this.getCachedIssues();
    
    // Then, trigger a background fetch
    this.fetchAndUpdateInBackground();
    
    return cachedData;
  }

  private async fetchAndUpdateInBackground(): Promise<void> {
    try {
      const { issues, pullRequests } = await this.fetchAndCacheIssues();
      // Notify that the data has been updated
      this._onDataUpdated.fire({ issues, pullRequests });
    } catch (error) {
      this.handleError('Error fetching and updating GitHub issues and pull requests', error);
    }
  }

  // Add this event emitter to the class
  private _onDataUpdated: vscode.EventEmitter<{ issues: any[], pullRequests: any[] }> = new vscode.EventEmitter<{ issues: any[], pullRequests: any[] }>();
  readonly onDataUpdated: vscode.Event<{ issues: any[], pullRequests: any[] }> = this._onDataUpdated.event;

  private async getCacheKey(): Promise<string> {
    const { owner, repo } = await this.getGitHubRepoInfo();
    return `githubIssues_${owner}_${repo}`;
  }
}

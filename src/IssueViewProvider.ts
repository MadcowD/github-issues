import * as vscode from 'vscode';
import { marked } from 'marked';

export class IssueViewProvider {
  private outputChannel: vscode.OutputChannel;
  private currentPanel: vscode.WebviewPanel | undefined;
  private currentIssue: any | undefined;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  public showIssue(issue: any): void {
    this.outputChannel.appendLine(`Opening issue: ${JSON.stringify(issue, null, 2)}`);
    
    if (!issue || typeof issue.number === 'undefined') {
      const errorMessage = 'Invalid issue data. Unable to open issue.';
      this.outputChannel.appendLine(`Error: ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
      return;
    }

    try {
      if (this.currentPanel) {
        this.currentPanel.reveal(vscode.ViewColumn.One);
      } else {
        this.currentPanel = vscode.window.createWebviewPanel(
          'githubIssue',
          `Issue #${issue.number}`,
          vscode.ViewColumn.One,
          {
            enableScripts: true
          }
        );

        this.currentPanel.onDidDispose(() => {
          this.currentPanel = undefined;
          this.currentIssue = undefined;
        });
      }

      this.currentIssue = issue;
      this.updateIssueContent();
      this.outputChannel.appendLine(`Successfully opened issue #${issue.number}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`Error opening issue: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to open issue: ${errorMessage}`);
    }
  }

  public updateIssueContent(): void {
    if (this.currentPanel && this.currentIssue) {
      const stateIcon = this.currentIssue.state === 'open' ? '🟢' : '🔴';
      const bodyHtml = this.currentIssue.body ? marked.parse(this.currentIssue.body) : 'No description provided.';
      this.currentPanel.webview.html = this.getWebviewContent(this.currentIssue, stateIcon, bodyHtml);
      this.currentPanel.title = `Issue #${this.currentIssue.number}`;
    }
  }

  public updateIssue(updatedIssue: any): void {
    if (this.currentIssue && this.currentIssue.number === updatedIssue.number) {
      this.currentIssue = updatedIssue;
      this.updateIssueContent();
      this.outputChannel.appendLine(`Updated issue #${updatedIssue.number} in the webview`);
    }
  }

  private getWebviewContent(issue: any, stateIcon: string, bodyHtml: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Issue #${issue.number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { margin-bottom: 10px; }
          .meta { color: #586069; margin-bottom: 20px; }
          .body { line-height: 1.5; }
        </style>
      </head>
      <body>
        <h1>${stateIcon} ${issue.title}</h1>
        <div class="meta">
          <strong>#${issue.number}</strong> opened by ${issue.user.login} 
          on ${new Date(issue.created_at).toLocaleDateString()}
        </div>
        <div class="body">
          ${bodyHtml}
        </div>
      </body>
      </html>
    `;
  }
}

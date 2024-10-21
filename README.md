# GitHub Issues Explorer

GitHub Issues Explorer is a robust Visual Studio Code extension designed to streamline your workflow by integrating GitHub issues and pull requests directly into your development environment. This powerful tool allows developers to manage and interact with their repository's issues and PRs without leaving their code editor, significantly enhancing productivity.

## Key Features

1. **Comprehensive Issue and PR Explorer**
   - Browse all issues and pull requests in a convenient tree view within the VSCode sidebar
   - Efficiently categorize and navigate through:
     - Open and Closed Issues
     - Open and Closed Pull Requests

2. **Detailed Issue View**
   - Access comprehensive issue details in a dedicated panel, including:
     - Title and issue number
     - Creator and creation date
     - Full description with rendered Markdown support

3. **Advanced Sub-issue Management**
   - Leverage checkbox support for sub-issues within issue descriptions
   - Manage sub-issues directly from the tree view
   - Track progress with automatic calculations for issues containing sub-tasks

4. **Real-time Progress Visualization**
   - Monitor task completion with visual progress bars for issues containing sub-tasks
   - Instantly view completion percentages for complex issues

5. **Powerful Search Capabilities**
   - Perform full-text searches across all issues and pull requests
   - Filter results based on title, body content, and sub-issues

6. **Efficient Data Management**
   - Manually refresh issue and PR lists as needed
   - Benefit from automatic background refreshes to maintain up-to-date information
   - Utilize an intelligent caching system to minimize API calls and optimize performance

7. **Secure Authentication**
   - Authenticate securely with GitHub using VSCode's built-in authentication provider
   - Enjoy seamless token management and automatic renewal

8. **Automatic Repository Detection**
   - Experience hassle-free setup with automatic detection of the GitHub repository associated with your current workspace

## Getting Started

1. Install the GitHub Issues Explorer extension from the VSCode marketplace
2. Open a workspace linked to a GitHub repository
3. Complete the GitHub authentication process when prompted
4. Access the GitHub Issues Explorer view in your sidebar

## Available Commands

- `GitHub Issues: Refresh Issues`: Manually update the issue and PR list
- `GitHub Issues: Search Issues`: Initiate a search to filter issues and PRs
- `GitHub Issues: Clear Search`: Remove the current search filter
- `GitHub Issues: Edit Issue`: Modify the title of the selected issue

## System Requirements

- Visual Studio Code v1.60.0 or later
- Active GitHub account
- Workspace connected to a GitHub repository

## Configuration

This extension provides the following customizable setting:

* `github-issues.refreshInterval`: Define the automatic refresh interval in minutes

## Reporting Issues

Encountered a problem? Please report it on our [GitHub repository](https://github.com/yourusername/vscode-github-issues/issues).

## Release Information

### 1.0.0

Initial release of GitHub Issues Explorer, introducing core functionality.

---

## Contributing

We value community contributions! Please refer to our [contributing guidelines](CONTRIBUTING.md) for more details on how to get involved.

## License

This project is distributed under the MIT License. For full details, please see the [LICENSE](LICENSE) file.

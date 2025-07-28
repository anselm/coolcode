import simpleGit from 'simple-git';

export class GitTool {
  constructor() {
    this.git = simpleGit();
  }
  
  async isGitRepo() {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }
  
  async getStatus() {
    return await this.git.status();
  }
  
  async getChangedFiles() {
    const status = await this.git.status();
    return [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.renamed.map(r => r.to)
    ];
  }
  
  async getDiff(file = null) {
    if (file) {
      return await this.git.diff([file]);
    }
    return await this.git.diff();
  }
  
  async getStagedDiff(file = null) {
    if (file) {
      return await this.git.diff(['--cached', file]);
    }
    return await this.git.diff(['--cached']);
  }
  
  async add(files) {
    return await this.git.add(files);
  }
  
  async commit(message) {
    return await this.git.commit(message);
  }
  
  async getCurrentBranch() {
    const status = await this.git.status();
    return status.current;
  }
  
  async getRecentCommits(count = 10) {
    return await this.git.log({ maxCount: count });
  }
  
  async createBranch(branchName) {
    return await this.git.checkoutLocalBranch(branchName);
  }
  
  async switchBranch(branchName) {
    return await this.git.checkout(branchName);
  }
}

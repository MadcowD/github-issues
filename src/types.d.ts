declare module 'simple-git' {
  function simpleGit(baseDir?: string): SimpleGit;

  interface SimpleGit {
    getRemotes(verbose: boolean): Promise<Remote[]>;
  }

  interface Remote {
    name: string;
    refs: {
      fetch: string;
      push: string;
    };
  }

  const _default: typeof simpleGit;
  export default _default;
}

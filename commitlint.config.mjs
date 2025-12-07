export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert'
    ]],
    'scope-enum': [2, 'always', [
      'core', 'agents', 'database', 'providers', 'arw',
      'api', 'mcp-server', 'sdk', 'ui', 'deps', 'release'
    ]],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100]
  }
};

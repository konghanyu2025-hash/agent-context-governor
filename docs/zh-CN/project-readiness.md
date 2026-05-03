# 项目完整度检查

当以下检查通过时，这个仓库可以视为可自用、可公开的开源 v1：

- 仓库有干净的 `main` 分支，并配置了 GitHub remote。
- `npm run check` 通过。
- `npm pack --dry-run` 包含 `dist`、`docs`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`、`LICENSE` 和 `SECURITY.md`。
- 可以通过 `npm install -g github:konghanyu2025-hash/agent-context-governor` 从 GitHub 直接安装。
- 打包安装后可以运行 `agent-context --help`。
- 新项目第一次使用可以直接运行 `agent-context setup`。
- 构建产物 CLI 可以运行 `doctor`。
- 构建产物 MCP server 可以返回 `tools/list`。
- `.agent-memory/`、`node_modules/`、`dist/` 和生成的 tarball 没有被提交。

## 当前包含

- CLI
- MCP stdio server
- 本地 JSONL 记忆存储
- 项目索引
- context pack 生成
- 失败路径负缓存
- npm 依赖审查
- 英文和中文文档
- GitHub Actions CI
- issue 和 pull request 模板

## 当前不包含

- npm registry 发布
- 云同步
- 团队共享和权限
- 编辑器插件
- 向量检索

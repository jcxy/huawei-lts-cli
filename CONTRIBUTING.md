# 贡献指南

欢迎 issue 和 PR。这个仓库不大，所以规矩也短——但下面几条是真的会被要求改的。

## 动手之前

- **先看 [CONTEXT.md](CONTEXT.md)。** 它是这个仓库的词汇表：日志组、日志流、索引字段、搜索语句、分析语句……写 issue、PR、测试名、ADR 时用里面的叫法，不要另造同义词。
- **架构决策看 [docs/adr/](docs/adr/)。** 尤其是 [ADR-0001](docs/adr/0001-dual-track-skill-and-profile.md)（已被取代）和 [ADR-0004](docs/adr/0004-retire-local-profile.md) ——后者记录了"为什么业务词表不在凭证目录"。
- 想做较大的改动，**先开 issue 说清楚要解决什么问题**，再写代码。避免写完发现方向不对。

## 本地开发

```bash
npm install
npm run dev -- query --last 2h    # 直接从源码跑
npm run typecheck                 # tsc --noEmit
npm test                          # node:test + tsx，需要 Node >= 22
npm run build                     # 编译到 dist/
```

CI 会跑 `typecheck`、`build`（Node 18/20/22）和 `test`（Node 22/24，Ubuntu + Windows）。提交前本地至少跑一遍 `npm run typecheck && npm test`。

> 测试要求 Node >= 22：`node --test "test/**/*.test.ts"` 的通配符支持直到 22 才落地，20 上会报 `Could not find`。

## 代码约定

- **同一个事实只允许有一个来源。** 字段清单、日志组/流 ID、字段取值一律运行时查询（`fields` / `groups` / `streams` / 管道 SQL），不要抄进文档或常量表——抄进去的那一刻它就开始过期。
- **绝不硬编码任何具体环境的事实。** 示例一律用 `my-app`、`service-a`、`appName:myapp` 这类中性占位；真实业务系统名、日志组 ID、日志流 ID、内部项目代号不允许出现在公开文件里。
- **凭证永远不进 AI 上下文。** 任何让 AI 读取 `~/.lts-cli/` 的设计都会被拒——那里是明文 AK/SK。
- 新增或修改 CLI 选项时，**必须同步 `src/cli/index.ts` 里补全脚本的三段手写列表**（bash / zsh / PowerShell）。这三处和命令定义分居两地，最容易漏。
- 注释解释"为什么"，不复述"是什么"。

## 提交与 PR

- 提交信息用 `type(scope): 摘要` 的形式（`feat` / `fix` / `docs` / `refactor` / `test` / `chore`）。破坏性变更在 type 后加 `!`，例如 `feat(cli)!: 删除 --offset`。
- 面向用户的变更要写进 [CHANGELOG.md](CHANGELOG.md) 的「未发布」段。
- PR 描述里说清：改了什么、为什么、怎么验证。CI 绿了再请人看。
- 只改文档的 PR 也欢迎，错别字和过期的示例同样算 bug。

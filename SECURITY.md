# 安全说明

## 这个工具会接触什么

`lts-cli` 需要在**本机**保存华为云凭证才能调用 LTS API：

| 位置 | 内容 | 权限 |
|---|---|---|
| `~/.lts-cli/config.json` | 明文 AK/SK、Project ID、默认日志组/流 | 文件 0600，目录 0700（Windows 由用户目录 ACL 保护） |
| 环境变量 `LTS_AK` / `LTS_SK` 等 | 同上，优先级高于配置文件 | — |

**凭证是明文的。** 本工具不加密存储，也不依赖系统钥匙串——这是有意的取舍，见 [ADR-0004](docs/adr/0004-retire-local-profile.md)。如果你需要更强的凭证保护，请用环境变量注入并在会话结束后清除，或使用临时的 IAM 用户。

## 一条硬规则

**不要把这个目录整个交给 AI 或任何自动化脚本。** `~/.lts-cli/` 里是明文 AK/SK，一次 `cat ~/.lts-cli/*` 或 `Get-ChildItem` 就会把凭证带进日志、聊天记录或提交历史。要看配置请用：

```bash
lts-cli config --list     # ak/sk 自动脱敏
```

skill（`skills/huawei-lts-log-query/`）里也写明了同样的规则，并且**故意**不把业务词表放在这个目录——AI 没有任何理由进去。

## 报告漏洞

不要开公开 issue。请用 GitHub 的私密报告通道：

**Security → Advisories → Report a vulnerability**

<https://github.com/jcxy/huawei-lts-cli/security/advisories/new>

请在报告里说明：受影响的版本、复现步骤、影响范围。如果问题涉及凭证泄漏，**不要贴出真实的 AK/SK**，用占位符代替。

## 如果你怀疑凭据已泄漏

1. 立刻在华为云控制台**删除并重建**该访问密钥（`我的凭证 → 访问密钥`）。泄漏的 AK/SK 无法"撤回"，只能作废。
2. 检查 `~/.lts-cli/config.json` 是否被提交、被贴进 issue、或出现在任何 AI 会话记录里。
3. 如果是本仓库的文档或示例引导出了泄漏，请按上面的通道报告。

## 支持范围

只为最新发布版本提供安全修复。旧版本请先升级。

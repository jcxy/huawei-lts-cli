# 华为云LTS CLI+Skill日志查询工具

基于Node.js/TypeScript的CLI工具，用于查询华为云日志服务(LTS)中的日志。

## 安装

```bash
npm install
npm run build
```

## 配置

```bash
# 设置认证信息
npm run start -- config --set ak=your_access_key
npm run start -- config --set sk=your_secret_key
npm run start -- config --set project_id=your_project_id
npm run start -- config --set region=cn-north-4
npm run start -- config --set endpoint=lts.cn-north-4.myhuaweicloud.com
```

## 使用

### 查询日志

```bash
# 基础查询
npm run start -- query -g group-xxx -s stream-xxx --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z

# 关键词搜索
npm run start -- query -g group-xxx -s stream-xxx --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -k "ERROR"

# 表格输出
npm run start -- query -g group-xxx -s stream-xxx --st 2024-01-01T00:00:00Z --et 2024-01-02T00:00:00Z -o table
```

## Skill集成

本项目包含Qoder Skill，位于 `.qoder/skills/lts-log-query/SKILL.md`。

## 命令参考

- `lts-cli query` — 查询日志
- `lts-cli config` — 配置管理

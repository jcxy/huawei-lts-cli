# 高级查询功能实现说明

## 概述

本文件记录 `huawei-lts-cli` 高级查询功能的技术实现细节，供开发者和维护者参考。

## 核心改动

### 1. 类型定义增强（src/types/index.ts）

**新增字段：**
```typescript
export interface QueryParams {
  // ... 原有字段
  keyword?: string;    // 向后兼容：简单关键词搜索
  query?: string;      // SQL查询语句或结构化查询表达式
}
```

### 2. 客户端支持高级查询（src/lts/client.ts）

**修改逻辑：**
- 优先使用 `query` 参数（支持SQL和结构化查询）
- 保留 `keyword` 参数用于向后兼容
- 通过 SDK 的 `withQuery()` 方法传递查询表达式

```typescript
// 优先使用 query 参数（支持SQL和结构化查询）
if (params.query) {
  queryParams.withQuery(params.query);
} else if (params.keyword) {
  // 向后兼容：简单关键词搜索
  queryParams.withKeywords(params.keyword);
}
```

### 3. CLI命令增强（src/cli/commands/query.ts）

**新增选项：**
```bash
-q, --query <query>     高级查询表达式（推荐）：
                          - 字段查询: content:error AND appName:myapp
                          - 比较运算: time>60 AND region:r
                          - SQL语法: SELECT * FROM log WHERE ...
                          - 逻辑运算符: AND, OR, NOT（需空格分隔）
```

**更新描述：**
- `-k, --keyword` 标记为"legacy"（旧版，不推荐）
- 添加详细的帮助文本说明查询语法

## 查询执行流程

```
用户输入 → CLI解析 → QueryParams.query →
SDK withQuery() → ListLogsRequest →
LTS API → 返回结果
```

### 优先级
1. `query` 参数（高级查询）
2. `keyword` 参数（简单搜索，向后兼容）

## 向后兼容性

✅ **完全向后兼容**

- 原有的 `-k, --keyword` 参数仍然可用
- 现有脚本和命令无需修改
- 新用户推荐使用 `-q, --query` 参数

## SDK 调用说明

使用华为云 LTS SDK v2 的 `QueryLtsLogParams.withQuery()` 方法传递查询表达式。

## 测试验证

### 构建测试
```bash
npm run build
```

### 帮助信息测试
```bash
node dist/cli/index.js query --help
```

### 功能测试
建议使用实际环境测试以下场景：
1. 单字段查询
2. 多字段组合查询（AND/OR/NOT）
3. 数值比较查询
4. SQL统计查询

## 参考资料

- [华为云LTS官方文档](https://support.huaweicloud.com/productdesc-lts/lts_03202.html)
- [搜索语法介绍](https://support.huaweicloud.com/intl/zh-cn/ally-visitor-1-usermanual-lts/lts_07_0086.html)
- [SQL查询语法概述](https://support.huaweicloud.com/usermanual-lts/lts_07_0087.html)
- [华为云LTS API参考](https://support.huaweicloud.com/api-lts/lts_api_0011.html)

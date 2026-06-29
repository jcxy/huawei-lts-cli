# 华为云LTS查询功能对比说明

## 控制台 vs CLI 功能对照

### 1. 单字段搜索

**控制台操作：**
- 选择字段：`content`
- 匹配方式：`包含(精确)`
- 输入值：`error`

**CLI命令：**
```bash
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "content:error"
```

### 2. 多字段组合查询（且关系）

**控制台操作：**
- 条件1：字段 `content`，包含 `error`
- 逻辑关系：`且`
- 条件2：字段 `appName`，包含 `myapp`

**CLI命令：**
```bash
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "content:error AND appName:myapp"
```

### 3. 多字段组合查询（或关系）

**控制台操作：**
- 条件1：字段 `level`，包含 `ERROR`
- 逻辑关系：`或`
- 条件2：字段 `level`，包含 `WARN`

**CLI命令：**
```bash
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "level:ERROR OR level:WARN"
```

### 4. 复杂组合查询

**控制台操作：**
- 条件1：字段 `level`，包含 `ERROR`
- 逻辑关系：`或`
- 条件2：字段 `level`，包含 `WARN`
- 逻辑关系：`且`
- 条件3：字段 `env`，不包含 `test`

**CLI命令：**
```bash
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "(level:ERROR OR level:WARN) NOT env:test"
```

### 5. 数值比较查询

**控制台操作：**
- 字段：`response_time`
- 运算符：`>`
- 值：`1000`

**CLI命令：**
```bash
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "response_time>1000"
```

### 6. SQL分析查询

**控制台操作：**
- 切换到"SQL分析"标签
- 输入SQL：`SELECT count(*) as cnt, level FROM log GROUP BY level`

**CLI命令：**
```bash
lts-cli query --st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z \
  -q "SELECT count(*) as cnt, level FROM log GROUP BY level" \
  -f json
```

## 关键语法要点

### 逻辑运算符使用规则
⚠️ **重要**：AND、OR、NOT 前后必须有**空格**

```bash
# ✅ 正确
-q "content:error AND level:ERROR"

# ❌ 错误（缺少空格）
-q "content:errorANDlevel:ERROR"
```

### 字段查询格式
```
field:value
```
- `:` 表示包含/模糊匹配
- 支持中文和英文

### SQL查询注意事项
- 使用标准SQL92语法
- 字段名含特殊字符时用双引号：`"field.name"`
- 字符串用单引号：`'value'`

## 快速参考卡片

| 需求 | 控制台操作 | CLI命令 |
|------|-----------|---------|
| 简单关键词 | 直接输入 | `-k "keyword"` |
| 字段匹配 | 选择字段+输入值 | `-q "field:value"` |
| 且关系 | 点击"且"按钮 | `AND`（带空格） |
| 或关系 | 点击"或"按钮 | `OR`（带空格） |
| 排除条件 | 添加条件后删除 | `NOT`（带空格） |
| 数值比较 | 选择比较符 | `field>value` |
| 统计分析 | SQL分析标签 | `-q "SELECT ..."` |

## 迁移建议

如果您习惯使用控制台的多条件查询界面，可以按照以下映射关系转换为CLI命令：

1. **识别字段**：查看控制台中选择的字段名（如 content、appName、node等）
2. **确定关系**：判断是"且"还是"或"关系
3. **构建表达式**：
   - "且" → 使用 `AND`
   - "或" → 使用 `OR`
   - "排除" → 使用 `NOT`
4. **组合条件**：用空格分隔各个条件和运算符
5. **执行查询**：添加时间范围和输出格式参数

**示例转换流程：**

控制台配置：
```
─────────────────────┐
│ content: error      │
│   [且]              │
│ appName: myapp      │
│   [或]              │
│ node: server1       │
─────────────────────┘
```

转换为CLI：
```bash
-q "content:error AND appName:myapp OR node:server1"
```

注意运算优先级，必要时使用括号：
```bash
-q "(content:error AND appName:myapp) OR node:server1"
```

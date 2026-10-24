# LTS 查询语法

配合 `lts-cli query -q "<表达式>"` 使用。控制台的多条件搜索、比较运算与管道分析都能写成同一行。

> **字段名先查，再写查询。** 下面的示例用的是 `content` / `appName` / `level` 这类常见命名，不代表你的日志流里一定存在这些字段。先跑 `lts-cli fields` 拿真实字段名与属性。

## 字段查询

```
field:value         # 值被分词后，命中含该词的日志
field:"a b c"       # 引号内整体当一个词，不分词
field:val*          # 前缀模糊
```

引号是必须的：值里含连字符、点、下划线等分词符时，不加引号会被拆成多个词，`field:8f14e45f-ceea` 实际是在找「8f14e45f」和「ceea」两个词，匹配不到那个 UUID。

`--app` / `--content` / `--request-id` 由 CLI 自动加引号；手写 `-q` 时要自己加。

## 逻辑与比较

| 运算符 | 含义 | 示例 |
| --- | --- | --- |
| `AND` | 且 | `level:ERROR AND appName:svc-a` |
| `OR` | 或 | `level:ERROR OR level:WARN` |
| `NOT` | 排除 | `level:DEBUG NOT module:test` |
| `>` `<` `>=` `<=` `!=` `=` | 比较 | `duration>1000` |

`AND` / `OR` / `NOT` **前后必须有空格**，`a:1ANDb:2` 不是语法错误，是搜不到东西。

括号控制优先级：

```bash
-q "(level:ERROR OR level:WARN) NOT env:test"
-q "appName:svc-a AND (content:error OR content:timeout)"
```

## 管道分析

新版控制台与 CLI 用同一套管道语法：`搜索语句 | SQL`。

```bash
# 先过滤再聚合
-q 'level:ERROR | SELECT count(*) AS cnt, appName GROUP BY appName'

# 左侧留空表示全量（等价于 *）
-q '| SELECT count(*) AS cnt'

# 裸 SELECT：CLI 自动识别为纯分析查询
-q 'SELECT count(*) AS cnt, level GROUP BY level'
```

SQL 注意：字段名含点号等特殊字符时用双引号 `SELECT "job.id"`；字符串值用单引号 `WHERE level='ERROR'`。

分析结果没有 `line_num`，因此不能游标翻页——`--all` 对分析查询没有意义，请用 SQL 的聚合/排序表达需求。

## 时间范围

```bash
--last 30m | 2h | 1d | 7d        # 推荐：不涉及时区换算
--st 2024-06-29T00:00:00Z --et 2024-06-29T23:59:59Z
```

两者互斥。`--last` 的内部实现是「此刻减去时长」，所以同一条命令在不同时刻的结果不同——写进脚本或报告时用 `--st/--et`。

## 引号陷阱

在 shell 里，外层用双引号、内层用单引号最省事：

```bash
-q "SELECT count(*) FROM log WHERE content LIKE '%error%'"    # 正确
-q 'SELECT * FROM log WHERE content LIKE "%error%"'           # 会被 shell 吃掉
```

值本身含双引号时（`field:"a b"`），整条表达式改用单引号包：

```bash
-q 'REQUEST_ID:"8f14e45f-ceea-467f"'
```

## 常见错误

| 写法 | 问题 | 正确写法 |
| --- | --- | --- |
| `level:ERRORANDappName:x` | 运算符没有空格 | `level:ERROR AND appName:x` |
| `REQUEST_ID:8f14e45f-ceea` | 值被分词 | `REQUEST_ID:"8f14e45f-ceea"` |
| `content:ERROR` 查不到小写日志 | 该字段大小写敏感 | 先 `lts-cli fields` 确认，再按实际大小写 |
| `region_id:abc` 无结果 | 该字段没建索引 | 改用 `content:"abc"` |
| `SELECT "a.b" FROM log` 写反引号 | 反引号不是 LTS 的标识符引法 | 用双引号 |

## 控制台 → CLI 对照

| 控制台操作 | CLI |
| --- | --- |
| 选字段 + 输入值 | `-q "field:value"` |
| 点「且」 | `AND`（带空格） |
| 点「或」 | `OR`（带空格） |
| 加排除条件 | `NOT`（带空格） |
| 选比较符 | `field>value` |
| SQL 分析标签 | 用 `-q` 传 SQL；「先过滤再统计」的写法见上文「管道分析」 |

## 官方文档

- [LTS 产品文档](https://support.huaweicloud.com/lts/index.html)
- [搜索语法](https://support.huaweicloud.com/usermanual-lts/lts_07_0086.html)
- [SQL 查询语法](https://support.huaweicloud.com/usermanual-lts/lts_07_0087.html)

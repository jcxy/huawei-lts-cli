# ADR-0002: 游标分页取代 offset

- **状态**：已接受
- **日期**：2026-10-24

## 背景

CLI 曾对外暴露 `--offset`，并在 `--all` 与 `trace` 中用它推进翻页。但华为云 LTS SDK（`@huaweicloud/huaweicloud-sdk-lts` 3.1.200）的 `QueryLtsLogParams` **没有 offset 字段**，`LTSClient.queryLogs()` 也从未读取过 `params.offset`。后果：

- `--offset 100` 静默返回第一页，用户与 AI 都以为翻页成功；
- `--all` 每轮把 offset 自增，但请求体不变，于是**同一页被重复拉取直到塞满 10000 条上限**；
- `trace` 命中链路超过单页时结果出现重复。

同时，`ListLogsResponse.isQueryComplete` 一直未被读取。LTS 在超大时间跨度下可能返回不完整结果，CLI 却静默当成功——AI 会基于残缺数据下结论，这是比报错更坏的失败模式。

## 决策

1. 删除 `--offset`。LTS 上不存在「跳到第 N 页」的语义，保留它等于对外承诺一个不存在的能力。
2. 分页改用官方游标：取上一页最后一条的 `line_num`，配合 `search_type=forwards | backwards` 继续请求。`query`、`trace`、`--all` 共用同一套推进逻辑。**续读方向一律 `forwards`，不要按排序方向推导——见 [ADR-0005](0005-full-scan-invariants.md)。**
3. `--all` 到顶即停（无更多结果时终止），保留 10000 条上限防止失控。
4. `isQueryComplete === false` 时向 stderr 输出明确警告，提示缩小时间范围。

## 取舍

- 代价：失去随机跳页（该能力本就不存在）；`--all` 的推进从「改一个数字」变成「维护一个游标」。
- 收益：翻页结果正确、无重复（该结论以前提成立为前提，见 [ADR-0005](0005-full-scan-invariants.md)）；残缺结果不再被当成完整结果。

## 被否方案

- **保留 `--offset`，内部翻译成「空跑 N/limit 次再返回」**：N 大时请求数与耗时都不可控，且中途超时会让语义变得更加不可预测。
- **保留 `--offset` 空壳并打 deprecation 警告**：AI 看到参数存在就会假定它有效，警告只对人有效，对最难获益的那个读者无效。
- **靠调大 `limit` 规避翻页**：受服务端单页上限约束，只是把问题推迟。

## 适用条件与失效条件

若 LTS 未来提供稳定的 offset 或 scroll 语义，可重新评估。在服务端语义变化之前，不允许在 CLI 层模拟 offset。

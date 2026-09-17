# Todo Web：手工测试套件

## 范围

- 被测对象：`web-ui`，使用真实 Todo API。
- 覆盖：新建、编辑、取消、字段校验、时间显示、过期与恢复、刷新同步、网络失败和保存中保护。
- 基线：桌面 Chrome，建议窗口不小于 1280 × 800；这是本组的执行环境，不是产品支持范围的定义。
- 预计用时：45–60 分钟，不含首次安装；用时仅供安排参考。
- 状态：用例设计，尚未执行，不代表产品已通过测试。

## 用例索引

共 13 条用例，按三个业务流程组阅读和执行。
优先级表示建议的执行顺序，不是测试结果：P1 优先检查核心流程和数据保护，P2 补充边界与刷新细节。

| 用例 ID | 用例 | 业务分组 | 优先级 |
| --- | --- | --- | --- |
| WEB-TODO-001 | [空列表、新建和重新加载](create-and-edit.md#web-todo-001-空列表新建和重新加载) | 新建与编辑 | P1 |
| WEB-TODO-002 | [编辑内容和手动状态](create-and-edit.md#web-todo-002-编辑内容和手动状态) | 新建与编辑 | P1 |
| WEB-TODO-003 | [放弃未保存的输入](create-and-edit.md#web-todo-003-放弃未保存的输入) | 新建与编辑 | P1 |
| WEB-TODO-004 | [必填和长度边界](create-and-edit.md#web-todo-004-必填和长度边界) | 新建与编辑 | P2 |
| WEB-TODO-005 | [设置、修改和清除截止时间](deadlines-and-status.md#web-todo-005-设置修改和清除截止时间) | 截止时间与状态 | P1 |
| WEB-TODO-006 | [过去的截止时间与过期恢复](deadlines-and-status.md#web-todo-006-过去的截止时间与过期恢复) | 截止时间与状态 | P1 |
| WEB-TODO-007 | [已完成任务不自动过期](deadlines-and-status.md#web-todo-007-已完成任务不自动过期) | 截止时间与状态 | P2 |
| WEB-TODO-008 | [前台过期刷新保留草稿](deadlines-and-status.md#web-todo-008-前台过期刷新保留草稿) | 截止时间与状态 | P1 |
| WEB-TODO-009 | [返回前台后同步，保留本地输入](refresh-and-recovery.md#web-todo-009-返回前台后同步保留本地输入) | 刷新与异常恢复 | P2 |
| WEB-TODO-010 | [首次加载失败后重试](refresh-and-recovery.md#web-todo-010-首次加载失败后重试) | 刷新与异常恢复 | P1 |
| WEB-TODO-011 | [刷新失败不清空列表或草稿](refresh-and-recovery.md#web-todo-011-刷新失败不清空列表或草稿) | 刷新与异常恢复 | P2 |
| WEB-TODO-012 | [保存失败后保留输入并重试](refresh-and-recovery.md#web-todo-012-保存失败后保留输入并重试) | 刷新与异常恢复 | P1 |
| WEB-TODO-013 | [保存中禁止重复提交和关闭](refresh-and-recovery.md#web-todo-013-保存中禁止重复提交和关闭) | 刷新与异常恢复 | P1 |

## 公共准备

按 [README 的启动说明](../../../README.md#run-the-todo-demo)安装依赖，并在不同终端启动 API 和 Web。
API 默认是 `http://127.0.0.1:3000`，Web 地址以 Vite 输出为准。
如果使用其他 API 地址，下面的网络阻止规则也要替换成实际地址。

使用专用测试服务，避免影响其他人的数据。
浏览器与服务端时钟应同步；记录本机时区和语言区域，测试期间不改变它们。
每条用例使用自己的任务名称，不依赖上一条用例留下的数据。
需要准备普通 Todo 时，点击 `New todo`，填写指定的 `Task` 和 `Description`，保持 `Incomplete`、不设截止时间，再点 `Save todo`。
列表中的铅笔按钮是 `Edit todo`，刷新按钮是 `Reload todos`。

### 手工网络控制

网络异常使用 Chrome DevTools，不停止 API，以免丢失测试记录。
测试时保持 DevTools 打开。

- 阻止请求：打开 DevTools 的 `Network request blocking` 面板，启用请求阻止，添加 `*127.0.0.1:3000/todos*`。
  在 Network 中确认请求被浏览器阻止，而不是服务已接收后才断网。
- 恢复请求：取消这条规则或关闭请求阻止。
- 延迟响应：在 Network 的 Throttling 中新增测试配置，下载和上传均为 1000 kbit/s，延迟为 10000 ms。
  这只用于延长观察窗口，不是性能指标。
- 恢复正常网络：关闭请求阻止，并将 Throttling 改回 `No throttling`。

每条网络用例结束后恢复正常网络。
若当前环境不允许使用这些控制，记录受阻的用例及原因，不把它当作通过。
本组不用自动化测试的故障接口，也不要求编写或执行脚本。

### 数据与清理

字段长度用例先在支持字数统计的文本编辑器中准备以下纯 ASCII 文本，不含空格或换行：

| 数据 | 准备方法 | 长度 |
| --- | --- | --- |
| T300 | 将 `0123456789` 连续重复 30 遍。 | 300 |
| T301 | 在 T300 后加一个 `X`。 | 301 |
| D1000 | 将 `0123456789` 连续重复 100 遍。 | 1,000 |
| D1001 | 在 D1000 后加一个 `X`。 | 1,001 |

本 Demo 没有删除 Todo 的入口。
整组结束后，关闭额外标签页并恢复网络设置。
需要清空数据时，只重启专用 API 进程，再重新加载 Web。
API 重启会清空全部内存数据；服务运行期间重新加载或关闭客户端不会清空数据。
持久化到服务重启之后仍是后续目标，不属于本组的通过标准。

## 覆盖边界与后续补充

本组覆盖 Web 的主要用户路径和代表性异常，不代表完整回归或其他平台通过。

- 暂未覆盖：移动端浏览器、键盘与读屏专项、所有 Unicode 字符组合、跨时区与夏令时、精确到期边界、长时间运行和性能。
- 需要更可控的请求时序，才能稳定验证“保存恰好跨过截止时间”的状态冲突，以及旧刷新响应不能覆盖新保存结果。
  本组不把自然等待后的刷新测试当成这些竞态已经覆盖。
  设计依据见 [Todo Expiration Sync](../../../artifacts/collaborations/todo-expiration-sync.md#polling-and-editing)。
- Web 重新加载会触发服务的过期校正，不能仅凭重开页面后看到 `Overdue` 就证明后台监控在无人访问时独立运行。
  后台扫描的独立运行、停止和失败重试需要单独的观察或控制入口，本组未验证。
  依据见 [Todo Expiration Monitor](../../../artifacts/sparks/todo-expiration-monitor.md) 和 [Todo Service：读取校正](../../../artifacts/sparks/todo-service.md#operations)。
- 网络阻止覆盖的是请求未送达的失败，不覆盖服务端写入失败、部分提交或响应丢失后的结果不确定性。
  未使用或虚构人工可用的存储故障开关。
- 不测试重启 API 后数据仍保留；该能力尚未交付，见 [Todo Service：持久化目标](../../../artifacts/sparks/todo-service.md#deferred-persistence)。

执行时另行记录浏览器与构建版本、测试环境、实际结果和问题证据。
本套件只定义步骤和预期结果，不预填通过或失败。
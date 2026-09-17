# Todo Web：截止时间与状态

被测对象：`web-ui`。
开始前阅读[公共准备](README.md#公共准备)，结束后按[数据与清理](README.md#数据与清理)恢复环境。
返回[套件首页与用例索引](README.md#用例索引)。

## WEB-TODO-005 设置、修改和清除截止时间

验证：截止时间可编辑和清除，使用本地时间显示，错误的日期时间阻止提交。

前置：准备无截止时间的 `QA-WEB-005-截止时间`。

来源：[Todo Item：dueAt](../../../artifacts/sparks/todo-item.md)、[Todo Editor：时间输入](../../../artifacts/sparks/todo-editor.md#modal-and-draft)、[Todo App：时间显示](../../../artifacts/sparks/todo-app.md#todos-and-loading)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 编辑该条，在 `Due at` 中填写明天 14:30，保持 `Incomplete` 并保存。 | 列表显示本机时区下明天的日期和 14:30，状态仍为 `Incomplete`。<br>可使用当地的 12 或 24 小时格式，不要求固定日期字符串。 |
| 2 | 重新打开，改成后天 09:15 并保存，再重新加载页面。 | 弹窗和列表显示修改后的时间，没有小时或日期偏移，创建时间不变。 |
| 3 | 编辑该条，点击 `Clear deadline` 并保存。 | 列表显示 `No deadline`，重新打开时截止时间为空，状态仍为 `Incomplete`。 |
| 4 | 重新打开编辑器。<br>在日期时间控件中只填写日期，留空时间，再移出焦点。 | 若控件保留了不完整输入，应显示日期时间错误并阻止保存，不能悄悄清除已保存的数据。<br>若浏览器直接禁止保留不完整值，记录该项无法在此浏览器构造，不当作通过。 |
| 5 | 清除日期时间，再点击 `Cancel`。 | 错误可清除，取消不写入任何修改。 |

## WEB-TODO-006 过去的截止时间与过期恢复

验证：过去的截止时间允许保存，但未完成任务由系统变为过期；恢复必须在截止时间修改成功后发生。

前置：按以下两组分别执行；每组新建自己的记录。

| 组别 | 任务 | 恢复方式 |
| --- | --- | --- |
| 清除 | `QA-WEB-006-清除` | 使用 `Clear deadline`。 |
| 延后 | `QA-WEB-006-延后` | 将截止时间改为明天 14:30。 |

来源：[Todo Item：状态变化](../../../artifacts/sparks/todo-item.md#status-changes)、[Todo Service：保存时处理状态](../../../artifacts/sparks/todo-service.md#operations)、[Todo Editor：过期只读状态](../../../artifacts/sparks/todo-editor.md#validation-and-saving)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 新建本组任务，状态保持 `Incomplete`，截止时间设为昨天 12:00，保存。 | 过去的时间不会被当作无效输入；返回的记录在列表中显示 `Overdue`。 |
| 2 | 打开编辑器，仅修改描述并保存，不改截止时间。 | `Overdue` 为只读，不能手动选择状态；内容仍可编辑并保存，保存后仍为 `Overdue`。 |
| 3 | 再次编辑，按本组方式清除或延后截止时间，但先不要保存。 | 状态仍为只读 `Overdue`，输入变化本身不会立即解锁状态。 |
| 4 | 点击 `Save todo`，成功后重新打开。 | 记录变为 `Incomplete`，时间为本组保存值，创建时间不变。<br>`Incomplete` 和 `Completed` 再次可选。 |
| 5 | 选择 `Completed` 并保存，再重新加载页面。 | 记录保持 `Completed`，此前保存的描述和截止时间仍在。 |

## WEB-TODO-007 已完成任务不自动过期

验证：截止时间已过不改变已完成状态；改回未完成时重新应用截止时间规则。

前置：新建 `QA-WEB-007-完成优先`，截止时间为昨天 12:00，保存前选择 `Completed`。

来源：[Todo Item：完成与过期](../../../artifacts/sparks/todo-item.md#status-changes)、[Todo Service：状态处理](../../../artifacts/sparks/todo-service.md#operations)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 保存，并在后续一次成功刷新后查看记录。 | 记录保持 `Completed`，不是 `Overdue`。 |
| 2 | 编辑记录，保留过去的截止时间，将状态改为 `Incomplete` 并保存。 | 保存后的状态为 `Overdue`；再次编辑时状态只读。 |

## WEB-TODO-008 前台过期刷新保留草稿

验证：服务返回过期状态后，列表和当前状态更新，但未保存的内容、截止时间不被覆盖。

前置：创建 `QA-WEB-008-即将过期`，状态为 `Incomplete`，截止时间选为当前时间之后至少两分钟的一个整分钟。

来源：[Todo App：前台刷新](../../../artifacts/sparks/todo-app.md#todos-and-loading)、[Todo Editor：工作输入](../../../artifacts/sparks/todo-editor.md#modal-and-draft)、[Todo Item：过期条件](../../../artifacts/sparks/todo-item.md#status-changes)、[Todo Expiration Sync：刷新与编辑](../../../artifacts/collaborations/todo-expiration-sync.md#polling-and-editing)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 在截止时间到来前编辑这条记录，将任务改为 `QA-WEB-008-未保存`，描述填 `保留我的输入`，将草稿截止时间改为明天 14:30，并选择 `Completed`。<br>不保存，保持页面在前台。 | 列表仍显示已保存的内容，不提前应用草稿。 |
| 2 | 等待服务时间超过原截止时间，并观察之后一次成功的列表刷新。 | 列表状态变为 `Overdue`，编辑器状态也变为只读 `Overdue`。<br>草稿中的任务、描述和明天的截止时间仍在，弹窗不关闭。<br>不能因为草稿里选过 `Completed` 或延后了时间，就继续手动提交状态。 |
| 3 | 点击 `Cancel`，再打开这条记录。 | 状态仍为 `Overdue`，任务为 `QA-WEB-008-即将过期`，截止时间仍是原时间。<br>取消丢弃草稿，但不会撤销已经发生的系统过期。 |

五秒是轮询节奏，不是到期后界面必须在五秒内变化的承诺。
记录实际观察到的刷新与状态变化；若后续成功刷新仍显示旧状态，再记录问题。
该用例不证明没有客户端请求时后台扫描独立运行，见[套件首页的覆盖边界与后续补充](README.md#覆盖边界与后续补充)。
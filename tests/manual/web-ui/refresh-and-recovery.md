# Todo Web：刷新与异常恢复

被测对象：`web-ui`。
开始前阅读[公共准备](README.md#公共准备)和[手工网络控制](README.md#手工网络控制)，结束后按[数据与清理](README.md#数据与清理)恢复环境。
返回[套件首页与用例索引](README.md#用例索引)。

## WEB-TODO-009 返回前台后同步，保留本地输入

验证：后台页面暂停轮询，返回后刷新已保存数据，不覆盖正在编辑的草稿。

前置：同一浏览器打开两个 Web 标签页 A、B，连接同一个专用 API；准备无截止时间的 `QA-WEB-009-共享`。

来源：[Todo App：前后台刷新](../../../artifacts/sparks/todo-app.md#todos-and-loading)、[Todo Editor：草稿隔离](../../../artifacts/sparks/todo-editor.md#modal-and-draft)、[Todo Expiration Sync：刷新与编辑](../../../artifacts/collaborations/todo-expiration-sync.md#polling-and-editing)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 在 A 编辑该条，将任务改为 `QA-WEB-009-A草稿`，描述改为 `A未保存`，截止时间设为明天 14:30，不保存。 | 只有输入发生变化，记录尚未写入。 |
| 2 | 打开 A 的 DevTools Network，清空记录，切换到 B。<br>在 B 将已保存任务改为 `QA-WEB-009-B已保存`，描述改为 `B已保存`，状态设为 `Completed` 并保存。<br>保持 B 在前台至少 12 秒。 | B 的修改保存成功；A 的同步结果在返回后检查。 |
| 3 | 返回 A，并查看 A 的 Network 时间记录。 | A 在后台期间没有持续发起新的列表轮询；切换前已发出的请求可以结束。<br>返回后发起列表刷新，不需要用户点击刷新按钮。 |
| 4 | 等待返回后的刷新成功。 | A 的列表显示 B 已保存的名称、描述和 `Completed`。<br>A 的弹窗仍开着，任务、描述和明天的截止时间仍是 A 的草稿，不被 B 的数据覆盖。 |
| 5 | 在 A 取消，再次打开该记录。<br>检查后关闭 B，避免影响后续用例。 | 编辑器从 B 已保存的数据重新初始化，A 的草稿被丢弃。 |

## WEB-TODO-010 首次加载失败后重试

验证：加载失败与空集合有区别，恢复后可以读取原记录。

前置：服务中已有 `QA-WEB-010-加载恢复`；API 始终保持运行。

来源：[Todo App：首次加载](../../../artifacts/sparks/todo-app.md#todos-and-loading)、[Todo Service：读取](../../../artifacts/sparks/todo-service.md#operations)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 启用 Todo 请求阻止，然后重新加载 Web 页面。 | 页面本身能打开，Todo 请求被阻止后显示 `Could not load todos` 和 `Retry`。<br>不把失败显示为 `No todos yet`。 |
| 2 | 取消请求阻止，点击 `Retry`。 | 列表重新加载成功，显示已保存的记录，错误消失，可以新建或编辑。<br>若自动重试已先恢复，记录恢复结果，无需为找回按钮再次制造故障。 |

## WEB-TODO-011 刷新失败不清空列表或草稿

验证：已有数据的刷新失败保留快照和输入，后续轮询能恢复。

前置：准备无截止时间的 `QA-WEB-011-原记录`，并打开编辑器，将任务改成 `QA-WEB-011-草稿`，不要保存。

来源：[Todo App：刷新失败](../../../artifacts/sparks/todo-app.md#todos-and-loading)、[Todo Expiration Sync：草稿保留](../../../artifacts/collaborations/todo-expiration-sync.md#polling-and-editing)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 启用 Todo 请求阻止，保持 Web 在前台，等待一次列表刷新失败。 | 显示 `Could not refresh todos.` 和 `Retry refresh`。<br>原列表未清空，弹窗仍在，草稿未丢失。 |
| 2 | 取消请求阻止，不点击重试，等待后续一次列表轮询成功。 | 错误消失，列表仍显示原记录，草稿仍为未保存值。 |
| 3 | 点击 `Cancel` 关闭弹窗并放弃草稿，再次阻止请求。<br>等刷新错误出现后取消阻止，点击 `Retry refresh`。 | 可以手动恢复；若自动刷新已先成功，错误和重试按钮可以已经消失。 |
| 4 | 重新加载页面。 | 记录仍为 `QA-WEB-011-原记录`，网络恢复没有把草稿写入。 |

## WEB-TODO-012 保存失败后保留输入并重试

验证：明确没有送达服务的保存失败不修改原记录，重试可保存同一份草稿。

前置：准备无截止时间的 `QA-WEB-012-原记录`，描述为 `原描述`，记录其创建时间。

来源：[Todo App：保存结果](../../../artifacts/sparks/todo-app.md#editing-and-saving)、[Todo Editor：失败与重试](../../../artifacts/sparks/todo-editor.md#validation-and-saving)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 编辑记录，将任务改为 `QA-WEB-012-重试成功`，描述改为 `重试后保留`，截止时间设为明天 14:30，状态选 `Completed`。<br>启用 Todo 请求阻止，再点击 `Save todo`。 | 发起保存；失败后的表现见步骤 2。 |
| 2 | 在 Network 确认保存请求被浏览器阻止。 | 弹窗显示保存错误，没有以成功方式关闭。<br>输入的任务、描述、截止时间和状态都保留，恢复为可继续编辑或重试的状态。<br>列表不显示这次草稿内容。 |
| 3 | 取消请求阻止，直接再次点击 `Save todo`。 | 保存成功，弹窗关闭，原记录更新为草稿内容，没有新增重复记录。 |
| 4 | 重新加载页面并打开该条。 | 修改后的四项值仍在，创建时间没有改变。 |

## WEB-TODO-013 保存中禁止重复提交和关闭

验证：保存尚未完成时不能重复提交、编辑输入或关闭弹窗，列表不提前更新。

前置：正常连接服务；打开新建弹窗，填写 `QA-WEB-013-只创建一次`，不设截止时间。

来源：[Todo App：等待保存](../../../artifacts/sparks/todo-app.md#editing-and-saving)、[Todo Editor：保存中保护](../../../artifacts/sparks/todo-editor.md#validation-and-saving)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 启用延迟配置，在 `Save todo` 上连续点击两次。 | 进入 `Saving`，按钮不可再次提交，输入控件不可编辑。<br>列表不因点击保存就提前显示草稿。<br>如果保存仍在等待时列表已出现记录，应在 Network 中确认已有一次成功的列表刷新返回了该记录。 |
| 2 | 在 Network 确认保存请求仍处于等待状态，再尝试 `Cancel`、`Close editor`、Escape 和点击弹窗外空白处。 | 按钮不可用，其他关闭方式也不会关闭弹窗或丢弃输入。<br>新建的创建时间仍为 `Not created yet`。 |
| 3 | 等待保存响应完成。 | 成功后弹窗关闭，列表只出现一条该任务，并显示服务返回的创建时间。 |
| 4 | 恢复正常网络，重新加载页面。 | 仍只有一条该任务。<br>若步骤 2 的请求过快结束，不能据此判断保护有效，应重新准备独立数据并在真正等待时检查。 |
# Todo Web：新建与编辑

被测对象：`web-ui`。
开始前阅读[公共准备](README.md#公共准备)，结束后按[数据与清理](README.md#数据与清理)恢复环境。
返回[套件首页与用例索引](README.md#用例索引)。

## WEB-TODO-001 空列表、新建和重新加载

验证：从空列表创建一条 Todo，默认值正确，保存后可重新加载。

前置：专用 API 刚启动，集合为空。

来源：[Todo App：加载与保存](../../../artifacts/sparks/todo-app.md#todos-and-loading)、[Todo Editor：草稿](../../../artifacts/sparks/todo-editor.md#modal-and-draft)、[Todo Item：字段](../../../artifacts/sparks/todo-item.md)、[Todo Service：数据生命周期](../../../artifacts/sparks/todo-service.md#saved-data)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 启用[延迟配置](README.md#手工网络控制)，打开 Web。<br>加载完成后恢复正常网络。 | 请求未完成时显示 `Loading todos`，不能新建。<br>请求成功后显示 `No todos yet`，没有错误提示。 |
| 2 | 点击 `New todo`。 | 任务和描述为空，状态为 `Incomplete`，截止时间为空，创建时间显示 `Not created yet`。<br>创建时间不可输入，`Save todo` 不可用。 |
| 3 | 输入任务 `QA-WEB-001-新建`，描述留空，不设截止时间，点击 `Save todo`。 | 保存成功后弹窗关闭，列表只新增一条该任务。<br>状态为 `Incomplete`，`Due at` 为 `No deadline`。<br>`Created at` 显示本机时区下本次创建的日期、小时和分钟。 |
| 4 | 记录创建时间，点击 `Reload todos`，再重新加载浏览器页面。 | 记录仍在，任务、状态和创建时间未改变，没有重复记录。 |
| 5 | 再次打开 `New todo`。<br>检查后点击 `Cancel` 关闭。 | 显示新建默认值，没有上一条输入残留。 |

## WEB-TODO-002 编辑内容和手动状态

验证：编辑更新原记录，完成状态可切换，创建时间不变。

前置：准备 `QA-WEB-002-原始`，描述为 `原始描述`，无截止时间。

来源：[Todo App：保存](../../../artifacts/sparks/todo-app.md#editing-and-saving)、[Todo Editor：提交](../../../artifacts/sparks/todo-editor.md#validation-and-saving)、[Todo Item：字段与状态](../../../artifacts/sparks/todo-item.md)、[Todo Service：更新](../../../artifacts/sparks/todo-service.md#operations)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 记录列表中的创建时间和记录数量，点击该条的 `Edit todo`。 | 弹窗显示已保存的任务、描述和状态，创建时间只读且与列表一致。 |
| 2 | 将任务改为 `QA-WEB-002-已修改`，描述改为 `修改后描述`，选择 `Completed`。 | 弹窗外的列表仍显示原值，不因输入而提前更新。 |
| 3 | 点击 `Save todo`，成功后重新加载页面。 | 原位置显示修改后的任务、描述和 `Completed`。<br>记录数量不变，原任务名称不再出现，创建时间不变。 |
| 4 | 再次编辑，将状态改回 `Incomplete` 并保存。 | 状态变为 `Incomplete`，内容和创建时间保留，没有新增记录。 |

## WEB-TODO-003 放弃未保存的输入

验证：取消和其他关闭方式都不写入草稿，重新打开使用当前已保存的数据。

前置：准备 `QA-WEB-003-保留`，描述为 `不要改动`，无截止时间；当前没有保存请求。

来源：[Todo App：取消](../../../artifacts/sparks/todo-app.md#editing-and-saving)、[Todo Editor：草稿与关闭](../../../artifacts/sparks/todo-editor.md#validation-and-saving)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 编辑该条，将任务改为 `QA-WEB-003-不应保存`，修改描述，选择 `Completed`，填写明天的截止时间。 | 已显示的列表内容不变。 |
| 2 | 点击 `Cancel`，重新打开这条记录。 | 任务、描述、状态和截止时间仍为原值，没有草稿残留。 |
| 3 | 重新修改输入，分别使用右上角 `Close editor`、Escape 键、点击弹窗外空白处关闭。<br>每种方式从重新打开原记录开始执行。 | 均能在未保存时关闭；再次打开和重新加载页面后，记录仍为原值。 |
| 4 | 打开 `New todo`，填写 `QA-WEB-003-取消新建` 后取消，再重新打开新建弹窗。 | 列表没有这条任务，新建弹窗恢复空输入和默认值。 |

## WEB-TODO-004 必填和长度边界

验证：错误输入可见但不能保存，达到长度上限仍能保存，超长输入不被静默截断。

前置：准备 T300、T301、D1000、D1001；打开新建弹窗。
长度数据的准备方法见[数据与清理](README.md#数据与清理)。

来源：[Todo Item：字段规则](../../../artifacts/sparks/todo-item.md)、[Todo Editor：输入校验](../../../artifacts/sparks/todo-editor.md#validation-and-saving)。

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1 | 让 `Task` 为空并移出焦点，再输入三个普通空格并移出焦点。 | 两种输入均提示任务必填，`Save todo` 不可用，列表没有新增记录。 |
| 2 | 用 T301 替换任务。 | 计数为 `301 / 300`，末尾的 `X` 仍在，显示超长错误，不能保存。 |
| 3 | 删除末尾的 `X`，保留 T300；描述留空，保存后重新打开记录。 | 300 字符的任务保存成功，描述可以为空，重新打开仍显示 `300 / 300`。 |
| 4 | 将描述设为 D1001。 | 计数为 `1001 / 1000`，文本未截断，显示描述错误，不能保存。 |
| 5 | 删除描述末尾的 `X`，保留 D1000 并保存，再重新加载并编辑该条。 | 保存成功，任务为 300 字符，描述为 1,000 字符，文本完整，没有错误。 |
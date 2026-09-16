# SparkWell：AI Coding 时代的软件工程方法思考

> **关于软件理解、Intent、Review 与持续演进的一次实验**

## 1. 为什么会有这个项目

过去几年，AI Coding 的能力提升得非常快。

从早期的代码补全，到现在的 Coding Agent，我们已经越来越习惯这样的开发方式：

```text
Requirement
    ↓
Coding Agent
    ↓
Code
```

对于很多任务，这种方式已经非常有效。

我们可以给 Agent 一个需求，让它：

- 阅读现有代码；
- 修改多个文件；
- 增加新的组件；
- 更新数据模型；
- 补充测试；
- 修复编译错误；
- 运行测试；
- 根据失败结果继续修改。

随着模型能力继续提升，一个 Agent 一次可以完成的工作量还会越来越大。

这带来了一个很自然的问题：

> **当代码越来越容易生成以后，软件工程里真正困难的部分会变成什么？**

我越来越觉得，未来的瓶颈可能不再只是：

> “如何把需求实现成代码？”

而会越来越变成：

> **“如何持续理解这些被快速生成和修改的软件？”**

SparkWell 就是从这个问题开始的。

---

# 2. 写代码本身曾经是理解软件的过程

在传统软件开发中，工程师通常经历：

```text
理解需求
    ↓
设计
    ↓
写代码
    ↓
调试
    ↓
修改
```

这个过程当然很慢，但它有一个经常被忽略的副作用：

> **工程师在实现软件的过程中，也在不断建立对软件的 mental model。**

当你亲手实现一个模块时，你通常会自然知道：

- 为什么存在这个模块；
- 哪部分负责什么；
- 数据从哪里来；
- 状态在哪里变化；
- 哪些地方互相依赖；
- 哪些设计是刻意选择的；
- 改一个东西可能影响哪些地方。

也就是说：

```text
Implementation Work
        ↓
Software Understanding
```

两件事情过去是高度绑定的。

但 AI Coding 正在把它们拆开。

未来越来越可能是：

```text
Requirement
    ↓
Agent
    ↓
大量 Implementation
```

代码确实被完成了。

但人并没有经历产生这些代码的整个思考过程。

于是出现了一个新的 gap：

```text
Implementation grows quickly

Human understanding grows much more slowly
```

---

# 3. 代码生成速度开始超过人的理解速度

假设 Coding Agent 一次修改：

```text
20 files
3000 lines of code
several tests
a new data model
multiple error paths
```

它可能：

- 编译成功；
- tests 全部通过；
- observable behavior 也符合需求。

但是工程师仍然可能面对一个问题：

> **我到底理解刚刚发生了什么吗？**

当然，我们可以读 diff。

但随着 Agent 一次完成的任务越来越大，只依赖逐行阅读代码可能变得越来越困难。

这不是因为代码本身“不重要”。

恰恰相反，是因为：

> **代码越来越多，而人的 attention 没有同步增加。**

所以 AI Coding 可能让软件工程出现一个新的稀缺资源：

> **Comprehension bandwidth。**

也就是人能够理解、review 和判断一个系统的能力。

---

# 4. Code 能表达 Implementation，但未必能完整表达 Intent

代码最擅长表达：

> **How does it work?**

但代码并不总是容易表达：

> **Why does it work this way?**

例如我们在代码里看到：

```text
if todoCount >= 100
```

实现非常清楚。

但仅从这段代码，我们不一定知道：

```text
100 是 Free Tier 的产品限制？
性能保护？
数据库限制？
临时 workaround？
历史遗留值？
```

同样，一段 retry logic 可以告诉我们：

```text
失败后最多 retry 三次
```

但不一定告诉我们：

> 为什么是三次？  
> 哪类错误应该 retry？  
> 这个行为是不是产品承诺？  
> 如果以后 implementation 重写，这个规则是否还应该存在？

随着系统不断变化：

```text
Implementation survives
Intent can fade
```

我们以前通过：

- PRD；
- Design Doc；
- Comments；
- Issues；
- PR Discussions；

来保存这些信息。

这些方式当然仍然有价值。

但它们经常存在一个共同问题：

> **它们更像某个时间点产生的 documents，而不是持续维护的 current model。**

---

# 5. AI Coding 时代，我们是否还需要理解 Implementation？

这里其实存在一个更根本的问题。

未来有没有可能变成：

```text
Requirement
    ↓
Agent
    ↓
Black-box Implementation
    ↓
Evaluation / Tests
```

人只需要验证最终行为，而不再理解软件内部实现？

我认为对于某些简单软件，这完全可能。

但对于很多长期存在的真实系统，尤其是：

- enterprise software；
- reliability-sensitive systems；
- security-sensitive systems；
- 多人长期协作的代码库；
- 大规模 distributed systems；
- 不断演进的产品；

我们大概率仍然需要回答：

```text
系统为什么这样设计？
真正重要的组件有哪些？
哪些状态由谁维护？
这里为什么要 retry？
这个 rule 在哪些地方成立？
改这里可能影响什么？
某个 failure 是局部 bug，还是 architecture problem？
```

Tests 可以告诉我们：

> 某些 observable behavior 是否正确。

但不一定能替代：

> **对系统内部结构和设计责任的理解。**

所以我的一个基本假设是：

> **AI 不会让 Software Understanding 消失；相反，当 Implementation 越来越自动生成时，Software Understanding 可能会变得更重要。**

---

# 6. 现在的软件知识其实分散在很多地方

一个成熟的软件系统，其真正的 knowledge 通常分布在：

```text
Source Code
Tests
PRD
Design Docs
Issues
Pull Requests
Chat / Email
Monitoring
Developers' memory
```

没有一个地方真正完整。

代码通常是最接近 current truth 的部分。

但代码的结构主要是为了：

> **让机器执行。**

它并不一定是：

> **最适合人建立 mental model 的结构。**

例如，一个 `Response Processing` 的概念，可能实际分散在：

```text
Streaming handler
Message reducer
Tool execution
Retry logic
Network layer
State management
```

从 source tree 的角度，它们可能完全分开。

但从人的理解角度，它们共同回答的是一个问题：

> **系统是如何处理一次 Response 的？**

这就是 SparkWell 最初想探索的地方。

---

# 7. 如果代码不是最好的认知模型，我们是否需要另一层模型？

SparkWell 的一个核心假设是：

> **人理解软件时使用的 conceptual structure，不一定应该和代码结构完全一致。**

例如代码可能是：

```text
src/
  ui/
  hooks/
  stores/
  services/
  reducers/
  utils/
```

而一个工程师理解软件时，脑子里的结构可能更像：

```text
Conversation
    ↓
Response Processing
    ├── Streaming
    ├── Tool Execution
    └── Error Recovery
```

或者：

```text
Authentication
    ├── Login
    ├── Session
    ├── Token Refresh
    └── Authorization
```

SparkWell 希望显式维护这样一层：

> **Human-oriented software model。**

这不是要替代代码。

而是：

```text
Human-understandable model
          ↕
      Implementation
```

两者长期保持关联。

---

# 8. Spark：按照人的理解边界，而不是代码边界建模

SparkWell 里最核心的概念叫 **Spark**。

一个 Spark 表示：

> **一个值得人单独理解、讨论、Review 或修改的软件概念。**

例如：

```text
Todo Editor
Todo Store
Conversation State
Response Processor
Sync Coordinator
```

Spark 不要求和下面这些东西一一对应：

```text
File
Class
Function
React Component
Service
```

因为我们希望 Spark 的 boundary 是：

> **Human reasoning boundary。**

例如 `Response Processor` 可能由十几个文件共同实现。

反过来，一个很大的 source file 里也可能包含多个不同的 Spark。

所以：

```text
Code structure
≠
Human cognitive structure
```

这是 SparkWell 一个很重要的出发点。

---

# 9. Spark 不是“给每个 Class 写文档”

一个很容易出现的误解是：

> SparkWell 是不是要给所有代码再维护一份 documentation？

不是。

如果这样做，SparkWell 只会制造更多维护成本。

例如下面这些通常都不应该独立成为 Spark：

```text
Save Button
Loading Spinner
Helper Function
Small React Hook
```

但下面这些可能值得：

```text
Offline Synchronization
Response Processing
Authentication Lifecycle
Todo Editing
Conversation State
```

一个简单的判断标准是：

> **如果这个东西发生变化，人会不会希望把它作为一个独立概念来讨论“它发生了什么变化”？**

如果答案是 Yes，它可能是一个有价值的 Spark。

因此：

> **More documentation is not the goal.**

目标是：

> **保存那些真正影响人理解软件的知识。**

---

# 10. Spark 是 Model，不只是 Document

Spark 可以使用 Markdown 来表达。

例如：

```text
Todo Editor

Purpose:
Edit an existing Todo.

Behavior:
Editing operates on a draft.

Save:
Validate and persist the draft.

Cancel:
Discard the draft without modifying persisted data.
```

但 Markdown 只是它的 representation。

更重要的是 Spark 有：

```text
Stable Identity
Relationships
Knowledge
Implementation Links
```

因此 Spark 更接近：

> **一个软件模型中的 node。**

而不是：

> 一篇孤立的文档。

这使得我们可以建立：

```text
Todo Editor
    ↓ uses
Todo Draft
    ↓ uses
Todo Store
```

然后进行：

- navigation；
- context building；
- impact analysis；
- model review。

---

# 11. 为什么 Stable Identity 很重要

AI Coding 很可能让 implementation 变化得越来越快。

例如：

```text
Version 1
Redux + reducers

Version 2
Local state + service

Version 3
Different framework
```

代码文件、class、function 全部可能变化。

但：

```text
Conversation State
```

这个 conceptual responsibility 仍然存在。

所以我们希望：

```text
Concept Identity
    >
Implementation Identity
```

也就是说：

> implementation 可以不断被 AI 重写，但人的 mental model 不应该每次都从零开始。

这是我认为 SparkWell 很重要的一个价值。

---

# 12. 不同知识不一定都应该塞进 Spark

随着讨论深入，我们发现：

> “软件知识”并不全部具有相同的形态。

如果强迫所有东西都叫 Spark，最终：

```text
Spark = anything worth documenting
```

那 Spark 这个概念反而会失去意义。

所以目前我们正在探索几种不同的 knowledge artifact。

---

## Spark：一个软件概念

回答：

> **What is this concept?**

例如：

```text
Todo Editor
Todo Store
Response Processor
```

---

## Constraint：必须持续成立的条件

例如：

```text
Todo description must be less than 1000 characters.
```

这个 rule 可能同时影响：

```text
Todo Editor
Todo Import
Validation
API
```

如果把它复制到所有地方，会产生重复和 drift。

因此可以让 Constraint 自己成为 canonical knowledge。

它回答：

> **What must remain true?**

---

## Aspect：横切多个概念的 Concern

例如：

```text
Accessibility
Localization
Authorization
Privacy
Telemetry
```

比如：

```text
所有 user-facing UI 都必须支持 screen reader。
```

如果项目有几十个 UI Spark，我们不希望把同一句话复制几十次。

更自然的是：

```text
Accessibility Aspect
        ↓
applies to relevant UI Sparks
```

它回答：

> **What concern applies across which concepts?**

这个思路来自 AOP，但我们的目的不是 code weaving，而是：

> **管理 cross-cutting knowledge。**

---

## Collaboration：多个 Sparks 如何共同工作

有些重要知识既不是一个 component，也不是一个 constraint。

例如 Todo Editing：

```text
Todo Editor
    ↓
Todo Draft
    ↓
Validation
    ↓
Todo Store
```

真正重要的是：

```text
Editing modifies Draft.

Save validates and persists Draft.

Cancel discards Draft.

If persistence fails, keep Draft for retry.
```

简单的 dependency edge：

```text
A uses B
```

并不能完整表达这种：

```text
Sequence
State
Failure path
Coordination
```

因此我们也在探索一种 Collaboration representation，用来回答：

> **How do these concepts work together?**

---

# 13. Requirement 可能不需要成为另一套永久模型

我们最初曾经设计过：

```text
Requirement
    ↓
Product Spark
    ↓
Solution Spark
    ↓
Code
```

因为我们觉得：

> Requirement 本身也非常重要，不能在 Agent 完成代码之后就消失。

这个出发点我仍然认为是对的。

但后来我们开始 challenge：

> Requirement 是否一定要成为一个独立的 persistent ontology？

例如：

```text
用户可以编辑 Todo
```

它最终可能自然成为：

```text
Todo Editor 的 Behavior
```

而：

```text
Description < 1000
```

可能成为：

```text
Constraint
```

而：

```text
所有 UI 支持 screen reader
```

可能成为：

```text
Accessibility Aspect + Constraint
```

因此现在更倾向于：

> **Requirements are inputs. Accepted requirements become maintained model knowledge.**

也就是说：

```text
Requirement
Idea
Feedback
Code Change
      ↓
Understand
      ↓
Update Current Model
```

而不是一定维护一个完整的 Requirement Registry。

---

# 14. 我们主要维护 Current Truth，而不是复制全部历史

软件开发当然需要 history。

但是我们已经有：

```text
Git
PR
Issue
Commit
Discussion
```

SparkWell 没有必要重新发明一套完整历史系统。

我们更希望 model 回答：

> **系统现在是什么样？**

所以：

```text
Current accepted knowledge
    → SparkWell Model

Historical evolution
    → Git / PR / Issues
```

这样可以让 model 保持相对干净。

---

# 15. Knowledge 只维护一次，但应该从任何需要的地方看到

这里还有一个很重要的设计。

假设 Accessibility 定义在：

```text
Accessibility Aspect
```

我们不希望在每一个 UI Spark 中复制：

```text
Accessibility
```

否则很快就会出现：

```text
duplicate knowledge
outdated references
inconsistent documents
```

所以我们希望：

> **每一份知识只有一个 canonical owner。**

但是，当打开 `Todo Editor` 时，人又必须能看到：

```text
Todo Editor

Own Knowledge
...

Depends On
...

Constraints
- Todo Description Length

Aspects
- Accessibility
- Localization

Collaborations
- Todo Editing

Implementation
...
```

也就是说：

```text
Knowledge stored once
        ↓
Graph / Index resolves relationships
        ↓
Visible from every useful direction
```

我们把这个概念叫：

```text
Resolved Spark Context
```

它可能最终比单独一个 Markdown Spark 文件更重要。

---

# 16. Change Impact：Graph 不是用来自动传播修改，而是缩小 Review 范围

SparkWell 的 graph 还有另一个用途：

> **帮助判断一个 change 可能影响哪里。**

例如：

```text
Todo description max length
1000 → 500
```

可能涉及：

```text
Todo Editor
Import
Validation
Tests
```

但 SparkWell 不应该机械地说：

```text
Constraint changed
→ all related Sparks must change
```

正确方式应该是：

```text
Change / Diff
      ↓
Graph finds impact candidates
      ↓
Semantic analysis
      ↓
Update or Skip
```

我们之前总结成：

> **The graph determines what should be checked.**  
> **The diff determines what changed.**  
> **Semantic judgment determines what actually needs updating.**

Graph 的作用不是替代判断。

而是：

> **减少人和 Agent 需要重新理解整个 codebase 的范围。**

---

# 17. 为什么不直接用 PRD / Design Doc？

这也是一个很自然的问题。

传统 PRD 和 Design Doc 很有价值。

但它们通常是：

```text
Document-centric
```

例如：

```text
Architecture-v2.docx
Design.md
PRD.md
```

问题是随着系统持续变化，容易出现：

```text
Document at time T
        ≠
Current System
```

SparkWell 更希望建立：

```text
Model-centric knowledge
```

每个概念具有：

```text
Stable ID
Current knowledge
Relationships
Resolved context
Implementation links
```

然后我们可以从 model 生成很多 human-friendly view：

```text
Architecture overview
Flow diagram
Requirement view
Interaction view
Impact view
```

也就是我们之前讨论过的：

> **Store once, view many ways.**

---

# 18. 为什么采用 Natural Language，而不是复杂 DSL？

如果要做 software model，很自然会想到定义大量 schema：

```text
transition:
event:
condition:
sideEffect:
input:
output:
...
```

但这样很容易重新走向：

```text
UML / formal modeling language
```

维护成本会迅速上升。

SparkWell 的一个重要原则是：

> **Schema the topology, not the knowledge.**

也就是说：

结构化：

```text
Identity
Relationship
Type
Scope
```

而实际知识仍然主要用：

```text
Natural language
Tables
Diagrams
State machines
Examples
```

表达。

原因是：

> 人和 AI 都已经非常擅长理解自然语言。

我们只把那些需要 graph / tooling 处理的部分结构化。

---

# 19. AI 不只是产生这个问题，也可能让这个方案第一次变得可行

传统软件工程里一直有人尝试：

```text
Architecture Documentation
UML
Formal Design Models
Traceability
```

这些方法最大的问题之一是：

> **维护成本很高。**

一旦 documentation 和 code 不一致，人很快就会停止相信 documentation。

但 AI 同时改变了另一件事情：

> **维护软件知识模型的成本可能大幅下降。**

Agent 可以：

```text
read diff
   ↓
understand semantic changes
   ↓
find affected Sparks
   ↓
propose model updates
   ↓
human review
```

所以 SparkWell 的一个重要假设其实是：

> **以前这种 maintained software model 可能太贵，但在 AI 时代，它可能第一次变得经济可行。**

这也是为什么这个想法现在值得重新尝试。

---

# 20. SparkWell 和 Coding Agent 不是竞争关系

SparkWell 并不是想替代：

```text
Copilot
Claude Code
Codex
Cursor
Other Coding Agents
```

Coding Agent 解决的是：

> **How do we implement this?**

SparkWell 更关心：

```text
What are the important concepts?
Why does this design exist?
What must remain true?
How do these concepts work together?
What should we inspect when something changes?
```

因此更接近：

```text
               SparkWell Model
                  ↕
Requirements → Coding Agent → Code
                  ↕
                Tests
```

理想情况下，SparkWell 应该和现有 Agent 配合，而不是建立另一套 code generation system。

---

# 21. 我们和 Spec-Driven Development 的关注点也不完全一样

现在有很多方法在探索：

```text
Requirement
    ↓
Spec
    ↓
Plan
    ↓
Agent
    ↓
Code
```

这类方法主要解决：

> **在 coding 之前，如何给 Agent 更好的输入和结构。**

SparkWell 更关注的是另一个 lifecycle 问题：

```text
Software exists
    ↓
changes repeatedly
    ↓
implementation keeps evolving
    ↓
how do humans keep understanding it?
```

也就是说：

> Spec 更偏向 **before implementation**。  
> SparkWell 更关注 **throughout software evolution**。

两者并不冲突。

---

# 22. Todo Demo

为了验证这些想法，我做了一个非常小的 Todo Demo。

选择 Todo 不是因为 Todo 本身复杂。

恰恰相反，是因为它足够简单：

> 我们可以把注意力放在方法本身，而不是业务复杂度上。

Demo 主要想让大家观察：

```text
Maintained Software Knowledge
            ↕
         Sparks
            ↕
          Code
```

之间是否真的形成了有价值的关系。

---

# 23. 看 Demo 时，希望大家重点 Challenge 的问题

我现在并不想证明 SparkWell 已经是正确答案。

相反，我希望通过 Demo challenge 几个假设。

### 1. Spark 是否真的比直接读 Code 更容易建立 mental model？

如果不是，那么这套东西没有足够价值。

---

### 2. Spark 的粒度是否自然？

有没有：

```text
too large
too small
too close to code structure
```

的问题？

---

### 3. 哪些知识值得长期维护？

是不是只有少数：

```text
Responsibility
Constraint
Cross-cutting concern
Collaboration
```

值得保存？

还有没有别的类型？

---

### 4. 维护成本会不会再次变成传统 documentation 的问题？

这是我认为最重要的风险之一。

如果每一次代码改动都要求人同时维护很多文档，这个方法不会成功。

它必须依赖 AI 把大部分同步成本降下来。

---

### 5. Change Impact 是否真的有帮助？

如果：

```text
Todo Editing
explicit Save
    ↓
autosave
```

SparkWell 是否真的能帮助我们快速判断：

```text
哪些 concepts 需要检查？
哪些 implementation 可能改变？
哪些东西其实无关？
```

---

### 6. 如果系统大 100 倍，这个模型是否更有价值？

Todo 很小，直接读代码当然很容易。

真正的问题是：

> **如果这是一个几百万行、几年历史、多人维护、并且大量代码由 Agent 生成的系统，这种 model 会不会变得有价值？**

这才是 SparkWell 真正想验证的场景。

---

# 24. SparkWell 当前最大的风险

这个方向也有几个非常明显的风险。

第一：

> **Model 可能只是另一份 Documentation。**

如果它经常过时，就没有价值。

第二：

> **Ontology 可能越来越复杂。**

如果我们最后发明几十种 artifact、relationship 和 rule，开发者不会愿意使用。

所以我们一直在主动删除不必要的概念。

第三：

> **未来可能根本不需要 Human Understanding。**

如果 AI 最终能够完全管理 implementation，人只验证 behavior，那么 SparkWell 解决的问题可能会逐渐缩小。

第四：

> **Model 的维护收益可能低于维护成本。**

这也是 Demo 必须验证的，而不是理论上假设它有价值。

---

# 25. 我目前最核心的判断

如果把整个项目压缩成一句话：

> **AI 正在让代码生成越来越便宜，但软件理解并没有因此自动变便宜。**

而过去：

```text
Writing Code
≈
Building Understanding
```

未来越来越可能变成：

```text
Generating Code
≠
Building Human Understanding
```

SparkWell 想探索：

> **我们是否可以在 AI-generated code 旁边维护一层面向人的、持续更新的软件认知模型，让人仍然能够理解、Review 和有意识地演进软件。**

这就是目前这个项目最核心的假设。

---

# 26. 我希望从这次内部讨论得到什么

这个项目现在还处于非常早期的探索阶段。

我目前更希望得到的是 challenge，而不是“这个 idea 看起来不错”这样的反馈。

特别希望大家帮忙判断：

- 你是否也观察到了 AI Coding 带来的 understanding gap？
- 你是否认为未来工程师仍然需要理解 implementation？
- 如果需要，Spark 这种 human-oriented model 是否是合理方向？
- 哪些知识最值得长期维护？
- 哪些东西根本不应该放进 model？
- 你觉得这种方法最大的维护成本在哪里？
- 什么样的真实工作场景最适合验证它？
- 在我们现有的大型代码库中，有没有特别适合做实验的模块？

如果我们连“问题是否真实存在”都不能得到认同，那应该先停下来重新思考。

如果问题存在，但 SparkWell 的 solution 不对，那么也应该尽早发现。

Todo Demo 的目的，就是让这些讨论从抽象观点变成一个可以具体 challenge 的实验。
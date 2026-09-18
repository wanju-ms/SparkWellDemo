# SparkWell：Brownfield、Descriptive Spark 与 Generative Spark 的完整结论

这轮讨论主要解决了一个之前没有真正想清楚的问题：

> **Spark 与 Existing Code 到底是什么关系？**

尤其是在现有项目中，Spark 不可能简单地成为 Source Code 的镜像，也不应该要求所有 Code 都能够从 Spark 中重新生成。

从一个真实的 `App.tsx` 例子出发，逐渐形成了下面这些结论。

---

# 1. Spark 不是 Source Code 的镜像

例如一个已有 React App 的入口：

```tsx
<ErrorBoundary>
  <DocumentTitle />
  <ClarityInit />
  <SidebarProvider>
    <PermissionSync>
      <VersionUpdateNotification />
      <NoAccessNotification />
      <AppRoutes />
    </PermissionSync>
  </SidebarProvider>
</ErrorBoundary>
```

如果把每个 Component 都机械转换成 Spark：

```text
App
├── ErrorBoundary
├── DocumentTitle
├── ClarityInit
├── SidebarProvider
├── PermissionSync
├── VersionUpdateNotification
├── NoAccessNotification
└── AppRoutes
```

这种 Spark Graph 几乎没有价值。

因为 Source Code 本身已经表达得更准确、更简单。

因此：

> **Spark Graph ≠ Source Tree**

Spark 不应该对应每个 File、Class、Function 或 Component。

---

# 2. Spark 应该提供 Semantic Compression

Spark 的价值应该是把大量 Implementation Detail 压缩成人真正需要理解的软件 Concept。

例如上面的实现可能有 8 个 Components，但人的 Mental Model 可能只有：

```text
Application Runtime
├── Error Handling
├── Permission Management
├── Navigation
└── Global UI State
```

Spark 的判断标准不应该是：

> “这个文件存在吗？”

而应该是：

> **“这个 Concept 是否值得 Engineer 独立理解、讨论、Review 和修改？”**

因此可以引入一个很重要的判断原则：

> **Does this Spark provide semantic compression?**

如果一个 Spark 只是把 Source Code 换一种形式重新描述一次，它大概率不应该存在。

---

# 3. 不是所有 Code Unit 都需要 Spark

对于 `App.tsx` 中的：

```text
DocumentTitle
ClarityInit
VersionUpdateNotification
NoAccessNotification
```

这些很可能只是 implementation details，不需要独立 Spark。

但像：

```text
Permission Synchronization
Application Error Handling
Navigation
```

如果它们具有独立的责任、行为和 Intent，就可能值得成为 Spark。

因此可能存在这样的关系：

```text
Spark                           Implementation

Application Runtime      →     App.tsx

Permission Synchronization
                         →     PermissionSync.tsx
                               usePermissions.ts
                               permissionService.ts

Application Error Handling
                         →     ErrorBoundary.tsx
                               telemetry
                               fallback UI
```

也就是说：

> **一个 Spark 可以对应多个 Files。**

同时：

> **一个 File 也可能参与多个 Sparks。**

Spark 与 Code 不是 1:1 映射。

---

# 4. `ui / logic / service / data` 不应该成为强制分类

真实软件 Concept 往往跨 Implementation Layer。

例如：

```text
Permission Synchronization
```

同时可能涉及：

- UI
- state
- API
- auth
- service
- data

如果强迫它只能选择：

```text
ui
logic
service
data
```

反而会失真。

因此 Spark Type 应该被弱化。

更合理的是：

```yaml
tags:
  - authorization
  - state
  - service
```

而 Spark 真正的重要属性应该是：

```text
Name
Responsibility
Intent
Behavior
Relationships
Implementation Mapping
```

也就是说：

> **Spark 是 Human Cognitive Concept，而不是 Implementation Layer。**

---

# 5. Spark 不应该是 Code 的完整可逆表示

这里出现了一个非常重要的问题：

如果 Spark 比 Code 高层很多，那么它显然没有包含所有 Implementation Detail。

因此不能假设：

```text
Spark → Code
```

可以无损重建现有实现。

如果为了做到这一点，不断把 Implementation Detail 填进 Spark，Spark 最终会变得和 Code 一样复杂。

这样 Spark 就失去意义了。

因此 SparkWell 不应该被设计成一种：

```text
Spark = Source Language
Code = Compiled Output
```

的编译器模型。

---

# 6. Brownfield 项目的正确更新方式

对于现有系统，正确模式不是：

```text
Updated Spark
    ↓
Regenerate Code
```

而应该是：

```text
Current Spark
    +
Accepted Spark Diff
    +
Existing Code
    ↓
Agent
    ↓
Code Diff
```

也可以简化为：

> **Spark Diff + Existing Code → Code Diff**

但更完整地说，Agent 实际需要的是：

```text
Current Spark
+
Spark Diff
+
Implementation Mapping
+
Existing Code
+
Repository Conventions
↓
Code Diff
```

其中：

- Spark 描述 **What / Why**
- Existing Code 描述 **How currently**
- Agent 负责把 semantic change 映射到当前 realization

因此：

> **Spark controls semantics; Code provides realization context.**

---

# 7. Existing Code 应该默认被保留

Brownfield Change 的基本原则应该是：

> **Preserve existing implementation structure unless the accepted Spark change requires otherwise.**

也就是默认追求：

```text
Minimal Semantic Change
        +
Minimal Structural Disturbance
```

而不是：

```text
New Spark
→ Rewrite implementation
```

这样可以避免 Agent 因为一次小 Requirement：

- 重写 architecture
- 改文件结构
- 改 naming
- 顺手 refactor 大量无关代码

---

# 8. Spark 必须是真实的 Semantic Model

讨论中出现了一个很重要的反例：

假设一个 Spark 里面写的是一篇完全无关的故事。

然后只在最后新增一句：

```text
Permission synchronization failure should support retry.
```

理论上 Agent 仍然可能依靠：

```text
Existing Code + 这一句 Diff
```

正确实现 retry。

但这并不说明 Spark 是有效的。

因为：

> **“能不能用 Spark Diff 生成正确 Code Diff”不能成为 Spark 是否正确的标准。**

Spark 本身必须对当前软件具有真实意义。

---

# 9. Spark 与 Code 应保持 Semantic Consistency

Spark 不需要包含 Code 的所有细节。

例如 Code 可能包含：

```text
React Query
useEffect
retry count
backoff
telemetry
AbortController
cache invalidation
```

Spark 只需要：

```text
Permission Synchronization

- Keeps client permissions aligned with server state.
- Synchronization happens after authentication.
- Failure does not invalidate the current session.
- Retry is supported.
```

这完全可以。

因此：

```text
Code
= semantic behavior
+ implementation details
```

Spark 只保存其中对 Human Understanding 有价值的 semantic knowledge。

但有一个要求：

> **Spark 不能与 Code 在它已经描述的语义上矛盾。**

例如 Spark 说：

```text
Cancel discards the draft.
```

但 Code 实际上：

```text
Cancel persists the draft.
```

那么 Model 已经 drift。

---

# 10. SparkWell 需要 Model ↔ Code Consistency

因此更准确的关系不是：

```text
Code → Spark → Code
```

而是：

```text
            Spark Model
               ↕
       semantic consistency
               ↕
             Code
```

可以形式化成：

```text
S ≈ abstraction(C)
```

其中：

- `S` = Spark Model
- `C` = Current Code

不要求 `S` 能重建 `C`。

只要求：

> **S 是 C 在 Human-relevant semantics 上的可信抽象。**

发生变化：

```text
S + ΔS → S'
C + S + ΔS → C'
```

之后仍然需要满足：

```text
S' ≈ abstraction(C')
```

---

# 11. SparkWell 需要 Consistency Check

这意味着未来一个重要能力是：

> **Spark ↔ Code Consistency Check**

例如：

```text
Spark:
Cancel discards draft.

Code:
Cancel persists draft.

→ Possible inconsistency
```

或者：

```text
Spark:
Permission retry is supported.

Code:
No retry path found.

→ Possible inconsistency
```

反过来也可能发现：

```text
Code introduced a major new behavior
but no related Spark changed.

→ Possible model drift
```

这正面回答了传统 Documentation 最大的问题：

> **文档会不会很快过期？**

SparkWell 的一个核心价值必须是尽量发现这种 drift。

---

# 12. Descriptive 与 Generative 不是完全不同的 Spark 类型

接下来进一步发现：

不是所有 Spark 都完整到足以生成新 Implementation。

因此应该区分：

## Descriptive Spark

主要目标：

> **可信地描述当前软件最重要的 semantic knowledge。**

例如：

```text
Permission Synchronization

Responsibility:
Keep effective client permissions aligned with server state.

Important behavior:
- Synchronization happens after authentication.
- Failure does not invalidate current session.

Implementation:
- PermissionSync.tsx
- usePermissions.ts
- permissionService.ts
```

它足够用于：

- Human Understanding
- Review
- Spark Diff
- Change Traceability
- Agent Context
- Test Case Generation
- Change Impact reasoning

但不一定完整到可以：

```text
Spark → 从零生成完整 iOS App
```

---

## Generative Spark

Generative Spark 包含更完整、platform-neutral 的 semantic knowledge。

例如：

```text
Todo Editing

- Editing uses a draft.
- Save validates and commits.
- Cancel discards.
- Save failure preserves the draft.
- Validation rules...
```

这种 Spark 可能足够用于：

```text
             Spark
          /    |    \
         ↓     ↓     ↓
       Web    iOS  Android
```

因此：

> **Generative = contains enough semantic information to bootstrap a new realization.**

---

# 13. Generative 不是永久 Type，而是一种 Capability

进一步讨论后发现：

`descriptive` / `generative` 更像 completeness 状态，而不是固定 Spark Type。

一个 Spark 可以：

```text
Descriptive
    ↓
逐渐补充
    ↓
Generative
```

之后又因为 Code 发生了未同步变化：

```text
Generative
    ↓
manual code change
    ↓
model drift
    ↓
Generative guarantee lost
```

同步之后：

```text
Code Diff
    ↓
Proposed Spark Diff
    ↓
Human Review
    ↓
Consistency restored
```

于是它重新成为可信的 Generative Model。

因此：

> **Generative is a capability / guarantee, not a permanent type.**

---

# 14. Trustworthiness 与 Completeness 是两个维度

这两个概念必须分开。

## Trustworthiness

回答：

> Spark 是否真实反映当前 Implementation？

## Completeness

回答：

> Spark 是否完整到足以生成一个新的 realization？

于是存在：

| | Incomplete | Complete |
|---|---|---|
| **Consistent** | Trusted Descriptive | Trusted Generative |
| **Inconsistent** | Stale Descriptive | Generative guarantee lost |

这很重要，因为：

> 一个 Spark 可以完全正确，但仍不足以生成 iOS。

例如：

```text
Application Runtime
```

可以 100% 正确描述当前 Web App。

但它没有描述完整 UI、interaction、state lifecycle 等，因此仍然：

```text
trustworthy = yes
generative = no
```

---

# 15. 所有 Spark 都应该 Trustworthy，但不一定 Generative

可以形成一个非常重要的原则：

> **All Sparks should be trustworthy.  
> Not all Sparks need to be generative.**

中文：

> **所有 Spark 都应该真实反映软件语义，但不是所有 Spark 都必须完整到足以生成新的 Implementation。**

这让 SparkWell 不需要为了“可生成”而把所有细节都塞进 Model。

---

# 16. 人可以直接手工修改 Code

SparkWell 不应该要求：

> “以后只能改 Spark，不能直接改 Code。”

真实软件工程里，人仍然可以：

```text
Engineer
    ↓
Manually edit Code
    ↓
Code Diff
```

然后 SparkWell 可以做：

```text
Code Diff
    ↓
Agent analyzes semantic change
    ↓
Compare with current Spark
    ↓
Proposed Spark Diff
    ↓
Human Review
```

因此变化可以从两边发起：

```text
Spark → Code
Code → Spark
```

更准确的原则是：

> **Change can originate from either the model or the implementation; SparkWell helps keep them semantically synchronized.**

---

# 17. 不是所有 Code Change 都需要回写 Shared Spark

进一步又发现：

即使手工修改 Code，也不一定需要修改 Shared Spark。

例如：

```text
Shared Spark:
Todo Editing

- Save commits draft.
- Cancel discards draft.
```

Web 中加入：

```text
Double-click title enters edit mode.
```

这可能只是 Web-specific interaction。

iOS 并不存在 Double-click。

因此不应该污染 shared semantic model。

---

# 18. Shared Semantics 与 Platform-specific Realization Knowledge 要区分

更合理的结构是：

```text
             Shared Spark
            /     |      \
           /      |       \
        Web      iOS    Android
     realization realization realization
```

Shared Spark 保存：

```text
platform-independent semantics
```

例如：

```text
Editing can be entered.
Cancel discards uncommitted changes.
Save commits changes.
```

Web-specific knowledge 可以是：

```text
Double-click title enters edit mode.
```

iOS-specific knowledge 可以是：

```text
Tap Edit button enters edit mode.
```

因此：

> **Not every implementation change is a shared model change.**

而应该判断：

```text
Is this:
1. Shared semantic change?
2. Platform-specific realization change?
3. Pure implementation detail?
```

只有第一类一定需要更新 Shared Spark。

---

# 19. Generative Spark 也不应该每次重新生成全部 Code

这是另一个重要结论。

即使 Spark 是 Generative，也不能假设每次重新生成都会得到完全相同的 Code。

Agent 可能改变：

- 文件拆分
- naming
- local abstraction
- library usage
- state placement
- formatting
- helper structure

因此：

> **Generative 不等于 deterministic regeneration。**

Generative 的真正含义是：

> **Spark 包含足够的软件语义，可以从零创建一个有效的新 realization。**

---

# 20. Bootstrap 与 Evolution 应该采用不同模式

对于一个全新的 platform realization：

```text
Generative Spark
      ↓
Generate from scratch
      ↓
New iOS / Web / Android implementation
```

这叫：

> **Bootstrapping a realization**

但一旦 realization 已经存在，之后不应该不断重新生成。

应该使用：

```text
Spark Diff
    +
Existing Web Code
    ↓
Web Code Diff
```

或者：

```text
Spark Diff
    +
Existing iOS Code
    ↓
iOS Code Diff
```

因此：

> **Generation is for bootstrapping.  
> Diff-based transformation is for evolution.**

---

# 21. Spark 负责 Semantic Stability，Code 负责 Realization Stability

这是这轮讨论里很重要的一个总结。

```text
Spark
→ semantic stability

Existing Code
→ realization stability
```

Spark 保证：

- Concept
- Intent
- Important behavior
- Relationships
- Semantic constraints

长期稳定。

Existing Code 保留：

- architecture choices
- file structure
- platform conventions
- optimizations
- implementation details
- human refinements

长期连续。

于是：

```text
Current Spark
    +
Spark Diff
    +
Existing Code
    ↓
Minimal Code Diff
```

就成为更合理的演进方式。

---

# 22. Descriptive Spark 仍然解决大部分 SparkWell 原始问题

即使一个 Spark 不能从零生成完整 Implementation，它仍然可以解决很多原来的问题。

| 问题 | Descriptive Spark 是否适用 |
|---|---|
| Human Mental Model | 是 |
| Agent 对 Requirement 理解偏差 | 是 |
| Spark Diff Review | 是 |
| PR 中解释 Code Change 原因 | 是 |
| Requirement → Spark → Code Traceability | 是 |
| Test Case Diff | 是 |
| Context / Intent Preservation | 是 |
| Knowledge Reuse | 是 |
| Black-box Implementation | 是 |
| Engineer Expertise 沉淀 | 是 |
| Change Impact reasoning | 是 |
| Many Views | 是 |
| Many Realizations | 不一定 |
| 从零生成完整新 Platform | 不一定 |

因此 Generative 并不是 SparkWell 存在的必要条件。

---

# 23. SparkWell 的主要价值需要重新表述

之前容易说：

> Spark 是一个更高层的模型，可以生成 Code。

现在更准确的是：

> **Spark 是一层长期、可信、Human-oriented 的 semantic software model。**

它可以用于：

```text
Understand
Review
Change
Explain
Trace
Validate
Generate
```

其中 `Generate` 是其中一个能力，而不是唯一价值。

更进一步：

> **Spark 是 Human 和 Agent 围绕软件语义进行沟通的共同层。**

---

# 24. Greenfield 与 Brownfield 的工作流

## Greenfield

如果 Spark 足够完整：

```text
Requirement
    ↓
Spark Graph
    ↓
Human Review
    ↓
Generate Initial Implementation
```

例如 Todo Demo。

---

## Brownfield

现有系统更现实的流程：

```text
Existing Code
    ↓
Agent-assisted abstraction
    ↓
Candidate Descriptive Sparks
    ↓
Human Review
    ↓
Accepted Spark Model
```

之后的 Change：

```text
Requirement
    ↓
Spark Diff
    ↓
Human Review
    ↓
Spark Diff + Existing Code
    ↓
Code Diff
```

如果人直接改 Code：

```text
Manual Code Diff
    ↓
Semantic Analysis
    ↓
Does this affect Shared Spark?
        ├── No → keep Spark unchanged
        └── Yes → propose Spark Diff
```

---

# 25. 最终的统一模型

这轮讨论之后，SparkWell 更准确的模型可以表达为：

```text
                     Requirement
                         ↓
                    Spark Change
                         ↓
                     Spark Diff
                         ↓
                    Human Review
                         ↓
                  Accepted Semantics
                         ↓
              ┌──────────┴──────────┐
              ↓                     ↓
      Existing Realization     New Realization
              ↓                     ↓
 Spark Diff + Existing Code    Generative Spark
              ↓                     ↓
          Code Diff             Initial Code
              ↓                     ↓
              └──────────┬──────────┘
                         ↓
                 Implementation
                         ↓
              Semantic Consistency
                         ↕
                    Spark Model
```

而手工修改 Code 也可以进入同一个 Loop：

```text
Manual Code Change
        ↓
Semantic Analysis
        ↓
Shared semantic change?
   ├── No
   │    ↓
   │ Platform / implementation-only
   │
   └── Yes
        ↓
Proposed Spark Diff
        ↓
Human Review
```

---

# 26. 当前最重要的设计原则

可以把这轮讨论最终压缩成这些原则。

### Spark Graph ≠ Source Tree

不要机械映射 File / Class / Component。

### Semantic Compression

Spark 必须比 Code 更容易建立 Mental Model。

### Human Cognitive Boundary

Spark 的边界由“人是否值得把它作为独立 Concept 理解”决定。

### Trustworthy First

所有 Spark 都应该真实反映当前软件语义。

### Generative Is Optional

不是所有 Spark 都必须完整到可以生成新 Implementation。

### Spark Is Not a Compiler IR

Spark 不需要完整表达所有 implementation semantics。

### Existing Code Matters

Brownfield Change 应该基于：

```text
Spark Diff + Existing Code → Code Diff
```

### Preserve Realization Continuity

已有实现默认保持结构稳定，只做必要修改。

### Model and Code Must Stay Semantically Consistent

Spark 与 Code 可以包含不同粒度的信息，但不能在共有语义上矛盾。

### Change Can Start From Either Side

既可以：

```text
Spark → Code
```

也可以：

```text
Code → Spark
```

### Not Every Code Change Is a Shared Spark Change

要区分：

```text
Shared semantic change
Platform-specific realization change
Implementation-only change
```

### Generation for Bootstrap, Diff for Evolution

新平台可以从 Generative Spark 初始化。

已有平台后续应该：

```text
Spark Diff + Existing Code → Code Diff
```

### Spark Stabilizes Meaning; Code Stabilizes Realization

Spark 负责长期语义。

Code 负责具体实现连续性。

---

# 27. 一句话总结

这轮讨论之后，SparkWell 不再应该被理解成：

> **“用 Spark 替代 Code，或者从 Spark 重建 Code。”**

更准确的是：

> **SparkWell 在 Code 之上维护一层可信、面向人的 Semantic Model；Spark 保存软件的 Concept、Intent 和重要行为，Code 保存具体 Realization。新实现可以从足够完整的 Spark 启动，而已有实现则通过 Spark Diff + Existing Code 的方式持续演进，并通过 semantic consistency 保持 Model 与 Code 对齐。**

这个模型既允许：

```text
One Model → Many Realizations
```

也允许：

```text
Existing Realization → Stable Evolution
```

同时避免把 Spark 变成另一份比 Source Code 更复杂的 Documentation。
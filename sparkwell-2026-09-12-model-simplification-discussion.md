# SparkWell：关于 Product Spark、Requirement、Aspect、Constraint 与 Collaboration 的进一步收敛

> 日期：2026-09-12
>
> 本文总结今天关于 SparkWell 模型简化的一轮讨论。重点不是给出最终定案，而是记录我们如何从原来的 **Product Spark → Solution Spark → Implementation** 三层思路，重新审视 Product Spark 和 Requirement 是否真的需要成为一等模型，并进一步讨论了 **Constraint、Aspect、Collaboration、Resolved Context** 等概念。
>
> 这轮讨论的核心背景是：Sparkwell 的主要目标之一不是“帮助 LLM 生成代码”，而是让人能够持续理解正在构建的软件，并在变化发生时保留可 review、可解释、可追踪的知识。

---

# 1. 起点：Product Spark + Solution Spark + Implementation 是否太复杂？

此前我们已经形成了一个相对完整的模型：

```text
Requirement
    ↓
Product Spark
    ↓
Solution Spark
    ↓
Implementation
```

其中：

- **Product Spark** 保存当前产品需求和产品概念；
- **Solution Spark** 保存软件内部值得长期理解的软件结构、职责、状态和协作；
- **Implementation** 是具体代码、测试和技术实现。

但今天重新 challenge 了一个问题：

> 如果每次从需求到代码都必须经历 Product → Solution → Code 三个阶段，这个流程是否过重？

这个担心是合理的，因为每多一个串行 transformation，都多一次 interpretation：

```text
Requirement
   ↓ interpretation #1
Product
   ↓ interpretation #2
Solution
   ↓ interpretation #3
Code
```

每一步都可能：

- 漏掉信息；
- 引入错误假设；
- 改变原始语义；
- 增加维护成本；
- 增加用户操作步骤。

因此，一个重要结论是：

> **“存在多个知识模型”不等于“用户必须手工经历多个生成步骤”。**

即使最终仍保留 Product / Solution / Code 三种 representation，工作流也不一定必须是三个显式阶段。

一种更轻的工作方式可以是：

```text
Change / Requirement
        ↓
      Understand
        ↓
Update affected representations

- Product, if product truth changed
- Solution, if enduring design changed
- Code, if implementation changed
```

也就是说，Agent 可以在一次 task 里同时维护多个 representation，而不是要求用户依次执行：

```text
/product-design
/solution-design
/implement
```

从工作流角度看，一个更合理的未来体验可能是：

```text
Tell SparkWell what changed.
```

然后由 Agent 判断：

```text
Product needs update?   yes / no
Solution needs update?  yes / no
Code needs update?      yes / no
```

---

# 2. 如果目标只是生成代码，其实连 Product Spark 都不需要

这轮讨论里进一步明确了一个重要事实：

> 如果 SparkWell 的目标只是“把需求变成代码”，那么 Product Spark 和 Solution Spark 都不是必要条件。

最直接的方式永远可以是：

```text
Requirement
   ↓
LLM / Coding Agent
   ↓
Code
```

现代 coding agents 本来就在做这件事。

因此，SparkWell 的价值不能建立在：

> “多加几个中间层可以帮助 LLM 生成代码。”

这不是一个足够强的理由。

SparkWell 更重要的目标应该是：

> **让人持续理解产品和软件，而不是只让 Agent 更容易生成实现。**

因此，我们重新区分了几个问题：

```text
Product Model
    What are we building?

Software / Solution Model
    How does the software work as a system?

Implementation
    How is that design concretely realized?
```

在这个视角下：

- Product knowledge 的价值主要是帮助人理解当前产品承诺；
- Solution knowledge 的价值主要是帮助人理解软件内部结构、职责和协作；
- Code 是具体实现。

一个重要原则是：

> **Generation is secondary. Comprehension is primary.**

---

# 3. Solution Spark 为什么仍然有明显价值？

相比 Product Spark，今天对 Solution Spark 的必要性仍然更有信心。

原因是复杂软件的代码通常会分散在很多文件、函数、类、框架结构和 plumbing 中。

例如一个 AI Chat 产品，产品上可能只说：

```text
- Supports streaming responses
- Supports tool calls
- Supports retry
- Supports cancel
```

但实现可能散落在几十个文件中。

人真正需要理解的是：

```text
Chat UI
   ↓
Conversation Coordinator
   ↓
Response Processor
   ├── Streaming State
   ├── Tool Execution
   └── Error Recovery
```

这种“比 code 更高一层，但又比产品需求更接近软件内部”的认知模型，是 Solution Spark 最初想承担的职责。

因此：

> **Solution Spark 的核心价值不是 code generation，而是 human software understanding。**

也就是说，如果最终保留 Solution Spark，它不应该变成“代码前置文档”，更不应该机械映射：

```text
one class = one Spark
one file = one Spark
```

而应该只保存：

> **人为了理解和修改系统，值得长期掌握的软件概念和职责。**

例如：

```text
Response Processing
Authentication Flow
Sync Strategy
Caching Model
Permission Evaluation
Conversation Lifecycle
```

---

# 4. Product Spark 的必要性开始受到更强 challenge

今天进一步追问：

> Product Spark 来保留需求，真的有必要吗？
> 为什么 requirement 必须 modeling 成 Spark？

最初引入 Product Spark 的真正动机，并不是已经证明了“需求必须 Spark 化”。

更准确地说，当时的判断是：

> **需求本身非常重要，不能只把 requirement 当作一次性输入。**

我们希望有一个 canonical、持久、当前有效的 product truth，而不是让需求只存在于：

- 原始聊天；
- ticket；
- issue；
- PRD；
- 用户脑子里；
- 已经生成的代码里。

因此我们引入 Product Spark，试图把“需求管理”也纳入 SparkWell。

但是，这里其实有两个独立问题：

1. **是否需要维护当前 canonical requirements？**
2. **这个 canonical representation 是否必须是 Product Spark Graph？**

今天的结论是：

> 第一个问题大概率是 Yes；第二个问题还没有被证明。

换句话说：

> 我们真正强的 conviction 是“需求不能只是一次性 input”，而不是“需求必须拆成 Product Sparks”。

---

# 5. 如果有 Solution Spark，当前需求是否可以从 Solution 中推导？

讨论中提出：

> 如果 Solution Spark 足够完整，当前需求是不是也可以从 Solution Spark 里推导出来？

答案是：

> **部分可以，但不能保证完整、稳定地推导。**

例如 Solution 里写：

```text
Todo Editor
- edits a draft
- Save commits the draft
- Cancel discards it
```

我们可以反推出：

```text
用户编辑 Todo 时：
- Save 保存
- Cancel 不保存
```

但有些 requirement 不一定自然对应一个软件 component 或 software responsibility：

```text
Free users can create at most 100 todos.

The product should support screen readers.

Users must see an explanation before deleting all data.
```

这些要求最终必须在 implementation 中体现，但它们往往是 **cross-cutting** 或 **distributed** 的。

例如：

```text
Free users can create at most 100 todos.
```

可能同时体现于：

- UI 状态；
- creation flow；
- domain validation；
- server validation；
- tests。

Accessibility requirement 可能分散在大量 UI 节点。

Delete-all confirmation 可能涉及：

- 入口；
- confirmation UI；
- destructive action flow；
- state；
- tests。

因此：

> **Requirement 最终会进入实现，但实现结果可能散落在多个位置。**

这意味着：

> 单纯从代码或 Solution 反推 requirement，在理论上可能，但语义并不稳定。

代码告诉你：

```text
if count >= 100 ...
```

但不一定告诉你：

> “100 是 Free Tier 的 product commitment。”

因此 requirement 的“统一语义”仍然有价值。

---

# 6. 我们更需要 Requirement History，还是 Current Requirements？

今天也明确区分了：

```text
Current Requirements
vs.
Requirement History
```

更重要的是：

> **当前需求。**

开发和修改软件时，Agent 和人最常问的是：

> 产品现在应该是什么样？

而不是：

```text
三个月前曾经考虑过什么？
后来又为什么改？
```

历史当然仍然有价值，但 Git / PR / issue / discussion 已经很适合保存历史。

因此：

```text
Current accepted model
    → maintained project knowledge

History / old requirements
    → Git / PR / issue / source records
```

SparkWell 的主模型应该优化：

> **current truth**

而不是成为一个 change log。

---

# 7. Requirement ID：是否可以只给特殊 Requirement？

随后讨论了一个更轻的方案：

> 不再把所有 requirement 都建模成 Product Sparks，而是把一些跨多个 Sparks 的 requirement 单独列出来，给稳定 Req ID，然后让 Solution Sparks 引用。

例如：

```markdown
# Requirements

## REQ-001 — Free todo limit

Free users can create at most 100 todos.

## REQ-002 — Accessibility

The product must support screen readers.

## REQ-003 — Delete-all confirmation

Before deleting all user data, the product must explain the consequences
and require explicit confirmation.
```

然后：

```yaml
requirements:
  - REQ-001
```

这样可以建立：

```text
Requirement
   ↓
multiple Solution Sparks
```

这特别适合：

- accessibility；
- privacy；
- global limits；
- compliance；
- security；
- data retention；
- performance commitment。

---

# 8. 但没必要维护一份“完整 Requirement Registry”

随后进一步 challenge：

> 是否真的有必要把所有需求都放进一个完整的 requirement list？

结论倾向于：

> **没有必要。**

很多局部 requirement 有一个非常自然的 owning concept。

例如：

```text
Save closes Todo Editor.
Cancel discards unsaved changes.
Profile page shows avatar.
```

这些 requirement 直接写在对应 Spark 里就足够了。

没有必要重复成：

```text
REQ-101
REQ-102
REQ-103
```

否则又产生两份需要同步的知识。

因此形成了一个重要原则：

> **不是每条 requirement 都需要成为独立 entity。每条知识应该有一个 canonical owner。**

例如：

```text
"Save closes Todo Editor"
    → owner: Todo Editor Spark

"Free users can create at most 100 todos"
    → may need independent owner because it affects multiple concepts
```

---

# 9. Local Intent 与 Cross-cutting Intent

于是我们一度形成了这样的划分：

```text
Product Intent
│
├── Local intent
│     owned directly by a Spark
│
└── Cross-cutting / global intent
      independently represented
      and related to multiple Sparks
```

这降低了 Product Spark 层的必要性。

因为大量 requirement 可能直接属于：

- Todo Editor；
- Conversation；
- Response Processor；
- Todo model；
- other meaningful software concepts。

只有无法自然归属单个 concept 的知识，才需要单独的 artifact。

---

# 10. AOP 思路：Accessibility / i18n 等 Cross-cutting Concerns

我们回忆起早期讨论过的 AOP / Aspect 思路，尤其适合：

```text
Accessibility
Localization / i18n
Authorization
Privacy
Telemetry
Audit
```

这些 requirement 的特点不是简单“影响很多 Sparks”，而是：

> **同一种 concern，以相似的语义横切多个彼此独立的概念。**

例如：

```text
Accessibility
   ├→ Todo List
   ├→ Todo Editor
   ├→ Settings
   └→ Profile
```

而不是在每个 Spark 里重复写：

```yaml
aspects:
  - accessibility
```

或者重复 requirement 正文。

AOP 给我们的主要启发不是 code weaving，而是：

> **把横切 concern 自己作为一个有作用范围的知识 artifact。**

---

# 11. Aspect 应该表达什么？

讨论中逐步明确：

```text
Aspect
    = a cross-cutting concern + applicability scope
```

例如：

```text
Accessibility Aspect
    applies to all user-facing UI
```

或：

```text
Localization Aspect
    applies to user-visible text
```

这里 Aspect 的重点是：

> **Where does this concern apply?**

而具体要求“必须满足什么”可能仍然属于 Constraint。

---

# 12. Constraint 与 Aspect 不是同一维度

今天一个很重要的收敛是：

> **Aspect 和 Constraint 不应该互相替代。**

例如：

```text
All user-visible text must be localizable.
```

可以拆成两个知识维度：

```text
Aspect:
Localization

Constraint:
User-visible strings must not be hard-coded in a way that prevents localization.

Scope:
all user-facing UI
```

Constraint 回答：

> **What must remain true?**

Aspect 回答：

> **Which cross-cutting concern applies where?**

因此：

```text
Constraint ≠ Aspect
```

Aspect 可以组织一组相关 constraints，并管理它们作用于哪些 Sparks。

---

# 13. 小范围 Constraint 不应该强行变成 Aspect

例如：

```text
Todo description must contain fewer than 1000 characters.
```

它可能影响：

- Todo Editor；
- Todo Validation；
- Todo Import；
- API validation。

但它并不是一个类似 Accessibility / Localization 的横切 concern。

它更自然地属于：

```text
Todo domain constraint
```

因此：

```text
Todo description < 1000
    → Constraint
```

而不是：

```text
Length Limit Aspect
```

是否使用 Aspect，不应该由：

> “影响几个 Spark”

决定，而应该由：

> “这是不是一种可重复、横切多个独立概念的 concern”

决定。

因此：

```text
same concern applies broadly
    → Aspect

specific invariant affects several concepts
    → Constraint
```

---

# 14. 应用关系存哪里？是否需要每个 Spark 引用 Aspect？

最初考虑：

```text
Aspect
    applies-to → Sparks
```

而不是让每个 Solution Spark 都写：

```yaml
aspects:
  - accessibility
```

原因是双向手工维护容易导致：

- 一边更新、一边忘记；
- duplicate source of truth；
- graph drift。

因此 canonical relationship 最好只维护一次：

```text
Aspect / Constraint
    → affected Sparks
```

但是马上发现一个问题：

> 打开一个 Spark 时，如果它自己不写 aspect / constraint，就不容易知道有哪些外部规则作用在它身上。

---

# 15. Canonical Storage 与 Human View 应该分开

因此进一步提出：

> **关系只需要 canonical 存储一次，但查看 Spark 时应该显示 resolved reverse context。**

例如 canonical source：

```text
Accessibility Aspect
    applies-to → Todo Editor

Todo Description Constraint
    applies-to → Todo Editor
```

用户打开 Todo Editor 时，Sparkwell 动态显示：

```text
Todo Editor

Own knowledge
- ...

Uses
- Todo

Used by
- ...

Applied Constraints
- Todo Description Length

Applied Aspects
- Accessibility
- Localization
```

也就是说：

```text
stored relation
Aspect / Constraint → Spark

        ↓ reverse index / graph resolution

display
Spark ← Aspect / Constraint
```

因此：

> **用户两边都看得到，但 source of truth 只维护一边。**

---

# 16. Spark Document 与 Resolved Spark Context

这一点进一步导出了两个概念：

## Spark Document

表示：

```text
这个 Spark 自己拥有的 canonical knowledge
+
canonical relationships
```

## Spark Context

表示工具为人或 Agent 动态解析出来的完整有效上下文：

```text
Spark Document
+
incoming relationships
+
applicable constraints
+
applicable aspects
+
collaborations
+
implementation links
+
other resolved context
```

这可能是 SparkWell 非常重要的体验：

> **A Spark view should show its effective context, not only what is written in its own file.**

例如未来：

```text
sparkwell show todo-editor
```

可以展示：

```text
Todo Editor
────────────────────────

Own Knowledge
...

Uses
  Todo

Used By
  Todo Application

Constraints
  Todo Description Length

Aspects
  Accessibility
  Localization

Collaborations
  Todo Editing

Implementation
  ...
```

这比简单 Graph Viewer 更接近“帮助人理解软件”的目标。

---

# 17. 是否应该弱化 Requirement 这个概念？

在 Aspect / Constraint 逐步明确之后，进一步提出：

> 既然很多 requirement 最终会成为 Spark knowledge、Constraint 或 Aspect，那是否还需要保留 Requirement 作为持久的一等 artifact？

当前倾向是：

> **应该弱化 Requirement，甚至可以从核心 ontology 中拿掉。**

不是因为 requirement 不重要，而是因为：

> **Requirement 更像 change input，而不是最终维护的知识类型。**

例如：

```text
Raw requirement:
"User can edit Todo."
    → Spark behavior

Raw requirement:
"Description < 1000."
    → Constraint

Raw requirement:
"All UI must support screen readers."
    → Accessibility Aspect + Constraint
```

因此更统一的 pipeline 是：

```text
requirements / ideas / feedback
             ↓
         understand
             ↓
   accepted model knowledge
```

而 accepted knowledge 根据性质变成：

```text
concept / responsibility / behavior
    → Spark

invariant / limit / commitment
    → Constraint

cross-cutting concern
    → Aspect

history / external source
    → provenance
```

---

# 18. Requirement 作为 Input，而不是 Persistent Entity

因此形成了一个更简洁的原则：

> **Requirements are inputs. Accepted requirements become model knowledge.**

这样：

```text
Requirements
Ideas
Feedback
Code Changes
```

都可以视为：

```text
Change Inputs
```

经过理解和 review 后更新 canonical model。

这与 SparkWell overview 中已经存在的一句话高度一致：

> Requirements, ideas, and feedback are change inputs.

---

# 19. Requirement History 如何处理？

如果 Requirement 不再是一等 artifact，就不需要建立复杂 lifecycle：

```text
draft → accepted → superseded → deprecated
```

至少 V0 不需要。

而是：

```text
Current accepted model
    → Sparks / Constraints / Aspects / Collaborations

History
    → Git / PR / issue / original source
```

如果某条当前 knowledge 来自外部 ticket、法规或需求系统，可以保留 provenance：

```yaml
sources:
  - GH-123
  - ADO-48219
```

Provenance 回答：

> 这条知识从哪里来的？

而不是要求 Sparkwell 再维护一个完整 Requirement object system。

---

# 20. 另一个问题：跨多个 Sparks 的设计模式怎么办？

今天还提出了另一类明显跨多个 Spark 的知识：

> 一个设计模式或软件行为可能涉及多个 components，它们之间的协作关系本身也值得保存。

例如：

```text
Todo Editor
    ↓
Todo Draft
    ↓
Todo Validator
    ↓
Todo Store
```

或者：

```text
Subject
  ├→ Observer A
  ├→ Observer B
  └→ Observer C
```

这和 Aspect 不一样。

Aspect 是：

> 同一个 concern 横切多个独立概念。

而这里是：

> 多个概念通过协作共同实现一个有意义的软件行为。

---

# 21. Relationship Edge 不足以表达复杂 Collaboration

单纯 graph edge 可以表达：

```text
A uses B
B uses C
```

但很难表达：

- 为什么需要这些 components；
- 调用/状态的顺序是什么；
- Save / Cancel semantics；
- failure path；
- retry；
- conflict；
- 每个 participant 的角色。

例如 Todo Editing：

```text
Edit
 ↓
Todo Draft
 ↓
Validate
 ├─ invalid → stay in editor
 └─ valid
      ↓
    Persist
      ├─ fail → keep draft
      └─ success → close editor
```

这种知识是：

> **interaction / collaboration semantics**

而不是简单 dependency topology。

---

# 22. 最初考虑：把 Collaboration 也建成 Spark

一开始提出：

```text
Todo Editing [behavior Spark]
```

正文保存：

```text
Participants:
- Todo Editor
- Todo Draft
- Todo Validator
- Todo Store

Flow:
- Editing modifies TodoDraft.
- Save validates and persists.
- Cancel discards the draft.
- Save failure preserves the draft.
```

这样可以生成：

- flow diagram；
- sequence diagram；
- state machine；
- responsibility view。

打开 Todo Editor 时，也可以显示：

```text
Participates in:
- Todo Editing
```

这有一个重要价值：

> 如果整个协作机制从 explicit save 变成 autosave，变化的其实不是某一个 component，而是 “Todo Editing” 这套 interaction model 本身。

因此 collaboration 有稳定 identity 是有意义的。

---

# 23. 但为什么一定要把 Collaboration 叫 Spark？

随后进一步 challenge：

> 如果 Aspect 和 Constraint 都是独立 artifact，为什么 collaboration 一定要硬塞进 Spark？

这个质疑成立。

如果 Spark 的定义越来越宽：

```text
component
workflow
state machine
design pattern
collaboration
product concept
...
```

最后 Spark 很容易退化成：

> “anything worth documenting”

这样 Spark 本身会失去清晰语义。

因此，当前更倾向于：

> **Collaboration 不必强制成为 Spark，可以是一种独立的 relationship-centric knowledge artifact。**

---

# 24. 一个新的候选模型：四类 Knowledge Artifacts

今天最后逐渐形成了一个更统一的模型：

```text
Sparkwell Model
│
├── Sparks
│     independently meaningful software concepts / responsibilities
│
├── Constraints
│     invariants / commitments that must remain true
│
├── Aspects
│     cross-cutting concerns and their applicability scope
│
└── Collaborations
      meaningful interactions among multiple Sparks
```

它们分别回答不同问题：

| Artifact | 核心问题 |
|---|---|
| **Spark** | What is this concept? |
| **Constraint** | What must remain true? |
| **Aspect** | What concern applies across which concepts? |
| **Collaboration** | How do these concepts work together? |

这种划分比“什么都是 Spark”更锋利。

---

# 25. Spark

Spark 表示一个：

> **independently meaningful software concept / responsibility**

典型：

```text
Todo Editor
Todo Store
Response Processor
Conversation State
Sync Coordinator
```

Spark 回答：

```text
这个概念是什么？
为什么存在？
负责什么？
如何行为？
依赖谁？
```

Spark 仍然遵循 human cognitive boundary：

> 人会想独立理解、讨论、review、修改它。

---

# 26. Constraint

Constraint 表示：

> **一个必须持续成立的 invariant / limit / commitment**

例如：

```text
Todo description < 1000 characters
Session expires after X
Free tier has a maximum of N items
Delete-all requires explicit confirmation
```

Constraint 可以：

- owned by a natural Spark；
- 或成为独立 artifact；
- 作用于一个或少数多个 Sparks。

它不应该因为影响多个 Spark 就自动变成 Aspect。

---

# 27. Aspect

Aspect 表示：

> **一个可重复、横切多个独立概念的 concern，并定义其 applicability scope**

典型：

```text
Accessibility
Localization
Authorization
Privacy
Telemetry
Audit
```

Aspect 可以包含或组织相关 Constraints，并定义：

```text
where this concern applies
```

例如：

```text
Accessibility
    scope: user-facing UI
```

---

# 28. Collaboration

Collaboration 表示：

> **多个 Sparks 如何共同完成一个有独立意义的软件行为或设计**

典型：

```text
Todo Editing
Sign-in Flow
Response Processing
Offline Synchronization
Checkout Processing
Authentication Lifecycle
```

它可以描述：

- participants；
- roles；
- sequence；
- state transitions；
- failure handling；
- protocol；
- coordination rules。

并适合生成：

- sequence diagram；
- workflow；
- state machine；
- interaction map。

它与 Spark 的区别是：

```text
Spark
    node-centric knowledge

Collaboration
    relationship / interaction-centric knowledge
```

---

# 29. Skill 仍然是什么？

今天的讨论并没有改变 Skill 的基本定位：

```text
Spark / Constraint / Aspect / Collaboration
    = project-specific maintained knowledge

Skill
    = reusable process / method / implementation guidance
```

例如：

```text
MVVM is a general reusable design approach
    → Skill / architecture convention

A concrete ChatView + ChatViewModel + ConversationService interaction
    → Collaboration / Sparks in this specific project
```

因此：

> reusable method 和 concrete model instance 仍然应该区分。

---

# 30. 一个可能的更简单整体模型

相比之前：

```text
Product Sparks
      ↓
Solution Sparks
      ↓
Code
```

今天逐渐浮现出了另一种候选模型：

```text
               Accepted Current Model

        ┌─────────┬───────────┬──────────────┐
        ▼         ▼           ▼              ▼
      Sparks   Constraints   Aspects    Collaborations
        │         │           │              │
        └─────────┴───────────┴──────────────┘
                         ↓
                  Implementation
```

而：

```text
Requirements
Ideas
Feedback
Code Changes
```

作为：

```text
Change Inputs
```

进入这个 accepted model。

这种模型有几个潜在优点：

1. 不再需要强制维护 Product Spark 层；
2. 不再需要完整 Requirement registry；
3. requirement 的语义根据性质落到更自然的 artifact；
4. Spark 可以重新保持清晰含义；
5. cross-cutting knowledge 不需要复制到多个 Sparks；
6. collaboration knowledge 不需要挤进普通 dependency edges；
7. 当前 truth 与 history 可以清楚分离。

---

# 31. 但 Product / Solution 的问题尚未最终定案

需要特别强调：

> 今天并没有最终决定删除 Product Spark / Solution Spark。

当前只是对原来的模型进行了较强 challenge。

尤其几个问题仍然需要实验：

### Product Spark 是否值得存在？

需要验证：

```text
Persistent Product Spark Graph
vs.
Requirements / constraints / aspects + software Sparks
```

哪一种在：

- current product understanding；
- completeness；
- traceability；
- change impact；
- maintenance cost

上更有优势。

### Solution Spark 是否应该继续叫 Solution Spark？

如果最终不再存在 Product / Solution 两层，那么剩余的软件概念可能直接叫：

```text
Spark
```

而不是：

```text
Solution Spark
```

这需要等 ontology 进一步收敛后再决定。

---

# 32. 今天形成的几个重要原则

## Principle 1

> **Do not add modeling layers merely to help LLMs generate code.**

如果目标只是生成代码，LLM 可以直接从 requirement 工作。

## Principle 2

> **SparkWell should optimize for human understanding and deliberate evolution.**

模型存在的主要理由是帮助人理解和 review，而不是增加 generation pipeline。

## Principle 3

> **Current truth matters more than storing requirement history inside the model.**

历史主要交给 Git / PR / issue / provenance。

## Principle 4

> **Not every requirement needs to become a persistent Requirement entity.**

局部需求应尽量由自然 owning concept 保存。

## Principle 5

> **Requirements are inputs; accepted requirements become maintained model knowledge.**

根据语义可能变成 Spark knowledge、Constraint、Aspect 或其他 artifact。

## Principle 6

> **Each piece of maintained knowledge should have one canonical owner.**

其他方向应尽量通过 graph/index/resolution 得到，而不是复制保存。

## Principle 7

> **Cross-cutting does not automatically mean Aspect.**

Aspect 表示一种可重复、横切性的 concern，而不仅仅是“影响多个 Sparks”。

## Principle 8

> **Constraint and Aspect are different dimensions.**

Constraint 表达 what must remain true。

Aspect 表达 which concern applies where。

## Principle 9

> **Relationships should be stored canonically once, but visible from every useful direction.**

不要为了阅读体验双向手工维护关系。

## Principle 10

> **A Spark view should show effective resolved context, not only the contents of its own document.**

这包括 incoming relationships、constraints、aspects、collaborations 和 implementation links。

## Principle 11

> **A relationship edge describes connection; a Collaboration describes meaningful interaction semantics among multiple Sparks.**

两者不能混为一谈。

## Principle 12

> **Do not let Spark become a name for every kind of project knowledge.**

Spark 应该保持清晰的 node-centric semantic identity。

---

# 33. 当前候选的知识分类

当前最值得继续探索的候选是：

```text
Spark
    concept / responsibility

Constraint
    invariant / commitment

Aspect
    cross-cutting concern + scope

Collaboration
    interaction among Sparks

Provenance
    where knowledge originated

Skill
    reusable process / method
```

其中：

```text
Requirement
```

更倾向于作为：

```text
change input
```

而不是持久 ontology 中的一等 artifact。

---

# 34. 下一步最值得验证的问题

这轮讨论之后，Demo 应该优先验证的已经不只是：

```text
Product → Solution → Code
```

而是下面这些问题：

1. **只维护软件 Sparks + Constraint / Aspect / Collaboration，是否已经足够表达当前软件 intent？**
2. **是否真的还需要 Product Spark 这一层？**
3. **从 Sparks + Constraints + Aspects 是否可以合理生成 current requirement view？**
4. **一个 Spark 的 resolved context 是否足够帮助人快速理解其完整作用范围？**
5. **Aspect scope 能否有效减少 accessibility / i18n 等重复知识？**
6. **Constraint 是否能够自然表达少量跨 Spark 的 product commitments？**
7. **Collaboration artifact 是否比把 workflow 强行建成 Spark 更清晰？**
8. **这些 artifact 的总维护成本是否仍然足够低？**

---

# 35. 当前最简 mental model

今天讨论之后，可以暂时用下面这个图理解最新方向：

```text
Requirements / Ideas / Feedback / Code Changes
                     │
                     │  understand + review
                     ▼
              Accepted Current Model

          ┌──────────┼──────────┬──────────────┐
          ▼          ▼          ▼              ▼
        Sparks   Constraints   Aspects    Collaborations
          │          │          │              │
          └──────────┴──────────┴──────────────┘
                     │
                     ▼
               Implementation
```

同时：

```text
Git / PR / Issues / Source Records
                ↓
             History
```

不把 historical discussion 混进 current model。

对于任意一个 Spark，工具提供：

```text
Resolved Spark Context
=
Own document
+ incoming/outgoing relationships
+ applicable constraints
+ applicable aspects
+ participating collaborations
+ implementation links
+ provenance when useful
```

这可能成为 SparkWell 实现“帮助人理解软件”的一个非常核心的产品能力。

---

# 36. 当前状态：这是收敛方向，不是最终定案

今天最重要的结果不是“已经确定新 ontology”，而是：

> **我们开始把 SparkWell 从多层生成 pipeline，重新收敛为一个以 human understanding 为中心的 maintained knowledge model。**

原来的：

```text
Product Spark
    ↓
Solution Spark
    ↓
Code
```

仍然是一个可以工作的方案。

但现在需要认真验证：

> 是否可以用更少的核心概念，获得同样甚至更好的理解、review、traceability 和 change reasoning。

当前最值得继续探索的方向是：

> **Sparks 描述概念，Constraints 描述必须成立的条件，Aspects 描述横切关注点，Collaborations 描述多个概念如何共同工作，而 Requirements 主要作为变化输入。**

这个方向如果成立，会显著减少模型层数，同时保留 SparkWell 最初最重要的目标：让人和 AI 都能持续理解、review 和有意识地演进软件。

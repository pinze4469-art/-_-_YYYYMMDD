# Health Quiz Funnel

这是一个健康测评系统的小型全栈 Demo，按挑战要求实现了后端主流程：分步保存、进度恢复、服务端计算、订阅状态校验、模拟支付和自动化测试。

项目没有依赖外部 npm 包，方便在本机直接运行。生产环境可以把当前 JSON 持久化层替换成 Prisma + PostgreSQL，相关 schema 已放在 `prisma/schema.prisma`。

## 运行

1. 用 VS Code 打开 `health-quiz-challenge` 文件夹。
2. 打开内置 Terminal，运行：

```bash
npm test
npm run dev
```

3. 浏览器访问：`http://localhost:3000`。
4. 也可以在 Run and Debug 里选择 `Run dev server` 或 `Run tests`。

Windows 一键脚本：

- 双击或运行 `run-tests.bat` 跑测试。
- 双击或运行 `start-dev.bat` 启动服务。

## 已实现功能

- 创建匿名 session。
- 每一步提交后保存数据。
- 刷新或重新进入后可以恢复已填写进度。
- 完成测评后服务端计算 BMI、建议摄入量、目标日期和预测曲线。
- 结果接口根据订阅状态返回不同内容：
  - 未付费：只返回预览信息，不返回完整预测曲线等字段。
  - 已付费：返回完整结果。
- `/pay` 模拟支付回调，把 session 改成已付费。
- 自动化测试覆盖核心流程和边界情况。

## Demo session

启动服务后会自动准备两个测试 session：

- 未付费：`demo-free-session`
- 已付费：`demo-paid-session`

对比接口：

```bash
curl http://localhost:3000/api/sessions/demo-free-session/result
curl http://localhost:3000/api/sessions/demo-paid-session/result
```

模拟支付：

```bash
curl -X POST http://localhost:3000/pay \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo-free-session"}'
```

支付后再请求：

```bash
curl http://localhost:3000/api/sessions/demo-free-session/result
```

## API 简表

### POST /api/sessions

创建 session。

可选 body：

```json
{ "preferredSessionId": "my-test-session" }
```

### PATCH /api/sessions/:sessionId/answers

保存一步测评数据。

示例：

```json
{
  "step": "body",
  "expectedVersion": 2,
  "data": {
    "age": 31,
    "heightCm": 168,
    "weightKg": 72,
    "targetWeightKg": 64
  }
}
```

支持的 step：

- `gender`：`{ "gender": "female" }`
- `goals`：`{ "goals": ["lose_weight", "increase_energy"] }`
- `body`：`{ "age": 31, "heightCm": 168, "weightKg": 72, "targetWeightKg": 64 }`
- `activity`：`{ "activityLevel": "moderate" }`

### GET /api/sessions/:sessionId/progress

恢复当前填写进度。

### POST /api/sessions/:sessionId/complete

计算并保存测评结果。

### GET /api/sessions/:sessionId/result

读取结果。未付费时返回脱敏预览，付费后返回完整数据。

### POST /pay

模拟支付回调。

```json
{ "sessionId": "demo-free-session" }
```

## 测试覆盖

运行：

```bash
npm test
```

覆盖内容：

- BMI、热量、目标日期计算。
- 非法身高、体重、年龄、目标体重、字符串注入等输入校验。
- 分步保存和恢复。
- 乱序提交、重复提交。
- stale `expectedVersion` 的并发冲突。
- 未付费结果脱敏，确保拿不到完整预测字段。
- `/pay` 后状态变化，结果从预览变完整。

暂时没有覆盖：

- 真实支付平台回调签名，因为本题要求的是模拟支付。
- 真实 PostgreSQL 集成测试。本地为了方便演示使用 JSON 文件，Prisma schema 已提供。
- UI 视觉回归测试，因为本题主要看后端和核心流程。

## 数据库设计

见：`docs/schema.md` 和 `prisma/schema.prisma`。

核心关系：

- `UserSession`：匿名用户会话。
- `QuizAnswer`：每一步测评答案。
- `HealthAssessment`：计算结果。
- `Subscription`：订阅状态。
- `PaymentEvent`：模拟支付事件记录。

## AI 使用复盘

见：`docs/ai-retrospective.md`。

# 校园食堂点评推荐

移动端优先的校园食堂点评推荐 Web 应用：AI 帮你找菜（无 Key 自动降级为纯规则），踩雷预警、过敏原硬过滤、评价摘要、每菜每日一评。

## 技术栈

- 后端：Node.js + Express + better-sqlite3（CommonJS，无构建步骤）
- 前端：`public/` 原生 HTML/CSS/JS 多页应用，Express 静态托管
- LLM：OpenAI 兼容 `/chat/completions`（默认 DeepSeek），可选

## 本地运行

```bash
npm install     # 安装依赖（better-sqlite3 有 prebuilt）
npm run seed    # 生成种子数据：3 食堂 / 15 窗口 / 120 菜 / 约 220 条评价（幂等，可重复执行）
npm start       # 监听 0.0.0.0:3000，打开 http://localhost:3000
npm run eval    # 另开终端运行本地验证脚本（28 项检查）
```

## 环境变量（`.env`，参考 `.env.example`）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` / `HOST` | 3000 / 0.0.0.0 | 监听端口与地址 |
| `LLM_API_BASE` | https://api.deepseek.com | OpenAI 兼容接口地址 |
| `LLM_API_KEY` | 空 | 不配置则全链路降级为规则模式 |
| `LLM_MODEL` | deepseek-chat | 模型名 |
| `LLM_TIMEOUT_MS` | 5000 | 单次调用超时（超时重试 1 次，仍失败降级） |
| `ADMIN_TOKEN` | change-me | 后台管理令牌（`/api/admin/*`） |
| `DATA_DIR` / `DB_PATH` | ./data | SQLite 数据目录/文件 |

## 核心规则（全部读 `config/thresholds.js`）

- **加权评分**：`(v*R + 5*C) / (v+5)`，R 为该菜三项评分均值，C 为全库活跃菜基准分；口味偏好每命中一个标签 +0.15，新品 ×1.15。
- **硬过滤（永不放宽）**：`allergen_status=unconfirmed` 一律剔除；命中用户过敏原且 `contains` 的菜剔除；素食/清真为强制匹配。
- **可放宽**：价格上限 +2 元一档、忽略口味、放宽窗口/食堂，并在 `relaxed[]` 中说明。
- **踩雷预警**：评价 ≥5 条且（加权 <3.0 或 1-2 星占比 ≥40%），并从差评短评提取高频原因。
- **新品**：`listed_at` 距今 ≤14 天即新品（按日期实时判断）；评价 <3 条在榜单中标 `pending_reviews` 排后。
- **评价风控**：三项评分 1-5 整数、短评 ≤200 字、同用户同菜每自然天 1 条（409）、60 秒内最多 3 条（429）、敏感词/广告评价入库但置 `blocked`。
- **防幻觉**：LLM 推荐的 `dish_id` 必须在候选集内、`review_id` 必须属于该菜、引用必须是评价原文子串；校验失败重试 1 次后降级为规则排序。

## 降级行为

- 未配置 `LLM_API_KEY` 或调用失败：意图解析走关键词规则（便宜→≤8 元、辣/清淡/酸甜等、素食/清真、新品、X 块以下、食堂名匹配），推荐理由用固定模板 + 该菜最高分评价作引用，响应 `degraded:true`、`parsed.source:"keyword"`。
- 查询指向不存在的食堂/菜品（如「火星食堂」）或过滤后无结果：返回 `fallback:true` + 固定文案 + 相近建议。
- 摘要：无 LLM 时用规则摘要（好评率 + 代表性评价），每句同样挂 `review_ids`。
- 评价 <3 条：摘要接口返回 `{available:false}`，详情页显示「评价较少，暂不判断」。

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/home` | 新品榜 top10 / 踩雷榜 top10 / 推荐菜 top6 |
| POST | `/api/recommend` | `{query, filters?, user_id}` F1 推荐流程 |
| GET | `/api/dishes/:id` | 详情（加权分、踩雷状态、过敏原、最新 5 条评价） |
| GET | `/api/dishes/:id/summary` | AI/规则摘要（每句挂 review_ids） |
| GET | `/api/dishes/:id/safe-alternatives` | 同窗口/同类 confirmed_free 安全替代 top3 |
| POST/GET | `/api/dishes/:id/reviews` | 发表/查看评价 |
| GET/PUT | `/api/profile/:user_id` | 口味 / 过敏原 / 饮食限制 |
| GET | `/api/canteens` | 食堂与窗口列表 |
| GET | `/api/admin/flagged` | 被屏蔽/限流列表（header `x-admin-token`） |
| POST | `/api/admin/reviews/:id/block\|unblock\|delete` | 评价处置 |

## Render 部署

1. 仓库推送到 GitHub，Render New → Web Service，选 `render.yaml`（plan free）。
2. 在环境变量里填入 `LLM_API_KEY` 与 `ADMIN_TOKEN`（`sync: false` 占位）。
3. build 命令 `npm install && npm run seed`，start 命令 `npm start`。

## 说明

- 无登录体系：`user_id` 为浏览器 localStorage 生成的设备标识，不收集真实个人信息。
- 种子评价均为合成数据（`is_synthetic=1`），对外统一匿名展示为「同学_xx」；合成标记仅在管理接口暴露。

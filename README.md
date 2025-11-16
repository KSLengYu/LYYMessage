# 简易留言板（Vercel + Supabase + SMTP OTP）

此仓库提供一个最小可用的留言板项目：
- 静态前端：`public/index.html`, `public/login.html`, `public/verify.html`
- Serverless 后端（Vercel）：`api/*.js`（发送验证码、验证、留言、检查登录）
- 数据库：Supabase（Postgres），含最小 schema
- 邮件发送：随机从你配置的多个 SMTP 发件人中选一个发送验证码

> 前提：你已在 Supabase 新建项目并能访问 SQL Editor；已准备好 6 个 SMTP（网易/QQ 等）并能生成授权码或 App Password。

---

## 一键部署（步骤速查）

1. **把仓库 push 到 GitHub**
   - `git init` → add/commit → push 到一个新仓库（或直接在 GitHub 上创建并上传文件）。

2. **在 Supabase 执行 SQL**
   - 打开 Supabase 控制台 → SQL Editor → 粘贴并运行 `sql/schema.sql`。

3. **在 Vercel 新建项目**
   - 登录 Vercel → New Project → 连接你的 GitHub 仓库 → Import。

4. **在 Vercel Project Settings → Environment Variables 填入**
   - 参考 `.env.example`，填写：
     - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `JWT_SECRET`（用下面的方法生成并填写，不要用示例）
     - `OTP_EXPIRES_MINUTES`
     - `SMTP_COUNT`（=6）与每组 `SMTP_i_HOST/PORT/USER/PASS/SECURE`
   - **注意**：把真实的 SMTP 密码、Service Role Key 放在 Vercel Env，不要提交到仓库。

5. **部署**
   - Vercel 会自动构建部署（无需你手动运行构建命令）。
   - 等待部署完成，打开分配的域名（https://your-project.vercel.app）。

6. **测试流程**
   - 访问 `/login.html` → 输入接收验证码的邮箱 → 点击“发送验证码” → 检查邮箱（验证码邮件发件人为你 6 个发件邮箱中的随机一个）  
   - 访问 `/verify.html` 输入邮箱与验证码 → 登录成功（后端会设置 HttpOnly cookie）  
   - 回到首页 `/` 填写并发布留言。

---

## 本地开发（可选）
- 安装依赖：
  ```bash
  npm install

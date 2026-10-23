# 澄序 · 设计主题样板

一套清晰、克制但不沉闷的界面主题示例。当前交付响应式 Web 多页面展示站；Expo 移动端将在主题方向确认后扩展，并复用同一份设计 token。

## 快速开始

```bash
pnpm install
pnpm dev
```

开发服务默认运行在 `http://localhost:3000`。`pnpm dev` 会先从 token 源文件生成 Web CSS 变量和 TypeScript token，再启动 Next.js。

## 项目结构

```text
apps/
  web/                         Next.js App Router 展示站
    src/app/                   页面入口、metadata 与全局基础样式
    src/components/navigation/  shadcn Sidebar 与当前页面头部
    src/components/ui/         shadcn/ui 可复用组件
    src/components/theme-showcase/  页面专属主题样例区块
    src/styles/tokens.css      自动生成的 CSS 自定义属性
packages/
  design-tokens/
    tokens.json                唯一设计 token 源
    scripts/build.mjs          生成 Web CSS 与 TypeScript token
    src/generated.ts           自动生成，供应用与未来 Expo 端复用
```

## 页面路由

| 路径 | 内容 |
| --- | --- |
| `/` | 主题概览与工作台样例 |
| `/colors` | 语义色板与颜色规则 |
| `/typography` | 字体分类与完整参数 |
| `/spacing` | 间距、圆角与形状 |
| `/components` | shadcn/ui 组件变体示例 |

侧栏使用 shadcn/ui Sidebar；通用控件直接引用 `src/components/ui/` 中的 shadcn 组件。

## Token 约定

- 修改 `packages/design-tokens/tokens.json`，不要直接编辑生成文件。
- 自定义页面样式通过 `--ds-color-*`、`--space-*`、`--ds-radius-*`、`--type-*` 等变量读取设计 token。
- `pnpm tokens:build` 重新生成目标文件；`pnpm tokens:check` 检查生成产物是否与源一致。
- 新的产品颜色应先加入 token，再在组件样式中引用，不在 CSS Modules 中散落十六进制色值。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 生成 token 并启动 Web 开发服务器 |
| `pnpm build` | 生成 token 并构建 Web 生产版本 |
| `pnpm lint` | 检查 Web 代码规范 |
| `pnpm typecheck` | 执行 TypeScript 检查 |
| `pnpm tokens:check` | 校验 token 生成结果 |

## 视觉规则

- 灰蓝中性色承担背景和阅读层级，低饱和紫靛只标记重点与交互。
- 使用系统中文无衬线字体，依靠字号、字重和行高形成阅读层级。
- 间距以 4px 为基础递增，圆角按控件与容器层级区分。
- 优先用对齐、留白和语义表达组织信息；装饰不承担内容本身的任务。

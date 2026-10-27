# 澄序 · 设计主题样板

一套清晰、克制但不沉闷的界面主题示例。Web 展示站与 Expo 移动端分别位于 `apps/web`、`apps/mobile`，共用一份设计 token，各自维护页面、组件和构建配置。

## 快速开始

```bash
pnpm install
pnpm dev
```

Web 开发服务默认运行在 `http://localhost:3399`。`pnpm dev` 会先从 token 源文件生成 TypeScript token 和主题变量，再启动 Next.js。

推送到 `main` 分支后，GitHub Actions 会自动构建 `apps/web` 的静态导出并部署到 GitHub Pages。仓库设置中的 Pages 来源请选择 **GitHub Actions**；项目站点路径由 `actions/configure-pages` 自动传给 Next.js。

移动端扫码预览：`pnpm dev:mobile`（Expo Go，需匹配 SDK 57，手机和电脑同一 Wi-Fi）。自定义开发客户端使用 `pnpm dev:mobile:client`；本地构建并启动 iOS / Android：`pnpm mobile:ios` / `pnpm mobile:android`，需要 Xcode 或 Android SDK。浏览器辅助预览：`pnpm mobile:web`（`http://localhost:8081`）。兼容版本、目录与构建说明见 [移动端文档](apps/mobile/README.md)。

## 项目结构

```text
apps/
  mobile/                      Expo Router + NativeWind + HeroUI Native
    src/app/                   路由入口，仅组合布局和功能页面
      (drawer)/(tabs)/          首页、搜索、我的三个底部页面
      design/                  颜色、字体、间距、组件；Stack push 与返回
    src/features/              按页面职责组织内容和交互
    src/shared/                公共导航、主题、本机状态与 UI
  web/                         Next.js App Router 展示站
    src/app/
      page.tsx                 首页结构与组件组合
      components/              首页私有组件
      colors/components/       颜色工作台、矩阵与编辑器
      typography/components/   字体数据、规范展示与样例行
      spacing/components/      间距与圆角面板
      showcase/components/     组件预览、筛选、分类示例
    src/shared/
      layout/                  公共侧栏、页头与 SectionShared
      providers/               跨页面共享的主题状态
      ui/                      shadcn/ui 基础组件库
      hooks/                   公共 hooks
      lib/                     公共工具
packages/
  design-tokens/
    tokens.json                唯一设计 token 源
    scripts/build.mjs          生成 TypeScript token 与主题变量
    src/generated.ts           自动生成，供 Web 与 Expo 端复用
    src/themes.ts              语义角色、派生规则与全站组件映射
```

## 页面路由

| 路径          | 内容                                         |
| ------------- | -------------------------------------------- |
| `/`           | 主题概览与工作台样例                         |
| `/colors`     | 三套浅色、一套深色主题与可编辑的功能颜色矩阵 |
| `/typography` | 字体分类与完整参数                           |
| `/spacing`    | 间距、圆角与形状                             |
| `/showcase`   | 33 个 shadcn/ui 组件示例，按 6 类区块预览    |

侧栏使用 shadcn/ui Sidebar；通用控件直接引用 `src/shared/ui/` 中的 shadcn 组件。旧地址 `/components` 永久重定向到 `/showcase`。

页面采用“总分”结构：`page.tsx` 只组合布局、Provider 和内容组件；标题、说明、数据展示和业务交互由当前路由 `components/` 下的组件负责。页面私有的数据、类型、工具和状态放在同一目录，仅跨页面复用的代码进入 `shared/`。组件文件夹内不放 `page.tsx` 或 `route.ts`，普通组件不会成为公开路由。

公共布局统一从 `shared/layout/` 引用；页面专属状态由路由内的 Provider 管理，全站主题状态保留在 `shared/providers/`。源码按职责拆分，当前 `apps/web/src` 下单个 TypeScript/TSX 文件均不超过 300 行；组件示例按六类拆分，侧栏基础实现按状态、框架、结构和菜单拆分。

## Token 约定

- 修改 `packages/design-tokens/tokens.json`，不要直接编辑生成文件。
- 自定义页面样式通过 `--ds-color-*`、`--space-*`、`--ds-radius-*`、`--type-*` 等变量读取设计 token。
- `pnpm tokens:build` 重新生成目标文件；`pnpm tokens:check` 检查生成产物是否与源一致。
- 样式直接平铺在 JSX 节点的 Tailwind className 中，不新增 CSS Modules 或页面 CSS。
- `src/app/tailwind.css` 仅保留 Tailwind 入口、主题映射与基础层工具类；主题变量通过生成的 `tokenVariables` 注入根节点。
- 新的产品颜色应先加入 token，再在节点工具类中引用。

## 常用命令

| 命令                                      | 作用                                               |
| ----------------------------------------- | -------------------------------------------------- |
| `pnpm dev`                                | 生成 token 并启动 Web 开发服务器                   |
| `pnpm build`                              | 生成 token 并构建 Web 生产版本                     |
| `pnpm dev:mobile`                         | 启动 Expo Go 扫码预览，优先使用 Wi-Fi 地址         |
| `pnpm dev:mobile:client`                  | 启动自定义开发客户端的 Metro 服务                  |
| `pnpm mobile:ios` / `pnpm mobile:android` | 本地构建并运行原生应用                             |
| `pnpm mobile:web`                         | 启动移动端浏览器辅助预览                           |
| `pnpm build:mobile`                       | 导出 iOS、Android、Web 生产 bundle（不生成安装包） |
| `pnpm lint`                               | 检查 Web 与 Mobile 代码规范                        |
| `pnpm typecheck`                          | 检查 Web 与 Mobile TypeScript                      |
| `pnpm tokens:check`                       | 校验 token 生成结果                                |

## 视觉规则

- 灰蓝中性色承担背景和阅读层级，低饱和紫靛只标记重点与交互。
- 使用系统中文无衬线字体，依靠字号、字重和行高形成阅读层级。
- 间距以 4px 为基础递增，圆角按控件与容器层级区分。
- 优先用对齐、留白和语义表达组织信息；装饰不承担内容本身的任务。

## 主题工作台

颜色页按功能展示 101 个角色，包含背景、前景、表面、浮层、状态、输入、边界、按钮、选择控件、导航与图表。三套浅色主题并列对照，深色主题独立切换；功能分类和搜索用于定位角色。

- **专注工作**：沿用澄序的低饱和强调，参考 [Radix Colors 的用途与状态阶梯](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)。
- **清晰交互**：参考 [HeroUI 语义颜色](https://heroui.com/en/docs/native/getting-started/colors)，保留文档中的 OKLCH 基色，并调整实色前景配对以提高按钮文字对比度。
- **温润阅读**：参考 [Material Design 3 的表面与前景配对](https://m3.material.io/styles/color/roles)，使用较暖的中性表面承载长内容。
- **夜间工作**：独立的近黑画布和容器亮度阶梯，参考 HeroUI 深色角色；强调与状态色针对深底重新配对。

这些主题是本项目的配色实现，并非上述设计系统的官方预设。预设颜色继续维护在 `packages/design-tokens/tokens.json`（原始澄序色与 `themes` 部分）；`src/themes.ts` 定义语义关系及 shadcn、旧展示组件的变量映射。派生角色使用 `color-mix(in oklab, …)`，覆盖某个角色后可以恢复预设/自动关联。

切换和编辑仅做全站预览，页面导航保留草稿，刷新恢复已保存状态。点击「保存主题」将当前选择及四套主题的所有自定义值保存至**当前浏览器的 localStorage**，键为 `chengxu.theme.v1`，不会修改仓库文件或跨设备同步。浏览器存储不可用时显示错误并保留草稿；可通过「导出配置」下载包含自定义值及 CSS 变量的 JSON。根布局在首屏绘制前应用保存的主题，避免深浅主题闪烁。

`pnpm test:themes` 检查角色完整性、派生依赖、覆盖与恢复、持久化校验及启动恢复。

## 组件预览库

`/showcase` 按基础操作、表单输入、导航切换、数据展示、反馈状态、浮层交互分为六个区块，提供 33 个组件示例，支持中英文名称/用途搜索、分类筛选、四套主题预览、复制引用与官方文档跳转。示例操作只在本地演示，不会请求业务接口。

- 通用组件：`apps/web/src/shared/ui/`，保持当前 `base-nova` / Base UI 配置。
- 示例与分类：`apps/web/src/app/showcase/components/demos/` 按六个分类分别维护示例及注册信息，`component-registry.ts` 统一汇总，分类计数自动更新。
- 预览容器与筛选：`app/showcase/components/component-preview.tsx`、`showcase-toolbar.tsx` 和 `showcase-context.tsx`；布局样式直接写在对应 JSX 节点的 Tailwind 类中。
- 源码于 2026-10-23 对照 [shadcn 官方 registry](https://ui.shadcn.com/r/styles/base-nova/button.json) 同步，当前 CLI 为 4.22.1。图标使用 Lucide，内部引用改为项目别名；按钮、输入框和 Sheet 保留已有主题定制。
- 新增组件通过 `--theme-control-*`、`--theme-field-*`、`--theme-progress-*`、`--theme-segment-*`、`--theme-backdrop` 和既有 shadcn 变量读取主题，不引入默认品牌色。后续使用 `pnpm --dir apps/web exec shadcn add <组件名> --dry-run` 检查上游更新，合入时保留本项目的语义颜色映射。
- Toast 使用当前 Base UI 版 `Toaster` 与 `toast.add(...)`；在使用通知的页面或布局挂载一次 `Toaster`。

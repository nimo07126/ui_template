# 澄序 · Mobile

独立于 `apps/web` 的 Expo SDK 57 应用，复用 `@template/design-tokens`。界面使用 NativeWind 工具类和真正的 HeroUI Native 组件，采用系统字体、iOS 分组列表、简洁导航和 4pt 间距。

## 运行与构建

从仓库根目录执行：

```bash
pnpm install
pnpm mobile:ios       # 首次本地构建并运行，需要完整 Xcode
pnpm mobile:android   # 首次本地构建并运行，需要 Android SDK / 模拟器或设备
pnpm dev:mobile       # Expo Go 扫码预览，需支持 SDK 57（8081）
pnpm dev:mobile:client # 自定义开发客户端模式（8081）
pnpm mobile:web       # 浏览器辅助预览（8081）
pnpm build:mobile     # 导出三个平台的生产 bundle 到 apps/mobile/dist
pnpm typecheck
pnpm lint
```

原生工程由 Expo 按需生成，不提交 `ios/`、`android/`。iOS 本地构建需完整 Xcode，只有 Command Line Tools 无法启动模拟器。`expo export` 校验 bundle，不等于已生成或签名 IPA / APK。

默认 `pnpm dev:mobile` 明确使用 Expo Go，二维码应为 `exp://<电脑 Wi-Fi IP>:8081`。`scripts/start.mjs` 优先选择 Wi-Fi 网卡的 IPv4 地址，避免同时连接有线网络时选中另一张网卡；已有 `REACT_NATIVE_PACKAGER_HOSTNAME` 设置会保留。电脑和手机需要处于能互相访问的同一局域网，iPhone 需允许 Expo Go 的本地网络访问。网络变化后重启 Metro，扫描新二维码。

SDK 57 需要匹配版本的 Expo Go；应用商店最新版不一定支持 SDK 57，版本不匹配会显示单独的 SDK 提示。以 [Expo Go 官方版本页面](https://expo.dev/go) 和手机实际安装版本为准。iPhone 真机如出现账号提示，按提示让 Expo CLI 与 Expo Go 登录同一 Expo 账号。

自定义开发客户端使用 `pnpm dev:mobile:client`，二维码是 `exp+chengxu-mobile://…`，需先安装澄序开发版。升级 SDK 后必须重新构建开发客户端，旧 SDK 54 的客户端不能加载 SDK 57。iPhone 真机首次安装可使用 `pnpm --filter @template/mobile exec expo run:ios --device`，安装成功后再连接开发客户端模式。

已提供 `eas.json` 的 development、preview、production 配置。需要安装包时，在有 Expo 账号及相应平台签名凭据的环境中执行：

```bash
cd apps/mobile
pnpm dlx eas-cli build --profile development --platform ios
pnpm dlx eas-cli build --profile preview --platform android
```

EAS 首次会关联项目并写入 `extra.eas.projectId`。开发配置生成包含 `expo-dev-client` 的客户端，再用 `pnpm dev:mobile:client` 连接。本仓库未关联或发起云构建。

## 兼容性选择

本项目按明确的 NativeWind 要求锁定兼容组合：

| 依赖                      | 版本                |
| ------------------------- | ------------------- |
| Expo                      | SDK 57 / `~57.0.31` |
| React / React Native      | `19.2.3` / `0.86.3` |
| NativeWind / Tailwind CSS | `4.2.7` / `3.4.x`   |
| HeroUI Native             | `1.0.0-alpha.16`    |
| Reanimated / Worklets     | `4.5.1` / `0.10.1`  |
| TypeScript                | `6.0.3`             |

HeroUI Native 正式版已采用 Uniwind；这里保留 NativeWind 时代的 alpha.16，原始依赖要求见 [alpha.16 安装说明](https://github.com/heroui-inc/heroui-native/blob/v1.0.0-alpha.16/README.md)。该版本上游声明的是旧 SDK 配套依赖，本仓库进行了以下适配，并不代表上游宣布支持 SDK 57：

- 根目录 `.pnpmfile.cjs` 仅针对 `heroui-native@1.0.0-alpha.16` 调整 NativeWind、Reanimated、Worklets 和 Safe Area 的 peer 版本，使整个 Mobile 使用 SDK 57 的同一组原生依赖。
- Metro 通过包的 `source` 条件读取 HeroUI TypeScript 源码，让 SDK 57 的 Worklets 插件重新编译动画函数，避免执行 alpha 包中由旧 Worklets 0.5.1 预编译的函数。保留此设置；只放宽 peer 版本不足以完成迁移。
- NativeWind 升至 [4.2.7](https://www.nativewind.dev/docs/getting-started/installation)，显式使用对应的 `react-native-css-interop@0.2.7`，继续保留 Tailwind 3 和 Babel preset 配置。
- 导航迁至 `expo-router/react-navigation`、`expo-router/js-tabs`、`expo-router/drawer`，删除旧的 `@react-navigation/*` 应用依赖。

后续升级 HeroUI 或动画依赖时，需要同时复核这一适配、类型检查、三端 bundle 和原生客户端。

NativeWind 的 JSX 转换会引用 `react-native-css-interop`，因此在 pnpm 隔离依赖下将其显式声明。工作区 `packageExtensions` 让 Next.js 的 React 类型绑定到 Web 自己的版本，避免两个 React 类型版本串用。

浏览器辅助预览通过 Metro 编译 Reanimated 源码，以保留 NativeWind 的 JSX 样式转换。HeroUI 在三个平台均通过源码编译。浮层使用 HeroUI 自带的 `Dialog.Trigger` / `Dialog.Close`，避免该 alpha 版本 `asChild` 与动画按钮组合时的事件问题。

## 目录约定

```text
src/
  app/
    _layout.tsx                Provider、安全区域、根 Stack、原生返回
    (drawer)/
      _layout.tsx              Expo Router Drawer
      (tabs)/
        _layout.tsx            仅三个底部入口
        index.tsx              首页
        search.tsx             搜索
        profile.tsx            个人空间
    design/                    设计页路由
    profile-edit.tsx           编辑资料，原生 modal
  features/
    home/                      概览与设计入口
    search/                    本地关键词搜索、分类与空结果
    profile/                   资料、偏好与编辑
    design/                    颜色、字体、间距与 HeroUI 组件示例
      demos/                   操作、表单、折叠与浮层交互
  shared/
    content/                   导航与搜索共用的设计条目
    navigation/                Drawer 目录
    providers/                 主题和资料的本机持久化
    theme/                     共享 token → 原生语义色适配
    ui/                        Screen、页面标题与可复用列表行
```

`app/` 只放路由和布局，页面状态留在 `features/`，跨页面复用内容才进入 `shared/`。普通样式使用 JSX `className`；`style` 仅用于动态颜色、token 数值和导航配置。Web 使用 Tailwind 4，Mobile 使用 NativeWind 对应的 Tailwind 3，配置相互独立。

## 导航行为

根 Stack 包含 Drawer 主界面、四个设计页与资料编辑。Drawer 内只挂载三页 Tabs；颜色、字体、间距、组件通过自定义 Drawer 内容中的 `router.push()` 打开，因此会显示原生返回按钮，在 iOS 支持侧滑返回，Android 支持系统返回。返回后保留之前所在 Tab、搜索词和列表位置；设计页不占底部导航入口。`initialRouteName` 提供直接链接进入设计页时的返回锚点。

| 路径                 | 页面                                                         |
| -------------------- | ------------------------------------------------------------ |
| `/`                  | 首页与主题概览                                               |
| `/search`            | 中英文关键词、分类筛选、空结果恢复                           |
| `/profile`           | 个人资料、主题偏好、夜间开关、关于                           |
| `/design/colors`     | 四套全局主题与核心颜色角色                                   |
| `/design/typography` | 共享字号、字重与行高                                         |
| `/design/spacing`    | 4pt 间距、圆角与布局示例                                     |
| `/design/showcase`   | HeroUI 按钮、Chip、输入、Switch、Checkbox、Accordion、Dialog |
| `/profile-edit`      | 昵称和简介编辑，含空昵称校验                                 |

## 主题与数据

所有颜色读取共享 token，通过 `colorjs.io` 将 Web 的 OKLCH 转为 React Native 可用的 sRGB。HeroUI Provider 与原生导航使用相同的语义色，支持专注工作、清晰交互、温润阅读、夜间工作四种主题。

主题与昵称/简介通过 AsyncStorage 存在本机（`chengxu.mobile.v1`），按顺序写入；启动校验保存值，存储失败时显示提示并保留本次会话状态。移动端和 Web 的保存分别独立，不跨设备同步。组件示例使用页面局部状态，不调用业务服务。

浏览器预览可辅助验证布局、搜索和状态恢复；HeroUI alpha 主要面向原生端。发布前仍需使用 iOS / Android 开发构建验收手势、键盘、安全区域、系统字号和原生返回。

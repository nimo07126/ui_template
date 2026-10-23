import { Blocks, CaseSensitive, Palette, ScanLine, type LucideIcon } from 'lucide-react-native';

export type DesignPath =
  | '/design/colors'
  | '/design/typography'
  | '/design/spacing'
  | '/design/showcase';
export type DesignPage = {
  title: string;
  subtitle: string;
  caption: string;
  path: DesignPath;
  icon: LucideIcon;
  keywords: string;
};
export const designPages: DesignPage[] = [
  {
    title: '颜色与主题',
    subtitle: '让每一种颜色，都有自己的职责',
    caption: 'COLOR',
    path: '/design/colors',
    icon: Palette,
    keywords: 'color theme 颜色 配色 深色 夜间 主题',
  },
  {
    title: '字体与排版',
    subtitle: '用字号与留白，建立阅读的节奏',
    caption: 'TYPOGRAPHY',
    path: '/design/typography',
    icon: CaseSensitive,
    keywords: 'typography font text 字体 文字 排版 标题 正文',
  },
  {
    title: '间距与圆角',
    subtitle: '从 4pt 开始，让界面呼吸',
    caption: 'SPACING',
    path: '/design/spacing',
    icon: ScanLine,
    keywords: 'spacing radius layout 间距 圆角 布局 留白',
  },
  {
    title: '组件预览',
    subtitle: '触摸、输入，感受真实的交互',
    caption: 'COMPONENTS',
    path: '/design/showcase',
    icon: Blocks,
    keywords: 'components ui button input switch card 组件 按钮 输入框 开关 卡片 反馈',
  },
];
export const searchEntries = [
  ...designPages,
  {
    ...designPages[0],
    title: '夜间工作',
    subtitle: '独立的深色表面与内容层级',
    keywords: 'dark night 深色 暗色 夜间',
  },
  {
    ...designPages[3],
    title: '按钮与操作',
    subtitle: '主要、次要与禁用状态',
    keywords: 'button 按钮 操作 禁用',
  },
  {
    ...designPages[3],
    title: '表单与输入',
    subtitle: '输入、校验与错误反馈',
    keywords: 'input form field 表单 输入 搜索 校验',
  },
];

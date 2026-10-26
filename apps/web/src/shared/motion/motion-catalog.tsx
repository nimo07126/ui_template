import { DragElasticDemo } from "./drag-elastic-demo";
import { FadeScaleDemo } from "./fade-scale-demo";
import { HoverLiftDemo } from "./hover-lift-demo";
import { LayoutMorphDemo } from "./layout-morph-demo";
import { PathDrawDemo } from "./path-draw-demo";
import { SlideDemo } from "./slide-demo";
import { SpringScaleDemo } from "./spring-scale-demo";
import { StaggerDemo } from "./stagger-demo";
import type { MotionDemoComponent, MotionParameter } from "./types";

export type MotionCategory = "all" | "基础" | "序列" | "手势" | "布局与 SVG";

export type MotionCatalogItem = {
  id: string;
  category: Exclude<MotionCategory, "all">;
  name: string;
  englishName: string;
  description: string;
  api: string;
  parameters: MotionParameter[];
  code: string;
  demo: MotionDemoComponent;
};

export const motionCategories: { id: MotionCategory; label: string }[] = [
  { id: "all", label: "全部动效" },
  { id: "基础", label: "基础动画" },
  { id: "序列", label: "序列与节奏" },
  { id: "手势", label: "手势交互" },
  { id: "布局与 SVG", label: "布局与 SVG" },
];

export const motionCatalog: MotionCatalogItem[] = [
  {
    id: "fade-scale",
    category: "基础",
    name: "淡入上移",
    englishName: "Fade + translateY",
    description: "元素从较低位置淡入，适合页面进入、提示和卡片出现。",
    api: "initial / animate / transition",
    parameters: [
      { id: "duration", label: "时长", min: 0.6, max: 2.4, step: 0.1, unit: "s", defaultValue: 1.2 },
      { id: "distance", label: "位移", min: 4, max: 48, step: 2, unit: "px", defaultValue: 18 },
    ],
    code: `<motion.div\n  initial={{ opacity: 0, y: 18 }}\n  animate={{ opacity: 1, y: 0 }}\n  transition={{ duration: 1.2 }}\n/>`,
    demo: FadeScaleDemo,
  },
  {
    id: "spring-scale",
    category: "基础",
    name: "弹簧缩放",
    englishName: "Spring scale",
    description: "元素带有弹性地从小到大，适合强调状态、成功反馈和重点按钮。",
    api: "animate / type: spring",
    parameters: [
      { id: "bounce", label: "弹性", min: 0, max: 0.9, step: 0.05, defaultValue: 0.45 },
      { id: "duration", label: "时长", min: 0.6, max: 2.2, step: 0.1, unit: "s", defaultValue: 1.4 },
    ],
    code: `<motion.div\n  animate={{ scale: [0.72, 1.12] }}\n  transition={{\n    type: "spring",\n    bounce: 0.45,\n    repeat: Infinity,\n    repeatType: "mirror",\n  }}\n/>`,
    demo: SpringScaleDemo,
  },
  {
    id: "slide",
    category: "基础",
    name: "方向滑入",
    englishName: "Directional slide",
    description: "内容从指定方向滑入并逐渐显现，适合抽屉、通知和分区入口。",
    api: "animate / ease",
    parameters: [
      {
        id: "direction",
        label: "方向",
        type: "select",
        defaultValue: "right",
        options: [
          { label: "从右", value: "right" },
          { label: "从左", value: "left" },
          { label: "从下", value: "down" },
          { label: "从上", value: "up" },
        ],
      },
      { id: "distance", label: "位移", min: 24, max: 120, step: 4, unit: "px", defaultValue: 72 },
    ],
    code: `<motion.div\n  initial={{ x: 72, opacity: 0 }}\n  animate={{ x: 0, opacity: 1 }}\n  transition={{ ease: [0.22, 1, 0.36, 1] }}\n/>`,
    demo: SlideDemo,
  },
  {
    id: "stagger",
    category: "序列",
    name: "交错出现",
    englishName: "Staggered sequence",
    description: "同组元素按固定间隔依次出现，适合列表、导航项和数据概览。",
    api: "delay / repeat",
    parameters: [
      { id: "stagger", label: "间隔", min: 0.04, max: 0.3, step: 0.01, unit: "s", defaultValue: 0.12 },
      { id: "count", label: "数量", min: 3, max: 7, step: 1, unit: "项", defaultValue: 5 },
    ],
    code: `{items.map((item, index) => (\n  <motion.li\n    animate={{ opacity: 1, y: 0 }}\n    transition={{ delay: index * 0.12 }}\n  />\n))}`,
    demo: StaggerDemo,
  },
  {
    id: "hover-lift",
    category: "手势",
    name: "悬停抬升",
    englishName: "Hover lift",
    description: "指针悬停或触摸时轻微抬升和放大，适合可点击卡片和快捷操作。",
    api: "whileHover / whileTap",
    parameters: [
      { id: "lift", label: "抬升", min: 4, max: 24, step: 1, unit: "px", defaultValue: 12 },
      { id: "scale", label: "缩放", min: 1.01, max: 1.1, step: 0.01, defaultValue: 1.04 },
    ],
    code: `<motion.button\n  whileHover={{ y: -12, scale: 1.04 }}\n  whileTap={{ scale: 0.98 }}\n/>`,
    demo: HoverLiftDemo,
  },
  {
    id: "drag-elastic",
    category: "手势",
    name: "拖拽回弹",
    englishName: "Elastic drag",
    description: "拖拽元素时允许一定超出范围，释放后以弹簧回到轨道位置。",
    api: "drag / dragConstraints / dragElastic",
    parameters: [
      { id: "elasticity", label: "弹性", min: 0, max: 1, step: 0.05, defaultValue: 0.65 },
      { id: "distance", label: "范围", min: 20, max: 72, step: 4, unit: "px", defaultValue: 42 },
    ],
    code: `<motion.div\n  drag="x"\n  dragConstraints={{ left: -84, right: 84 }}\n  dragElastic={0.65}\n/>`,
    demo: DragElasticDemo,
  },
  {
    id: "layout-morph",
    category: "布局与 SVG",
    name: "布局变形",
    englishName: "Layout morph",
    description: "同一元素的尺寸、位置和内容改变时平滑过渡，适合切换、展开和重排。",
    api: "layout / LayoutGroup",
    parameters: [
      { id: "radius", label: "圆角", min: 8, max: 40, step: 2, unit: "px", defaultValue: 24 },
    ],
    code: `<LayoutGroup>\n  <motion.button layout transition={{ type: "spring" }} />\n</LayoutGroup>`,
    demo: LayoutMorphDemo,
  },
  {
    id: "path-draw",
    category: "布局与 SVG",
    name: "路径绘制",
    englishName: "SVG path draw",
    description: "沿 SVG 路径逐段绘制图形，适合图标、进度和品牌标记的首次出现。",
    api: "pathLength / SVG",
    parameters: [
      { id: "duration", label: "时长", min: 0.8, max: 3, step: 0.1, unit: "s", defaultValue: 1.8 },
    ],
    code: `<motion.path\n  initial={{ pathLength: 0 }}\n  animate={{ pathLength: 1 }}\n  transition={{ duration: 1.8 }}\n/>`,
    demo: PathDrawDemo,
  },
];

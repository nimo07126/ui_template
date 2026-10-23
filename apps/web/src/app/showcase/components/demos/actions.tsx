"use client";

import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/ui/button-group";
import { Toggle } from "@/shared/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Italic,
  MoreHorizontal,
  Plus,
  Star,
  Underline,
} from "lucide-react";
import type { ComponentExample } from "../example-types";
import { notify, row } from "./demo-utils";

function ButtonsDemo() {
  return (
    <div className="grid gap-5">
      <div className={row}>
        <Button onClick={() => notify("已新建示例项目")}>
          <Plus data-icon="inline-start" />
          新建项目
        </Button>
        <Button variant="secondary" onClick={() => notify("草稿已保存")}>
          次要操作
        </Button>
        <Button variant="outline" onClick={() => notify("草稿已保存")}>
          保存草稿
        </Button>
        <Button variant="ghost" onClick={() => notify("已取消操作")}>
          取消
        </Button>
        <Button variant="destructive" onClick={() => notify("已演示危险操作")}>
          危险操作
        </Button>
        <Button variant="link" onClick={() => notify("已点击文字链接")}>
          文字链接
        </Button>
        <Button disabled>暂不可用</Button>
      </div>
      <div className={row}>
        <Button size="xs">超小</Button>
        <Button size="sm">小号</Button>
        <Button>默认</Button>
        <Button size="lg">大号</Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="更多按钮操作"
          onClick={() => notify("已点击图标按钮")}
        >
          <MoreHorizontal />
        </Button>
      </div>
    </div>
  );
}

function ButtonGroupDemo() {
  return (
    <ButtonGroup>
      <Button variant="outline" onClick={() => notify("草稿已保存")}>
        保存草稿
      </Button>
      <Button
        variant="outline"
        onClick={() => notify("已展开保存选项")}
        aria-label="更多保存选项"
        size="icon"
      >
        <ChevronDown />
      </Button>
    </ButtonGroup>
  );
}

function ToggleDemo() {
  return (
    <div className={row}>
      <Toggle aria-label="收藏项目" variant="outline">
        <Star />
        收藏
      </Toggle>
      <Toggle aria-label="粗体" defaultPressed>
        <Bold />
      </Toggle>
      <Toggle aria-label="不可用的斜体" disabled>
        <Italic />
      </Toggle>
    </div>
  );
}

function ToggleGroupDemo() {
  return (
    <div className="grid gap-4">
      <ToggleGroup
        defaultValue={["left"]}
        variant="outline"
        spacing={0}
        aria-label="文本对齐"
      >
        <ToggleGroupItem value="left" aria-label="左对齐">
          <AlignLeft />
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="居中对齐">
          <AlignCenter />
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="右对齐">
          <AlignRight />
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup multiple defaultValue={["bold"]} aria-label="文字样式">
        <ToggleGroupItem value="bold" aria-label="加粗">
          <Bold />
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="斜体">
          <Italic />
        </ToggleGroupItem>
        <ToggleGroupItem value="underline" aria-label="下划线">
          <Underline />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export const actionsExamples: ComponentExample[] = [
  {
    id: "button",
    name: "Button",
    title: "按钮",
    description: "6 种操作变体、4 种尺寸与禁用状态",
    group: "actions",
    imports: "Button",
    demo: ButtonsDemo,
  },
  {
    id: "button-group",
    name: "Button Group",
    title: "按钮组",
    description: "将有关联的操作聚合在一起",
    group: "actions",
    imports: "ButtonGroup",
    demo: ButtonGroupDemo,
  },
  {
    id: "toggle",
    name: "Toggle",
    title: "切换按钮",
    description: "单个选项的开启、关闭与禁用",
    group: "actions",
    imports: "Toggle",
    demo: ToggleDemo,
  },
  {
    id: "toggle-group",
    name: "Toggle Group",
    title: "切换按钮组",
    description: "支持单选对齐与多选文字样式",
    group: "actions",
    imports: "ToggleGroup, ToggleGroupItem",
    demo: ToggleGroupDemo,
  },
];

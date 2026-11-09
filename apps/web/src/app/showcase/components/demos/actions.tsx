"use client";

import { Button } from "@/shared/ui/button";
import { ButtonGroup } from "@/shared/arc/button-group/button-group";
import { Toggle } from "@/shared/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/shared/arc/toggle-group/toggle-group";
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
import { useState } from "react";
import { row, useNotify } from "./demo-utils";

export function ButtonsDemo() {
  const notify = useNotify();
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

export function ButtonGroupDemo() {
  const notify = useNotify();
  return (
    <ButtonGroup
      label="草稿操作"
      items={[
        { id: "save", label: "保存草稿", onSelect: () => notify("草稿已保存") },
        {
          id: "more",
          label: "更多保存选项",
          icon: <ChevronDown />,
          iconOnly: true,
          onSelect: () => notify("已展开保存选项"),
        },
      ]}
    />
  );
}

export function ToggleDemo() {
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

export function ToggleGroupDemo() {
  const [alignment, setAlignment] = useState(["left"]);
  return (
    <div className="grid gap-4">
      <ToggleGroup
        type="multiple"
        value={alignment}
        onValueChange={(next) => setAlignment(next.slice(-1))}
        label="文本对齐"
      >
        <ToggleGroupItem value="left" label="左对齐">
          <AlignLeft />
        </ToggleGroupItem>
        <ToggleGroupItem value="center" label="居中对齐">
          <AlignCenter />
        </ToggleGroupItem>
        <ToggleGroupItem value="right" label="右对齐">
          <AlignRight />
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup type="multiple" defaultValue={["bold"]} label="文字样式">
        <ToggleGroupItem value="bold" label="加粗">
          <Bold />
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" label="斜体">
          <Italic />
        </ToggleGroupItem>
        <ToggleGroupItem value="underline" label="下划线">
          <Underline />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

"use client";

import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/shared/ui/input-group";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Slider } from "@/shared/ui/slider";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { Mail, Search } from "lucide-react";
import { useState } from "react";
import type { ComponentExample } from "../example-types";
import { stack } from "./demo-utils";

function InputDemo() {
  return (
    <div className={stack}>
      <div className="grid gap-2">
        <Label htmlFor="demo-project">项目名称</Label>
        <Input id="demo-project" placeholder="例如：春季品牌更新" />
        <p className="text-xs text-muted-foreground">名称之后仍然可以修改。</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="demo-email">工作邮箱</Label>
        <Input
          id="demo-email"
          aria-invalid="true"
          aria-describedby="demo-email-error"
          defaultValue="lin@example"
          type="email"
        />
        <p id="demo-email-error" className="text-xs text-destructive">
          请输入完整的邮箱地址。
        </p>
      </div>
      <Input disabled aria-label="禁用输入框" placeholder="当前不可编辑" />
    </div>
  );
}

function InputGroupDemo() {
  return (
    <div className={stack}>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput aria-label="搜索项目" placeholder="搜索项目…" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>⌘ K</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>
          <Mail />
        </InputGroupAddon>
        <InputGroupInput aria-label="团队邮箱名称" placeholder="your-team" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>@example.com</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function TextareaDemo() {
  const [text, setText] = useState("");
  return (
    <div className={stack}>
      <div className="grid gap-2">
        <Label htmlFor="demo-description">项目描述</Label>
        <Textarea
          id="demo-description"
          placeholder="简单介绍这次项目的目标…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={200}
          aria-describedby="demo-description-count"
        />
        <p
          id="demo-description-count"
          className="text-right text-xs tabular-nums text-muted-foreground"
        >
          {text.length} / 200
        </p>
      </div>
    </div>
  );
}

function CheckboxDemo() {
  return (
    <div className="grid gap-4">
      <Label htmlFor="demo-check">
        <Checkbox id="demo-check" defaultChecked />
        接收项目更新通知
      </Label>
      <Label htmlFor="demo-check-all">
        <Checkbox id="demo-check-all" indeterminate />
        部分选中
      </Label>
      <Label htmlFor="demo-check-disabled">
        <Checkbox id="demo-check-disabled" disabled />
        暂不可选择
      </Label>
    </div>
  );
}

function RadioDemo() {
  return (
    <RadioGroup defaultValue="team" aria-label="项目可见范围" className="gap-4">
      <Label htmlFor="demo-radio-private">
        <RadioGroupItem id="demo-radio-private" value="private" />
        仅自己可见
      </Label>
      <Label htmlFor="demo-radio-team">
        <RadioGroupItem id="demo-radio-team" value="team" />
        团队成员可见
      </Label>
      <Label htmlFor="demo-radio-public">
        <RadioGroupItem id="demo-radio-public" value="public" disabled />
        公开访问（暂未开放）
      </Label>
    </RadioGroup>
  );
}

function SelectDemo() {
  const options = [
    { value: "design", label: "设计团队" },
    { value: "product", label: "产品团队" },
    { value: "engineering", label: "研发团队" },
  ];
  return (
    <div className={stack}>
      <Label id="demo-team-label">所属团队</Label>
      <Select items={options} defaultValue="design">
        <SelectTrigger aria-labelledby="demo-team-label" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select disabled>
        <SelectTrigger aria-label="未开放的团队选择" className="w-full">
          <SelectValue placeholder="暂不可选择" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">暂无团队</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function SwitchDemo() {
  return (
    <div className="grid w-full max-w-sm gap-5">
      <div className="flex items-center justify-between gap-6">
        <div className="grid gap-1">
          <Label htmlFor="demo-notification">消息通知</Label>
          <p className="text-xs text-muted-foreground">
            接收与你相关的项目动态。
          </p>
        </div>
        <Switch id="demo-notification" defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="demo-auto-save">自动保存</Label>
        <Switch id="demo-auto-save" />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="demo-disabled-switch">管理员选项</Label>
        <Switch id="demo-disabled-switch" disabled />
      </div>
    </div>
  );
}

function SliderDemo() {
  const [value, setValue] = useState([64]);
  return (
    <div className={stack}>
      <div className="flex items-center justify-between text-sm">
        <Label id="demo-volume-label">预览音量</Label>
        <output className="tabular-nums text-muted-foreground">
          {value[0]}%
        </output>
      </div>
      <Slider
        aria-labelledby="demo-volume-label"
        value={value}
        onValueChange={(next) => setValue(Array.isArray(next) ? next : [next])}
      />
      <p className="mt-2 text-xs text-muted-foreground">区间选择</p>
      <Slider aria-label="价格区间" defaultValue={[25, 75]} />
      <Slider aria-label="禁用滑块" defaultValue={[40]} disabled />
    </div>
  );
}

export const formsExamples: ComponentExample[] = [
  {
    id: "input",
    name: "Input / Label",
    title: "输入框与标签",
    description: "默认、错误反馈与禁用状态",
    group: "forms",
    imports: "Input",
    demo: InputDemo,
  },
  {
    id: "input-group",
    name: "Input Group",
    title: "组合输入",
    description: "为输入框添加图标、快捷键和后缀",
    group: "forms",
    imports: "InputGroup, InputGroupInput, InputGroupAddon",
    demo: InputGroupDemo,
  },
  {
    id: "textarea",
    name: "Textarea",
    title: "多行输入",
    description: "长文本编辑与实时字数统计",
    group: "forms",
    imports: "Textarea",
    demo: TextareaDemo,
  },
  {
    id: "checkbox",
    name: "Checkbox",
    title: "复选框",
    description: "已选、部分选中与禁用状态",
    group: "forms",
    imports: "Checkbox",
    demo: CheckboxDemo,
  },
  {
    id: "radio-group",
    name: "Radio Group",
    title: "单选组",
    description: "从一组互斥选项中选择一个",
    group: "forms",
    imports: "RadioGroup, RadioGroupItem",
    demo: RadioDemo,
  },
  {
    id: "select",
    name: "Select",
    title: "选择器",
    description: "下拉选择、键盘导航与禁用状态",
    group: "forms",
    imports: "Select, SelectTrigger, SelectValue, SelectContent, SelectItem",
    demo: SelectDemo,
  },
  {
    id: "switch",
    name: "Switch",
    title: "开关",
    description: "即时生效的偏好与状态切换",
    group: "forms",
    imports: "Switch",
    demo: SwitchDemo,
  },
  {
    id: "slider",
    name: "Slider",
    title: "滑块",
    description: "数值调节、区间选择与禁用状态",
    group: "forms",
    imports: "Slider",
    demo: SliderDemo,
  },
];

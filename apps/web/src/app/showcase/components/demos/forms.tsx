"use client";

import { Checkbox } from "@/shared/arc/checkbox/checkbox";
import { Input } from "@/shared/arc/input/input";
import { RadioGroup } from "@/shared/arc/radio-group/radio-group";
import { Select } from "@/shared/arc/select/select";
import { Slider } from "@/shared/arc/slider/slider";
import { Switch } from "@/shared/arc/switch/switch";
import { Textarea } from "@/shared/arc/textarea/textarea";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/shared/ui/input-group";
import { Mail, Search } from "lucide-react";
import { useState } from "react";
import { stack } from "./demo-utils";

export function InputDemo() {
  return (
    <div className={stack}>
      <Input
        label="项目名称"
        placeholder="例如：春季品牌更新"
        description="名称之后仍然可以修改。"
      />
      <Input
        label="工作邮箱"
        error="请输入完整的邮箱地址。"
        defaultValue="lin@example"
        type="email"
      />
      <Input disabled label="禁用输入框" placeholder="当前不可编辑" />
    </div>
  );
}

export function InputGroupDemo() {
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

export function TextareaDemo() {
  const [text, setText] = useState("");
  return (
    <div className="grid w-full max-w-sm gap-2">
      <Textarea
        label="项目描述"
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
  );
}

export function CheckboxDemo() {
  return (
    <div className="grid gap-4">
      <Checkbox label="接收项目更新通知" defaultChecked />
      <Checkbox label="部分选中" defaultChecked="indeterminate" />
      <Checkbox label="暂不可选择" disabled />
    </div>
  );
}

export function RadioDemo() {
  const [scope, setScope] = useState("team");
  return (
    <RadioGroup
      label="项目可见范围"
      options={[
        { value: "private", label: "仅自己可见" },
        { value: "team", label: "团队成员可见" },
        { value: "public", label: "公开访问（暂未开放）", disabled: true },
      ]}
      value={scope}
      onValueChange={setScope}
    />
  );
}

export function SelectDemo() {
  const options = [
    { value: "design", label: "设计团队" },
    { value: "product", label: "产品团队" },
    { value: "engineering", label: "研发团队" },
  ];
  return (
    <div className={stack}>
      <Select label="所属团队" options={options} defaultValue="design" />
      <Select
        disabled
        label="未开放的团队选择"
        placeholder="暂不可选择"
        options={[{ value: "none", label: "暂无团队" }]}
      />
    </div>
  );
}

export function SwitchDemo() {
  return (
    <div className="grid w-full max-w-sm gap-5">
      <div className="flex items-center justify-between gap-6">
        <div className="grid gap-1">
          <label htmlFor="demo-notification" className="text-sm font-medium">消息通知</label>
          <p className="text-xs text-muted-foreground" id="demo-notification-hint">
            接收与你相关的项目动态。
          </p>
        </div>
        <Switch
          id="demo-notification"
          label="消息通知"
          aria-describedby="demo-notification-hint"
          defaultChecked
        />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="demo-auto-save" className="text-sm font-medium">自动保存</label>
        <Switch id="demo-auto-save" label="自动保存" />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="demo-disabled-switch" className="text-sm font-medium">管理员选项</label>
        <Switch id="demo-disabled-switch" label="管理员选项" disabled />
      </div>
    </div>
  );
}

export function SliderDemo() {
  const [value, setValue] = useState(64);
  return (
    <div className={stack}>
      <Slider
        label="预览音量"
        value={value}
        onValueChange={setValue}
        format={(current) => `${current}%`}
        showValue
      />
      <Slider<[number, number]>
        label="价格区间"
        defaultValue={[25, 75]}
        thumbLabels={["最低价格", "最高价格"]}
      />
      <Slider label="禁用滑块" defaultValue={40} disabled />
    </div>
  );
}

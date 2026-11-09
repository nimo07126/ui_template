"use client";

import { ChipGroup } from "@/shared/arc/chip-group/chip-group";
import { Combobox } from "@/shared/arc/combobox/combobox";
import { ExpandingSearch } from "@/shared/arc/expanding-search/expanding-search";
import { InlineEdit } from "@/shared/arc/inline-edit/inline-edit";
import { MoneyInput } from "@/shared/arc/money-input/money-input";
import { MorphSelect } from "@/shared/arc/morph-select/morph-select";
import { MultiSelect } from "@/shared/arc/multi-select/multi-select";
import { NumberField } from "@/shared/arc/number-field/number-field";
import { PasswordField } from "@/shared/arc/password-field/password-field";
import { PasswordStrength } from "@/shared/arc/password-strength/password-strength";
import { PhoneInput } from "@/shared/arc/phone-input/phone-input";
import { RadioCards } from "@/shared/arc/radio-cards/radio-cards";
import { ScrubInput } from "@/shared/arc/scrub-input/scrub-input";
import { SearchField } from "@/shared/arc/search-field/search-field";
import { ShortcutRecorder } from "@/shared/arc/shortcut-recorder/shortcut-recorder";
import { TagInput } from "@/shared/arc/tag-input/tag-input";
import { useState } from "react";
import { DemoColumn, DemoResult, projectNames, projectOptions } from "./fixtures";

export function ComboboxDemo() {
  const [value, setValue] = useState("");
  return (
    <DemoColumn>
      <Combobox label="搜索项目" options={projectOptions} value={value} onValueChange={setValue} />
    </DemoColumn>
  );
}

export function MultiSelectDemo() {
  const [value, setValue] = useState<string[]>(["0"]);
  return (
    <DemoColumn>
      <MultiSelect label="关联项目" options={projectOptions} value={value} onValueChange={setValue} />
    </DemoColumn>
  );
}

export function NumberFieldDemo() {
  const [value, setValue] = useState(3);
  return (
    <DemoColumn>
      <NumberField label="成员数量" value={value} onValueChange={setValue} min={1} max={30} scrub />
    </DemoColumn>
  );
}

export function PasswordFieldDemo() {
  return (
    <DemoColumn>
      <PasswordField label="示例密码" defaultValue="chengxu-demo" autoComplete="off" />
    </DemoColumn>
  );
}

export function SearchFieldDemo() {
  const [query, setQuery] = useState("");
  const matches = projectNames.filter((name) => name.includes(query.trim()));
  return (
    <DemoColumn>
      <SearchField label="筛选项目" placeholder="输入项目名称" value={query} onValueChange={setQuery} />
      <DemoResult>{matches.join("、") || "无匹配项目"}</DemoResult>
    </DemoColumn>
  );
}

export function TagInputDemo() {
  const [value, setValue] = useState(["设计", "动效"]);
  return (
    <DemoColumn>
      <TagInput
        label="项目标签"
        value={value}
        onValueChange={setValue}
        description="按 Enter 或输入逗号添加标签。"
      />
    </DemoColumn>
  );
}

export function InlineEditDemo() {
  const [title, setTitle] = useState("澄序主题样板");
  return (
    <InlineEdit
      label="项目名称"
      value={title}
      validate={(next) => (next.trim() ? null : "请输入项目名称")}
      onSave={setTitle}
    />
  );
}

export function ExpandingSearchDemo() {
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <ExpandingSearch
        label="搜索资料"
        items={[
          { id: "components", title: "组件使用说明", group: "文档", keywords: ["UI"] },
          { id: "themes", title: "主题颜色指南", group: "文档", keywords: ["token"] },
        ]}
        onSelect={(item) => setResult(item.title)}
      />
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

export function ChipGroupDemo() {
  const [value, setValue] = useState<string[]>(["design"]);
  return (
    <DemoColumn>
      <ChipGroup
        label="筛选主题"
        value={value}
        onValueChange={setValue}
        maxVisible={4}
        options={[
          { value: "design", label: "设计" },
          { value: "research", label: "调研" },
          { value: "motion", label: "动效" },
          { value: "code", label: "代码" },
          { value: "writing", label: "文案" },
        ]}
      />
    </DemoColumn>
  );
}

export function PasswordStrengthDemo() {
  return (
    <DemoColumn>
      <PasswordStrength label="设置示例密码" autoComplete="off" />
    </DemoColumn>
  );
}

export function MorphSelectDemo() {
  const [value, setValue] = useState<string | null>("sh");
  return (
    <DemoColumn>
      <MorphSelect
        label="办公地点"
        value={value}
        onValueChange={setValue}
        items={[
          {
            label: "亚洲",
            options: [
              { value: "sh", label: "上海", meta: "UTC+8" },
              { value: "tk", label: "东京", meta: "UTC+9" },
            ],
          },
          { label: "欧洲", options: [{ value: "ld", label: "伦敦", meta: "UTC+0" }] },
        ]}
      />
    </DemoColumn>
  );
}

export function ScrubInputDemo() {
  const [width, setWidth] = useState(240);
  return (
    <DemoColumn>
      <ScrubInput
        label="宽度"
        value={width}
        onValueChange={setWidth}
        min={0}
        units={["px", "%"]}
        resetValue={240}
      />
    </DemoColumn>
  );
}

export function PhoneInputDemo() {
  const [value, setValue] = useState("");
  const [valid, setValid] = useState(false);
  return (
    <DemoColumn>
      <PhoneInput
        label="示例联系电话"
        value={value}
        onValueChange={(next, details) => {
          setValue(next);
          setValid(details.valid);
        }}
        defaultCountry="CN"
        preferredCountries={["CN", "GB", "US"]}
        description={valid ? "号码格式有效" : "试着切换区号并填写示例号码"}
      />
    </DemoColumn>
  );
}

export function MoneyInputDemo() {
  const [value, setValue] = useState<number | null>(1500);
  return (
    <DemoColumn>
      <MoneyInput
        label="预估金额"
        value={value}
        onValueChange={setValue}
        currencies={["CNY", "USD"]}
        quickAdd={[5, 10, 20]}
      />
    </DemoColumn>
  );
}

export function ShortcutRecorderDemo() {
  const [value, setValue] = useState<string | null>("mod+k");
  return (
    <DemoColumn>
      <ShortcutRecorder label="搜索快捷键" value={value} onValueChange={setValue} resetValue="mod+k" />
    </DemoColumn>
  );
}

export function RadioCardsDemo() {
  return (
    <DemoColumn>
      <RadioCards
        aria-label="配送方式"
        layout="list"
        defaultValue="standard"
        options={[
          { value: "standard", label: "标准", description: "4–6 个工作日", meta: "免费" },
          { value: "express", label: "加急", description: "2 个工作日", meta: "¥12" },
          { value: "overnight", label: "隔夜", disabled: true, disabledReason: "此地址暂不可用" },
        ]}
      />
    </DemoColumn>
  );
}

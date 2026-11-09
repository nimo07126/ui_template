"use client";

import { AvatarGroup } from "@/shared/arc/avatar-group/avatar-group";
import { BillingPrice, BillingToggle } from "@/shared/arc/billing-toggle/billing-toggle";
import { Button } from "@/shared/arc/button/button";
import { CodeBlock } from "@/shared/arc/code-block/code-block";
import { FilterToolbar, type FilterChip } from "@/shared/arc/filter-toolbar/filter-toolbar";
import { JsonViewer } from "@/shared/arc/json-viewer/json-viewer";
import { OnboardingChecklist } from "@/shared/arc/onboarding-checklist/onboarding-checklist";
import { ReorderableList, type ReorderableItem } from "@/shared/arc/reorderable-list/reorderable-list";
import { Stepper } from "@/shared/arc/stepper/stepper";
import { Timeline } from "@/shared/arc/timeline/timeline";
import { TreeTable, type TreeTableColumn, type TreeTableRow } from "@/shared/arc/tree-table/tree-table";
import { TreeView, type TreeNode } from "@/shared/arc/tree-view/tree-view";
import { UsageMeter } from "@/shared/arc/usage-meter/usage-meter";
import { useState } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

const members = [
  { name: "陈晓", status: "online" as const },
  { name: "林可" },
  { name: "张然" },
  { name: "周悦" },
  { name: "刘夏" },
];

export function AvatarGroupDemo() {
  return <AvatarGroup members={members} max={3} label="设计协作成员" />;
}

const nodes: TreeNode[] = [
  {
    id: "design",
    label: "设计资源",
    children: [
      { id: "themes", label: "themes.json" },
      { id: "colors", label: "colors.css" },
    ],
  },
  { id: "docs", label: "文档", children: [{ id: "guide", label: "README.md" }] },
];

export function TreeViewDemo() {
  const [file, setFile] = useState("");
  return (
    <DemoColumn>
      <TreeView nodes={nodes} defaultExpandedIds={["design"]} onSelect={(node) => setFile(node.label)} />
      <DemoResult>{file && `已选择 ${file}`}</DemoResult>
    </DemoColumn>
  );
}

const filterFields = [
  { id: "status", label: "状态", options: ["进行中", "已完成"] },
  { id: "owner", label: "负责人", options: ["陈晓", "林可"] },
];

export function FilterToolbarDemo() {
  const [filters, setFilters] = useState<FilterChip[]>([]);
  return (
    <FilterToolbar
      filters={filters}
      onRemove={(id) => setFilters((current) => current.filter((chip) => chip.id !== id))}
      onClearAll={() => setFilters([])}
      addFilter={{
        fields: filterFields,
        onAdd: (chip) => setFilters((current) => [...current.filter((item) => item.id !== chip.id), chip]),
      }}
    />
  );
}

export function CodeBlockDemo() {
  return (
    <DemoColumn>
      <CodeBlock
        code={'export const project = { name: "澄序", active: true };'}
        filename="project.ts"
        language="ts"
        maxLines={6}
      />
    </DemoColumn>
  );
}

export function ReorderableListDemo() {
  const [items, setItems] = useState<ReorderableItem[]>([
    { id: "design", title: "确认视觉稿", detail: "设计" },
    { id: "build", title: "接入主题组件", detail: "开发" },
    { id: "test", title: "走查键盘操作", detail: "测试" },
  ]);
  return (
    <DemoColumn>
      <ReorderableList items={items} onReorder={setItems} label="拖动调整优先级" />
    </DemoColumn>
  );
}

export function UsageMeterDemo() {
  return (
    <DemoColumn>
      <UsageMeter
        label="工作区存储"
        unit="GB"
        limit={50}
        segments={[
          { id: "files", label: "文件", value: 21.4 },
          { id: "media", label: "图片", value: 14.2 },
          { id: "backup", label: "备份", value: 6.8 },
        ]}
      />
    </DemoColumn>
  );
}

export function OnboardingChecklistDemo() {
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <OnboardingChecklist
        title="配置示例工作区"
        defaultCompleted={["create"]}
        steps={[
          { id: "create", title: "创建项目" },
          { id: "invite", title: "邀请协作者", actionLabel: "邀请", onAction: () => setResult("已模拟发送邀请") },
          { id: "theme", title: "选择主题", description: "为项目设定默认外观。" },
        ]}
      />
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

const now = Date.UTC(2026, 8, 22, 11);
const events = [
  { id: "published", at: "2026-09-22T10:30:00Z", actor: "陈晓", title: "发布组件库预览", meta: "v1.0" },
  {
    id: "review",
    at: "2026-09-22T09:00:00Z",
    title: "完成设计复核",
    tone: "success" as const,
    detail: <p>已复核键盘操作和暗色主题。</p>,
  },
  { id: "created", at: "2026-09-21T09:00:00Z", title: "创建澄序工作区" },
];

export function TimelineDemo() {
  return (
    <DemoColumn>
      <Timeline events={events} now={now} label="项目动态" maxHeight={260} />
    </DemoColumn>
  );
}

const steps = [
  { id: "draft", label: "起草" },
  { id: "review", label: "审阅", description: "确认文案和视觉" },
  { id: "publish", label: "发布" },
];

export function StepperDemo() {
  const [step, setStep] = useState(1);
  return (
    <DemoColumn>
      <Stepper current={step} onStepSelect={setStep} steps={steps} label="发布流程" completeLabel="发布已完成" />
      <Button variant="secondary" onClick={() => setStep((step + 1) % (steps.length + 1))}>
        {step === steps.length ? "重新开始" : "下一步"}
      </Button>
    </DemoColumn>
  );
}

const eventData = {
  type: "project.updated",
  project: { name: "澄序主题样板", version: 2, themes: ["studio", "night"] },
  success: true,
};

export function JsonViewerDemo() {
  return (
    <DemoColumn>
      <JsonViewer data={eventData} rootName="event" defaultExpandDepth={2} maxHeight={220} />
    </DemoColumn>
  );
}

type DocumentRow = { name: string; size: number };

const columns: TreeTableColumn<DocumentRow>[] = [
  {
    id: "name",
    header: "名称",
    cell: (item) => item.name,
    sortValue: (item) => item.name,
    width: "minmax(0, 2fr)",
  },
  {
    id: "size",
    header: "大小",
    cell: (item) => `${item.size} KB`,
    sortValue: (item) => item.size,
    align: "end",
    width: "80px",
  },
];

const rows: TreeTableRow<DocumentRow>[] = [
  {
    id: "design",
    data: { name: "设计资源", size: 56 },
    children: [
      { id: "tokens", data: { name: "tokens.json", size: 36 } },
      { id: "styles", data: { name: "styles.css", size: 20 } },
    ],
  },
  { id: "readme", data: { name: "README.md", size: 10 } },
];

export function TreeTableDemo() {
  return (
    <div className="w-full min-w-0">
      <TreeTable
        label="设计文件"
        rows={rows}
        columns={columns}
        selectable
        rowLabel={(item) => item.name}
        defaultExpanded={["design"]}
        maxHeight={260}
      />
    </div>
  );
}

export function BillingToggleDemo() {
  const [period, setPeriod] = useState("monthly");
  const yearly = period === "yearly";
  return (
    <DemoColumn>
      <BillingToggle
        value={period}
        onValueChange={setPeriod}
        options={[
          { value: "monthly", label: "月付" },
          { value: "yearly", label: "年付", badge: "省 20%" },
        ]}
      />
      <BillingPrice
        amount={yearly ? 16 : 20}
        was={yearly ? 20 : undefined}
        period={yearly ? "每月，按年结算" : "每月"}
      />
    </DemoColumn>
  );
}

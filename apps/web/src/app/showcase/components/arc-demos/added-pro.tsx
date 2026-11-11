"use client";

import { Checkbox } from "@/shared/arc/checkbox/checkbox";
import { Input } from "@/shared/arc/input/input";
import { AgentLoop } from "@/shared/arc/pro/agent-loop/agent-loop";
import { GradientMesh } from "@/shared/arc/pro/gradient-mesh/gradient-mesh";
import { MixtureOfExperts } from "@/shared/arc/pro/mixture-of-experts/mixture-of-experts";
import { MultiStepForm } from "@/shared/arc/pro/multi-step-form/multi-step-form";
import { PromptCache } from "@/shared/arc/pro/prompt-cache/prompt-cache";
import { ReasoningTree } from "@/shared/arc/pro/reasoning-tree/reasoning-tree";
import { SelectionToolbar } from "@/shared/arc/pro/selection-toolbar/selection-toolbar";
import { SpeculativeDecoding } from "@/shared/arc/pro/speculative-decoding/speculative-decoding";
import { Archive } from "lucide-react";
import { useState } from "react";
import { DemoColumn, DemoResult, projectNames } from "./fixtures";

export function AgentLoopDemo() {
  return <AgentLoop autoPlay={false} />;
}

export function GradientMeshDemo() {
  return <GradientMesh animate={false} hint="拖动色点调整渐变" />;
}

export function MixtureOfExpertsDemo() {
  return <MixtureOfExperts defaultPaused loop={false} />;
}

export function MultiStepFormDemo() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <MultiStepForm
      nextLabel="继续"
      completeLabel="完成"
      steps={[
        {
          id: "workspace",
          title: "工作区",
          content: <Input label="工作区名称" value={name} onChange={(event) => setName(event.target.value)} required />,
        },
        {
          id: "contact",
          title: "联系方式",
          content: <Input label="电子邮件" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />,
        },
      ]}
    />
  );
}

export function PromptCacheDemo() {
  return <PromptCache autoPlay={false} loop={false} />;
}

export function ReasoningTreeDemo() {
  return <ReasoningTree autoPlay={false} loop={false} />;
}

export function SelectionToolbarDemo() {
  const [projects, setProjects] = useState(projectNames);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState("");

  function archiveSelection() {
    setProjects(projects.filter((name) => !selected.includes(name)));
    setResult(`已归档 ${selected.length} 个项目`);
    setSelected([]);
  }

  return (
    <DemoColumn>
      {projects.map((name) => (
        <Checkbox
          key={name}
          label={name}
          checked={selected.includes(name)}
          onCheckedChange={(checked) => setSelected((current) => checked === true
            ? [...current, name]
            : current.filter((item) => item !== name))}
        />
      ))}
      <SelectionToolbar
        count={selected.length}
        noun="project"
        actions={[{ label: "归档", icon: <Archive size={14} />, onClick: archiveSelection }]}
        onClear={() => setSelected([])}
      />
      <DemoResult>{result || "选择项目以查看批量操作。"}</DemoResult>
    </DemoColumn>
  );
}

export function SpeculativeDecodingDemo() {
  return <SpeculativeDecoding autoplay={false} />;
}

"use client";

import { ActionButton } from "@/shared/arc/action-button/action-button";
import { ActionSwap } from "@/shared/arc/action-swap/action-swap";
import { ConfirmMorph } from "@/shared/arc/confirm-morph/confirm-morph";
import { ContextMenu } from "@/shared/arc/context-menu/context-menu";
import { CopyButton } from "@/shared/arc/copy-button/copy-button";
import { ExpandingButtonGroup } from "@/shared/arc/expanding-button-group/expanding-button-group";
import { FloatingButtonGroup } from "@/shared/arc/floating-button-group/floating-button-group";
import { HoldToConfirm } from "@/shared/arc/hold-to-confirm/hold-to-confirm";
import { IconMorph } from "@/shared/arc/icon-morph/icon-morph";
import { Reactions } from "@/shared/arc/reactions/reactions";
import { SplitButton } from "@/shared/arc/split-button/split-button";
import { SwipeActions, SwipeActionsRow } from "@/shared/arc/swipe-actions/swipe-actions";
import {
  Archive,
  Check,
  Copy,
  Forward,
  Heart,
  MailOpen,
  Play,
  Redo2,
  Reply,
  Send,
  ThumbsUp,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

export function ActionSwapDemo() {
  return (
    <ActionSwap
      states={[
        { id: "send", label: "发送邀请", icon: <Send size={16} /> },
        { id: "sent", label: "已发送", icon: <Check size={16} />, tone: "success", holdFor: 2000 },
      ]}
    />
  );
}

export function ActionButtonDemo() {
  return (
    <ActionButton
      label="发布更新"
      pendingLabel="正在发布"
      successLabel="已发布"
      onAction={() => new Promise<void>((resolve) => window.setTimeout(resolve, 450))}
      resetAfterMs={1500}
    />
  );
}

export function SplitButtonDemo() {
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <SplitButton
        label="导出报告"
        onClick={() => setResult("已模拟导出 PDF")}
        actions={[
          { label: "导出 CSV", onSelect: () => setResult("已模拟导出 CSV") },
          { label: "导出 JSON", onSelect: () => setResult("已模拟导出 JSON") },
        ]}
      />
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

export function FloatingButtonGroupDemo() {
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  return (
    <DemoColumn>
      <FloatingButtonGroup
        label="画板操作"
        variant="floating"
        items={[
          {
            id: "undo",
            label: "撤销",
            icon: <Undo2 />,
            iconOnly: true,
            disabled: step === 0,
            onSelect: () => setStep(step - 1),
          },
          {
            id: "redo",
            label: "重做",
            icon: <Redo2 />,
            iconOnly: true,
            disabled: step === 2,
            onSelect: () => setStep(step + 1),
          },
          { type: "separator" },
          {
            id: "play",
            label: playing ? "停止" : "演示",
            icon: <Play />,
            pressed: playing,
            onSelect: () => setPlaying(!playing),
          },
        ]}
      />
      <DemoResult>{playing ? "正在演示" : `画板版本 ${step + 1}`}</DemoResult>
    </DemoColumn>
  );
}

export function ExpandingButtonGroupDemo() {
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <ExpandingButtonGroup
        label="消息操作"
        defaultExpanded="reply"
        items={[
          { id: "reply", label: "回复", icon: <Reply />, onSelect: () => setResult("已打开回复") },
          { id: "forward", label: "转发", icon: <Forward />, onSelect: () => setResult("已模拟转发") },
          {
            id: "archive",
            label: "归档",
            doneLabel: "已归档",
            icon: <Archive />,
            onSelect: () => setResult("消息已归档"),
          },
        ]}
      />
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

export function ContextMenuDemo() {
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <ContextMenu
        label="示例文件操作"
        items={[
          {
            id: "copy",
            label: "复制文件名",
            icon: <Copy size={16} />,
            onSelect: () => setResult("文件名为 brief.md"),
          },
          {
            id: "delete",
            label: "删除文件",
            icon: <Trash2 size={16} />,
            destructive: true,
            onSelect: () => setResult("已模拟删除"),
          },
        ]}
      >
        <div className="rounded-lg border border-dashed p-4 text-sm">右键或按 Shift + F10 · brief.md</div>
      </ContextMenu>
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

export function CopyButtonDemo() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="text-xs">chengxu-demo</code>
      <CopyButton value="chengxu-demo" label="复制示例文本" />
    </div>
  );
}

export function HoldToConfirmDemo() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <DemoColumn>
      <HoldToConfirm
        label="按住确认归档"
        confirmedLabel="已确认"
        duration={1000}
        onConfirm={() => setConfirmed(true)}
      />
      <DemoResult>{confirmed && "已模拟归档项目"}</DemoResult>
    </DemoColumn>
  );
}

export function SwipeActionsDemo() {
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <SwipeActions label="示例收件箱">
        <SwipeActionsRow
          label="设计周报"
          leading={[
            {
              label: "标记未读",
              icon: <MailOpen size={18} />,
              keepRow: true,
              onSelect: () => setResult("已标为未读"),
            },
          ]}
          trailing={[
            { label: "归档", icon: <Archive size={18} />, keepRow: true, onSelect: () => setResult("已模拟归档") },
          ]}
        >
          <div className="px-4 py-3 text-sm">左右滑动查看设计周报的操作</div>
        </SwipeActionsRow>
      </SwipeActions>
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

export function ReactionsDemo() {
  return (
    <Reactions
      options={[
        { id: "like", label: "赞", icon: ThumbsUp },
        { id: "love", label: "喜欢", icon: Heart },
      ]}
      defaultValue={[{ id: "like", count: 3, reacted: false }]}
    />
  );
}

export function IconMorphDemo() {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className="grid size-10 place-items-center rounded-lg border"
      aria-label={open ? "关闭菜单图标" : "打开菜单图标"}
      aria-pressed={open}
      onClick={() => setOpen(!open)}
    >
      <IconMorph name="menu" state={open} size={20} />
    </button>
  );
}

export function ConfirmMorphDemo() {
  return (
    <ConfirmMorph
      label="删除示例"
      icon={<Trash2 size={16} />}
      prompt="确定删除这个示例？"
      confirmMode="hold"
      onConfirm={() => Promise.resolve()}
      onUndo={() => Promise.resolve()}
    />
  );
}

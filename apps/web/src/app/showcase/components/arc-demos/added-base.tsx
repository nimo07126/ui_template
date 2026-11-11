"use client";

import { Button } from "@/shared/arc/button/button";
import { CommandPalette, type CommandItem } from "@/shared/arc/command-palette/command-palette";
import { FileUpload } from "@/shared/arc/file-upload/file-upload";
import { NotificationCenter, type NotificationItem } from "@/shared/arc/notification-center/notification-center";
import { OtpInput } from "@/shared/arc/otp-input/otp-input";
import { FileText, Settings, Users } from "lucide-react";
import { useRef, useState } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

const commands: CommandItem[] = [
  { id: "new", label: "新建文档", group: "文档", keywords: ["new", "document"], icon: <FileText size={16} /> },
  { id: "team", label: "查看团队成员", group: "工作区", keywords: ["team", "members"], icon: <Users size={16} /> },
  { id: "settings", label: "打开工作区设置", group: "工作区", keywords: ["settings"], icon: <Settings size={16} /> },
];

export function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  function closePalette() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <DemoColumn>
      <Button
        ref={triggerRef}
        variant="secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "收起命令面板" : "打开命令面板"}
      </Button>
      {open && (
        <CommandPalette
          items={commands}
          label="工作区命令"
          placeholder="搜索命令"
          autoFocus
          onClose={closePalette}
          onSelect={(item) => {
            setSelected(item.label);
            closePalette();
          }}
        />
      )}
      <DemoResult>{selected && `已选择「${selected}」`}</DemoResult>
    </DemoColumn>
  );
}

export function FileUploadDemo() {
  return (
    <DemoColumn>
      <FileUpload
        label="添加附件"
        description="拖入或选择图片、PDF，单个文件最大 5 MB。"
        accept="image/*,.pdf"
        maxSize={5 * 1024 * 1024}
        onUpload={async (_file, { onProgress, signal }) => {
          for (const progress of [25, 50, 75, 100]) {
            await new Promise<void>((resolve) => setTimeout(resolve, 180));
            signal.throwIfAborted();
            onProgress(progress);
          }
        }}
      />
      <DemoResult>上传进度在本地模拟。</DemoResult>
    </DemoColumn>
  );
}

const notifications: NotificationItem[] = [
  { id: "review", title: "设计稿等待评审", description: "首页方案已更新，请查看最新版本。", time: "5 分钟前" },
  { id: "publish", title: "组件库已发布", description: "新版主题已经可以使用。", time: "1 小时前", tone: "success" },
  { id: "quota", title: "附件空间即将用满", description: "已使用 90% 的可用空间。", time: "昨天", tone: "warning", read: true },
];

export function NotificationCenterDemo() {
  const [result, setResult] = useState("");

  return (
    <DemoColumn>
      <NotificationCenter
        label="工作区通知"
        notifications={notifications}
        onReadChange={(item, read) => setResult(`「${item.title}」已标为${read ? "已读" : "未读"}`)}
        onDismiss={(item) => setResult(`已清除「${item.title}」`)}
      />
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

export function OtpInputDemo() {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const valid = value === "804216";

  return (
    <DemoColumn>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.length === 6) setSubmitted(true);
        }}
      >
        <OtpInput
          label="六位验证码"
          description="输入或粘贴示例验证码 804216。"
          value={value}
          onChange={(next) => {
            setValue(next);
            setSubmitted(false);
          }}
          error={submitted && !valid ? "验证码有误，请重试。" : undefined}
        />
        <Button variant="secondary" type="submit" disabled={value.length !== 6}>验证</Button>
      </form>
      <DemoResult>{submitted && valid ? "验证通过" : ""}</DemoResult>
    </DemoColumn>
  );
}

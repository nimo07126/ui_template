"use client";

import { AnnouncementBar } from "@/shared/arc/announcement-bar/announcement-bar";
import { Button } from "@/shared/arc/button/button";
import { ChatThread, type ChatMessage } from "@/shared/arc/chat-thread/chat-thread";
import { CommentThread, type ThreadComment } from "@/shared/arc/comment-thread/comment-thread";
import { CookieConsent } from "@/shared/arc/cookie-consent/cookie-consent";
import { Countdown } from "@/shared/arc/countdown/countdown";
import { ExpandableText } from "@/shared/arc/expandable-text/expandable-text";
import { MentionInput, type MentionValue } from "@/shared/arc/mention-input/mention-input";
import { RichTextEditor, type RichTextValue } from "@/shared/arc/rich-text-editor/rich-text-editor";
import { useState } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

export function CountdownDemo() {
  const [target, setTarget] = useState(() => Date.now() + 30_000);
  return (
    <DemoColumn>
      <Countdown
        target={target}
        units={["minutes", "seconds"]}
        label="预览发布倒计时"
        completeLabel="预览已发布"
      />
      <Button variant="secondary" onClick={() => setTarget(Date.now() + 30_000)}>
        重新计时 30 秒
      </Button>
    </DemoColumn>
  );
}

export function CookieConsentDemo() {
  return (
    <div className="relative h-72 w-full min-w-0 rounded-xl border bg-card">
      <CookieConsent strategy="absolute" />
    </div>
  );
}

export function AnnouncementBarDemo() {
  const [open, setOpen] = useState(true);
  const [result, setResult] = useState("");
  return (
    <div className="grid w-full min-w-0 gap-3">
      <AnnouncementBar
        label="项目公告"
        open={open}
        onOpenChange={setOpen}
        autoPlay={false}
        controls
        messages={[
          {
            id: "release",
            message: "主题预览已更新",
            action: { label: "查看", onClick: () => setResult("已打开更新说明") },
          },
          { id: "motion", message: "动效示例现已开放" },
        ]}
      />
      {!open && (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          重新显示公告
        </Button>
      )}
      <DemoResult>{result}</DemoResult>
    </div>
  );
}

const currentUser = { id: "me", name: "林可" };
const people = [
  { id: "chen", name: "陈晓", role: "设计师" },
  { id: "zhou", name: "周悦", role: "工程师" },
];

export function MentionInputDemo() {
  const [value, setValue] = useState<MentionValue>({ text: "", mentions: [] });
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <MentionInput
        aria-label="示例评论"
        placeholder="输入 @ 提及成员，按 Enter 提交"
        people={people}
        channels={[{ id: "design", name: "设计评审", description: "讨论当前项目", members: 4 }]}
        value={value}
        onChange={setValue}
        submitOnEnter
        onSubmit={(next) => {
          setResult(next.text);
          setValue({ text: "", mentions: [] });
        }}
      />
      <DemoResult>{result && `示例评论：${result}`}</DemoResult>
    </DemoColumn>
  );
}

const messages: ChatMessage[] = [
  { id: "m1", authorId: "chen", text: "组件预览已经更新了吗？", createdAt: "2026-09-23T09:12:00Z" },
  {
    id: "m2",
    authorId: "me",
    text: "更新了，正在走查深色主题。",
    createdAt: "2026-09-23T09:13:00Z",
    status: "delivered",
  },
];

export function ChatThreadDemo() {
  return (
    <div className="h-80 w-full min-w-0">
      <ChatThread
        participants={[currentUser, people[0]]}
        currentUserId={currentUser.id}
        defaultMessages={messages}
        readBy={{ chen: "m2" }}
        placeholder="在本地添加一条示例消息"
        allowAttachments={false}
      />
    </div>
  );
}

export function RichTextEditorDemo() {
  const [draft, setDraft] = useState<RichTextValue | null>(null);
  const [saved, setSaved] = useState("");
  return (
    <div className="grid w-full min-w-0 gap-3">
      <RichTextEditor
        aria-label="项目更新正文"
        placeholder="撰写项目更新"
        defaultMarkdown={"# 发布记录\n\n- 加入主题预览\n- 更新 **键盘操作**"}
        onChange={setDraft}
      />
      <Button
        variant="secondary"
        disabled={!draft || draft.empty}
        onClick={() => setSaved("已保存本次演示的草稿")}
      >
        保存演示草稿
      </Button>
      <DemoResult>{saved}</DemoResult>
    </div>
  );
}

const comments: ThreadComment[] = [
  { id: "c1", author: people[0], body: "建议在标题下面加一行简短说明。", createdAt: "10:30" },
  { id: "c2", author: currentUser, body: "好的，这样能让读者更快找到示例。", createdAt: "10:35" },
];

export function CommentThreadDemo() {
  return (
    <div className="w-full min-w-0">
      <CommentThread
        title="首页标题讨论"
        currentUser={currentUser}
        people={[currentUser, ...people]}
        defaultComments={comments}
        placeholder="添加一条示例回复"
      />
    </div>
  );
}

export function ExpandableTextDemo() {
  return (
    <DemoColumn>
      <ExpandableText lines={2} moreLabel="展开全文" lessLabel="收起">
        <p>澄序是一套清晰、克制而有温度的界面主题。我们先用语义颜色表达内容，再用排版和留白组织阅读顺序。</p>
        <p>主题工作台可以现场验证各个组件的对比度、状态和动效。打开这段文字，可以查看完整示例。</p>
      </ExpandableText>
    </DemoColumn>
  );
}

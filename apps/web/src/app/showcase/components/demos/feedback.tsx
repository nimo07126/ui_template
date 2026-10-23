"use client";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty";
import { Progress, ProgressLabel, ProgressValue } from "@/shared/ui/progress";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";
import { toast } from "@/shared/ui/toast";
import { Bell, Check, FolderOpen, Info, Plus } from "lucide-react";
import { useState } from "react";
import type { ComponentExample } from "../example-types";
import { notify, row, stack } from "./demo-utils";

function AlertDemo() {
  return (
    <div className="grid w-full gap-3">
      <Alert>
        <Info />
        <AlertTitle>所有修改已同步</AlertTitle>
        <AlertDescription>团队成员现在可以查看最新设计。</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <Info />
        <AlertTitle>邮箱地址不完整</AlertTitle>
        <AlertDescription>请补全邮箱地址后再继续。</AlertDescription>
      </Alert>
    </div>
  );
}

function ProgressDemo() {
  const [value, setValue] = useState(64);
  return (
    <div className={stack}>
      <Progress value={value}>
        <ProgressLabel>资源上传</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Button
        className="justify-self-start"
        size="sm"
        variant="outline"
        onClick={() => setValue(value >= 100 ? 0 : Math.min(100, value + 12))}
      >
        {value >= 100 ? "重新开始" : "模拟进度 +12%"}
      </Button>
    </div>
  );
}

function SkeletonDemo() {
  return (
    <div
      className="flex w-full max-w-sm items-center gap-4"
      role="status"
      aria-label="正在加载内容"
    >
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <span className="sr-only">正在加载内容…</span>
    </div>
  );
}

function SpinnerDemo() {
  return (
    <div className={row}>
      <Button disabled>
        <Spinner />
        正在保存
      </Button>
      <Button disabled variant="outline">
        <Spinner />
        加载中
      </Button>
      <Spinner className="size-6 text-primary" aria-label="正在加载" />
    </div>
  );
}

function EmptyDemo() {
  return (
    <Empty className="w-full p-0 md:p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpen />
        </EmptyMedia>
        <EmptyTitle>还没有项目</EmptyTitle>
        <EmptyDescription>
          从一个想法开始，创建你的第一个项目。
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={() => notify("已创建第一个示例项目")}>
          <Plus />
          创建项目
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function ToastDemo() {
  return (
    <div className={row}>
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            title: "修改已保存",
            description: "最新内容已同步到当前预览。",
            type: "success",
          })
        }
      >
        <Check />
        成功提示
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            title: "连接暂时中断",
            description: "请稍后再试，你的修改仍保留。",
            type: "error",
          })
        }
      >
        错误提示
      </Button>
      <Button
        variant="ghost"
        onClick={() => toast.add({ title: "有新的项目动态", type: "info" })}
      >
        <Bell />
        普通消息
      </Button>
    </div>
  );
}

export const feedbackExamples: ComponentExample[] = [
  {
    id: "alert",
    name: "Alert",
    title: "提示",
    description: "普通说明与错误反馈",
    group: "feedback",
    imports: "Alert, AlertTitle, AlertDescription",
    demo: AlertDemo,
  },
  {
    id: "progress",
    name: "Progress",
    title: "进度条",
    description: "带标签与数值的任务进度",
    group: "feedback",
    imports: "Progress, ProgressLabel, ProgressValue",
    demo: ProgressDemo,
  },
  {
    id: "skeleton",
    name: "Skeleton",
    title: "骨架屏",
    description: "内容加载前保留真实布局结构",
    group: "feedback",
    imports: "Skeleton",
    demo: SkeletonDemo,
  },
  {
    id: "spinner",
    name: "Spinner",
    title: "加载指示",
    description: "独立指示与按钮内的等待状态",
    group: "feedback",
    imports: "Spinner",
    demo: SpinnerDemo,
  },
  {
    id: "empty",
    name: "Empty",
    title: "空状态",
    description: "解释当前状态，并给出下一步行动",
    group: "feedback",
    imports: "Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent",
    demo: EmptyDemo,
  },
  {
    id: "toast",
    name: "Toast",
    title: "消息通知",
    description: "成功、错误与普通消息的即时反馈",
    group: "feedback",
    imports: "Toaster, toast",
    demo: ToastDemo,
  },
];

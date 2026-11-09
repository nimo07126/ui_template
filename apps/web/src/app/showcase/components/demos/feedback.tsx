"use client";

import { Alert } from "@/shared/arc/alert/alert";
import { EmptyState } from "@/shared/arc/empty-state/empty-state";
import { Progress } from "@/shared/arc/progress/progress";
import { Skeleton } from "@/shared/arc/skeleton/skeleton";
import { useToastStack } from "@/shared/arc/toast-stack/toast-stack";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { Bell, Check, FolderOpen, Plus } from "lucide-react";
import { useState } from "react";
import { row, stack, useNotify } from "./demo-utils";

export function AlertDemo() {
  return (
    <div className="grid w-full gap-3">
      <Alert tone="info" title="所有修改已同步">
        团队成员现在可以查看最新设计。
      </Alert>
      <Alert tone="danger" title="邮箱地址不完整">
        请补全邮箱地址后再继续。
      </Alert>
    </div>
  );
}

export function ProgressDemo() {
  const [value, setValue] = useState(64);
  return (
    <div className={stack}>
      <Progress value={value} label="资源上传" showValue />
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

export function SkeletonDemo() {
  return (
    <Skeleton className="w-full max-w-sm" label="正在加载内容" avatar />
  );
}

export function SpinnerDemo() {
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

export function EmptyDemo() {
  const notify = useNotify();
  return (
    <EmptyState
      className="w-full"
      title="还没有项目"
      description="从一个想法开始，创建你的第一个项目。"
      icon={<FolderOpen />}
      action={
        <Button size="sm" onClick={() => notify("已创建第一个示例项目")}>
          <Plus />
          创建项目
        </Button>
      }
    />
  );
}

export function ToastDemo() {
  const { toast } = useToastStack();
  return (
    <div className={row}>
      <Button
        variant="outline"
        onClick={() =>
          toast({
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
          toast({
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
        onClick={() => toast({ title: "有新的项目动态", type: "info" })}
      >
        <Bell />
        普通消息
      </Button>
    </div>
  );
}

"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/shared/arc/dialog/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "@/shared/arc/drawer/drawer";
import { DropdownMenu } from "@/shared/arc/dropdown-menu/dropdown-menu";
import { Input } from "@/shared/arc/input/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/arc/popover/popover";
import { Switch } from "@/shared/arc/switch/switch";
import { Tooltip } from "@/shared/arc/tooltip/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { ChevronDown, Settings, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { row, useNotify } from "./demo-utils";

export function DialogDemo() {
  const [open, setOpen] = useState(false);
  const notify = useNotify();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">编辑项目</Button>
      </DialogTrigger>
      <DialogContent
        title="编辑项目"
        description="调整项目名称，让团队更容易找到它。"
        closeLabel="关闭对话框"
      >
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            notify("项目名称已更新");
            setOpen(false);
          }}
        >
          <Input label="项目名称" defaultValue="澄光品牌焕新" />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit">保存修改</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AlertDialogDemo() {
  const [open, setOpen] = useState(false);
  const notify = useNotify();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Trash2 />
        移除示例项目
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认移除这个项目？</AlertDialogTitle>
          <AlertDialogDescription>
            这是确认弹窗的交互演示，确认后会显示一条反馈消息。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setOpen(false);
              notify("已演示移除项目");
            }}
          >
            确认移除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SheetDemo() {
  const notify = useNotify();
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <Settings />
          打开侧边面板
        </Button>
      </DrawerTrigger>
      <DrawerContent
        title="项目偏好"
        description="在保留当前页面上下文的同时调整设置。"
        closeLabel="关闭侧边面板"
      >
        <div className="grid gap-6">
          <Input label="项目名称" defaultValue="澄光品牌焕新" />
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="sheet-notification" className="text-sm font-medium">
              接收项目通知
            </label>
            <Switch id="sheet-notification" label="接收项目通知" defaultChecked />
          </div>
          <DrawerClose asChild>
            <Button className="justify-self-end" onClick={() => notify("偏好已保存")}>
              保存偏好
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function DropdownDemo() {
  const notify = useNotify();
  return (
    <DropdownMenu
      label="项目操作"
      items={[
        { label: "编辑项目", icon: <Settings />, onSelect: () => notify("已演示编辑项目") },
        { label: "加入收藏", icon: <Star />, onSelect: () => notify("已收藏项目") },
        {
          label: "移除项目",
          icon: <Trash2 />,
          destructive: true,
          separatorBefore: true,
          onSelect: () => notify("已演示移除项目"),
        },
      ]}
    />
  );
}

export function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          显示偏好
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" aria-labelledby="popover-heading">
        <h3 className="m-0 text-sm font-semibold" id="popover-heading">显示偏好</h3>
        <p className="mt-1 text-xs text-muted-foreground">只影响当前示例的交互状态。</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <label htmlFor="popover-details" className="text-sm font-medium">显示项目详情</label>
          <Switch id="popover-details" label="显示项目详情" defaultChecked />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TooltipDemo() {
  return (
    <div className={row}>
      <Tooltip content="将项目加入收藏">
        <Button variant="outline" size="icon" aria-label="收藏提示">
          <Star />
        </Button>
      </Tooltip>
      <span className="text-xs text-muted-foreground">
        悬停或通过键盘聚焦图标
      </span>
    </div>
  );
}

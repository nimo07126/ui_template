"use client";

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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { Switch } from "@/shared/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { ChevronDown, Settings, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ComponentExample } from "../example-types";
import { notify, row } from "./demo-utils";

function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        编辑项目
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            notify("项目名称已更新");
          }}
        >
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
            <DialogDescription>
              调整项目名称，让团队更容易找到它。
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 grid gap-2">
            <Label htmlFor="dialog-project">项目名称</Label>
            <Input id="dialog-project" defaultValue="澄光品牌焕新" />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <DialogClose
              render={<Button type="button" />}
              onClick={() => notify("项目名称已更新")}
            >
              保存修改
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AlertDialogDemo() {
  const [open, setOpen] = useState(false);
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

function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        <Settings />
        打开侧边面板
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>项目偏好</SheetTitle>
          <SheetDescription>
            在保留当前页面上下文的同时调整设置。
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4">
          <Label htmlFor="sheet-title">项目名称</Label>
          <Input id="sheet-title" defaultValue="澄光品牌焕新" />
          <Label htmlFor="sheet-notification">
            <Switch id="sheet-notification" defaultChecked />
            接收项目通知
          </Label>
        </div>
        <SheetFooter>
          <SheetClose render={<Button />} onClick={() => notify("偏好已保存")}>
            保存偏好
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DropdownDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        项目操作
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>澄光品牌焕新</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => notify("已演示编辑项目")}>
            <Settings />
            编辑项目
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => notify("已收藏项目")}>
            <Star />
            加入收藏
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => notify("已演示移除项目")}
          >
            <Trash2 />
            移除项目
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        显示偏好
        <ChevronDown />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <PopoverHeader>
          <PopoverTitle>显示偏好</PopoverTitle>
          <PopoverDescription>只影响当前示例的交互状态。</PopoverDescription>
        </PopoverHeader>
        <Label className="mt-4 justify-between" htmlFor="popover-details">
          显示项目详情
          <Switch id="popover-details" defaultChecked />
        </Label>
      </PopoverContent>
    </Popover>
  );
}

function TooltipDemo() {
  return (
    <div className={row}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="outline" size="icon" aria-label="收藏提示" />
          }
        >
          <Star />
        </TooltipTrigger>
        <TooltipContent>将项目加入收藏</TooltipContent>
      </Tooltip>
      <span className="text-xs text-muted-foreground">
        悬停或通过键盘聚焦图标
      </span>
    </div>
  );
}

export const overlaysExamples: ComponentExample[] = [
  {
    id: "dialog",
    name: "Dialog",
    title: "对话框",
    description: "承载需要专注完成的编辑任务",
    group: "overlays",
    imports: "Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle",
    demo: DialogDemo,
  },
  {
    id: "alert-dialog",
    name: "Alert Dialog",
    title: "确认弹窗",
    description: "为关键操作提供明确的确认与取消",
    group: "overlays",
    imports:
      "AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogAction",
    demo: AlertDialogDemo,
  },
  {
    id: "sheet",
    name: "Sheet",
    title: "侧边面板",
    description: "保留页面上下文的设置与详情",
    group: "overlays",
    imports: "Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle",
    demo: SheetDemo,
  },
  {
    id: "dropdown-menu",
    name: "Dropdown Menu",
    title: "下拉菜单",
    description: "操作分组、分隔线与危险操作",
    group: "overlays",
    imports:
      "DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem",
    demo: DropdownDemo,
  },
  {
    id: "popover",
    name: "Popover",
    title: "气泡面板",
    description: "在触发位置附近提供轻量交互",
    group: "overlays",
    imports: "Popover, PopoverTrigger, PopoverContent",
    demo: PopoverDemo,
  },
  {
    id: "tooltip",
    name: "Tooltip",
    title: "文字提示",
    description: "悬停与键盘聚焦时解释图标用途",
    group: "overlays",
    imports: "Tooltip, TooltipTrigger, TooltipContent",
    demo: TooltipDemo,
  },
];

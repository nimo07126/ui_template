"use client";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/shared/ui/progress";
import { Separator } from "@/shared/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { ArrowRight, Check } from "lucide-react";
import type { ComponentExample } from "../example-types";
import { notify, row, stack } from "./demo-utils";

function BadgeDemo() {
  return (
    <div className={row}>
      <Badge>进行中</Badge>
      <Badge variant="secondary">
        <Check />
        已完成
      </Badge>
      <Badge variant="outline">待确认</Badge>
      <Badge variant="destructive">需处理</Badge>
    </div>
  );
}

function CardDemo() {
  return (
    <Card className="w-full max-w-sm" size="sm">
      <CardHeader>
        <CardTitle>澄光品牌焕新</CardTitle>
        <CardDescription>品牌设计 · 更新于 10 分钟前</CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={78}>
          <ProgressLabel>项目进度</ProgressLabel>
          <ProgressValue />
        </Progress>
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-xs text-muted-foreground">距离目标更近一步</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => notify("已打开示例项目")}
        >
          查看项目
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function AvatarDemo() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <Avatar size="lg">
        <AvatarFallback>林</AvatarFallback>
        <AvatarBadge aria-label="在线" />
      </Avatar>
      <Avatar>
        <AvatarFallback>陈</AvatarFallback>
      </Avatar>
      <Avatar size="sm">
        <AvatarFallback>周</AvatarFallback>
      </Avatar>
      <AvatarGroup>
        {["林", "陈", "周"].map((name) => (
          <Avatar key={name}>
            <AvatarFallback>{name}</AvatarFallback>
          </Avatar>
        ))}
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>
    </div>
  );
}

function TableDemo() {
  return (
    <Table>
      <TableCaption>最近更新的 3 个示例项目</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>项目名称</TableHead>
          <TableHead>状态</TableHead>
          <TableHead className="text-right">进度</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[
          ["品牌焕新", "进行中", "78%"],
          ["官网设计", "待确认", "92%"],
          ["组件整理", "已完成", "100%"],
        ].map(([name, status, progress]) => (
          <TableRow key={name}>
            <TableCell className="font-medium">{name}</TableCell>
            <TableCell>
              <Badge variant={status === "进行中" ? "default" : "secondary"}>
                {status}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {progress}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SeparatorDemo() {
  return (
    <div className={stack}>
      <div>
        <p className="text-sm font-medium">把相关内容放在一起</p>
        <p className="mt-1 text-xs text-muted-foreground">
          用分隔线建立轻量的内容边界。
        </p>
      </div>
      <Separator />
      <div className="flex h-4 items-center gap-4 text-sm">
        <span>设计</span>
        <Separator orientation="vertical" />
        <span>开发</span>
        <Separator orientation="vertical" />
        <span>交付</span>
      </div>
    </div>
  );
}

export const dataExamples: ComponentExample[] = [
  {
    id: "badge",
    name: "Badge",
    title: "徽标",
    description: "默认、次要、描边与危险状态",
    group: "data",
    imports: "Badge",
    demo: BadgeDemo,
  },
  {
    id: "card",
    name: "Card",
    title: "卡片",
    description: "将项目信息、进度与操作组织在一起",
    group: "data",
    imports:
      "Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter",
    demo: CardDemo,
  },
  {
    id: "avatar",
    name: "Avatar",
    title: "头像",
    description: "尺寸、文字回退、在线状态与头像组",
    group: "data",
    imports: "Avatar, AvatarFallback, AvatarGroup",
    demo: AvatarDemo,
  },
  {
    id: "table",
    name: "Table",
    title: "表格",
    description: "表头、数据行与状态信息",
    group: "data",
    imports: "Table, TableHeader, TableBody, TableRow, TableHead, TableCell",
    demo: TableDemo,
  },
  {
    id: "separator",
    name: "Separator",
    title: "分隔线",
    description: "水平与垂直的轻量内容边界",
    group: "data",
    imports: "Separator",
    demo: SeparatorDemo,
  },
];

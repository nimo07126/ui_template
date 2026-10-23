"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useState } from "react";
import type { ComponentExample } from "../example-types";

function TabsDemo() {
  return (
    <Tabs defaultValue="overview" className="w-full max-w-sm">
      <TabsList aria-label="项目详情">
        <TabsTrigger value="overview">项目概览</TabsTrigger>
        <TabsTrigger value="activity">最新动态</TabsTrigger>
        <TabsTrigger value="settings" disabled>
          设置
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="overview"
        className="rounded-lg border p-4 text-muted-foreground"
      >
        设计规则、组件与内容，都在同一处。
      </TabsContent>
      <TabsContent
        value="activity"
        className="rounded-lg border p-4 text-muted-foreground"
      >
        林然更新了品牌设计稿 · 10 分钟前
      </TabsContent>
    </Tabs>
  );
}

function AccordionDemo() {
  return (
    <Accordion className="w-full" defaultValue={["theme"]}>
      <AccordionItem value="theme">
        <AccordionTrigger>组件会跟随主题变化吗？</AccordionTrigger>
        <AccordionContent>
          会。所有示例共用澄序的语义颜色，切换主题或编辑颜色后会即时更新。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="reuse">
        <AccordionTrigger>如何在其他页面使用？</AccordionTrigger>
        <AccordionContent>
          从 components/ui 引入对应组件，即可复用相同的交互和主题规则。
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function BreadcrumbDemo() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>设计系统</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>组件预览</BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>导航切换</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(1);
  const navigate = (
    event: React.MouseEvent<HTMLAnchorElement>,
    next: number,
  ) => {
    event.preventDefault();
    setPage(next);
  };
  return (
    <div className="grid gap-4">
      <Pagination aria-label="示例列表分页">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              text="上一页"
              href="#pagination"
              aria-label="上一页"
              aria-disabled={page === 1}
              className={page === 1 ? "pointer-events-none opacity-50" : ""}
              onClick={(event) => navigate(event, Math.max(1, page - 1))}
            />
          </PaginationItem>
          {[1, 2, 3].map((number) => (
            <PaginationItem key={number}>
              <PaginationLink
                href="#pagination"
                isActive={page === number}
                aria-label={`第 ${number} 页`}
                onClick={(event) => navigate(event, number)}
              >
                {number}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              text="下一页"
              href="#pagination"
              aria-label="下一页"
              aria-disabled={page === 3}
              className={page === 3 ? "pointer-events-none opacity-50" : ""}
              onClick={(event) => navigate(event, Math.min(3, page + 1))}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <p
        className="text-center text-xs text-muted-foreground"
        aria-live="polite"
      >
        当前第 {page} 页，共 3 页
      </p>
    </div>
  );
}

export const navigationExamples: ComponentExample[] = [
  {
    id: "tabs",
    name: "Tabs",
    title: "选项卡",
    description: "在同级内容之间切换，支持禁用项",
    group: "navigation",
    imports: "Tabs, TabsList, TabsTrigger, TabsContent",
    demo: TabsDemo,
  },
  {
    id: "accordion",
    name: "Accordion",
    title: "折叠面板",
    description: "按需展开内容，减少页面阅读负担",
    group: "navigation",
    imports: "Accordion, AccordionItem, AccordionTrigger, AccordionContent",
    demo: AccordionDemo,
  },
  {
    id: "breadcrumb",
    name: "Breadcrumb",
    title: "面包屑",
    description: "呈现页面层级与当前位置",
    group: "navigation",
    imports: "Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage",
    demo: BreadcrumbDemo,
  },
  {
    id: "pagination",
    name: "Pagination",
    title: "分页",
    description: "页码切换、当前页与首尾边界",
    group: "navigation",
    imports: "Pagination, PaginationContent, PaginationItem, PaginationLink",
    demo: PaginationDemo,
  },
];

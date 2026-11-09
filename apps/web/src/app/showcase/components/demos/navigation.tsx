"use client";

import { Accordion } from "@/shared/arc/accordion/accordion";
import { Breadcrumb } from "@/shared/arc/breadcrumb/breadcrumb";
import { Pagination } from "@/shared/arc/pagination/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/arc/tabs/tabs";
import { useState } from "react";

export function TabsDemo() {
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

export function AccordionDemo() {
  return (
    <div className="w-full">
      <Accordion
        defaultOpen={0}
        items={[
          {
            title: "组件会跟随主题变化吗？",
            content: "会。所有示例共用澄序的语义颜色，切换主题或编辑颜色后会即时更新。",
          },
          {
            title: "如何在其他页面使用？",
            content: "复制示例的引用语句，即可复用相同的交互和主题规则。",
          },
        ]}
      />
    </div>
  );
}

export function BreadcrumbDemo() {
  return (
    <Breadcrumb
      ariaLabel="示例面包屑"
      items={[
        { label: "设计系统" },
        { label: "组件预览" },
        { label: "导航切换" },
      ]}
    />
  );
}

export function PaginationDemo() {
  const [page, setPage] = useState(1);
  return (
    <div className="grid gap-4">
      <Pagination
        label="示例列表分页"
        page={page}
        pageCount={3}
        onPageChange={setPage}
        previousLabel="上一页"
        nextLabel="下一页"
        getPageLabel={(number) => `第 ${number} 页`}
      />
      <p
        className="text-center text-xs text-muted-foreground"
        aria-live="polite"
      >
        当前第 {page} 页，共 3 页
      </p>
    </div>
  );
}

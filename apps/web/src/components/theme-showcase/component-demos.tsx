"use client";

import { useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bell,
  Bold,
  Check,
  ChevronDown,
  FolderOpen,
  Info,
  Italic,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Underline,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const row = "flex flex-wrap items-center gap-2";
const stack = "grid w-full max-w-sm gap-4";
const notify = (title: string) =>
  toast.add({
    title,
    description: "这是组件预览，仅在当前页面演示。",
    type: "success",
  });

function ButtonsDemo() {
  return (
    <div className="grid gap-5">
      <div className={row}>
        <Button onClick={() => notify("已新建示例项目")}>
          <Plus data-icon="inline-start" />
          新建项目
        </Button>
        <Button variant="secondary" onClick={() => notify("草稿已保存")}>
          次要操作
        </Button>
        <Button variant="outline" onClick={() => notify("草稿已保存")}>
          保存草稿
        </Button>
        <Button variant="ghost" onClick={() => notify("已取消操作")}>
          取消
        </Button>
        <Button variant="destructive" onClick={() => notify("已演示危险操作")}>
          危险操作
        </Button>
        <Button variant="link" onClick={() => notify("已点击文字链接")}>
          文字链接
        </Button>
        <Button disabled>暂不可用</Button>
      </div>
      <div className={row}>
        <Button size="xs">超小</Button>
        <Button size="sm">小号</Button>
        <Button>默认</Button>
        <Button size="lg">大号</Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="更多按钮操作"
          onClick={() => notify("已点击图标按钮")}
        >
          <MoreHorizontal />
        </Button>
      </div>
    </div>
  );
}
function ButtonGroupDemo() {
  return (
    <ButtonGroup>
      <Button variant="outline" onClick={() => notify("草稿已保存")}>
        保存草稿
      </Button>
      <Button
        variant="outline"
        onClick={() => notify("已展开保存选项")}
        aria-label="更多保存选项"
        size="icon"
      >
        <ChevronDown />
      </Button>
    </ButtonGroup>
  );
}
function ToggleDemo() {
  return (
    <div className={row}>
      <Toggle aria-label="收藏项目" variant="outline">
        <Star />
        收藏
      </Toggle>
      <Toggle aria-label="粗体" defaultPressed>
        <Bold />
      </Toggle>
      <Toggle aria-label="不可用的斜体" disabled>
        <Italic />
      </Toggle>
    </div>
  );
}
function ToggleGroupDemo() {
  return (
    <div className="grid gap-4">
      <ToggleGroup
        defaultValue={["left"]}
        variant="outline"
        spacing={0}
        aria-label="文本对齐"
      >
        <ToggleGroupItem value="left" aria-label="左对齐">
          <AlignLeft />
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="居中对齐">
          <AlignCenter />
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="右对齐">
          <AlignRight />
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup multiple defaultValue={["bold"]} aria-label="文字样式">
        <ToggleGroupItem value="bold" aria-label="加粗">
          <Bold />
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="斜体">
          <Italic />
        </ToggleGroupItem>
        <ToggleGroupItem value="underline" aria-label="下划线">
          <Underline />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
function InputDemo() {
  return (
    <div className={stack}>
      <div className="grid gap-2">
        <Label htmlFor="demo-project">项目名称</Label>
        <Input id="demo-project" placeholder="例如：春季品牌更新" />
        <p className="text-xs text-muted-foreground">名称之后仍然可以修改。</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="demo-email">工作邮箱</Label>
        <Input
          id="demo-email"
          aria-invalid="true"
          aria-describedby="demo-email-error"
          defaultValue="lin@example"
          type="email"
        />
        <p id="demo-email-error" className="text-xs text-destructive">
          请输入完整的邮箱地址。
        </p>
      </div>
      <Input disabled aria-label="禁用输入框" placeholder="当前不可编辑" />
    </div>
  );
}
function InputGroupDemo() {
  return (
    <div className={stack}>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput aria-label="搜索项目" placeholder="搜索项目…" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>⌘ K</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>
          <Mail />
        </InputGroupAddon>
        <InputGroupInput aria-label="团队邮箱名称" placeholder="your-team" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>@example.com</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
function TextareaDemo() {
  const [text, setText] = useState("");
  return (
    <div className={stack}>
      <div className="grid gap-2">
        <Label htmlFor="demo-description">项目描述</Label>
        <Textarea
          id="demo-description"
          placeholder="简单介绍这次项目的目标…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={200}
          aria-describedby="demo-description-count"
        />
        <p
          id="demo-description-count"
          className="text-right text-xs tabular-nums text-muted-foreground"
        >
          {text.length} / 200
        </p>
      </div>
    </div>
  );
}
function CheckboxDemo() {
  return (
    <div className="grid gap-4">
      <Label htmlFor="demo-check">
        <Checkbox id="demo-check" defaultChecked />
        接收项目更新通知
      </Label>
      <Label htmlFor="demo-check-all">
        <Checkbox id="demo-check-all" indeterminate />
        部分选中
      </Label>
      <Label htmlFor="demo-check-disabled">
        <Checkbox id="demo-check-disabled" disabled />
        暂不可选择
      </Label>
    </div>
  );
}
function RadioDemo() {
  return (
    <RadioGroup defaultValue="team" aria-label="项目可见范围" className="gap-4">
      <Label htmlFor="demo-radio-private">
        <RadioGroupItem id="demo-radio-private" value="private" />
        仅自己可见
      </Label>
      <Label htmlFor="demo-radio-team">
        <RadioGroupItem id="demo-radio-team" value="team" />
        团队成员可见
      </Label>
      <Label htmlFor="demo-radio-public">
        <RadioGroupItem id="demo-radio-public" value="public" disabled />
        公开访问（暂未开放）
      </Label>
    </RadioGroup>
  );
}
function SelectDemo() {
  const options = [
    { value: "design", label: "设计团队" },
    { value: "product", label: "产品团队" },
    { value: "engineering", label: "研发团队" },
  ];
  return (
    <div className={stack}>
      <Label id="demo-team-label">所属团队</Label>
      <Select items={options} defaultValue="design">
        <SelectTrigger aria-labelledby="demo-team-label" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select disabled>
        <SelectTrigger aria-label="未开放的团队选择" className="w-full">
          <SelectValue placeholder="暂不可选择" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">暂无团队</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
function SwitchDemo() {
  return (
    <div className="grid w-full max-w-sm gap-5">
      <div className="flex items-center justify-between gap-6">
        <div className="grid gap-1">
          <Label htmlFor="demo-notification">消息通知</Label>
          <p className="text-xs text-muted-foreground">
            接收与你相关的项目动态。
          </p>
        </div>
        <Switch id="demo-notification" defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="demo-auto-save">自动保存</Label>
        <Switch id="demo-auto-save" />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="demo-disabled-switch">管理员选项</Label>
        <Switch id="demo-disabled-switch" disabled />
      </div>
    </div>
  );
}
function SliderDemo() {
  const [value, setValue] = useState([64]);
  return (
    <div className={stack}>
      <div className="flex items-center justify-between text-sm">
        <Label id="demo-volume-label">预览音量</Label>
        <output className="tabular-nums text-muted-foreground">
          {value[0]}%
        </output>
      </div>
      <Slider
        aria-labelledby="demo-volume-label"
        value={value}
        onValueChange={(next) => setValue(Array.isArray(next) ? next : [next])}
      />
      <p className="mt-2 text-xs text-muted-foreground">区间选择</p>
      <Slider aria-label="价格区间" defaultValue={[25, 75]} />
      <Slider aria-label="禁用滑块" defaultValue={[40]} disabled />
    </div>
  );
}
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

export const componentGroups = [
  {
    id: "actions",
    name: "基础操作",
    description: "用清晰的层级表达操作优先级。",
    icon: "01",
  },
  {
    id: "forms",
    name: "表单输入",
    description: "从填写到选择，覆盖完整的输入状态。",
    icon: "02",
  },
  {
    id: "navigation",
    name: "导航切换",
    description: "组织内容，帮助用户找到当前位置。",
    icon: "03",
  },
  {
    id: "data",
    name: "数据展示",
    description: "让信息有层次，让状态一目了然。",
    icon: "04",
  },
  {
    id: "feedback",
    name: "反馈状态",
    description: "及时回应操作，照顾等待与空白时刻。",
    icon: "05",
  },
  {
    id: "overlays",
    name: "浮层交互",
    description: "在需要的时候，展开更多信息与操作。",
    icon: "06",
  },
] as const;

type ComponentExample = {
  id: string;
  name: string;
  title: string;
  description: string;
  group: (typeof componentGroups)[number]["id"];
  imports: string;
  demo: React.ComponentType;
};
export const componentExamples: ComponentExample[] = [
  {
    id: "button",
    name: "Button",
    title: "按钮",
    description: "6 种操作变体、4 种尺寸与禁用状态",
    group: "actions",
    imports: "Button",
    demo: ButtonsDemo,
  },
  {
    id: "button-group",
    name: "Button Group",
    title: "按钮组",
    description: "将有关联的操作聚合在一起",
    group: "actions",
    imports: "ButtonGroup",
    demo: ButtonGroupDemo,
  },
  {
    id: "toggle",
    name: "Toggle",
    title: "切换按钮",
    description: "单个选项的开启、关闭与禁用",
    group: "actions",
    imports: "Toggle",
    demo: ToggleDemo,
  },
  {
    id: "toggle-group",
    name: "Toggle Group",
    title: "切换按钮组",
    description: "支持单选对齐与多选文字样式",
    group: "actions",
    imports: "ToggleGroup, ToggleGroupItem",
    demo: ToggleGroupDemo,
  },
  {
    id: "input",
    name: "Input / Label",
    title: "输入框与标签",
    description: "默认、错误反馈与禁用状态",
    group: "forms",
    imports: "Input",
    demo: InputDemo,
  },
  {
    id: "input-group",
    name: "Input Group",
    title: "组合输入",
    description: "为输入框添加图标、快捷键和后缀",
    group: "forms",
    imports: "InputGroup, InputGroupInput, InputGroupAddon",
    demo: InputGroupDemo,
  },
  {
    id: "textarea",
    name: "Textarea",
    title: "多行输入",
    description: "长文本编辑与实时字数统计",
    group: "forms",
    imports: "Textarea",
    demo: TextareaDemo,
  },
  {
    id: "checkbox",
    name: "Checkbox",
    title: "复选框",
    description: "已选、部分选中与禁用状态",
    group: "forms",
    imports: "Checkbox",
    demo: CheckboxDemo,
  },
  {
    id: "radio-group",
    name: "Radio Group",
    title: "单选组",
    description: "从一组互斥选项中选择一个",
    group: "forms",
    imports: "RadioGroup, RadioGroupItem",
    demo: RadioDemo,
  },
  {
    id: "select",
    name: "Select",
    title: "选择器",
    description: "下拉选择、键盘导航与禁用状态",
    group: "forms",
    imports: "Select, SelectTrigger, SelectValue, SelectContent, SelectItem",
    demo: SelectDemo,
  },
  {
    id: "switch",
    name: "Switch",
    title: "开关",
    description: "即时生效的偏好与状态切换",
    group: "forms",
    imports: "Switch",
    demo: SwitchDemo,
  },
  {
    id: "slider",
    name: "Slider",
    title: "滑块",
    description: "数值调节、区间选择与禁用状态",
    group: "forms",
    imports: "Slider",
    demo: SliderDemo,
  },
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

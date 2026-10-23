import { toast } from "@/shared/ui/toast";

export const row = "flex flex-wrap items-center gap-2";

export const stack = "grid w-full max-w-sm gap-4";

export const notify = (title: string) =>
  toast.add({
    title,
    description: "这是组件预览，仅在当前页面演示。",
    type: "success",
  });

import { useToastStack } from "@/shared/arc/toast-stack/toast-stack";

export const row = "flex flex-wrap items-center gap-2";

export const stack = "grid w-full max-w-sm gap-4";

export function useNotify() {
  const { toast } = useToastStack();
  return (title: string) =>
    toast({
      title,
      description: "这是组件预览，仅在当前页面演示。",
      type: "success",
    });
}

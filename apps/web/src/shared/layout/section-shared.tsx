import { cn } from "@/shared/lib/utils";
import type { ComponentProps } from "react";

export function SectionShared({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 py-4 px-0 gap-6 max-[68rem]:grid-cols-1 max-[68rem]:gap-8 max-[52rem]:grid-cols-1 max-[52rem]:py-12 max-[52rem]:px-0 max-[52rem]:gap-6 max-[36rem]:py-8 max-[36rem]:px-0",
        className,
      )}
      {...props}
    />
  );
}

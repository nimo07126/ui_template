import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input text-[var(--theme-field-foreground)] hover:border-[var(--theme-field-border-hover)] focus-visible:bg-[var(--theme-field-focus)] bg-[var(--theme-field-background)] px-2.5 py-2 text-base transition-colors outline-none placeholder:text-[var(--theme-field-placeholder)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-[var(--theme-disabled)] disabled:text-[var(--theme-disabled-foreground)] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm   dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

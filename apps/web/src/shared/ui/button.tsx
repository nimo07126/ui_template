"use client";

import { Button as ArcButton, type ButtonProps as ArcButtonProps } from "@/shared/arc/button/button";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:bg-[var(--theme-disabled)] disabled:text-[var(--theme-disabled-foreground)] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--theme-button-primary-hover)]",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[var(--theme-button-secondary-hover)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "bg-[var(--theme-button-ghost)] text-[var(--theme-button-ghost-foreground)] hover:bg-[var(--theme-button-ghost-hover)] aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-[var(--theme-button-danger)] text-[var(--theme-button-danger-foreground)] hover:bg-[var(--theme-button-danger-hover)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-[var(--theme-link)] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const arcVariants = {
  default: "primary",
  outline: "secondary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "danger",
  link: "ghost",
} satisfies Record<NonNullable<VariantProps<typeof buttonVariants>["variant"]>, ArcButtonProps["variant"]>;

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  style,
  ref,
  type = "button",
  focusableWhenDisabled,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  if (render || nativeButton === false || focusableWhenDisabled || typeof className === "function" || typeof style === "function") {
    return (
      <ButtonPrimitive
        data-slot="button"
        render={render}
        nativeButton={nativeButton}
        ref={ref}
        type={type}
        focusableWhenDisabled={focusableWhenDisabled}
        style={style}
        className={typeof className === "function"
          ? (state) => buttonVariants({ variant, size, className: className(state) })
          : cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }

  return <ArcButton
    data-slot="button"
    data-chengxu-button={variant ?? "default"}
    data-chengxu-size={size ?? "default"}
    ref={ref as React.Ref<HTMLButtonElement>}
    variant={arcVariants[variant ?? "default"]}
    type={type}
    className={className}
    style={style}
    {...props}
  />;
}

export { Button, buttonVariants };

import type { ReactNode } from "react";

export function DemoColumn({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid w-full max-w-sm min-w-0 gap-3 ${className}`}>{children}</div>;
}

export function DemoResult({ children }: { children: ReactNode }) {
  return (
    <p className="min-h-4 text-xs text-muted-foreground" role="status">
      {children}
    </p>
  );
}

export const projectNames = ["品牌焕新", "产品网站", "组件库"];
export const projectOptions = projectNames.map((label, index) => ({ value: String(index), label }));

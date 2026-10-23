export function TypographyAdvice() {
  return (
    <div className="flex items-baseline rounded-[var(--ds-radius-md)] bg-[var(--ds-color-surface-subtle)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] p-4 gap-3 max-[36rem]:grid max-[36rem]:gap-1">
      <span>阅读建议</span>
      <strong className="text-[var(--ds-color-ink-soft)] font-[number:var(--type-weight-medium)]">
        正文行宽约 32–40 个汉字；窄屏下展示字号会适度缩小，参数仍展示基础
        token。
      </strong>
    </div>
  );
}

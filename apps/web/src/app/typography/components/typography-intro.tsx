export function TypographyIntro() {
  return (
    <div className="max-w-172 max-[52rem]:max-w-144">
      <h1
        className="text-[length:var(--type-size-2xl)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] leading-[var(--type-line-heading)] m-0 max-[52rem]:text-[length:var(--type-size-2xl)] max-[36rem]:text-[length:var(--type-size-xl)]"
        id="typography-title"
      >
        从展示到阅读，
        <br />
        每一级都有依据。
      </h1>
      <p className="mt-4 mb-0 text-[var(--ds-color-muted)] text-[length:var(--type-size-sm)] leading-[var(--type-line-body)] mx-0">
        字体规范不只是几种字号示例。这里定义字体族、字号分类、行高、字重与字距，让不同页面能够使用同一套排版尺度。
      </p>
    </div>
  );
}

export function SpacingIntro() {
  return (
    <div className="max-w-92 max-[52rem]:max-w-144">
      <h1
        className="text-[length:var(--type-size-2xl)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] leading-[var(--type-line-heading)] m-0 max-[52rem]:text-[length:var(--type-size-2xl)] max-[36rem]:text-[length:var(--type-size-xl)]"
        id="spacing-title"
      >
        节奏来自距离，
        <br />
        而不是更多装饰。
      </h1>
      <p className="mt-4 mb-0 text-[var(--ds-color-muted)] text-[length:var(--type-size-sm)] leading-[var(--type-line-body)] mx-0">
        间距以 4px
        为基础递增；圆角随元素层级变化。尺寸有规律，界面就会显得从容。
      </p>
    </div>
  );
}

"use client";

import { useId, useState, type CSSProperties } from "react";

type ColorOption = {
  token: string;
  name: string;
  usage: string;
};

const foreground = (usage: string): ColorOption => ({
  token: "foreground",
  name: "主要文字",
  usage,
});
const muted = (usage: string): ColorOption => ({
  token: "muted",
  name: "辅助文字",
  usage,
});
const link = (usage: string): ColorOption => ({
  token: "link",
  name: "链接文字",
  usage,
});
const danger: ColorOption = {
  token: "danger-soft-foreground",
  name: "错误文字",
  usage: "校验错误、失败原因与危险操作提示",
};

function colorOptions(size: string): ColorOption[] {
  if (size.startsWith("display")) {
    return [
      foreground("品牌主标题、首屏标语与关键数字"),
      {
        token: "accent-soft-foreground",
        name: "强调文字",
        usage: "品牌关键词、活动主题与重点数字",
      },
      {
        token: "success-soft-foreground",
        name: "成功文字",
        usage: "已完成目标与正向业务指标",
      },
    ];
  }
  if (size.startsWith("heading")) {
    return [
      foreground(
        size === "headingXs"
          ? "卡片标题、表单分组与小节标题"
          : "页面标题、区块标题与卡片标题",
      ),
      muted("次级分组与低强调的小节标题"),
      link("可点击的文章标题与详情入口"),
    ];
  }
  if (size.startsWith("body")) {
    const primary = foreground("正文段落、内容摘要与重要说明");
    const secondary = muted(
      size === "bodyXs"
        ? "备注、时间戳、来源与次要补充信息"
        : "辅助说明、描述与补充信息",
    );
    return [
      ...(size === "bodySmall" || size === "bodyXs"
        ? [secondary, primary]
        : [primary, secondary]),
      link("正文链接、帮助说明与了解更多"),
    ];
  }
  if (size === "labelMedium") {
    return [
      muted("中性状态、分类标签与辅助标记"),
      {
        token: "success-soft-foreground",
        name: "成功文字",
        usage: "已完成、已通过与有效状态",
      },
      {
        token: "warning-soft-foreground",
        name: "警告文字",
        usage: "待处理、需注意与待复核状态",
      },
      danger,
    ];
  }
  if (size === "labelSmall") {
    return [
      muted("辅助标签、数量标记与简短备注"),
      foreground("需要明确识别的紧凑标签"),
      danger,
    ];
  }
  return [
    foreground("表单标签、导航文字与普通操作"),
    link("文字按钮、可点击标签与操作入口"),
    danger,
  ];
}

type TypeSpecimenRowProps = {
  size: string;
  name: string;
  token: string;
  params: { label: string; value: string }[];
  sample: string;
  sampleClassName: string;
};

export function TypeSpecimenRow({
  size,
  name,
  token,
  params,
  sample,
  sampleClassName,
}: TypeSpecimenRowProps) {
  const groupId = useId();
  const options = colorOptions(size);
  const [selectedToken, setSelectedToken] = useState(options[0].token);
  const selected =
    options.find((option) => option.token === selectedToken) ?? options[0];

  return (
    <div className="grid grid-cols-[minmax(18rem,_0.85fr)_minmax(0,_1.15fr)] items-center border-b border-b-[var(--ds-color-line)] py-5 px-0 gap-8 max-[52rem]:grid-cols-[minmax(0,_0.8fr)_minmax(0,_1.2fr)] max-[52rem]:gap-4 max-[36rem]:grid-cols-1 max-[36rem]:py-4 max-[36rem]:px-0 max-[36rem]:gap-3">
      <div className="min-w-0">
        <div className="grid gap-1">
          <strong className="text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-semibold)]">
            {name}
          </strong>
          <code className="wrap-anywhere text-[var(--ds-color-muted)] font-[family-name:var(--type-family-sans)] text-[length:var(--type-size-xs)] tabular-nums">
            {token}
          </code>
        </div>
        <dl className="grid grid-cols-1 mt-3 mb-0 mx-0 gap-2">
          {params.map((param) => (
            <div
              className="grid grid-cols-[3rem_minmax(0,_1fr)] items-baseline min-w-0 gap-3"
              key={param.label}
            >
              <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
                {param.label}
              </dt>
              <dd className="text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-xs)] tabular-nums font-[number:var(--type-weight-medium)] m-0">
                {param.value}
              </dd>
            </div>
          ))}
          
          <div className="grid grid-cols-[3rem_minmax(0,_1fr)] items-baseline min-w-0 gap-3">
            <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
              用途
            </dt>
            <dd
              className="text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-xs)] tabular-nums font-[number:var(--type-weight-medium)] m-0"
              aria-live="polite"
            >
              {selected.usage}
              <div className="mt-1 text-[var(--ds-color-muted)] wrap-anywhere">
                {selected.name} ·{" "}
                <code className="[font-family:inherit] text-[length:inherit] [font-weight:inherit] leading-[inherit]">
                  {selected.token}
                </code>
              </div>
            </dd>
          </div>
          <div className="grid grid-cols-[3rem_minmax(0,_1fr)] items-baseline min-w-0 gap-3">
            <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
            
            </dt>
            <dd className="text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-xs)] tabular-nums font-[number:var(--type-weight-medium)] m-0">
              <fieldset className="flex flex-wrap min-w-0 border-0 m-0 p-0 gap-2">
                <legend className="sr-only">{name}示例配色</legend>
                {options.map((option) => (
                  <label
                    className="relative grid w-8 h-8 place-items-center cursor-pointer"
                    key={option.token}
                    title={`${option.name} · ${option.token}：${option.usage}`}
                  >
                    <input
                      className="peer sr-only"
                      type="radio"
                      name={groupId}
                      value={option.token}
                      checked={selected.token === option.token}
                      onChange={() => setSelectedToken(option.token)}
                      aria-label={`${option.name} · ${option.token}`}
                    />
                    <span
                      className="block w-7 h-7 bg-[var(--sample-color)] [border:3px_solid_transparent] rounded-[var(--ds-radius-sm)] shadow-[0_0_0_1px_var(--ds-color-line)] peer-checked:border-[#fff] peer-checked:shadow-[0_0_0_1px_var(--ds-color-line-strong)] peer-focus-visible:[outline:2px_solid_var(--ds-color-focus-ring)] peer-focus-visible:[outline-offset:3px]"
                      style={
                        {
                          "--sample-color": `var(--theme-${option.token})`,
                        } as CSSProperties
                      }
                    />
                  </label>
                ))}
              </fieldset>
              
            </dd>
          </div>
        </dl>
      </div>
      <div className="min-w-0">
        <p
          className={`text-[var(--sample-color)] wrap-anywhere m-0 ${sampleClassName}`}
          style={
            {
              "--sample-color": `var(--theme-${selected.token})`,
            } as CSSProperties
          }
        >
          {sample}
        </p>
      </div>
    </div>
  );
}

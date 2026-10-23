"use client";

import { useId, useState } from "react";
import styles from "./theme-tokens.module.css";

type ColorOption = {
  token: string;
  name: string;
  usage: string;
};

const foreground = (usage: string): ColorOption => ({ token: "foreground", name: "主要文字", usage });
const muted = (usage: string): ColorOption => ({ token: "muted", name: "辅助文字", usage });
const link = (usage: string): ColorOption => ({ token: "link", name: "链接文字", usage });
const danger: ColorOption = { token: "danger-soft-foreground", name: "错误文字", usage: "校验错误、失败原因与危险操作提示" };

function colorOptions(size: string): ColorOption[] {
  if (size.startsWith("display")) {
    return [
      foreground("品牌主标题、首屏标语与关键数字"),
      { token: "accent-soft-foreground", name: "强调文字", usage: "品牌关键词、活动主题与重点数字" },
      { token: "success-soft-foreground", name: "成功文字", usage: "已完成目标与正向业务指标" },
    ];
  }
  if (size.startsWith("heading")) {
    return [
      foreground(size === "headingXs" ? "卡片标题、表单分组与小节标题" : "页面标题、区块标题与卡片标题"),
      muted("次级分组与低强调的小节标题"),
      link("可点击的文章标题与详情入口"),
    ];
  }
  if (size.startsWith("body")) {
    const primary = foreground("正文段落、内容摘要与重要说明");
    const secondary = muted(size === "bodyXs" ? "备注、时间戳、来源与次要补充信息" : "辅助说明、描述与补充信息");
    return [
      ...(size === "bodySmall" || size === "bodyXs" ? [secondary, primary] : [primary, secondary]),
      link("正文链接、帮助说明与了解更多"),
    ];
  }
  if (size === "labelMedium") {
    return [
      muted("中性状态、分类标签与辅助标记"),
      { token: "success-soft-foreground", name: "成功文字", usage: "已完成、已通过与有效状态" },
      { token: "warning-soft-foreground", name: "警告文字", usage: "待处理、需注意与待复核状态" },
      danger,
    ];
  }
  if (size === "labelSmall") {
    return [muted("辅助标签、数量标记与简短备注"), foreground("需要明确识别的紧凑标签"), danger];
  }
  return [foreground("表单标签、导航文字与普通操作"), link("文字按钮、可点击标签与操作入口"), danger];
}

type TypeSpecimenRowProps = {
  size: string;
  name: string;
  token: string;
  params: { label: string; value: string }[];
  sample: string;
  sampleClassName: string;
};

export function TypeSpecimenRow({ size, name, token, params, sample, sampleClassName }: TypeSpecimenRowProps) {
  const groupId = useId();
  const options = colorOptions(size);
  const [selectedToken, setSelectedToken] = useState(options[0].token);
  const selected = options.find((option) => option.token === selectedToken) ?? options[0];

  return (
    <div className={styles.typeRow}>
      <div className={styles.typeDetails}>
        <div className={styles.typeMeta}>
          <strong>{name}</strong>
          <code>{token}</code>
        </div>
        <dl className={styles.typeParams}>
          {params.map((param) => (
            <div key={param.label}><dt>{param.label}</dt><dd>{param.value}</dd></div>
          ))}
          <div>
            <dt>配色</dt>
            <dd>
              <fieldset className={styles.typeColorOptions}>
                <legend className="sr-only">{name}示例配色</legend>
                {options.map((option) => (
                  <label className={styles.typeColorChoice} key={option.token} title={`${option.name} · ${option.token}：${option.usage}`}>
                    <input
                      className="sr-only"
                      type="radio"
                      name={groupId}
                      value={option.token}
                      checked={selected.token === option.token}
                      onChange={() => setSelectedToken(option.token)}
                      aria-label={`${option.name} · ${option.token}`}
                    />
                    <span className={styles.typeColorSwatch} style={{ backgroundColor: `var(--theme-${option.token})` }} />
                  </label>
                ))}
              </fieldset>
              <div className={styles.typeColorName}>{selected.name} · <code>{selected.token}</code></div>
            </dd>
          </div>
          <div>
            <dt>用途</dt>
            <dd aria-live="polite">{selected.usage}</dd>
          </div>
        </dl>
      </div>
      <div className={styles.typeSampleWrap}>
        <p className={`${styles.typeSample} ${sampleClassName}`} style={{ color: `var(--theme-${selected.token})` }}>{sample}</p>
      </div>
    </div>
  );
}

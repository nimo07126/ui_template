import { Icon } from "@/components/theme-showcase/icon";
import styles from "./component-samples.module.css";

export function ComponentSamples() {
  return (
    <section aria-labelledby="components-title" className={styles.componentsSection} id="components">
      <div className={styles.componentIntro}>
        <div className={styles.sectionIndex}><Icon name="components" /><span>常用控件</span></div>
        <h2 id="components-title">少量控件，<br />看清同一套规则。</h2>
        <p>组件共用颜色、间距、圆角和状态定义。具体形态服务于操作，不为变化而变化。</p>
      </div>

      <div className={styles.componentCanvas}>
        <div className={styles.canvasHeader}>
          <div><strong>基础交互</strong><span>按钮 · 输入 · 状态反馈</span></div>
          <span className={styles.canvasVersion}>组件示例</span>
        </div>

        <div className={styles.componentRow}>
          <div className={styles.rowLabel}><strong>按钮</strong><span>操作有主次</span></div>
          <div className={styles.buttonSamples}>
            <button className={styles.primaryButton} type="button"><Icon name="plus" />新建项目</button>
            <button className={styles.secondaryButton} type="button">保存草稿</button>
            <button className={styles.tertiaryButton} type="button">取消</button>
            <button aria-label="更多操作" className={styles.iconButton} type="button"><Icon name="more" /></button>
          </div>
        </div>

        <div className={styles.componentRow}>
          <div className={styles.rowLabel}><strong>输入框</strong><span>有标签，也有说明</span></div>
          <div className={styles.inputSamples}>
            <label className={styles.field}>
              <span>项目名称</span>
              <div className={styles.inputWrap}><input aria-label="项目名称" placeholder="例如：春季品牌更新" /><Icon name="search" /></div>
              <small>名称之后仍然可以修改。</small>
            </label>
            <label className={`${styles.field} ${styles.errorField}`}>
              <span>工作邮箱</span>
              <input aria-label="工作邮箱" aria-invalid="true" defaultValue="lin@example" />
              <small>请输入完整的邮箱地址。</small>
            </label>
          </div>
        </div>

        <div className={styles.componentRow}>
          <div className={styles.rowLabel}><strong>状态提示</strong><span>状态色只表达状态</span></div>
          <div className={styles.statusSamples}>
            <span className={styles.statusPill}><span />进行中</span>
            <span className={styles.successPill}><Icon name="check" />已完成</span>
            <span className={styles.warningPill}>待确认</span>
            <span className={styles.neutralPill}>草稿</span>
          </div>
        </div>

        <div className={styles.notice}>
          <span className={styles.noticeIcon}><Icon name="spark" /></span>
          <div><strong>柔和，不等于模糊</strong><span>辅助文字降低音量，但仍保持清晰可读；错误状态则直接告诉使用者如何继续。</span></div>
          <a href="#colors" aria-label="回看颜色规则"><Icon name="chevron" /></a>
        </div>
      </div>
    </section>
  );
}

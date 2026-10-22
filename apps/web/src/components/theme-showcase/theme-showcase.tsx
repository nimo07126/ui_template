import { ThemeOverview } from "@/components/theme-showcase/theme-overview";
import { ThemeTokens } from "@/components/theme-showcase/theme-tokens";
import { ComponentSamples } from "@/components/theme-showcase/component-samples";
import { Icon } from "@/components/theme-showcase/icon";
import styles from "./theme-showcase.module.css";

const navigation = [
  { label: "主题概览", href: "#overview", icon: "overview" as const },
  { label: "颜色系统", href: "#colors", icon: "palette" as const },
  { label: "字体层级", href: "#type", icon: "type" as const },
  { label: "间距与形状", href: "#shape", icon: "shape" as const },
  { label: "常用控件", href: "#components", icon: "components" as const },
];

export function ThemeShowcase() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="主题目录">
        <a className={styles.brand} href="#overview" aria-label="澄序主题首页">
          <span className={styles.brandMark}>澄</span>
          <span className={styles.brandCopy}>
            <strong>澄序</strong>
            <span>设计主题样板</span>
          </span>
        </a>

        <div className={styles.navHeading}>设计语言</div>
        <nav className={styles.navigation}>
          {navigation.map((item, index) => (
            <a
              aria-current={index === 0 ? "page" : undefined}
              className={`${styles.navLink} ${index === 0 ? styles.navLinkActive : ""}`}
              href={item.href}
              key={item.href}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {index === 0 && <span className={styles.navDot} />}
            </a>
          ))}
        </nav>

        <div className={styles.sidebarNote}>
          <div className={styles.noteIcon}><Icon name="spark" /></div>
          <p>把复杂留给系统，<br />把清晰留给使用者。</p>
          <span>澄序 · 浅色主题</span>
        </div>

        <div className={styles.sidebarFooter}>
          <span className={styles.statusDot} />
          <span>主题变量已同步</span>
          <span className={styles.version}>v0.1</span>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <span>设计系统</span><Icon name="chevron" /><strong>主题展示</strong>
          </div>
          <div className={styles.topbarMeta}>
            <span className={styles.themeIndicator}><span />浅色主题</span>
            <span className={styles.divider} />
            <span className={styles.updated}>基础规范 · 2026</span>
          </div>
        </header>

        <div className={styles.content}>
          <ThemeOverview />
          <ThemeTokens />
          <ComponentSamples />
          <footer className={styles.pageFooter}>
            <span className={styles.footerMark}>澄</span>
            <p>一套可以被看见、理解，也可以被复用的界面规则。</p>
            <a href="#overview">回到顶部 <Icon name="chevron" /></a>
          </footer>
        </div>
      </main>
    </div>
  );
}

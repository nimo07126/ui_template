import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/theme-showcase/icon";
import styles from "./theme-overview.module.css";

const projects = [
  { name: "澄光品牌焕新", category: "品牌设计", progress: "78%", color: "violet", due: "10 月 28 日" },
  { name: "春日会员计划", category: "产品体验", progress: "52%", color: "blue", due: "11 月 04 日" },
  { name: "客户旅程梳理", category: "研究与策略", progress: "34%", color: "green", due: "11 月 12 日" },
];

export function ThemeOverview() {
  return (
    <section aria-labelledby="overview-title" className={styles.overview} id="overview">
      <div className={styles.intro}>
        <div className={styles.introCopy}>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />一套安静、清晰的界面语言</div>
          <h1 id="overview-title">为内容留白，<br />为重点着色。</h1>
          <p className={styles.introText}>
            「澄序」以柔和的灰蓝为底，用低饱和紫靛标记关键时刻。它不抢内容的声音，只让重要的事更容易被看见。
          </p>
          <div className={styles.introActions}>
            <Link className={styles.primaryLink} href="/colors">查看设计规则 <Icon name="chevron" /></Link>
            <span className={styles.themeCode}>主题编号 <strong>CX / 01</strong></span>
          </div>
        </div>
        <div className={styles.introAside}>
          <span className={styles.asideLabel}>设计取向</span>
          <div className={styles.principles}>
            <span>中性但不冷淡</span>
            <span>克制但不单调</span>
            <span>清晰胜过装饰</span>
          </div>
          <div className={styles.paletteSignature} aria-label="主题主色预览">
            <span className={styles.signatureCanvas} />
            <span className={styles.signatureInk} />
            <span className={styles.signatureAccent} />
            <span className={styles.signatureSoft} />
          </div>
        </div>
      </div>

      <div className={styles.previewSection}>
        <div className={styles.previewHeading}>
          <div>
            <span className={styles.previewKicker}>落在真实界面里</span>
            <h2>一眼看见规则如何协作</h2>
          </div>
          <span className={styles.previewTag}><span />主题实时预览</span>
        </div>

        <div className={styles.previewFrame}>
          <div className={styles.appTopbar}>
            <div className={styles.appIdentity}>
              <span className={styles.appMark}>澄</span>
              <span>栖云工作室</span>
              <Icon name="chevron" />
              <strong>项目空间</strong>
            </div>
            <div className={styles.appTopActions}>
              <Button aria-label="搜索" className={styles.searchButton} size="icon" variant="ghost"><Icon name="search" /></Button>
              <span className={styles.avatar}>林</span>
            </div>
          </div>

          <div className={styles.appLayout}>
            <aside className={styles.appRail} aria-label="工作台示例导航">
              <div className={styles.railCaption}>工作空间</div>
              <span aria-current="page" className={styles.railLinkActive}><Icon name="overview" />总览</span>
              <span className={styles.railLink}><Icon name="components" />项目</span>
              <span className={styles.railLink}><Icon name="shape" />日程</span>
              <div className={styles.railDivider} />
              <div className={styles.railCaption}>协作</div>
              <span className={styles.railLink}><span className={styles.teamGlyph}>人</span>团队成员</span>
              <div className={styles.railBottom}><span className={styles.railAvatar}>林</span><span>林知遥<small>设计负责人</small></span><Icon name="more" /></div>
            </aside>

            <div className={styles.appContent}>
              <div className={styles.workspaceHeading}>
                <div>
                  <span className={styles.dateLabel}>星期三 · 10 月 21 日</span>
                  <h3>下午好，知遥</h3>
                  <p>今天有 3 个项目正在稳步推进。</p>
                </div>
                <Button className={styles.createButton} size="lg"><Icon name="plus" />新建项目</Button>
              </div>

              <div className={styles.focusStrip}>
                <div className={styles.focusIcon}><Icon name="spark" /></div>
                <div className={styles.focusCopy}><strong>本周进展顺利</strong><span>已完成 12 项任务，距离本周目标还差 3 项。</span></div>
                <div className={styles.focusProgress}><span /><span /></div>
                <span className={styles.focusCount}>12 / 15</span>
              </div>

              <div className={styles.projectHeader}>
                <div><h4>正在推进</h4><span>按最近更新排序</span></div>
                <Button className={styles.textAction} size="sm" variant="link">查看全部 <Icon name="chevron" /></Button>
              </div>
              <div className={styles.projectList}>
                {projects.map((project) => (
                  <div className={styles.projectRow} key={project.name}>
                    <span className={`${styles.projectMark} ${styles[project.color]}`} />
                    <div className={styles.projectName}><strong>{project.name}</strong><span>{project.category}</span></div>
                    <div className={styles.progressGroup}><div className={styles.progressTrack}><span style={{ width: project.progress }} /></div><span>{project.progress}</span></div>
                    <span className={styles.projectDue}>截止 {project.due}</span>
                    <Button aria-label={`更多：${project.name}`} className={styles.rowMore} size="icon-sm" variant="ghost"><Icon name="more" /></Button>
                  </div>
                ))}
              </div>

              <div className={styles.appBottomNote}><span className={styles.statusDot} />所有项目已同步 <span>刚刚更新</span></div>
            </div>
          </div>
        </div>
        <div className={styles.previewCaption}><span>主题应用示例</span><span>颜色 · 字体 · 间距 · 状态</span></div>
      </div>
    </section>
  );
}

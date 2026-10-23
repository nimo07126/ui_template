import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import styles from "./component-samples.module.css";
import {
  AlertCircle,
  Check,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

export function ComponentSamples() {
  return (
    <section aria-labelledby="components-title" className={styles.componentsSection}>
      <div className={styles.componentIntro}>
        <div className={styles.sectionIndex}><Sparkles aria-hidden="true" /><span>常用控件</span></div>
        <h1 id="components-title">真实组件，<br />遵循同一套主题。</h1>
        <p>以下示例直接引用 shadcn/ui 组件。主题颜色、圆角与焦点状态由共享 token 提供，而不是在页面里另写一套控件样式。</p>
      </div>

      <Card className={styles.componentCanvas}>
        <CardHeader className={styles.canvasHeader}>
          <div>
            <CardTitle>基础交互组件</CardTitle>
            <CardDescription>shadcn/ui · 澄序主题映射</CardDescription>
          </div>
          <Badge variant="outline">交互规范</Badge>
        </CardHeader>
        <CardContent className={styles.canvasContent}>
          <section aria-labelledby="button-samples-title" className={styles.componentRow}>
            <div className={styles.rowLabel}>
              <h2 id="button-samples-title">按钮 Button</h2>
              <p>用层级区分操作优先级。</p>
            </div>
            <div className={styles.buttonSamples}>
              <Button><Plus data-icon="inline-start" />新建项目</Button>
              <Button variant="secondary">次要操作</Button>
              <Button variant="outline">保存草稿</Button>
              <Button variant="ghost">取消</Button>
              <Button aria-label="更多操作" size="icon" variant="outline"><MoreHorizontal /></Button>
            </div>
          </section>

          <Separator />

          <section aria-labelledby="input-samples-title" className={styles.componentRow}>
            <div className={styles.rowLabel}>
              <h2 id="input-samples-title">输入框 Input</h2>
              <p>标签和错误信息始终明确。</p>
            </div>
            <div className={styles.inputSamples}>
              <label className={styles.field} htmlFor="project-name">
                <span>项目名称</span>
                <div className={styles.inputWrap}>
                  <Input className="h-10 pr-10" id="project-name" placeholder="例如：春季品牌更新" />
                  <Search aria-hidden="true" />
                </div>
                <small>名称之后仍然可以修改。</small>
              </label>
              <label className={styles.field} htmlFor="work-email">
                <span>工作邮箱</span>
                <Input aria-invalid="true" defaultValue="lin@example" id="work-email" type="email" />
                <small className={styles.errorMessage}>请输入完整的邮箱地址。</small>
              </label>
            </div>
          </section>

          <Separator />

          <section aria-labelledby="badge-samples-title" className={styles.componentRow}>
            <div className={styles.rowLabel}>
              <h2 id="badge-samples-title">状态 Badge</h2>
              <p>语义颜色表达状态。</p>
            </div>
            <div className={styles.statusSamples}>
              <Badge><span className={styles.statusDot} />进行中</Badge>
              <Badge variant="secondary"><Check data-icon="inline-start" />已完成</Badge>
              <Badge variant="outline">待确认</Badge>
              <Badge variant="destructive">需处理</Badge>
            </div>
          </section>

          <Separator />

          <section aria-labelledby="card-samples-title" className={styles.componentRow}>
            <div className={styles.rowLabel}>
              <h2 id="card-samples-title">信息卡片 Card</h2>
              <p>承载关联内容，不额外堆叠装饰。</p>
            </div>
            <Card className={styles.sampleCard} size="sm">
              <CardHeader>
                <CardTitle>澄光品牌焕新</CardTitle>
                <CardDescription>品牌设计 · 更新于 10 分钟前</CardDescription>
              </CardHeader>
              <CardContent className={styles.sampleCardContent}>
                <span>项目进度</span><strong>78%</strong>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <div className={styles.alertSamples}>
            <Alert>
              <Sparkles aria-hidden="true" />
              <AlertTitle>柔和，不等于模糊</AlertTitle>
              <AlertDescription>辅助文字降低音量，但仍保持清晰可读。</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>邮箱地址不完整</AlertTitle>
              <AlertDescription>请补全邮箱地址后再继续。</AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

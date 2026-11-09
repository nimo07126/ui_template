"use client";

import { ActivityHeatmap } from "@/shared/arc/activity-heatmap/activity-heatmap";
import { AnimatedCounter } from "@/shared/arc/animated-counter/animated-counter";
import { BarChart } from "@/shared/arc/bar-chart/bar-chart";
import { BrushChart } from "@/shared/arc/brush-chart/brush-chart";
import { Button } from "@/shared/arc/button/button";
import { DonutChart } from "@/shared/arc/donut-chart/donut-chart";
import { Gauge } from "@/shared/arc/gauge/gauge";
import { LineChart } from "@/shared/arc/line-chart/line-chart";
import { MetricCard } from "@/shared/arc/metric-card/metric-card";
import { Ridgeline } from "@/shared/arc/ridgeline/ridgeline";
import { SlopeChart } from "@/shared/arc/slope-chart/slope-chart";
import { Sparkline } from "@/shared/arc/sparkline/sparkline";
import { Streamgraph } from "@/shared/arc/streamgraph/streamgraph";
import { Treemap } from "@/shared/arc/treemap/treemap";
import { WaffleChart } from "@/shared/arc/waffle-chart/waffle-chart";
import { useState, type ReactNode } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

const days = ["一", "二", "三", "四", "五", "六", "日"];
const signups = [12, 18, 15, 22, 30, 27, 34];
const visits = [
  { key: "search", label: "搜索", value: 4210 },
  { key: "direct", label: "直达", value: 2380 },
  { key: "social", label: "社交", value: 1190 },
  { key: "mail", label: "邮件", value: 640 },
];

function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="w-full min-w-0">{children}</div>;
}

export function MetricCardDemo() {
  return <MetricCard label="服务可用性" value={99.9} suffix="%" context="过去 30 天" change="+0.2%" />;
}

export function SparklineDemo() {
  return <Sparkline label="本周注册数" data={signups} labels={days} value="34" change="+26%" tone="success" />;
}

export function GaugeDemo() {
  return (
    <Gauge
      label="已用容量"
      value={72}
      detail="360 / 500 GB"
      thresholds={[
        { from: 0, tone: "success", label: "充足" },
        { from: 70, tone: "warning", label: "容量趋紧" },
        { from: 90, tone: "danger", label: "容量不足" },
      ]}
    />
  );
}

export function AnimatedCounterDemo() {
  const [count, setCount] = useState(1280);
  return (
    <DemoColumn>
      <AnimatedCounter label="访问次数" value={count} animateOnView />
      <Button variant="secondary" onClick={() => setCount(count + 125)}>
        模拟新增 125 次
      </Button>
    </DemoColumn>
  );
}

export function BarChartDemo() {
  return (
    <ChartFrame>
      <BarChart
        label="本周报名"
        period="周一至周日"
        unit="人"
        data={signups.map((value, index) => ({
          key: String(index),
          label: `星期${days[index]}`,
          axisLabel: days[index],
          value,
        }))}
      />
    </ChartFrame>
  );
}

const activity = Array.from({ length: 56 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 8, index + 1)).toISOString().slice(0, 10),
  count: (index * index + index * 17) % 12,
}));

export function ActivityHeatmapDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <ChartFrame>
      <ActivityHeatmap
        days={activity}
        label="项目贡献"
        period="9–10 月"
        selectedDate={selected}
        onSelectDate={setSelected}
      />
      <DemoResult>{selected && `已选择 ${selected}`}</DemoResult>
    </ChartFrame>
  );
}

export function LineChartDemo() {
  return (
    <ChartFrame>
      <LineChart
        label="报名人数"
        data={signups.map((value, index) => ({
          key: String(index),
          label: `星期${days[index]}`,
          axisLabel: days[index],
          values: { thisWeek: value, lastWeek: 9 + index * 2 },
        }))}
        series={[
          { key: "thisWeek", label: "本周" },
          { key: "lastWeek", label: "上周", dashed: true },
        ]}
      />
    </ChartFrame>
  );
}

export function DonutChartDemo() {
  return (
    <ChartFrame>
      <DonutChart label="访问来源" data={visits} unit="次" />
    </ChartFrame>
  );
}

export function StreamgraphDemo() {
  return (
    <ChartFrame>
      <Streamgraph
        label="反馈趋势"
        categoryLabel="周"
        unit="条"
        data={signups.map((value, index) => ({
          key: String(index),
          label: `第 ${index + 1} 周`,
          axisLabel: String(index + 1),
          values: { questions: value, ideas: (value * index) % 23, issues: 14 - index * 2 },
        }))}
        series={[
          { key: "questions", label: "咨询" },
          { key: "ideas", label: "建议" },
          { key: "issues", label: "问题" },
        ]}
      />
    </ChartFrame>
  );
}

const dailyUsers = Array.from({ length: 40 }, (_, index) => ({
  date: Date.UTC(2026, 8, index + 1),
  value: 40 + Math.floor(index * 2 + 17 * Math.sin(index * 0.63)),
}));

export function BrushChartDemo() {
  const [range, setRange] = useState<[number, number]>([dailyUsers[14].date, dailyUsers[35].date]);
  return (
    <ChartFrame>
      <BrushChart
        data={dailyUsers}
        label="每日活跃用户"
        unit="人"
        range={range}
        onRangeChange={setRange}
        annotations={[{ date: dailyUsers[23].date, label: "v2", description: "组件预览开放" }]}
      />
    </ChartFrame>
  );
}

export function RidgelineDemo() {
  const series = ["上海", "北京", "深圳"].map((label, region) => ({
    id: String(region),
    label,
    values: Array.from({ length: 40 }, (_, index) => 36 + ((index * 5) % 24) + region * 9),
  }));
  return (
    <ChartFrame>
      <Ridgeline label="响应延迟" series={series} unit=" ms" />
    </ChartFrame>
  );
}

export function TreemapDemo() {
  return (
    <ChartFrame>
      <Treemap
        label="区域营收"
        colorLabel="增长"
        formatColor={(value) => `+${value}%`}
        data={{
          id: "all",
          label: "所有区域",
          children: [
            {
              id: "east",
              label: "华东",
              children: [
                { id: "sh", label: "上海", value: 75, color: 20 },
                { id: "hz", label: "杭州", value: 45, color: 14 },
              ],
            },
            {
              id: "south",
              label: "华南",
              children: [
                { id: "sz", label: "深圳", value: 52, color: 18 },
                { id: "gz", label: "广州", value: 30, color: 8 },
              ],
            },
          ],
        }}
      />
    </ChartFrame>
  );
}

export function WaffleChartDemo() {
  return (
    <ChartFrame>
      <WaffleChart label="访问占比" data={visits} unit="次" />
    </ChartFrame>
  );
}

export function SlopeChartDemo() {
  return (
    <ChartFrame>
      <SlopeChart
        label="渠道转化率"
        startLabel="一季度"
        endLabel="二季度"
        highlightKey="email"
        formatValue={(value) => `${value.toFixed(1)}%`}
        data={[
          { key: "email", label: "邮件", start: 3.1, end: 4.6 },
          { key: "search", label: "搜索", start: 3.4, end: 3.6 },
          { key: "social", label: "社交", start: 1.9, end: 1.3 },
        ]}
      />
    </ChartFrame>
  );
}

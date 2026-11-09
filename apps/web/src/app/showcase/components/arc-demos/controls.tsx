"use client";

import { Calendar } from "@/shared/arc/calendar/calendar";
import { ColorPicker, type ColorSwatch } from "@/shared/arc/color-picker/color-picker";
import { DatePicker } from "@/shared/arc/date-picker/date-picker";
import { DateRangePicker, type DateRange } from "@/shared/arc/date-range-picker/date-range-picker";
import { ElasticSlider } from "@/shared/arc/elastic-slider/elastic-slider";
import { FileDropzone } from "@/shared/arc/file-dropzone/file-dropzone";
import { RangeHistogramSlider } from "@/shared/arc/range-histogram-slider/range-histogram-slider";
import { Rating } from "@/shared/arc/rating/rating";
import { RulerSlider } from "@/shared/arc/ruler-slider/ruler-slider";
import SegmentedControl from "@/shared/arc/segmented-control/segmented-control";
import { SignaturePad } from "@/shared/arc/signature-pad/signature-pad";
import { TimePicker } from "@/shared/arc/time-picker/time-picker";
import { Volume1, Volume2 } from "lucide-react";
import { useState } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

export function FileDropzoneDemo() {
  return (
    <DemoColumn>
      <FileDropzone
        label="添加示例附件"
        description="拖入文件，或点击选择"
        note="文件仅用于本地预览"
        accept="image/*,.pdf,.txt"
        maxFiles={3}
        maxSize={5 * 1024 * 1024}
        multiple
      />
    </DemoColumn>
  );
}

export function SegmentedControlDemo() {
  const [range, setRange] = useState("week");
  return (
    <SegmentedControl
      label="统计周期"
      value={range}
      onValueChange={setRange}
      options={[
        { value: "day", label: "按日" },
        { value: "week", label: "按周" },
        { value: "month", label: "按月" },
      ]}
    />
  );
}

export function CalendarDemo() {
  const [date, setDate] = useState<Date>();
  return (
    <DemoColumn>
      <Calendar value={date} onChange={setDate} locale="zh-CN" showToday />
      <DemoResult>{date && `已选择 ${date.toLocaleDateString("zh-CN")}`}</DemoResult>
    </DemoColumn>
  );
}

export function DatePickerDemo() {
  const [date, setDate] = useState<Date>();
  return (
    <DemoColumn>
      <DatePicker label="交付日期" value={date} onChange={setDate} locale="zh-CN" showToday />
    </DemoColumn>
  );
}

export function TimePickerDemo() {
  const [time, setTime] = useState("14:30");
  return (
    <DemoColumn>
      <TimePicker label="会议时间" value={time} onChange={setTime} minuteStep={30} />
    </DemoColumn>
  );
}

export function DateRangePickerDemo() {
  const [range, setRange] = useState<DateRange | null>(null);
  return (
    <DemoColumn>
      <DateRangePicker label="报告周期" value={range} onChange={setRange} weekStartsOn={1} />
    </DemoColumn>
  );
}

export function RatingDemo() {
  const [rating, setRating] = useState(3);
  return (
    <DemoColumn>
      <Rating label="体验评分" value={rating} onChange={setRating} />
      <DemoResult>{rating ? `${rating} / 5 分` : "尚未评分"}</DemoResult>
    </DemoColumn>
  );
}

export function ElasticSliderDemo() {
  const [volume, setVolume] = useState(60);
  return (
    <DemoColumn>
      <ElasticSlider
        label="音量"
        value={volume}
        onValueChange={setVolume}
        marks={[0, { value: 50, label: "50%" }, 100]}
        format={(value) => `${value}%`}
        startIcon={<Volume1 size={16} />}
        endIcon={<Volume2 size={16} />}
      />
    </DemoColumn>
  );
}

const prices = Array.from({ length: 100 }, (_, index) => 20 + ((index * 23) % 340) + ((index * 13) % 140));

export function RangeHistogramSliderDemo() {
  const [range, setRange] = useState<[number, number]>([80, 320]);
  return (
    <DemoColumn>
      <RangeHistogramSlider
        label="预算范围"
        data={prices}
        min={0}
        max={500}
        step={5}
        bins={20}
        value={range}
        onValueChange={setRange}
        format={(value) => `¥${value}`}
      />
    </DemoColumn>
  );
}

export function RulerSliderDemo() {
  const [value, setValue] = useState(48);
  return (
    <DemoColumn>
      <RulerSlider label="画板网格" unit="px" min={4} max={96} value={value} onValueChange={setValue} />
    </DemoColumn>
  );
}

export function SignaturePadDemo() {
  const [count, setCount] = useState(0);
  return (
    <DemoColumn>
      <SignaturePad
        signer="示例签名"
        label="签名画布"
        hint="在此处画几笔"
        onChange={(strokes) => setCount(strokes.length)}
      />
      <DemoResult>{count ? `已绘制 ${count} 笔` : "在此体验绘制、撤销与清除"}</DemoResult>
    </DemoColumn>
  );
}

export function ColorPickerDemo() {
  const [color, setColor] = useState("#7669C7");
  const [swatches, setSwatches] = useState<ColorSwatch[]>([
    { id: "violet", color: "#7669C7" },
    { id: "orange", color: "#945D3B" },
  ]);
  return (
    <DemoColumn>
      <ColorPicker
        label="示例主题色"
        value={color}
        onValueChange={setColor}
        swatches={swatches}
        onSwatchesChange={setSwatches}
      />
    </DemoColumn>
  );
}

"use client";

import { Button } from "@/shared/arc/button/button";
import { CardStack } from "@/shared/arc/card-stack/card-stack";
import { Carousel } from "@/shared/arc/carousel/carousel";
import { ImageCompare } from "@/shared/arc/image-compare/image-compare";
import { InViewTitle } from "@/shared/arc/in-view-title/in-view-title";
import { SlotText } from "@/shared/arc/slot-text/slot-text";
import { TextMorph } from "@/shared/arc/text-morph/text-morph";
import { TextReveal } from "@/shared/arc/text-reveal/text-reveal";
import { TextShimmer } from "@/shared/arc/text-shimmer/text-shimmer";
import { useState } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

export function TextRevealDemo() {
  const [run, setRun] = useState(0);
  return (
    <DemoColumn>
      <TextReveal key={run} as="p" className="text-lg font-semibold" text={"思考，记录，\n然后继续创作。"} />
      <Button variant="secondary" onClick={() => setRun(run + 1)}>
        重播文字入场
      </Button>
    </DemoColumn>
  );
}

export function InViewTitleDemo() {
  return (
    <InViewTitle
      className="text-lg font-semibold"
      variant="line"
      text="从界面细节开始"
      lines={["从界面", "细节开始"]}
    />
  );
}

export function TextMorphDemo() {
  const [saved, setSaved] = useState(false);
  return (
    <Button onClick={() => setSaved(!saved)}>
      <TextMorph>{saved ? "已保存" : "保存草稿"}</TextMorph>
    </Button>
  );
}

export function TextShimmerDemo() {
  const [busy, setBusy] = useState(true);
  return (
    <DemoColumn>
      <TextShimmer active={busy}>{busy ? "正在整理发布摘要" : "发布摘要已就绪"}</TextShimmer>
      <Button variant="secondary" onClick={() => setBusy(!busy)}>
        {busy ? "模拟完成" : "重新开始"}
      </Button>
    </DemoColumn>
  );
}

function Landscape({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      className={muted ? "size-full grayscale" : "size-full"}
      role="img"
      aria-label={muted ? "黑白山景" : "彩色山景"}
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="320" height="180" fill="#f3ddc0" />
      <circle cx="231" cy="53" r="29" fill="#ee9675" />
      <path d="M0 143 76 47l71 88 50-60 123 78v27H0Z" fill="#6f7ba6" />
      <path d="M0 156 103 96l46 28 56-9 115 46v19H0Z" fill="#4d6767" />
    </svg>
  );
}

export function ImageCompareDemo() {
  return (
    <DemoColumn>
      <ImageCompare
        before={<Landscape muted />}
        after={<Landscape />}
        labels={["调色前", "调色后"]}
        aspectRatio="16 / 9"
        label="拖动分隔线比较调色"
      />
    </DemoColumn>
  );
}

const places = [
  { id: "river", name: "河岸", subtitle: "松绿与雾灰", tone: "bg-emerald-900 text-white" },
  { id: "dune", name: "沙丘", subtitle: "暖沙与晨光", tone: "bg-amber-100 text-amber-950" },
  { id: "city", name: "城市", subtitle: "深靛与灯火", tone: "bg-indigo-950 text-white" },
];

function PlaceCard({ place }: { place: (typeof places)[number] }) {
  return (
    <div className={`flex h-32 flex-col justify-end rounded-lg p-4 ${place.tone}`}>
      <p className="text-lg font-semibold">{place.name}</p>
      <p className="text-xs">{place.subtitle}</p>
    </div>
  );
}

export function CarouselDemo() {
  return (
    <DemoColumn>
      <Carousel label="三套配色灵感" slideSize="100cqw" interval={4500}>
        {places.map((place) => (
          <PlaceCard key={place.id} place={place} />
        ))}
      </Carousel>
    </DemoColumn>
  );
}

export function CardStackDemo() {
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <CardStack
        items={places}
        getKey={(place) => place.id}
        getLabel={(place) => place.name}
        renderCard={(place) => <PlaceCard place={place} />}
        labels={{ left: "跳过", right: "收藏" }}
        onDecide={(place, direction) => setResult(`${direction === "right" ? "已收藏" : "已跳过"}${place.name}`)}
      />
      <DemoResult>{result || "滑动卡片收藏或跳过"}</DemoResult>
    </DemoColumn>
  );
}

export function SlotTextDemo() {
  const [count, setCount] = useState(1280);
  return (
    <DemoColumn>
      <span className="text-2xl font-semibold">
        <SlotText value={count} announce />
      </span>
      <Button variant="secondary" onClick={() => setCount(count + 37)}>
        新增 37 个访问
      </Button>
    </DemoColumn>
  );
}

"use client";

import {
  ArrowUpRight,
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Database,
  DollarSign,
  Filter,
  Grid2X2,
  MessageCircle,
  Moon,
  Network,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const agents = [
  { name: "research_agent", role: "Specialist", calls: "188 calls", color: "bg-emerald-100 text-emerald-600", icon: Search },
  { name: "supervisor", role: "Router", calls: "412 calls", color: "bg-violet-100 text-violet-600", icon: Network },
  { name: "data_agent", role: "Specialist", calls: "204 calls", color: "bg-blue-100 text-blue-600", icon: Database },
  { name: "validator_agent", role: "Validator", calls: "196 calls", color: "bg-amber-100 text-amber-600", icon: ShieldCheck },
  { name: "responder", role: "Composer", calls: "404 calls", color: "bg-rose-100 text-rose-500", icon: Send },
];

const timeline = [
  { name: "Delegating", tone: "bg-violet-400", text: "text-violet-950", status: "Healthy", start: 2, span: 3, row: 2, icon: Network },
  { name: "Validating", tone: "bg-emerald-400", text: "text-emerald-950", status: "Healthy", start: 1, span: 3, row: 4, icon: ShieldCheck },
  { name: "Validating", tone: "bg-blue-400", text: "text-blue-950", status: "Pending", start: 7, span: 3, row: 3, icon: ShieldCheck },
  { name: "Responding", tone: "bg-violet-400", text: "text-violet-950", status: "Healthy", start: 13, span: 3, row: 5, icon: Send },
];

function WorkspaceHeader() {
  return (
    <header className="pointer-events-none fixed inset-x-4 top-4 z-30 flex min-h-[74px] items-center justify-between gap-3 lg:inset-x-6">
      <Link href="/" className="pointer-events-auto flex shrink-0 items-center gap-3 rounded-[22px] border border-[#e8eaf0] bg-white/95 px-3 py-2.5 text-[#21242b] shadow-[0_16px_36px_rgba(44,55,78,0.10),0_2px_6px_rgba(44,55,78,0.04)] backdrop-blur-xl" aria-label="返回设计主题首页">
        <span className="grid size-9 place-items-center rounded-2xl bg-[#e9f0ff] text-[#2f69dc]"><BarMark /></span>
        <span className="hidden text-[15px] font-semibold tracking-[-0.02em] sm:inline">OrchestrateIQ</span>
      </Link>
      <nav className="pointer-events-auto hidden items-center gap-1 rounded-[22px] border border-[#e8eaf0] bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(44,55,78,0.10),0_2px_6px_rgba(44,55,78,0.04)] backdrop-blur-xl md:flex" aria-label="系统导航">
        {['Overview', 'Workflows', 'Live Map', 'Traces', 'Incidents', 'Insights'].map((item, index) => (
          <a key={item} href={index === 0 ? '#overview' : `#${item.toLowerCase().replace(' ', '-')}`} className={`rounded-full px-4 py-2 text-[13px] transition-colors ${index === 0 ? 'bg-[#2f69dc] text-white shadow-sm' : 'text-[#454a57] hover:bg-[#f2f4f8]'}`}>{item}</a>
        ))}
      </nav>
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-[22px] border border-[#e8eaf0] bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(44,55,78,0.10),0_2px_6px_rgba(44,55,78,0.04)] backdrop-blur-xl lg:flex">
          <span className="flex items-center gap-2 rounded-full bg-[#e8fbef] px-3 py-2 text-[12px] font-medium text-[#1d8151]"><span className="size-2 rounded-full bg-[#20b66a]" />Live</span>
          <button className="flex items-center gap-2 rounded-full px-3 py-2 text-[12px] text-[#454a57] hover:bg-[#f2f4f8]"><CalendarDays className="size-3.5" />30 min<ChevronDown className="size-3" /></button>
        </div>
        <div className="flex items-center gap-1 rounded-[22px] border border-[#e8eaf0] bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(44,55,78,0.10),0_2px_6px_rgba(44,55,78,0.04)] backdrop-blur-xl">
          <button aria-label="搜索" className="grid size-9 place-items-center rounded-full text-[#687080] hover:bg-[#f2f4f8] hover:text-[#2f69dc]"><Search className="size-4" /></button>
          <button aria-label="通知" className="relative grid size-9 place-items-center rounded-full text-[#687080] hover:bg-[#f2f4f8]"><Bell className="size-4" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#e66b45]" /></button>
        </div>
        <button className="hidden items-center gap-2 rounded-[22px] border border-[#e8eaf0] bg-white/95 py-1.5 pl-1.5 pr-3 text-left shadow-[0_16px_36px_rgba(44,55,78,0.10),0_2px_6px_rgba(44,55,78,0.04)] backdrop-blur-xl lg:flex"><span className="size-8 rounded-full bg-gradient-to-br from-[#ffaf9d] to-[#e8736b]" /><span className="grid text-[11px] leading-tight"><strong className="font-semibold text-[#313640]">Platform Team</strong><small className="text-[#8d94a3]">Owner · acme-ai</small></span><ChevronDown className="ml-2 size-3 text-[#7c8492]" /></button>
      </div>
    </header>
  );
}

function BarMark() {
  return <span className="flex items-end gap-0.5"><i className="h-3 w-1 rounded-full bg-current" /><i className="h-5 w-1 rounded-full bg-current" /><i className="h-4 w-1 rounded-full bg-current" /></span>;
}

function Rail() {
  const [dark, setDark] = useState(false);
  return <aside className="fixed bottom-4 left-4 top-[106px] z-20 hidden w-[76px] shrink-0 flex-col items-center justify-between rounded-[24px] border border-[#e8eaf0] bg-white/95 py-5 shadow-[0_16px_36px_rgba(44,55,78,0.10),0_2px_6px_rgba(44,55,78,0.04)] backdrop-blur-xl md:flex" aria-label="工作台工具栏">
    <div className="flex flex-col items-center gap-5">
      <button aria-label="切换明暗" onClick={() => setDark(!dark)} className="grid size-11 place-items-center rounded-2xl bg-white text-[#777f8d] shadow-[0_4px_12px_rgba(30,40,65,0.06)] hover:text-[#2f69dc]">{dark ? <Moon className="size-5" /> : <Sun className="size-5" />}</button>
      <div className="flex flex-col items-center gap-4 text-[#7c8492]">
        <button aria-label="总览" className="grid size-11 place-items-center rounded-2xl bg-[#2f69dc] text-white shadow-[0_6px_16px_rgba(47,105,220,0.28)]"><Grid2X2 className="size-5" /></button>
        <button aria-label="机器人" className="grid size-11 place-items-center rounded-2xl hover:bg-white hover:text-[#2f69dc]"><Bot className="size-5" /></button>
        <button aria-label="成本" className="grid size-11 place-items-center rounded-2xl hover:bg-white hover:text-[#2f69dc]"><DollarSign className="size-5" /></button>
        <button aria-label="工具" className="grid size-11 place-items-center rounded-2xl hover:bg-white hover:text-[#2f69dc]"><Wrench className="size-5" /></button>
        <button aria-label="集成" className="grid size-11 place-items-center rounded-2xl hover:bg-white hover:text-[#2f69dc]"><Zap className="size-5" /></button>
        <button aria-label="设置" className="grid size-11 place-items-center rounded-2xl hover:bg-white hover:text-[#2f69dc]"><Settings className="size-5" /></button>
      </div>
    </div>
    <div className="flex flex-col items-center gap-4 text-[#7c8492]"><button aria-label="帮助" className="grid size-11 place-items-center rounded-2xl hover:bg-white hover:text-[#2f69dc]"><CircleHelp className="size-5" /></button><button aria-label="退出" className="grid size-11 place-items-center rounded-2xl hover:bg-white hover:text-[#2f69dc]"><ArrowUpRight className="size-5" /></button></div>
  </aside>;
}

function TimelineCard() {
  return <section id="overview" className="overflow-hidden rounded-[26px] border border-[#edf0f4] bg-white shadow-[0_14px_34px_rgba(46,59,84,0.06)]">
    <div className="flex flex-wrap items-start justify-between gap-5 px-6 pb-5 pt-7 sm:px-8">
      <div><h1 className="text-[clamp(27px,3vw,42px)] font-medium tracking-[-0.055em] text-[#191c23]">We found your system</h1><p className="mt-1.5 text-[13px] text-[#8a92a1]">Everything below was inferred from 412 events in 4 minutes. Nothing was declared by hand.</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9faef] px-3.5 py-2 text-[12px] font-medium text-[#38845a]"><Check className="size-3.5" />Setup complete · 3 of 3</span><button className="inline-flex items-center gap-2 rounded-full border border-[#e8eaf0] bg-[#fafbfc] px-3.5 py-2 text-[12px] text-[#4a5160]"><CalendarDays className="size-3.5" />Sep 9, 2026 · 09:41<ChevronDown className="size-3" /></button><button className="inline-flex items-center gap-2 rounded-full border border-[#e8eaf0] bg-[#fafbfc] px-3.5 py-2 text-[12px] text-[#4a5160]"><Filter className="size-3.5" />Filter</button><a href="#live-map" className="inline-flex items-center gap-2 rounded-full border border-[#e8eaf0] bg-[#fafbfc] px-3.5 py-2 text-[12px] text-[#4a5160] hover:border-[#2f69dc] hover:text-[#2f69dc]"><ArrowUpRight className="size-3.5" />Live Map</a></div>
    </div>
    <div className="overflow-x-auto px-6 pb-7 sm:px-8"><div className="min-w-[1020px]">
      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4"><div className="flex items-end pb-2 text-[13px] font-medium text-[#343a46]">Agents</div><div className="grid grid-cols-[repeat(15,minmax(58px,1fr))] gap-2 text-center text-[11px] text-[#9097a5]">{['09:41|00','09:41|15','09:41|30','09:41|45','09:42|00','09:42|15','09:42|30','09:42|45','09:43|00','09:43|15','09:43|30','09:43|45','09:44|00','09:44|15','09:44|30'].map((label, i) => <div key={label} className={`rounded-2xl border border-[#edf0f4] py-2 ${i === 8 ? 'border-[#2f69dc] bg-[#2f69dc] text-white shadow-[0_6px_15px_rgba(47,105,220,0.2)]' : i === 5 || i === 6 || i === 11 ? 'bg-[#eceef3]' : 'bg-[#fcfcfd]'}`}><span className="block">{label.split('|')[0]}</span><strong className="text-[13px] font-semibold">{label.split('|')[1]}</strong></div>)}</div></div>
      <div className="mt-3 grid grid-cols-[220px_minmax(0,1fr)] gap-4"><div className="grid gap-2">{agents.map((agent) => { const Icon = agent.icon; return <div key={agent.name} className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-[#edf0f4] bg-white px-3 shadow-[0_3px_12px_rgba(30,40,65,0.025)]"><span className={`grid size-9 place-items-center rounded-full ${agent.color}`}><Icon className="size-4" /></span><span className="grid gap-0.5"><strong className="text-[13px] font-medium text-[#363b46]">{agent.name}</strong><small className="text-[11px] text-[#9299a6]">{agent.role} · {agent.calls}</small></span></div> })}</div><div className="relative grid grid-rows-5 gap-2">{Array.from({ length: 5 }).map((_, row) => <div key={row} className="relative grid grid-cols-[repeat(15,minmax(58px,1fr))] gap-2">{Array.from({ length: 15 }).map((__, col) => <span key={col} className={`rounded-xl border border-[#edf0f4] ${[4,5,10,11].includes(col) ? 'bg-[repeating-linear-gradient(135deg,#f0f1f5_0_3px,#fbfbfc_3px_7px)]' : 'bg-[#fcfcfd]'}`} />)}{timeline.filter((item) => item.row === row + 1).map((item) => { const Icon = item.icon; return <div key={`${item.name}-${item.row}`} className={`absolute top-0.5 bottom-0.5 col-start-${item.start} flex items-center gap-2 rounded-2xl ${item.tone} px-3 shadow-[0_8px_16px_rgba(42,60,90,0.12)]`} style={{ left: `calc(${(item.start - 1) * 100 / 15}% + ${(item.start - 1) * 8 / 15}px)`, width: `calc(${item.span * 100 / 15}% + ${(item.span - 1) * 8 / 15}px)` }}><span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/90"><Icon className={`size-4 ${item.text}`} /></span><strong className={`text-[13px] font-medium ${item.text}`}>{item.name}</strong><span className="ml-auto hidden rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-[#55606f] xl:inline-flex">• {item.status}</span></div> })}</div>)}<div className="pointer-events-none absolute inset-y-0 left-[56.6%] border-l-2 border-dashed border-[#2f69dc]" /></div></div>
    </div></div>
  </section>;
}

function NextSteps() {
  const steps = [{ title: 'Name your workflows', desc: 'Runtime IDs are hard to read in an incident.', tone: 'bg-[#ffda45]', status: 'Do first', meta: ['2 workflows', '~2 min'] }, { title: 'Set a cost budget', desc: 'So anomaly detection has a baseline from day one.', tone: 'bg-white', status: '', meta: ['$0 / day', 'Sep 9'] }, { title: 'Invite your on-call', desc: 'Incidents need an owner before the first one opens.', tone: 'bg-white', status: '', meta: [] }];
  return <section className="rounded-[26px] border border-[#edf0f4] bg-white p-6 shadow-[0_14px_34px_rgba(46,59,84,0.05)]"><div className="mb-4 flex items-center justify-between"><h2 className="text-[24px] font-medium tracking-[-0.045em] text-[#20242c]">Next steps</h2><a href="#detected" className="inline-flex items-center gap-1.5 rounded-full border border-[#e8eaf0] px-3 py-2 text-[12px] text-[#5c6472] hover:text-[#2f69dc]">View all <ArrowUpRight className="size-3.5" /></a></div><div className="grid gap-3">{steps.map((step) => <article key={step.title} className={`rounded-2xl border border-[#edf0f4] p-4 ${step.tone}`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-[14px] font-medium text-[#303641]">{step.title}</h3><p className="mt-1 text-[12px] leading-relaxed text-[#717988]">{step.desc}</p></div>{step.status && <span className="rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-medium text-[#3f4752]">• {step.status}</span>}</div>{step.meta.length > 0 && <div className="mt-4 flex gap-2">{step.meta.map((meta) => <span key={meta} className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] text-[#505866]"><Check className="size-3" />{meta}</span>)}</div>}</article>)}</div></section>;
}

function Detected() {
  const cards = [{ label: 'agents', value: '6', icon: Bot, color: 'bg-emerald-100 text-emerald-600', meta: '92% confidence' }, { label: 'workflows', value: '2', icon: Network, color: 'bg-violet-100 text-violet-600', meta: '88% confidence' }, { label: 'handoffs', value: '9', icon: Zap, color: 'bg-blue-100 text-blue-600', meta: '2 unverified' }, { label: 'events', value: '412', icon: Sparkles, color: 'bg-amber-100 text-amber-600', meta: 'streaming' }];
  return <section id="detected" className="rounded-[26px] border border-[#edf0f4] bg-white p-6 shadow-[0_14px_34px_rgba(46,59,84,0.05)]"><div className="mb-4 flex items-center justify-between"><h2 className="text-[24px] font-medium tracking-[-0.045em] text-[#20242c]">Detected</h2><a href="#overview" className="inline-flex items-center gap-1.5 rounded-full border border-[#e8eaf0] px-3 py-2 text-[12px] text-[#5c6472] hover:text-[#2f69dc]">View all <ArrowUpRight className="size-3.5" /></a></div><div className="grid grid-cols-2 gap-3">{cards.map((card) => { const Icon = card.icon; return <article key={card.label} className="flex min-h-[148px] flex-col items-center justify-center rounded-2xl border border-[#edf0f4] text-center"><span className={`grid size-11 place-items-center rounded-full ${card.color}`}><Icon className="size-5" /></span><strong className="mt-3 text-[20px] font-medium text-[#303641]">{card.value}</strong><span className="mt-0.5 text-[12px] text-[#505866]">{card.label}</span><span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#f7f8fa] px-2 py-1 text-[10px] text-[#858d9a]"><Check className="size-3" />{card.meta}</span></article> })}</div></section>;
}

function Assistant() {
  return <section id="live-map" className="relative overflow-hidden rounded-[26px] border border-[#edf0f4] bg-white p-6 shadow-[0_14px_34px_rgba(46,59,84,0.05)]"><div className="pointer-events-none absolute left-1/2 top-6 size-24 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#d8e8ff,#7ca8f3_45%,#cbd9f7_70%,transparent_72%)] blur-[2px]" /><div className="relative pt-24 text-center"><h2 className="text-[23px] font-medium tracking-[-0.04em] text-[#20242c]">Welcome, Nizam</h2><p className="mt-1 text-[20px] tracking-[-0.045em] text-[#20242c]">What can I help with today?</p><div className="mt-5 flex flex-wrap justify-center gap-2"><button className="inline-flex items-center gap-1.5 rounded-full border border-[#edf0f4] bg-[#fafbfc] px-3 py-2 text-[11px] text-[#535b69]"><Network className="size-3.5" />Name workflows</button><button className="inline-flex items-center gap-1.5 rounded-full border border-[#edf0f4] bg-[#fafbfc] px-3 py-2 text-[11px] text-[#535b69]"><MessageCircle className="size-3.5" />Explain graph</button><button className="inline-flex items-center gap-1.5 rounded-full border border-[#edf0f4] bg-[#fafbfc] px-3 py-2 text-[11px] text-[#535b69]"><Plus className="size-3.5" />Invite team</button></div><div className="mt-7 text-left"><p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9aa1ad]">Ask about what we found</p>{['Why is validator_agent still pending?', 'Which agent is most likely to fail first?'].map((prompt) => <button key={prompt} className="mb-2 flex w-full items-center justify-between rounded-xl bg-[#f7f8fa] px-3 py-3 text-left text-[11px] text-[#4b5360] hover:bg-[#eef3ff] hover:text-[#2f69dc]"><span className="flex items-center gap-2"><Sparkles className="size-3.5 text-[#8c6be8]" />{prompt}</span><ArrowUpRight className="size-3.5" /></button>)}<div className="mt-1 flex items-center gap-2 rounded-2xl border border-[#e8eaf0] bg-white px-3 py-2.5"><input aria-label="Ask me anything" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#a3a9b3]" placeholder="Ask me anything" /><button aria-label="发送问题" className="text-[#303742] hover:text-[#2f69dc]"><Send className="size-4" /></button></div><div className="mt-2 flex items-center justify-between text-[10px] text-[#a3a9b3]"><span>⌘ Enter to send</span><span>0 / 300</span></div></div></div></section>;
}

export default function OrchestrateIQPage() {
  return <div className="min-h-dvh bg-[#f4f5f7] pt-[106px] text-[#20242c]"><WorkspaceHeader /><div className="flex min-h-[calc(100dvh-106px)] gap-4 px-4 pb-4 pt-4 lg:px-6"><Rail /><main className="min-w-0 flex-1 md:pl-[92px]"><div className="mx-auto max-w-[1480px]"><TimelineCard /><div className="mt-5 grid gap-5 xl:grid-cols-[1.04fr_1fr_1.04fr]"><NextSteps /><Detected /><Assistant /></div></div></main></div></div>;
}

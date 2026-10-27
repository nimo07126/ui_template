import Link from "next/link";

export default function ComponentsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <meta httpEquiv="refresh" content="0;url=../showcase/" />
      <p className="text-sm text-muted-foreground">
        组件预览已移动到 <Link className="underline" href="/showcase">/showcase</Link>，正在跳转…
      </p>
    </main>
  );
}

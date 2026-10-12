import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Restaurant Web POC
      </h1>
      <p className="max-w-md text-muted-foreground">
        Next.js + TypeScript + Apollo GraphQL + Tailwind + shadcn/ui.
      </p>
      <Button asChild>
        <Link href="/dashboard">View dashboard demo</Link>
      </Button>
    </main>
  );
}

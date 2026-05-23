import { Spinner } from "@/components/ui/spinner";

export default function AdminLoading() {
  return (
    <div className="arena-panel flex min-h-[16rem] items-center justify-center rounded-3xl p-6 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <Spinner className="size-5 text-primary" />
        <span className="font-mono uppercase tracking-[0.18em]">Loading admin page...</span>
      </div>
    </div>
  );
}

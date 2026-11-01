import { FlowsEditor } from "@/components/flows-editor";

export const dynamic = "force-dynamic";

export default function FlowsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl tracking-tight text-landing">Flows</h1>
      <p className="mt-2 text-sm text-muted">
        Choose which AI tool, model and effort runs each task. Saved to <span className="font-mono">config/flows.yml</span>.
        &ldquo;App default&rdquo; uses the CLI picked for the run. Token use and failures come from your recent runs in this browser.
      </p>
      <FlowsEditor />
    </div>
  );
}

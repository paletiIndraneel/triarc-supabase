"use client";

// Styled replacements for window.confirm / window.prompt in the admin area.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, HelpCircle } from "lucide-react";

type BaseOptions = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type PromptOptions = BaseOptions & { defaultValue?: string; inputMode?: "text" | "decimal" | "numeric" };

function DialogView({ options, withInput, onDone }: { options: PromptOptions; withInput: boolean; onDone: (result: string | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(options.defaultValue ?? "");

  useEffect(() => {
    ref.current!.showModal();
    // Destructive actions focus Cancel, so Enter never deletes by accident.
    if (withInput) inputRef.current?.select();
    else if (!options.danger) confirmRef.current?.focus();
  }, [withInput, options.danger]);

  const Icon = options.danger ? AlertTriangle : HelpCircle;
  const accent = options.danger
    ? "bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
    : "bg-[#7157d9] hover:bg-[#5f46c7] focus-visible:outline-[#7157d9]";

  return (
    <dialog
      ref={ref}
      onCancel={(event) => { event.preventDefault(); onDone(null); }}
      onClick={(event) => { if (event.target === ref.current) onDone(null); }}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_70px_rgba(16,24,40,0.18)] backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]"
    >
      <form method="dialog" onSubmit={(event) => { event.preventDefault(); onDone(withInput ? value : ""); }} className="p-6">
        <div className="flex gap-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${options.danger ? "bg-red-50" : "bg-violet-50"}`}>
            <Icon size={20} aria-hidden="true" color={options.danger ? "#dc2626" : "#7157d9"} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{options.title ?? (withInput ? "Enter a value" : "Are you sure?")}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{options.message}</p>
            {withInput && (
              <input
                ref={inputRef}
                value={value}
                inputMode={options.inputMode}
                onChange={(event) => setValue(event.target.value)}
                className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#8b78df] focus:ring-3 focus:ring-[#7157d9]/15"
              />
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" autoFocus={options.danger && !withInput} onClick={() => onDone(null)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {options.cancelLabel ?? "Cancel"}
          </button>
          <button ref={confirmRef} type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 ${accent}`}>
            {options.confirmLabel ?? (options.danger ? "Yes, continue" : "Confirm")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function open(options: PromptOptions, withInput: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const opener = document.activeElement as HTMLElement | null;
    const done = (result: string | null) => { root.unmount(); host.remove(); opener?.focus?.(); resolve(result); };
    root.render(<DialogView options={options} withInput={withInput} onDone={done} />);
  });
}

export async function confirmDialog(options: BaseOptions | string): Promise<boolean> {
  const opts = typeof options === "string" ? { message: options } : options;
  return (await open(opts, false)) !== null;
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return open(options, true);
}

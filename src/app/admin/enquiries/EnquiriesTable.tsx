"use client";

import { useMemo, useState } from "react";
import { Mail, Phone, Search, ChevronDown, ChevronUp, AlertCircle, Inbox } from "lucide-react";
import { safeMailtoHref, safeTelHref } from "@/lib/security";
import { supabase } from "@/lib/supabase/billing";

type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "New" | "Contacted" | "Closed";
  created_at: string;
};

type Props = {
  enquiries: Enquiry[];
  error?: boolean;
};

const statuses = ["New", "Contacted", "Closed"] as const;
const filters = [...statuses, "All"] as const;
const STATUS_STYLE: Record<Enquiry["status"], string> = {
  New: "border-violet-200 bg-violet-50 text-violet-700",
  Contacted: "border-amber-200 bg-amber-50 text-amber-800",
  Closed: "border-slate-200 bg-slate-100 text-slate-600",
};

export default function EnquiriesTable({ enquiries: initialEnquiries, error = false }: Props) {
  const [enquiries, setEnquiries] = useState(initialEnquiries);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("New");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
  const [lastChange, setLastChange] = useState<{ item: Enquiry; previous: Enquiry["status"] } | null>(null);

  // RLS lets only active admins update enquiries; the row stays put on failure.
  async function changeStatus(item: Enquiry, status: Enquiry["status"], isUndo = false) {
    if (status === item.status) return;
    setSavingId(item.id);
    setStatusError("");
    const { error: updateError } = await supabase.from("enquiries").update({ status }).eq("id", item.id);
    setSavingId(null);
    if (updateError) {
      setStatusError(`Couldn't update ${item.name}: ${updateError.message}`);
      return;
    }
    setEnquiries((current) => current.map((row) => (row.id === item.id ? { ...row, status } : row)));
    // The row may leave the filtered view, so offer a one-step undo instead of a confirm.
    setLastChange(isUndo ? null : { item: { ...item, status }, previous: item.status });
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enquiries.filter((item) => {
      const matchesStatus = filter === "All" || item.status === filter;
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        (item.phone ?? "").toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [enquiries, filter, query]);

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search enquiries by name, email, phone or message..."
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as (typeof filters)[number])}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-violet-300"
              aria-label="Enquiry status"
            >
              {filters.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <span className="whitespace-nowrap rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:bg-[#25382f] dark:text-[#e7f0ec]">
              {rows.length} {rows.length === 1 ? "enquiry" : "enquiries"}
            </span>
          </div>
        </div>
      </div>

      {lastChange && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <span>Enquiry marked as {lastChange.item.status}.</span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={() => void changeStatus(lastChange.item, lastChange.previous, true)} className="font-semibold text-violet-700 hover:text-violet-900">Undo</button>
            <button type="button" onClick={() => setLastChange(null)} aria-label="Dismiss" className="text-violet-500 hover:text-violet-800">✕</button>
          </span>
        </div>
      )}

      {statusError && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{statusError}</p>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-red-50 p-3 text-red-600"><AlertCircle size={22} /></div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">Unable to load enquiries</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">There was a problem loading enquiries from the database.</p>
            <button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-slate-100 p-3 text-slate-500"><Inbox size={22} /></div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">No enquiries found</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {filter === "New" && !query ? "There are no new enquiries requiring attention." : "Try changing the status filter or search term."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    {["Name", "Email", "Phone", "Message", "Submitted", "Status"].map((label) => (
                      <th key={label} className="px-5 py-3.5 font-semibold text-slate-600">{label}</th>
                    ))}
                    <th className="px-5 py-3.5 text-right font-semibold text-slate-600">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item) => {
                    const isExpanded = !!expanded[item.id];
                    return (
                      <tr key={item.id} className="align-top transition hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{item.name}</div>
                        </td>
                        <td className="px-5 py-4 font-mono text-[13px] text-slate-600">{item.email}</td>
                        <td className="px-5 py-4 text-slate-600">{item.phone || "—"}</td>
                        <td className="max-w-[390px] px-5 py-4 text-slate-600">
                          <p className={isExpanded ? "whitespace-pre-wrap leading-6" : "line-clamp-2 leading-6"}>{item.message}</p>
                          {item.message.length > 100 && (
                            <button
                              type="button"
                              onClick={() => setExpanded((prev) => ({ ...prev, [item.id]: !isExpanded }))}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900"
                            >
                              {isExpanded ? <>Collapse <ChevronUp size={13} /></> : <>Expand <ChevronDown size={13} /></>}
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                          {new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={item.status}
                            disabled={savingId === item.id}
                            onChange={(e) => void changeStatus(item, e.target.value as Enquiry["status"])}
                            aria-label={`Status of enquiry from ${item.name}`}
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60 ${STATUS_STYLE[item.status]}`}
                          >
                            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <a href={safeMailtoHref(item.email)} aria-label={`Email ${item.name}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-violet-700"><Mail size={15} /></a>
                            {item.phone && <a href={safeTelHref(item.phone)} aria-label={`Call ${item.name}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-violet-700"><Phone size={15} /></a>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

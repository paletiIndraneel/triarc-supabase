"use client";

import { useMemo, useState } from "react";
import { Mail, Phone, RefreshCw, Search, ChevronDown, ChevronUp, AlertCircle, Inbox } from "lucide-react";

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

const filters = ["New", "Contacted", "Closed", "All"] as const;

export default function EnquiriesTable({ enquiries, error = false }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("New");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
      <div className="mt-7 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
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
            <span className="whitespace-nowrap rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
              Showing {rows.length} Enquiries
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>
      </div>

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
                    {["Name", "Email", "Phone", "Message", "Submitted", "Actions"].map((label) => (
                      <th key={label} className="px-5 py-3.5 font-semibold text-slate-600">{label}</th>
                    ))}
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
                          <div className="flex justify-end gap-2">
                            <a href={`mailto:${item.email}`} aria-label={`Email ${item.name}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-violet-700"><Mail size={15} /></a>
                            {item.phone && <a href={`tel:${item.phone}`} aria-label={`Call ${item.name}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-violet-700"><Phone size={15} /></a>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
              <span>Showing {rows.length} of {rows.length} Enquiries</span>
              <div className="flex items-center gap-1">
                <button disabled className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-300">Previous</button>
                <span className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white">1</span>
                <button disabled className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-300">Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

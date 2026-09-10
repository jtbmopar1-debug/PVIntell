"use client";

import { ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  planStatus: string;
  protected: boolean;
};

export function AdminUsers({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  async function deleteUser(user: AdminUserRow) {
    const phrase = `DELETE ${user.email}`;
    const confirmation = window.prompt(`Permanently delete ${user.email} and all of their PVIntell data?\n\nType ${phrase} to continue.`);
    if (confirmation === null) return;
    setDeletingId(user.id); setError("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The user could not be deleted.");
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The user could not be deleted.");
    } finally {
      setDeletingId("");
    }
  }

  return <section className="card mt-5 overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="text-sm font-extrabold">Registered users</h2><p className="mt-1 text-[10px] text-muted">{users.length} account{users.length === 1 ? "" : "s"}</p></div><ShieldCheck size={20} className="text-brand"/></div>
    {error ? <p role="alert" className="border-b border-[#efaa9f] bg-[#fff0eb] px-4 py-3 text-[11px] text-[#913e31]">{error}</p> : null}
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left">
      <thead className="bg-[#f5f8fb] text-[9px] font-extrabold uppercase tracking-[.1em] text-muted"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Plan status</th><th className="w-16 px-4 py-3 text-center">Delete</th></tr></thead>
      <tbody className="divide-y divide-line">{users.map((user) => <tr key={user.id} className="text-xs"><td className="px-4 py-3 font-bold">{user.name || "Not provided"}</td><td className="px-4 py-3 text-muted">{user.email}</td><td className="px-4 py-3 text-muted">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(user.createdAt))}</td><td className="px-4 py-3"><span className="inline-flex rounded-full bg-[#eaf2fb] px-2.5 py-1 text-[10px] font-bold capitalize text-brand">{user.planStatus}</span></td><td className="px-4 py-3 text-center"><button type="button" disabled={user.protected || deletingId === user.id} onClick={() => void deleteUser(user)} aria-label={user.protected ? `Protected admin account ${user.email}` : `Delete ${user.email}`} title={user.protected ? "Admin accounts are protected" : "Permanently delete user"} className="inline-grid size-9 place-items-center rounded-lg border border-line text-[#a7442d] hover:border-[#df8f81] hover:bg-[#fff0eb] disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={15}/></button></td></tr>)}</tbody>
    </table></div>
  </section>;
}


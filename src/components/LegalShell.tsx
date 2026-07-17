import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { MarketingHeader } from './MarketingHeader';

/**
 * Layout for the static legal pages (Privacy, Terms): marketing header, a readable
 * prose column, and cross-links. Content is authored in English (the governing
 * language); localize per-jurisdiction with legal review before production.
 */
export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{updated}</p>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Template — this document is a starting point, not legal advice. Have it reviewed by a qualified
          lawyer and fill in the bracketed placeholders before using it in production.
        </div>

        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-700 [&_a]:text-indigo-600 [&_a:hover]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>

        <nav className="mt-10 flex flex-wrap gap-x-2 gap-y-1 border-t border-slate-100 pt-6 text-sm text-slate-500">
          <RouterLink to="/privacy">Privacy Policy</RouterLink>
          <span>·</span>
          <RouterLink to="/terms">Terms of Service</RouterLink>
          <span>·</span>
          <RouterLink to="/cookies">Cookie preferences</RouterLink>
          <span>·</span>
          <RouterLink to="/accessibility">Accessibility</RouterLink>
          <span>·</span>
          <RouterLink to="/">Home</RouterLink>
        </nav>
      </main>
    </div>
  );
}

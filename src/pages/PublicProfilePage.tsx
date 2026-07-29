import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { problemOf } from '../api/problem';
import {
  publicCardUrl,
  publicVcardUrl,
  type Affiliation,
  type AwardResponse,
  type Currency,
  type LinkResponse,
  type LinkType,
  type PriceItem,
  type ProfileResponse,
} from '../api/profile';
import { usePublicProfile } from '../features/profile/usePublicProfile';
import { accentVars } from '../features/profile/accents';
import { SiteFooter } from '../components/SiteFooter';
import { mapQuery } from '../features/profile/maps';
import { WorkplaceMap } from '../features/profile/WorkplaceMap';
import { getPublicShowcases, type Showcase } from '../features/profile/showcases';
import { localizeCountry } from '../features/profile/countries';
import { formatAmount } from '../features/profile/currencies';
import { SocialGlyph, hasSocialIcon } from '../features/profile/socialIcons';
import { Accordion } from '../components/Accordion';

/**
 * Public card at /@username (e.g. /@alice). Anonymous — no auth. The route
 * captures the whole `@handle` segment; non-`@` paths fall back to the app.
 */
export function PublicProfilePage() {
  const { t, i18n } = useTranslation();
  const { handle } = useParams();
  const username = handle?.startsWith('@') ? handle.slice(1) : undefined;
  const { data, isLoading, isError, error } = usePublicProfile(username);

  // Render the card in the creator's chosen language (their single locale).
  const cardLocale = data?.locale;
  useEffect(() => {
    if (cardLocale && i18n.language !== cardLocale) {
      void i18n.changeLanguage(cardLocale);
    }
  }, [cardLocale, i18n]);

  // A bare segment without the `@` isn't a card — preserve the app catch-all.
  if (!username) {
    return <Navigate to="/app" replace />;
  }

  if (isLoading) {
    return <Centered>{t('publicCard.loading')}</Centered>;
  }

  if (isError || !data) {
    const notFound =
      problemOf(error)?.code === 'profile_not_found' || (error instanceof ApiError && error.status === 404);
    return notFound ? (
      <Centered>
        <p className="text-lg font-semibold text-slate-900">@{username}</p>
        <p className="mt-1 text-sm text-slate-500">{t('publicCard.notFound')}</p>
      </Centered>
    ) : (
      <Centered>
        <p className="text-sm text-red-600">{t('publicCard.loadError')}</p>
      </Centered>
    );
  }

  return <Card profile={data} />;
}

/**
 * Responsive layout: on desktop a sticky identity/contact panel sits beside a
 * content column; on mobile they stack. When the profile has no extra content,
 * it collapses to a single centered card.
 */
function Card({ profile }: { profile: ProfileResponse }) {
  const { t } = useTranslation();
  const links = [...profile.links].sort((a, b) => a.position - b.position);
  const socials = links.filter((l) => hasSocialIcon(l.type));
  const customLinks = links.filter((l) => !hasSocialIcon(l.type));
  const name = profile.display_name ?? `@${profile.username}`;
  const workplaces = profile.affiliations ?? [];
  const activities = profile.activities ?? [];
  const priceItems = profile.price_items ?? [];
  const currency = profile.currency ?? 'USD';
  const awards = [...(profile.awards ?? [])].sort((a, b) => a.position - b.position);

  const { data: showcasesData, isPending: showcasesPending } = useQuery({
    queryKey: ['showcases', 'public', profile.username],
    queryFn: () => getPublicShowcases(profile.username),
  });
  const showcases = showcasesData ?? [];

  // Heavy sections present, in render order. The first is expanded by default so a
  // profile with a single section doesn't look empty; the rest stay collapsed to
  // keep the page short. Gated on the showcases query so "first" is computed once.
  const sections: string[] = [];
  if (priceItems.length) sections.push('pricelist');
  if (workplaces.length) sections.push('workplaces');
  if (showcases.length) sections.push('showcases');
  if (awards.length) sections.push('awards');
  const firstOpen = sections[0];

  const hasContent = activities.length > 0 || sections.length > 0;

  return (
    <Page>
      <div
        style={accentVars(profile.accent_color)}
        className={
          hasContent
            ? 'mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start lg:gap-8'
            : 'mx-auto w-full max-w-md'
        }
      >
        <IdentityPanel profile={profile} name={name} socials={socials} customLinks={customLinks} sticky={hasContent} />

        {hasContent && (
          <div className="space-y-4">
            {activities.length > 0 && <ActivitiesCard activities={activities} />}
            {!showcasesPending && (
              <>
                {priceItems.length > 0 && (
                  <Accordion
                    title={t('publicCard.pricelist')}
                    count={priceItems.length}
                    defaultOpen={firstOpen === 'pricelist'}
                  >
                    <PricelistList items={priceItems} currency={currency} lang={profile.locale} />
                  </Accordion>
                )}
                {workplaces.length > 0 && (
                  <Accordion
                    title={t('publicCard.whereToFind')}
                    count={workplaces.length}
                    defaultOpen={firstOpen === 'workplaces'}
                  >
                    <WorkplacesList profile={profile} workplaces={workplaces} />
                  </Accordion>
                )}
                {showcases.length > 0 && (
                  <Accordion
                    title={t('publicCard.showcases')}
                    count={showcases.length}
                    defaultOpen={firstOpen === 'showcases'}
                  >
                    <ShowcasesList showcases={showcases} />
                  </Accordion>
                )}
                {awards.length > 0 && (
                  <Accordion title={t('awards.heading')} count={awards.length} defaultOpen={firstOpen === 'awards'}>
                    <AwardsGallery awards={awards} name={name} />
                  </Accordion>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

function IdentityPanel({
  profile,
  name,
  socials,
  customLinks,
  sticky,
}: {
  profile: ProfileResponse;
  name: string;
  socials: LinkResponse[];
  customLinks: LinkResponse[];
  sticky: boolean;
}) {
  const { t } = useTranslation();
  const location = primaryLocation(profile);

  return (
    <aside
      className={`w-full rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200/70 sm:p-8 ${
        sticky ? 'lg:sticky lg:top-8 lg:self-start' : ''
      }`}
    >
      <Avatar url={profile.avatar_url} name={name} />

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
      <p className="mt-0.5 text-sm text-slate-500">@{profile.username}</p>

      {location && (
        <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-500">
          <span aria-hidden="true">📍</span>
          {location}
        </p>
      )}

      {profile.bio && (
        <p className="mx-auto mt-4 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-slate-700">
          {profile.bio}
        </p>
      )}

      <a
        href={publicVcardUrl(profile.username)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-[var(--accent-strong)] active:scale-[.99]"
      >
        <span aria-hidden="true">＋</span> {t('publicCard.saveContact')}
      </a>

      {profile.phone && (
        <a
          href={`tel:${profile.phone}`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[.99]"
        >
          <span aria-hidden="true">📞</span> {t('publicCard.call')}
        </a>
      )}

      <ShareButton url={publicCardUrl(profile.username)} name={name} />

      {socials.length > 0 && (
        <ul className="mx-auto mt-5 flex max-w-xs flex-wrap justify-center gap-2">
          {socials.map((link) => {
            const isEmail = link.type === 'EMAIL';
            return (
            <li key={link.id}>
              <a
                href={isEmail ? mailtoHref(link.url) : link.url}
                {...(isEmail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                aria-label={link.label}
                title={link.label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-[var(--accent)] hover:shadow-md active:scale-90"
              >
                <SocialGlyph type={link.type} className="h-[18px] w-[18px]" />
              </a>
            </li>
            );
          })}
        </ul>
      )}

      {customLinks.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {customLinks.map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[.99]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}

    </aside>
  );
}

/**
 * One clearly-labeled "Share this card" button (grouped with Save/Call, not a bare icon
 * row that would mimic the owner's social links). On mobile it opens the OS share sheet
 * (the user picks who to send to); on desktop it drops a labeled menu with WhatsApp /
 * Telegram / X / Copy link.
 */
function ShareButton({ url, name }: { url: string; name: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const text = t('publicCard.shareText', { name });
  const e = encodeURIComponent;

  const onShare = async () => {
    // Native share sheet where available (mostly mobile) — clearest "with whom" UX.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {
        return; // user dismissed the sheet
      }
    }
    setOpen((v) => !v); // desktop fallback: labeled menu
  };

  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setOpen(false);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: { type: LinkType; label: string; href: string }[] = [
    { type: 'WHATSAPP', label: 'WhatsApp', href: `https://wa.me/?text=${e(`${text} ${url}`)}` },
    { type: 'TELEGRAM', label: 'Telegram', href: `https://t.me/share/url?url=${e(url)}&text=${e(text)}` },
    { type: 'TWITTER', label: 'X', href: `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(text)}` },
  ];

  return (
    <div ref={wrapRef} className="relative mt-3">
      <button
        type="button"
        onClick={onShare}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[.99]"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 15V3m0 0 4 4m-4-4L8 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {copied ? t('publicCard.linkCopied') : t('publicCard.shareThis')}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {items.map((it) => (
            <a
              key={it.type}
              role="menuitem"
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <SocialGlyph type={it.type} className="h-4 w-4 text-slate-500" />
              {t('publicCard.shareOn', { app: it.label })}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={copy}
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10 13a5 5 0 007.1 0l1.4-1.4a5 5 0 00-7.1-7.1L10 6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 11a5 5 0 00-7.1 0L5.5 12.4a5 5 0 007.1 7.1L14 18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('publicCard.copyLink')}
          </button>
        </div>
      )}
    </div>
  );
}

function ActivitiesCard({ activities }: { activities: string[] }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">{t('publicCard.activities')}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {activities.map((a, i) => (
          <li
            key={i}
            className="rounded-full bg-[var(--accent-soft,#eef2ff)] px-3 py-1 text-sm font-medium text-[var(--accent-strong,#4338ca)]"
          >
            {a}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The price list: service name on the left, formatted price on the right. */
function PricelistList({ items, currency, lang }: { items: PriceItem[]; currency: Currency; lang: string }) {
  const { t } = useTranslation();
  const fmt = (n: number | undefined) => formatAmount(n ?? 0, currency, lang);
  const priceLabel = (item: PriceItem): string => {
    switch (item.price_type) {
      case 'FROM':
        return t('publicCard.priceFrom', { amount: fmt(item.amount_min) });
      case 'RANGE':
        return `${fmt(item.amount_min)} – ${fmt(item.amount_max)}`;
      default:
        return fmt(item.amount_min);
    }
  };
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item, i) => (
        <li key={i} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <span className="min-w-0 break-words text-sm text-slate-700">{item.name}</span>
          <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-slate-900">{priceLabel(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function WorkplacesList({ profile, workplaces }: { profile: ProfileResponse; workplaces: Affiliation[] }) {
  return (
    <ul className="space-y-3">
      {workplaces.map((a, i) => (
        <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
          {roleLine(a) && <p className="text-sm font-semibold text-slate-800">{roleLine(a)}</p>}
          {a.address && <p className="mt-0.5 text-sm text-slate-600">{a.address}</p>}
          {a.description && <p className="mt-0.5 text-xs italic text-slate-400">{a.description}</p>}
          {a.address && (
            <WorkplaceMap
              query={mapQuery({ address: a.address, city: profile.location?.city, country: profile.location?.country })}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Certificates / diplomas grid. Thumbnails show the *whole* document (letterboxed,
 * never cropped) since certificates are text-heavy and vary in orientation. Tapping
 * one opens a full-screen viewer with prev/next navigation (arrows + keyboard).
 */
function AwardsGallery({ awards, name }: { awards: AwardResponse[]; name: string }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;
  const count = awards.length;
  const current = index === null ? null : awards[index];

  const close = useCallback(() => setIndex(null), []);
  const go = useCallback((dir: 1 | -1) => setIndex((i) => (i === null ? i : (i + dir + count) % count)), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close, go]);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {awards.map((award, i) => (
          <li key={award.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              title={award.description}
              className="group block w-full rounded-xl border border-slate-200 bg-slate-50 p-2 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-[.98]"
            >
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg">
                <img
                  src={award.image_url}
                  alt={award.description || t('awards.imageAlt', { name })}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-105"
                />
              </div>
            </button>
            {award.description && <p className="mt-1 truncate text-xs text-slate-500">{award.description}</p>}
          </li>
        ))}
      </ul>

      {open && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('awards.viewerLabel')}
          onClick={close}
          className="bc-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
        >
          <button
            type="button"
            aria-label={t('awards.close')}
            onClick={close}
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:scale-110 hover:bg-white/20 active:scale-90 sm:right-5 sm:top-5"
          >
            ✕
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label={t('awards.previous')}
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl leading-none text-white transition duration-150 hover:-translate-x-0.5 hover:bg-white/20 active:scale-90 sm:left-5"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={t('awards.next')}
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl leading-none text-white transition duration-150 hover:translate-x-0.5 hover:bg-white/20 active:scale-90 sm:right-5"
              >
                ›
              </button>
            </>
          )}

          <figure onClick={(e) => e.stopPropagation()} className="flex max-h-full max-w-3xl flex-col items-center gap-4">
            <img
              key={index}
              src={current.image_url}
              alt={current.description || t('awards.imageAlt', { name })}
              className="bc-zoom-in max-h-[80vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            />
            <figcaption className="text-center">
              {current.description && (
                <span className="block max-w-prose text-sm text-slate-200">{current.description}</span>
              )}
              {count > 1 && (
                <span className="mt-1 block text-xs text-slate-500">
                  {index + 1} / {count}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}

/** Public before→after case studies rendered as numbered photo timelines. */
function ShowcasesList({ showcases }: { showcases: Showcase[] }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="text-sm text-slate-500">{t('publicCard.showcasesSubtitle')}</p>
      <div className="mt-4 space-y-5">
        {showcases.map((showcase, i) => (
          <ShowcaseCard key={i} showcase={showcase} />
        ))}
      </div>
    </>
  );
}

/**
 * One case study: a titled card whose steps read top-to-bottom as a connected
 * timeline (numbered nodes + a spine line). First/last steps carry Before/Result
 * badges; tapping any photo opens a full-screen viewer that pages through the steps.
 */
function ShowcaseCard({ showcase }: { showcase: Showcase }) {
  const { t } = useTranslation();
  const steps = showcase.steps ?? [];
  const title = showcase.title ?? t('publicCard.showcases');
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;
  const count = steps.length;

  const close = useCallback(() => setIndex(null), []);
  const go = useCallback((dir: 1 | -1) => setIndex((i) => (i === null ? i : (i + dir + count) % count)), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close, go]);

  const badgeFor = (j: number): string | null => {
    if (count < 2) return null;
    if (j === 0) return t('publicCard.showcaseBefore');
    if (j === count - 1) return t('publicCard.showcaseResult');
    return null;
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {(showcase.title || showcase.intro) && (
        <header className="border-b border-slate-100 px-4 py-3 sm:px-5">
          {showcase.title && <h3 className="text-base font-semibold text-slate-900">{showcase.title}</h3>}
          {showcase.intro && <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{showcase.intro}</p>}
        </header>
      )}

      <ol className="px-4 py-4 sm:px-5">
        {steps.map((step, j) => {
          const badge = badgeFor(j);
          const isResult = count > 1 && j === count - 1;
          return (
            <li key={j} className="relative pb-6 pl-9 last:pb-0">
              {j < count - 1 && (
                <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-7 w-px bg-slate-200" />
              )}
              <span
                aria-hidden="true"
                className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ring-4 ring-white ${
                  isResult ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
                }`}
              >
                {j + 1}
              </span>

              {badge && (
                <span
                  className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    isResult ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {badge}
                </span>
              )}

              <button
                type="button"
                onClick={() => setIndex(j)}
                aria-label={step.description || t('publicCard.showcaseStep', { n: j + 1 })}
                className="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <img
                  src={step.image_url}
                  alt={step.description || t('publicCard.showcaseStepAlt', { title, n: j + 1 })}
                  loading="lazy"
                  className="mx-auto max-h-96 w-auto max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                />
              </button>
              {step.description && <p className="mt-1.5 text-sm text-slate-600">{step.description}</p>}
            </li>
          );
        })}
      </ol>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('publicCard.showcaseViewerLabel')}
          onClick={close}
          className="bc-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
        >
          <button
            type="button"
            aria-label={t('publicCard.showcaseClose')}
            onClick={close}
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition hover:scale-110 hover:bg-white/20 active:scale-90 sm:right-5 sm:top-5"
          >
            ✕
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label={t('publicCard.showcasePrev')}
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl leading-none text-white transition duration-150 hover:-translate-x-0.5 hover:bg-white/20 active:scale-90 sm:left-5"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={t('publicCard.showcaseNext')}
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl leading-none text-white transition duration-150 hover:translate-x-0.5 hover:bg-white/20 active:scale-90 sm:right-5"
              >
                ›
              </button>
            </>
          )}

          <figure onClick={(e) => e.stopPropagation()} className="flex max-h-full max-w-3xl flex-col items-center gap-4">
            <img
              key={index}
              src={steps[index].image_url}
              alt={steps[index].description || t('publicCard.showcaseStepAlt', { title, n: index + 1 })}
              className="bc-zoom-in max-h-[80vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            />
            <figcaption className="text-center">
              {steps[index].description && (
                <span className="block max-w-prose text-sm text-slate-200">{steps[index].description}</span>
              )}
              {count > 1 && (
                <span className="mt-1 block text-xs text-slate-500">
                  {index + 1} / {count}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </article>
  );
}

function Avatar({ url, name }: { url?: string; name: string }) {
  if (url) {
    return <img src={url} alt={name} className="mx-auto h-24 w-24 rounded-full object-cover shadow-md ring-4 ring-white" />;
  }
  return (
    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent-soft)] text-3xl font-semibold text-[var(--accent)] shadow-md ring-4 ring-white">
      {name.replace(/^@/, '').charAt(0).toUpperCase()}
    </div>
  );
}

/** Ensure an EMAIL link opens the mail client — a bare address would navigate in-app. */
function mailtoHref(value: string): string {
  return /^mailto:/i.test(value) ? value : `mailto:${value}`;
}

/** "Role · Organization" for one workplace — skips whichever part is blank. */
function roleLine(affiliation: Affiliation): string {
  return [affiliation.role, affiliation.organization].filter(Boolean).join(' · ');
}

/** "City, Country" — the profile's primary location, country localized to the card's language. */
function primaryLocation(profile: ProfileResponse): string {
  const loc = profile.location;
  if (!loc) return '';
  return [loc.city, localizeCountry(loc.country, profile.locale)].filter(Boolean).join(', ');
}

/** Public page chrome: a slim brand header (+ CTA / back), the card, and a legal footer. */
function Page({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="group flex items-center gap-2.5" aria-label="Beamcard">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-sm transition group-hover:bg-indigo-700">
              B
            </span>
            <span className="text-[17px] font-bold tracking-tight text-slate-900">Beamcard</span>
          </Link>
          {token ? (
            // Logged-in owner previewing their own card gets a way back.
            <Link
              to="/app/profile"
              className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← {t('publicCard.backToProfile')}
            </Link>
          ) : (
            // Visitors get a subtle log-in link; the sign-up pitch lives in the JoinBanner below.
            <Link
              to="/login"
              className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t('publicCard.logIn')}
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-10">{children}</main>

      {!token && <JoinBanner />}
      <SiteFooter />
    </div>
  );
}

/**
 * Bottom "join" banner shown to visitors (not the owner previewing). It appears after
 * they've seen the card — the natural "I want one too" moment — and explains what
 * Beamcard is and why, so the single sign-up CTA has context instead of being a bare button.
 */
function JoinBanner() {
  const { t } = useTranslation();
  return (
    <section className="border-t border-slate-200/70 bg-white/60">
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-sm">
          B
        </span>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{t('publicCard.joinTitle')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{t('publicCard.joinBody')}</p>
        <Link
          to="/signup"
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[.99]"
        >
          {t('publicCard.joinCta')}
          <span aria-hidden="true">→</span>
        </Link>
        <p className="mt-3 text-xs text-slate-400">{t('publicCard.joinNote')}</p>
      </div>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 text-center text-slate-600 shadow-sm ring-1 ring-slate-200/70">
        {children}
      </div>
    </Page>
  );
}

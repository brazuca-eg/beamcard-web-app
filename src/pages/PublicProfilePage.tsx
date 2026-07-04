import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { problemOf } from '../api/problem';
import { publicVcardUrl, type Affiliation, type AwardResponse, type ProfileResponse } from '../api/profile';
import { usePublicProfile } from '../features/profile/usePublicProfile';
import { mapQuery } from '../features/profile/maps';
import { WorkplaceMap } from '../features/profile/WorkplaceMap';

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

function Card({ profile }: { profile: ProfileResponse }) {
  const { t } = useTranslation();
  const links = [...profile.links].sort((a, b) => a.position - b.position);
  const name = profile.display_name ?? `@${profile.username}`;
  const workplaces = profile.affiliations ?? [];
  const activities = profile.activities ?? [];
  const awards = [...(profile.awards ?? [])].sort((a, b) => a.position - b.position);

  return (
    <Page>
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200/70 sm:p-8">
        <Avatar url={profile.avatar_url} name={name} />

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
        <p className="mt-0.5 text-sm text-slate-500">@{profile.username}</p>

        {primaryLocation(profile) && (
          <p className="mt-2 inline-flex items-center gap-1 text-sm text-slate-500">
            <span aria-hidden="true">📍</span>
            {primaryLocation(profile)}
          </p>
        )}

        {profile.bio && (
          <p className="mx-auto mt-4 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-slate-700">
            {profile.bio}
          </p>
        )}

        <a
          href={publicVcardUrl(profile.username)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[.99]"
        >
          <span aria-hidden="true">＋</span> {t('publicCard.saveContact')}
        </a>

        {links.length > 0 && (
          <ul className="mt-4 space-y-3">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[.99]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}

        {activities.length > 0 && (
          <section className="mt-8 text-left">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('publicCard.activities')}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {activities.map((a, i) => (
                <li
                  key={i}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700"
                >
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}

        {awards.length > 0 && <Awards awards={awards} name={name} />}

        {workplaces.length > 0 && (
          <section className="mt-8 text-left">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('publicCard.whereToFind')}
            </h2>
            <ul className="mt-3 space-y-3">
              {workplaces.map((a, i) => (
                <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  {roleLine(a) && <p className="text-sm font-semibold text-slate-800">{roleLine(a)}</p>}
                  {a.address && <p className="mt-0.5 text-sm text-slate-600">{a.address}</p>}
                  {a.description && <p className="mt-0.5 text-xs italic text-slate-400">{a.description}</p>}
                  {a.address && (
                    <WorkplaceMap
                      query={mapQuery({
                        address: a.address,
                        city: profile.location?.city,
                        country: profile.location?.country,
                      })}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">{t('publicCard.madeWith')}</p>
    </Page>
  );
}

/**
 * Certificates / diplomas. Thumbnails show the *whole* document (letterboxed, never
 * cropped), since certificates are text-heavy and vary in orientation. Tapping one
 * opens a full-screen viewer with prev/next navigation (arrows, keyboard, swipe-free).
 */
function Awards({ awards, name }: { awards: AwardResponse[]; name: string }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;
  const count = awards.length;
  const current = index === null ? null : awards[index];

  const close = useCallback(() => setIndex(null), []);
  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i === null ? i : (i + dir + count) % count)),
    [count],
  );

  // While the viewer is open: arrow keys navigate, Escape closes, body scroll locks.
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
    <section className="mt-8 text-left">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('awards.heading')}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3">
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

          <figure
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full max-w-3xl flex-col items-center gap-4"
          >
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
    </section>
  );
}

function Avatar({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md"
      />
    );
  }
  return (
    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100 text-3xl font-semibold text-indigo-600 ring-4 ring-white shadow-md">
      {name.replace(/^@/, '').charAt(0).toUpperCase()}
    </div>
  );
}

/** "Role · Organization" for one workplace — skips whichever part is blank. */
function roleLine(affiliation: Affiliation): string {
  return [affiliation.role, affiliation.organization].filter(Boolean).join(' · ');
}

/** "City, Country" — the profile's primary location; skips any blank part. */
function primaryLocation(profile: ProfileResponse): string {
  const loc = profile.location;
  return loc ? [loc.city, loc.country].filter(Boolean).join(', ') : '';
}

/** Soft full-height backdrop that centres the card (mobile-first). */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">{children}</div>
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

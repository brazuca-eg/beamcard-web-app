import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PhoneInput, { isValidPhoneNumber, type Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import phoneLabelsEn from 'react-phone-number-input/locale/en.json';
import phoneLabelsDe from 'react-phone-number-input/locale/de.json';
import phoneLabelsUk from 'react-phone-number-input/locale/ua.json';
import { problemOf } from '../api/problem';
import {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  AWARD_CONTENT_TYPES,
  AWARD_MAX_BYTES,
  publicCardUrl,
  type AccentColor,
  type Affiliation,
  type Currency,
  type LinkResponse,
  type LinkType,
  type PriceItem,
  type PriceType,
  type ProfileResponse,
} from '../api/profile';
import { useMyProfile, useProfileMutations } from '../features/profile/useMyProfile';
import { mapQuery } from '../features/profile/maps';
import { WorkplaceMap } from '../features/profile/WorkplaceMap';
import { ShowcasesEditor } from '../features/profile/ShowcasesEditor';
import { ADD_ROW_BTN, EmptyState, SectionHead, TabIcon, UPLOAD_BTN } from '../features/profile/editorUi';
import { ACCENTS, ACCENT_ORDER } from '../features/profile/accents';
import { buildQrSvg } from '../features/profile/qr';
import { useQrStyle } from '../features/profile/qrStyle';
import { LINK_PREFIX, VALUE_PLACEHOLDER, composeUrl, hasPrefix, toHandle } from '../features/profile/linkComposer';
import { countryOptions } from '../features/profile/countries';
import { currencyOptions, isPriceItemValid } from '../features/profile/currencies';

const PRICE_TYPES: PriceType[] = ['EXACT', 'FROM', 'RANGE'];

/** Debounce before auto-saving the profile block after an edit. */
const AUTOSAVE_MS = 700;

/** Shared card-panel styling so every editor section reads as a distinct block. */
const PANEL = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6';
const INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

/** Display label per type; GENERIC is user-provided so it has no preset. */
const TYPE_LABELS: Record<LinkType, string> = {
  GENERIC: 'Custom link',
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  INSTAGRAM: 'Instagram',
  TWITTER: 'X (Twitter)',
  LINKEDIN: 'LinkedIn',
  EMAIL: 'Email',
};

const LINK_TYPES = Object.keys(TYPE_LABELS) as LinkType[];

/** Left-nav tabs for the editor — groups the sections so the page isn't one long scroll. */
const EDITOR_TABS = [
  { id: 'profile', labelKey: 'editor.tabProfile', icon: 'profile' },
  { id: 'workplaces', labelKey: 'editor.tabWorkplaces', icon: 'pin' },
  { id: 'services', labelKey: 'editor.tabServices', icon: 'services' },
  { id: 'portfolio', labelKey: 'editor.tabPortfolio', icon: 'portfolio' },
  { id: 'links', labelKey: 'editor.tabLinks', icon: 'link' },
  { id: 'appearance', labelKey: 'editor.tabAppearance', icon: 'palette' },
] as const;

type EditorTabId = (typeof EDITOR_TABS)[number]['id'];

/** Typed links derive their label from the platform; only GENERIC needs a custom one. */
function labelFor(type: LinkType, custom: string): string {
  return type === 'GENERIC' ? custom.trim() : TYPE_LABELS[type];
}

/** Flat editor row for one workplace — street address only (city/country are the profile's primary). */
interface WorkplaceRow {
  role: string;
  organization: string;
  address: string;
  description: string;
}

const EMPTY_ROW: WorkplaceRow = { role: '', organization: '', address: '', description: '' };

/** API affiliations → editor rows (always at least one row so the form isn't empty). */
function toRows(affiliations: Affiliation[] | undefined): WorkplaceRow[] {
  if (!affiliations || affiliations.length === 0) return [{ ...EMPTY_ROW }];
  return affiliations.map((a) => ({
    role: a.role ?? '',
    organization: a.organization ?? '',
    address: a.address ?? '',
    description: a.description ?? '',
  }));
}

/** Editor rows → API affiliations (the backend drops fully-blank rows). */
function toAffiliations(rows: WorkplaceRow[]): Affiliation[] {
  return rows.map((r) => ({
    role: r.role,
    organization: r.organization,
    address: r.address,
    description: r.description,
  }));
}

/** API activities (plain direction strings) → editor rows; always ≥1 so the form isn't empty. */
function toActivityRows(activities: string[] | undefined): string[] {
  return activities && activities.length > 0 ? [...activities] : [''];
}

/** Editor row for one price-list line — amounts held as strings for controlled inputs. */
interface PriceRow {
  name: string;
  priceType: PriceType;
  min: string;
  max: string;
}

const EMPTY_PRICE_ROW: PriceRow = { name: '', priceType: 'EXACT', min: '', max: '' };

/** API price items → editor rows (empty when none — the price list is optional). */
function toPriceRows(items: PriceItem[] | undefined): PriceRow[] {
  if (!items || items.length === 0) return [];
  return items.map((i) => ({
    name: i.name,
    priceType: i.price_type,
    min: i.amount_min != null ? String(i.amount_min) : '',
    max: i.amount_max != null ? String(i.amount_max) : '',
  }));
}

/** One editor row → API price item, keeping only the amount(s) its type uses. */
function rowToPriceItem(row: PriceRow): PriceItem {
  const item: PriceItem = { name: row.name.trim(), price_type: row.priceType };
  if (row.priceType === 'RANGE') {
    item.amount_min = parseFloat(row.min);
    item.amount_max = parseFloat(row.max);
  } else {
    item.amount_min = parseFloat(row.min); // EXACT, FROM
  }
  return item;
}

export function MyProfilePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading, isError } = useMyProfile();

  if (isLoading) {
    return <div className="mx-auto mt-20 max-w-md p-6 text-slate-600">{t('editor.loading')}</div>;
  }
  if (isError || !profile) {
    return <div className="mx-auto mt-20 max-w-md p-6 text-sm text-red-600">{t('editor.loadError')}</div>;
  }
  // Mount the editor only once loaded, so its state seeds from the profile without an effect.
  return <CardEditor profile={profile} />;
}

/** Small segmented control (pill group) for the QR style options. */
function SegGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              value === o.v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Best-effort default country for the phone input's dropdown, from the UI language. */
function localeCountry(lang: string): Country | undefined {
  if (lang === 'uk') return 'UA';
  if (lang === 'de') return 'DE';
  return undefined;
}

/** Localized country names for the phone dropdown (the lib defaults to English). */
const PHONE_LABELS: Record<string, typeof phoneLabelsEn> = {
  en: phoneLabelsEn,
  de: phoneLabelsDe,
  uk: phoneLabelsUk,
};

/** Small "saves automatically" badge for the sections that don't use the profile Save button. */
function AutoSavedBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t('editor.autoSaved')}
    </span>
  );
}

function CardEditor({ profile }: { profile: ProfileResponse }) {
  const { t, i18n } = useTranslation();
  const {
    updateProfile,
    createLink,
    updateLink,
    deleteLink,
    reorderLinks,
    uploadAvatar,
    removeAvatar,
    uploadAward,
    updateAward,
    deleteAward,
    reorderAwards,
  } = useProfileMutations();

  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [phone, setPhone] = useState<string | undefined>(profile.phone ?? undefined);
  const countries = useMemo(() => countryOptions(i18n.language), [i18n.language]);
  const [country, setCountry] = useState(profile.location?.country ?? '');
  const [city, setCity] = useState(profile.location?.city ?? '');
  const [workplaces, setWorkplaces] = useState<WorkplaceRow[]>(() => toRows(profile.affiliations));
  const [activities, setActivities] = useState<string[]>(() => toActivityRows(profile.activities));
  const currencyList = useMemo(() => currencyOptions(i18n.language), [i18n.language]);
  const [currency, setCurrency] = useState<Currency>(profile.currency ?? 'USD');
  const [priceRows, setPriceRows] = useState<PriceRow[]>(() => toPriceRows(profile.price_items));
  const [accent, setAccent] = useState<AccentColor>(profile.accent_color ?? 'INDIGO');
  const [qrStyle, setQrStyle] = useQrStyle();
  // Live QR preview mirrors the account-page QR: current accent + saved style.
  const qrPreview = useMemo(
    () =>
      buildQrSvg(publicCardUrl(profile.username), {
        accent,
        colorMode: qrStyle.colorMode,
        moduleStyle: qrStyle.moduleStyle,
        logo: qrStyle.logo,
      }),
    [profile.username, accent, qrStyle.colorMode, qrStyle.moduleStyle, qrStyle.logo],
  );
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<LinkType>('GENERIC');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const awardInputRef = useRef<HTMLInputElement>(null);
  const firstRenderRef = useRef(true);
  // Open a specific tab when arriving via a deep link (e.g. the account checklist's ?tab=portfolio).
  const [params] = useSearchParams();
  const requestedTab = params.get('tab');
  const [tab, setTab] = useState<EditorTabId>(() =>
    EDITOR_TABS.some((x) => x.id === requestedTab) ? (requestedTab as EditorTabId) : 'profile',
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Select a tab and keep it in view — centers it in the horizontal strip on mobile so the
  // active tab is never stuck off-screen; `focus` carries keyboard focus for arrow-key nav.
  const selectTab = (id: EditorTabId, focus = false) => {
    setTab(id);
    const el = tabRefs.current[id];
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (focus) el.focus();
    }
  };

  // Arrow/Home/End move between tabs and carry focus with them (ARIA roving tabindex).
  const onTabKeyDown = (e: KeyboardEvent) => {
    const idx = EDITOR_TABS.findIndex((x) => x.id === tab);
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % EDITOR_TABS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + EDITOR_TABS.length) % EDITOR_TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = EDITOR_TABS.length - 1;
    else return;
    e.preventDefault();
    selectTab(EDITOR_TABS[next].id, true);
  };

  const links = [...profile.links].sort((a, b) => a.position - b.position);
  const awards = [...(profile.awards ?? [])].sort((a, b) => a.position - b.position);

  const onPickAvatar = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!AVATAR_CONTENT_TYPES.includes(file.type)) {
      setError(t('editor.avatarType'));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError(t('editor.avatarSize'));
      return;
    }
    uploadAvatar.mutate(file, {
      onError: (e) => setError(problemOf(e)?.detail ?? t('editor.avatarUploadError')),
    });
  };

  const onPickAward = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!AWARD_CONTENT_TYPES.includes(file.type)) {
      setError(t('editor.certType'));
      return;
    }
    if (file.size > AWARD_MAX_BYTES) {
      setError(t('editor.certSize'));
      return;
    }
    uploadAward.mutate(file, {
      onError: (e) => setError(problemOf(e)?.detail ?? t('editor.certUploadError')),
    });
  };

  const moveAward = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= awards.length) return;
    const ids = awards.map((a) => a.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorderAwards.mutate(ids);
  };

  // Auto-save the profile block (details / location / workplaces / directions / pricelist + currency).
  // Debounced so typing doesn't spam the API; invalid phone/prices block the save and surface inline
  // rather than silently dropping. No Save button — the header status shows the state.
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false; // don't save on initial mount (state just seeded from the profile)
      return;
    }
    if (phone && !isValidPhoneNumber(phone)) {
      setValidationError(t('editor.phoneInvalid'));
      return;
    }
    const priceItems = priceRows.filter((r) => r.name.trim()).map(rowToPriceItem);
    if (!priceItems.every(isPriceItemValid)) {
      setValidationError(t('editor.priceInvalid'));
      return;
    }
    setValidationError(null);

    const timer = setTimeout(() => {
      updateProfile.mutate(
        {
          display_name: displayName,
          bio,
          phone: phone ?? '', // '' clears it server-side
          location: { country, city },
          affiliations: toAffiliations(workplaces),
          activities: activities.map((a) => a.trim()).filter(Boolean),
          currency,
          price_items: priceItems,
          accent_color: accent,
        },
        { onError: (e) => setError(problemOf(e)?.detail ?? t('editor.saveError')) },
      );
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, bio, phone, country, city, workplaces, activities, currency, priceRows, accent]);

  const updateWorkplace = (index: number, field: keyof WorkplaceRow, value: string) =>
    setWorkplaces((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  const addWorkplace = () => setWorkplaces((rows) => [...rows, { ...EMPTY_ROW }]);

  const removeWorkplace = (index: number) =>
    setWorkplaces((rows) => (rows.length === 1 ? [{ ...EMPTY_ROW }] : rows.filter((_, i) => i !== index)));

  const updateActivity = (index: number, value: string) =>
    setActivities((rows) => rows.map((r, i) => (i === index ? value : r)));

  const addActivity = () => setActivities((rows) => [...rows, '']);

  const removeActivity = (index: number) =>
    setActivities((rows) => (rows.length === 1 ? [''] : rows.filter((_, i) => i !== index)));

  const updatePriceRow = (index: number, field: keyof PriceRow, value: string) =>
    setPriceRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  const addPriceRow = () => setPriceRows((rows) => [...rows, { ...EMPTY_PRICE_ROW }]);

  const removePriceRow = (index: number) => setPriceRows((rows) => rows.filter((_, i) => i !== index));

  const movePriceRow = (index: number, dir: -1 | 1) =>
    setPriceRows((rows) => {
      const next = index + dir;
      if (next < 0 || next >= rows.length) return rows;
      const copy = [...rows];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });

  const addLink = () => {
    setError(null);
    createLink.mutate(
      { label: labelFor(type, label), url: composeUrl(type, url), type },
      {
        onSuccess: () => {
          setLabel('');
          setUrl('');
          setType('GENERIC');
        },
        onError: (e) => {
          const p = problemOf(e);
          setError(p?.errors?.url ?? p?.detail ?? t('editor.linkAddError'));
        },
      },
    );
  };

  const startEdit = (link: LinkResponse) => {
    setError(null);
    setEditingId(link.id);
    setEditLabel(link.label);
    setEditUrl(toHandle(link.type, link.url));
  };

  const cancelEdit = () => setEditingId(null);

  // Typed links keep their derived label; only GENERIC carries a user-editable one.
  const saveEdit = (link: LinkResponse) => {
    setError(null);
    updateLink.mutate(
      { id: link.id, label: link.type === 'GENERIC' ? editLabel.trim() : undefined, url: composeUrl(link.type, editUrl) },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) => {
          const p = problemOf(e);
          setError(p?.errors?.url ?? p?.detail ?? t('editor.linkSaveError'));
        },
      },
    );
  };

  const isGeneric = type === 'GENERIC';
  const canAdd = Boolean(url) && (!isGeneric || Boolean(label));

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= links.length) return;
    const ids = links.map((l) => l.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorderLinks.mutate(ids);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/85 px-4 py-2 backdrop-blur">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{t('editor.title')}</h1>
        <span className="shrink-0 text-sm" role="status" aria-live="polite">
          {validationError ? (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700">⚠ {validationError}</span>
          ) : updateProfile.isPending ? (
            <span className="text-slate-500">{t('editor.saving')}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('editor.savedAll')}
            </span>
          )}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-6">
        <nav
          role="tablist"
          aria-label={t('editor.title')}
          aria-orientation="vertical"
          onKeyDown={onTabKeyDown}
          className="sticky top-12 z-[9] -mx-4 mb-4 flex gap-1 overflow-x-auto bg-slate-50/90 px-4 py-2 backdrop-blur md:top-16 md:mx-0 md:mb-0 md:flex-col md:self-start md:overflow-visible md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
        >
          {EDITOR_TABS.map((tb) => {
            const selected = tab === tb.id;
            return (
              <button
                key={tb.id}
                ref={(el) => {
                  tabRefs.current[tb.id] = el;
                }}
                role="tab"
                type="button"
                id={`tab-${tb.id}`}
                aria-controls={`panel-${tb.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(tb.id)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-3 text-sm font-medium transition md:py-2 ${
                  selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <TabIcon name={tb.icon} />
                {t(tb.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-5">
          <div
            role="tabpanel"
            id="panel-profile"
            aria-labelledby="tab-profile"
            hidden={tab !== 'profile'}
            className="space-y-5"
          >
        {/* Avatar + share */}
        <section className={PANEL}>
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Your avatar"
                className="h-20 w-20 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-2xl text-slate-400">
                {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_CONTENT_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  onPickAvatar(e.target.files?.[0]);
                  e.target.value = ''; // allow re-selecting the same file
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAvatar.isPending}
                className={UPLOAD_BTN}
              >
                {uploadAvatar.isPending
                  ? t('editor.uploading')
                  : profile.avatar_url
                    ? t('editor.changePhoto')
                    : t('editor.uploadPhoto')}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  onClick={() => removeAvatar.mutate()}
                  disabled={removeAvatar.isPending}
                  className="ml-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {t('editor.remove')}
                </button>
              )}
              <p className="text-xs text-slate-400">{t('editor.avatarHint')}</p>
            </div>
          </div>
        </section>

        {/* Profile details */}
        <section className={PANEL}>
          <SectionHead icon="profile" title={t('editor.details')} hint={t('editor.detailsHint')} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              {t('editor.displayName')}
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={`mt-1 ${INPUT}`} />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              {t('editor.bio')}
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className={`mt-1 ${INPUT}`}
              />
            </label>

            <div className="block text-sm font-medium text-slate-700">
              {t('editor.phone')}
              <PhoneInput
                international
                labels={PHONE_LABELS[i18n.language] ?? phoneLabelsEn}
                defaultCountry={localeCountry(i18n.language)}
                value={phone}
                onChange={setPhone}
                className="mt-1"
                numberInputProps={{ className: INPUT, 'aria-label': t('editor.phone') }}
              />
              {phone && !isValidPhoneNumber(phone) && (
                <p className="mt-1 text-xs text-red-600">{t('editor.phoneInvalid')}</p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">{t('editor.primaryLocation')}</legend>
              <div className="flex gap-2">
                <select
                  aria-label={t('editor.country')}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={`w-1/2 bg-white ${INPUT}`}
                >
                  <option value="">{t('editor.country')}</option>
                  {/* Preserve an existing value that isn't in the generated list (legacy free-text). */}
                  {country && !countries.some((c) => c.value === country) && (
                    <option value={country}>{country}</option>
                  )}
                  {countries.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={t('editor.city')}
                  placeholder={t('editor.city')}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={`w-1/2 ${INPUT}`}
                />
              </div>
            </fieldset>
          </div>
        </section>
          </div>

          <div
            role="tabpanel"
            id="panel-workplaces"
            aria-labelledby="tab-workplaces"
            hidden={tab !== 'workplaces'}
            className="space-y-5"
          >
        {/* Workplaces */}
        <section className={PANEL}>
          <SectionHead icon="pin" title={t('editor.workplaces')} hint={t('editor.workplacesHint')} />
          <div className="space-y-3">
            {workplaces.map((w, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{t('editor.workplaceN', { n: i + 1 })}</span>
                  <button
                    type="button"
                    aria-label={t('editor.removeWorkplace', { n: i + 1 })}
                    onClick={() => removeWorkplace(i)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    {t('editor.remove')}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    aria-label={t('editor.roleAria', { n: i + 1 })}
                    placeholder={t('editor.rolePlaceholder')}
                    value={w.role}
                    onChange={(e) => updateWorkplace(i, 'role', e.target.value)}
                    className={`w-1/2 ${INPUT}`}
                  />
                  <input
                    aria-label={t('editor.orgAria', { n: i + 1 })}
                    placeholder={t('editor.orgPlaceholder')}
                    value={w.organization}
                    onChange={(e) => updateWorkplace(i, 'organization', e.target.value)}
                    className={`w-1/2 ${INPUT}`}
                  />
                </div>
                <input
                  aria-label={t('editor.addressAria', { n: i + 1 })}
                  placeholder={t('editor.addressPlaceholder')}
                  value={w.address}
                  onChange={(e) => updateWorkplace(i, 'address', e.target.value)}
                  className={INPUT}
                />
                <p className="text-xs text-slate-400">{t('editor.addressHint')}</p>
                <input
                  aria-label={t('editor.findAria', { n: i + 1 })}
                  placeholder={t('editor.findPlaceholder')}
                  value={w.description}
                  onChange={(e) => updateWorkplace(i, 'description', e.target.value)}
                  className={INPUT}
                />
                {w.address.trim() && (
                  <WorkplaceMap query={mapQuery({ address: w.address, city, country })} debounceMs={600} />
                )}
              </div>
            ))}
            <button type="button" onClick={addWorkplace} className={ADD_ROW_BTN}>
              {t('editor.addWorkplace')}
            </button>
          </div>
        </section>
          </div>

          <div
            role="tabpanel"
            id="panel-services"
            aria-labelledby="tab-services"
            hidden={tab !== 'services'}
            className="space-y-5"
          >
        {/* Main directions */}
        <section className={PANEL}>
          <SectionHead icon="services" title={t('editor.activities')} hint={t('editor.activitiesHint')} />
          <div className="space-y-3">
            {activities.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={t('editor.activityNameAria', { n: i + 1 })}
                  placeholder={t('editor.activityNamePlaceholder')}
                  value={a}
                  maxLength={60}
                  onChange={(e) => updateActivity(i, e.target.value)}
                  className={`min-w-0 flex-1 ${INPUT}`}
                />
                <button
                  type="button"
                  aria-label={t('editor.removeActivity', { n: i + 1 })}
                  onClick={() => removeActivity(i)}
                  className="px-2 text-red-600 transition-transform duration-150 hover:scale-125 hover:text-red-800 active:scale-90"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={addActivity} className={ADD_ROW_BTN}>
              {t('editor.addActivity')}
            </button>
          </div>
        </section>

        {/* Price list */}
        <section className={PANEL}>
          <SectionHead icon="tag" title={t('editor.pricelist')} hint={t('editor.pricelistHint')} />
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 sm:max-w-xs">
              {t('editor.currency')}
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className={`mt-1 bg-white ${INPUT}`}
              >
                {currencyList.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            {priceRows.length === 0 && <EmptyState icon="tag" text={t('editor.noPriceItems')} />}
            {priceRows.map((row, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{t('editor.priceItemN', { n: i + 1 })}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t('editor.priceMoveUp', { n: i + 1 })}
                      onClick={() => movePriceRow(i, -1)}
                      disabled={i === 0}
                      className="px-2 text-slate-500 transition-transform duration-150 hover:-translate-y-0.5 hover:text-slate-900 active:scale-90 disabled:opacity-30 disabled:hover:translate-y-0"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={t('editor.priceMoveDown', { n: i + 1 })}
                      onClick={() => movePriceRow(i, 1)}
                      disabled={i === priceRows.length - 1}
                      className="px-2 text-slate-500 transition-transform duration-150 hover:translate-y-0.5 hover:text-slate-900 active:scale-90 disabled:opacity-30 disabled:hover:translate-y-0"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={t('editor.removePriceItem', { n: i + 1 })}
                      onClick={() => removePriceRow(i)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      {t('editor.remove')}
                    </button>
                  </div>
                </div>
                <input
                  aria-label={t('editor.priceNameAria', { n: i + 1 })}
                  placeholder={t('editor.priceNamePlaceholder')}
                  value={row.name}
                  maxLength={500}
                  onChange={(e) => updatePriceRow(i, 'name', e.target.value)}
                  className={INPUT}
                />
                <div className="flex gap-2">
                  <select
                    aria-label={t('editor.priceTypeAria', { n: i + 1 })}
                    value={row.priceType}
                    onChange={(e) => updatePriceRow(i, 'priceType', e.target.value)}
                    className={`min-w-0 flex-1 bg-white ${INPUT}`}
                  >
                    {PRICE_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {t(`priceTypes.${pt}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    aria-label={
                      row.priceType === 'RANGE'
                        ? t('editor.priceFromAria', { n: i + 1 })
                        : t('editor.priceAmountAria', { n: i + 1 })
                    }
                    placeholder={
                      row.priceType === 'RANGE' || row.priceType === 'FROM'
                        ? t('editor.priceFromPlaceholder')
                        : t('editor.priceAmountPlaceholder')
                    }
                    value={row.min}
                    onChange={(e) => updatePriceRow(i, 'min', e.target.value)}
                    className={`min-w-0 flex-1 ${INPUT}`}
                  />
                  {row.priceType === 'RANGE' && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      aria-label={t('editor.priceToAria', { n: i + 1 })}
                      placeholder={t('editor.priceToPlaceholder')}
                      value={row.max}
                      onChange={(e) => updatePriceRow(i, 'max', e.target.value)}
                      className={`min-w-0 flex-1 ${INPUT}`}
                    />
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addPriceRow} className={ADD_ROW_BTN}>
              {t('editor.addPriceItem')}
            </button>
          </div>
        </section>
          </div>

          <div
            role="tabpanel"
            id="panel-portfolio"
            aria-labelledby="tab-portfolio"
            hidden={tab !== 'portfolio'}
            className="space-y-5"
          >
        {/* Certificates */}
        <section className={PANEL}>
          <SectionHead icon="portfolio" title={t('editor.certificates')} aside={<AutoSavedBadge />} />
          {awards.length === 0 && (
            <div className="mb-3">
              <EmptyState icon="portfolio" text={t('editor.noCertificates')} />
            </div>
          )}
          {awards.length > 0 && (
            <ul className="mb-4 space-y-2">
              {awards.map((award, i) => (
                <li
                  key={award.id}
                  className="group flex items-center gap-3 rounded-md border border-slate-200 p-2 transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                    <img
                      src={award.image_url}
                      alt={`Certificate ${i + 1}`}
                      className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-110"
                    />
                  </div>
                  <input
                    defaultValue={award.description ?? ''}
                    placeholder={t('editor.captionPlaceholder')}
                    aria-label={t('editor.captionAria', { n: i + 1 })}
                    maxLength={300}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value !== (award.description ?? '')) {
                        updateAward.mutate({ id: award.id, description: value });
                      }
                    }}
                    className={`min-w-0 flex-1 text-sm ${INPUT}`}
                  />
                  <button
                    type="button"
                    aria-label={t('editor.certMoveUp', { n: i + 1 })}
                    onClick={() => moveAward(i, -1)}
                    disabled={i === 0 || reorderAwards.isPending}
                    className="px-2 text-slate-500 transition-transform duration-150 hover:-translate-y-0.5 hover:text-slate-900 active:scale-90 disabled:opacity-30 disabled:hover:translate-y-0"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t('editor.certMoveDown', { n: i + 1 })}
                    onClick={() => moveAward(i, 1)}
                    disabled={i === awards.length - 1 || reorderAwards.isPending}
                    className="px-2 text-slate-500 transition-transform duration-150 hover:translate-y-0.5 hover:text-slate-900 active:scale-90 disabled:opacity-30 disabled:hover:translate-y-0"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={t('editor.certDelete', { n: i + 1 })}
                    onClick={() => deleteAward.mutate(award.id)}
                    disabled={deleteAward.isPending}
                    className="px-2 text-red-600 transition-transform duration-150 hover:scale-125 hover:text-red-800 active:scale-90 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={awardInputRef}
            type="file"
            accept={AWARD_CONTENT_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              onPickAward(e.target.files?.[0]);
              e.target.value = ''; // allow re-selecting the same file
            }}
          />
          <button
            type="button"
            onClick={() => awardInputRef.current?.click()}
            disabled={uploadAward.isPending}
            className={UPLOAD_BTN}
          >
            {uploadAward.isPending ? t('editor.uploading') : t('editor.addCertificate')}
          </button>
          <p className="mt-2 text-xs text-slate-400">{t('editor.certHint')}</p>
        </section>

        {/* Showcases (self-contained editor, auto-saves) */}
        <section className={PANEL}>
          <ShowcasesEditor />
        </section>
          </div>

          <div
            role="tabpanel"
            id="panel-links"
            aria-labelledby="tab-links"
            hidden={tab !== 'links'}
            className="space-y-5"
          >
        {/* Links */}
        <section className={PANEL}>
          <SectionHead icon="link" title={t('editor.links')} aside={<AutoSavedBadge />} />
          {links.length === 0 && (
            <div className="mb-4">
              <EmptyState icon="link" text={t('editor.noLinks')} />
            </div>
          )}
          <ul className="mb-6 space-y-2">
            {links.map((link, i) =>
              editingId === link.id ? (
                <li key={link.id} className="space-y-2 rounded-md border border-indigo-300 px-3 py-2">
                  {link.type === 'GENERIC' && (
                    <input
                      aria-label={t('editor.editLabelAria')}
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className={INPUT}
                    />
                  )}
                  {hasPrefix(link.type) ? (
                    <div className="flex items-stretch">
                      <span className="inline-flex items-center whitespace-nowrap rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-xs text-slate-500">
                        {LINK_PREFIX[link.type]}
                      </span>
                      <input
                        aria-label={t('editor.editUrlAria')}
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="w-full rounded-r-md border border-slate-300 px-3 py-2"
                      />
                    </div>
                  ) : (
                    <input
                      aria-label="Edit URL"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className={INPUT}
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(link)}
                      disabled={updateLink.isPending || !editUrl || (link.type === 'GENERIC' && !editLabel.trim())}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {updateLink.isPending ? t('editor.savingProfile') : t('common.save')}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={link.id}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{link.label}</p>
                    <p className="truncate text-xs text-slate-500">{link.url}</p>
                  </div>
                  <button
                    aria-label={t('editor.moveUp')}
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reorderLinks.isPending}
                    className="px-2 text-slate-500 transition-transform duration-150 hover:-translate-y-0.5 hover:text-slate-900 active:scale-90 disabled:opacity-30 disabled:hover:translate-y-0"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={t('editor.moveDown')}
                    onClick={() => move(i, 1)}
                    disabled={i === links.length - 1 || reorderLinks.isPending}
                    className="px-2 text-slate-500 transition-transform duration-150 hover:translate-y-0.5 hover:text-slate-900 active:scale-90 disabled:opacity-30 disabled:hover:translate-y-0"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={t('editor.editLink', { label: link.label })}
                    onClick={() => startEdit(link)}
                    className="px-2 text-slate-500 transition-transform duration-150 hover:scale-125 hover:text-slate-900 active:scale-90"
                  >
                    ✎
                  </button>
                  <button
                    aria-label={t('editor.deleteLink', { label: link.label })}
                    onClick={() => deleteLink.mutate(link.id)}
                    disabled={deleteLink.isPending}
                    className="px-2 text-red-600 transition-transform duration-150 hover:scale-125 hover:text-red-800 active:scale-90 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </li>
              ),
            )}
          </ul>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-medium text-slate-700">{t('editor.addLink')}</h3>
            <select
              aria-label={t('editor.linkTypeAria')}
              value={type}
              onChange={(e) => setType(e.target.value as LinkType)}
              className={`bg-white ${INPUT}`}
            >
              {LINK_TYPES.map((linkType) => (
                <option key={linkType} value={linkType}>
                  {t(`linkTypes.${linkType}`)}
                </option>
              ))}
            </select>
            {isGeneric && (
              <input
                placeholder={t('editor.linkLabelPlaceholder')}
                aria-label={t('editor.linkLabelAria')}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={INPUT}
              />
            )}
            {hasPrefix(type) ? (
              <div className="flex items-stretch">
                <span className="inline-flex items-center whitespace-nowrap rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
                  {LINK_PREFIX[type]}
                </span>
                <input
                  placeholder={VALUE_PLACEHOLDER[type]}
                  aria-label={`${TYPE_LABELS[type]} link`}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-r-md border border-slate-300 px-3 py-2"
                />
              </div>
            ) : (
              <input
                placeholder={VALUE_PLACEHOLDER[type]}
                aria-label={isGeneric ? 'URL' : `${TYPE_LABELS[type]} link`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={INPUT}
              />
            )}
            <button
              onClick={addLink}
              disabled={createLink.isPending || !canAdd}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {createLink.isPending ? t('editor.addingLink') : t('editor.addLinkButton')}
            </button>
          </div>
        </section>
          </div>

          <div
            role="tabpanel"
            id="panel-appearance"
            aria-labelledby="tab-appearance"
            hidden={tab !== 'appearance'}
            className="space-y-5"
          >
        {/* Appearance */}
        <section className={PANEL}>
          <SectionHead
            icon="palette"
            title={t('editor.appearance')}
            hint={t('editor.appearanceHint')}
            aside={<AutoSavedBadge />}
          />
          <div className="flex flex-wrap gap-3">
            {ACCENT_ORDER.map((a) => {
              const selected = accent === a;
              return (
                <button
                  key={a}
                  type="button"
                  aria-label={t(`accents.${a}`)}
                  aria-pressed={selected}
                  onClick={() => setAccent(a)}
                  style={{ backgroundColor: ACCENTS[a].base }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110 ${
                    selected ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200'
                  }`}
                >
                  {selected && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      aria-hidden="true"
                    >
                      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 p-4">
            <p className="mb-2 text-xs font-medium text-slate-500">{t('editor.appearancePreview')}</p>
            <span
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
              style={{ backgroundColor: ACCENTS[accent].base }}
            >
              {t('accents.' + accent)}
            </span>
          </div>

          {/* QR code styling — a private tool shown on the Account share panel + downloads. */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">{t('editor.qrTitle')}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{t('editor.qrHint')}</p>

            <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-4">
                <SegGroup
                  label={t('editor.qrColor')}
                  value={qrStyle.colorMode}
                  onChange={(v) => setQrStyle({ colorMode: v })}
                  options={[
                    { v: 'accent', label: t('editor.qrColorAccent') },
                    { v: 'black', label: t('editor.qrColorBlack') },
                  ]}
                />
                <SegGroup
                  label={t('editor.qrShape')}
                  value={qrStyle.moduleStyle}
                  onChange={(v) => setQrStyle({ moduleStyle: v })}
                  options={[
                    { v: 'rounded', label: t('editor.qrShapeRounded') },
                    { v: 'square', label: t('editor.qrShapeSquare') },
                    { v: 'dots', label: t('editor.qrShapeDots') },
                  ]}
                />
                <SegGroup
                  label={t('editor.qrLogo')}
                  value={qrStyle.logo ? 'on' : 'off'}
                  onChange={(v) => setQrStyle({ logo: v === 'on' })}
                  options={[
                    { v: 'on', label: t('editor.qrLogoShow') },
                    { v: 'off', label: t('editor.qrLogoHide') },
                  ]}
                />
              </div>
              <div
                aria-label={t('editor.qrTitle')}
                className="mx-auto h-40 w-40 shrink-0 rounded-xl border border-slate-200 bg-white p-2 [&>svg]:h-full [&>svg]:w-full sm:mx-0"
                dangerouslySetInnerHTML={{ __html: qrPreview }}
              />
            </div>
          </div>
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}

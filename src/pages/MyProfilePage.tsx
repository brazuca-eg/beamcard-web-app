import { useMemo, useRef, useState } from 'react';
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
  type Affiliation,
  type LinkResponse,
  type LinkType,
  type ProfileResponse,
} from '../api/profile';
import { useMyProfile, useProfileMutations } from '../features/profile/useMyProfile';
import { mapQuery } from '../features/profile/maps';
import { WorkplaceMap } from '../features/profile/WorkplaceMap';
import { ShowcasesEditor } from '../features/profile/ShowcasesEditor';
import { LINK_PREFIX, VALUE_PLACEHOLDER, composeUrl, hasPrefix, toHandle } from '../features/profile/linkComposer';
import { countryOptions } from '../features/profile/countries';

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
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<LinkType>('GENERIC');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const awardInputRef = useRef<HTMLInputElement>(null);

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

  const saveProfile = () => {
    setError(null);
    if (phone && !isValidPhoneNumber(phone)) {
      setError(t('editor.phoneInvalid'));
      return;
    }
    updateProfile.mutate(
      {
        display_name: displayName,
        bio,
        phone: phone ?? '', // '' clears it server-side
        location: { country, city },
        affiliations: toAffiliations(workplaces),
        activities: activities.map((a) => a.trim()).filter(Boolean),
      },
      { onError: (e) => setError(problemOf(e)?.detail ?? t('editor.saveError')) },
    );
  };

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
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-6">
      <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{t('editor.title')}</h1>

      {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

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
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
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
          <h2 className="text-base font-semibold text-slate-900">{t('editor.details')}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{t('editor.detailsHint')}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

        {/* Workplaces */}
        <section className={PANEL}>
          <fieldset className="space-y-3">
            <legend className="text-base font-semibold text-slate-900">{t('editor.workplaces')}</legend>
            <p className="text-xs text-slate-400">{t('editor.workplacesHint')}</p>
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
            <button
              type="button"
              onClick={addWorkplace}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {t('editor.addWorkplace')}
            </button>
          </fieldset>
        </section>

        {/* Main directions */}
        <section className={PANEL}>
          <fieldset className="space-y-3">
            <legend className="text-base font-semibold text-slate-900">{t('editor.activities')}</legend>
            <p className="text-xs text-slate-400">{t('editor.activitiesHint')}</p>
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
            <button
              type="button"
              onClick={addActivity}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {t('editor.addActivity')}
            </button>
          </fieldset>
        </section>

        {/* Save (covers the profile/location/workplaces/directions above) */}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-xs text-slate-400 sm:mr-auto">{t('editor.saveScopeHint')}</p>
          <button
            onClick={saveProfile}
            disabled={updateProfile.isPending}
            className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[.99] disabled:opacity-50 sm:w-auto"
          >
            {updateProfile.isPending ? t('editor.savingProfile') : t('editor.saveProfile')}
          </button>
        </div>

        {/* Certificates */}
        <section className={PANEL}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{t('editor.certificates')}</h2>
            <AutoSavedBadge />
          </div>
          {awards.length === 0 && <p className="mb-3 text-sm text-slate-400">{t('editor.noCertificates')}</p>}
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
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {uploadAward.isPending ? t('editor.uploading') : t('editor.addCertificate')}
          </button>
          <p className="mt-2 text-xs text-slate-400">{t('editor.certHint')}</p>
        </section>

        {/* Showcases (own editor + own save button) */}
        <section className={PANEL}>
          <ShowcasesEditor />
        </section>

        {/* Links */}
        <section className={PANEL}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{t('editor.links')}</h2>
            <AutoSavedBadge />
          </div>
          <ul className="mb-6 space-y-2">
            {links.length === 0 && <li className="text-sm text-slate-400">{t('editor.noLinks')}</li>}
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
              className="rounded-md bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {createLink.isPending ? t('editor.addingLink') : t('editor.addLinkButton')}
            </button>
          </div>
        </section>
    </div>
  );
}

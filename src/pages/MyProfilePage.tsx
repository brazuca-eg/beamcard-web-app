import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { problemOf } from '../api/problem';
import {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  AWARD_CONTENT_TYPES,
  AWARD_MAX_BYTES,
  getMyProfileQr,
  publicCardUrl,
  type Affiliation,
  type LinkResponse,
  type LinkType,
  type ProfileResponse,
} from '../api/profile';
import { useMyProfile, useProfileMutations } from '../features/profile/useMyProfile';
import { mapQuery } from '../features/profile/maps';
import { WorkplaceMap } from '../features/profile/WorkplaceMap';
import { ShareDialog } from '../features/profile/ShareDialog';
import { ShowcasesEditor } from '../features/profile/ShowcasesEditor';
import { LINK_PREFIX, VALUE_PLACEHOLDER, composeUrl, hasPrefix, toHandle } from '../features/profile/linkComposer';
import { COUNTRIES } from '../features/profile/countries';

/** Display label per type; GENERIC is user-provided so it has no preset. */
const TYPE_LABELS: Record<LinkType, string> = {
  GENERIC: 'Custom link',
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  VIBER: 'Viber',
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
    return <div className="max-w-md mx-auto mt-20 p-6 text-slate-600">{t('editor.loading')}</div>;
  }
  if (isError || !profile) {
    return <div className="max-w-md mx-auto mt-20 p-6 text-sm text-red-600">{t('editor.loadError')}</div>;
  }
  // Mount the editor only once loaded, so its state seeds from the profile without an effect.
  return <CardEditor profile={profile} />;
}

function CardEditor({ profile }: { profile: ProfileResponse }) {
  const { t } = useTranslation();
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
  const [shareOpen, setShareOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const awardInputRef = useRef<HTMLInputElement>(null);

  const cardUrl = publicCardUrl(profile.username);
  // Only fetch the QR when the share dialog is opened.
  const qr = useQuery({ queryKey: ['profile', 'qr'], queryFn: getMyProfileQr, enabled: shareOpen });

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
    updateProfile.mutate(
      {
        display_name: displayName,
        bio,
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('editor.title')}</h1>
          <div className="flex gap-3 text-sm">
            <RouterLink to={`/@${profile.username}`} className="text-indigo-600 hover:underline">
              {t('editor.viewPublic')}
            </RouterLink>
            <RouterLink to="/app" className="text-slate-600 hover:underline">
              {t('editor.account')}
            </RouterLink>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

      <section className="flex items-center gap-4 mb-8">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Your avatar"
            className="h-20 w-20 rounded-full object-cover border border-slate-200"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl text-slate-400">
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
            className="py-1.5 px-3 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
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
              className="ml-2 py-1.5 px-3 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {t('editor.remove')}
            </button>
          )}
          <p className="text-xs text-slate-400">{t('editor.avatarHint')}</p>
        </div>
      </section>

      <section className="mb-8 flex items-center justify-between gap-3 border border-slate-200 rounded-md p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700">{t('editor.shareTitle')}</p>
          <p className="text-xs text-slate-500 truncate">{cardUrl}</p>
        </div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="shrink-0 py-2 px-3 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {t('editor.shareButton')}
        </button>
      </section>

      {shareOpen && (
        <ShareDialog
          username={profile.username}
          url={cardUrl}
          qrSvg={qr.data}
          isLoading={qr.isLoading}
          onClose={() => setShareOpen(false)}
        />
      )}

      <section className="space-y-3 mb-8">
        <label className="block text-sm font-medium text-slate-700">
          {t('editor.displayName')}
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          {t('editor.bio')}
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">{t('editor.primaryLocation')}</legend>
          <div className="flex gap-2">
            <input
              aria-label={t('editor.country')}
              placeholder={t('editor.country')}
              list="country-options"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-1/2 px-3 py-2 border border-slate-300 rounded-md"
            />
            <datalist id="country-options">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              aria-label={t('editor.city')}
              placeholder={t('editor.city')}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-1/2 px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-700">{t('editor.workplaces')}</legend>
          <p className="text-xs text-slate-400">{t('editor.workplacesHint')}</p>
          {workplaces.map((w, i) => (
            <div key={i} className="space-y-2 border border-slate-200 rounded-md p-3">
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
                  className="w-1/2 px-3 py-2 border border-slate-300 rounded-md"
                />
                <input
                  aria-label={t('editor.orgAria', { n: i + 1 })}
                  placeholder={t('editor.orgPlaceholder')}
                  value={w.organization}
                  onChange={(e) => updateWorkplace(i, 'organization', e.target.value)}
                  className="w-1/2 px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <input
                aria-label={t('editor.addressAria', { n: i + 1 })}
                placeholder={t('editor.addressPlaceholder')}
                value={w.address}
                onChange={(e) => updateWorkplace(i, 'address', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
              <input
                aria-label={t('editor.findAria', { n: i + 1 })}
                placeholder={t('editor.findPlaceholder')}
                value={w.description}
                onChange={(e) => updateWorkplace(i, 'description', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
              {w.address.trim() && (
                <WorkplaceMap query={mapQuery({ address: w.address, city, country })} debounceMs={600} />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addWorkplace}
            className="py-1.5 px-3 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            {t('editor.addWorkplace')}
          </button>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-700">{t('editor.activities')}</legend>
          <p className="text-xs text-slate-400">{t('editor.activitiesHint')}</p>
          {activities.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label={t('editor.activityNameAria', { n: i + 1 })}
                placeholder={t('editor.activityNamePlaceholder')}
                value={a}
                maxLength={160}
                onChange={(e) => updateActivity(i, e.target.value)}
                className="min-w-0 flex-1 px-3 py-2 border border-slate-300 rounded-md"
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
            className="py-1.5 px-3 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            {t('editor.addActivity')}
          </button>
        </fieldset>

        <button
          onClick={saveProfile}
          disabled={updateProfile.isPending}
          className="py-2 px-4 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {updateProfile.isPending ? t('editor.savingProfile') : t('editor.saveProfile')}
        </button>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('editor.certificates')}</h2>
        {awards.length === 0 && <p className="text-sm text-slate-400 mb-3">{t('editor.noCertificates')}</p>}
        {awards.length > 0 && (
          <ul className="space-y-2 mb-4">
            {awards.map((award, i) => (
              <li
                key={award.id}
                className="group flex items-center gap-3 border border-slate-200 rounded-md p-2 transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
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
                  className="min-w-0 flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
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
          className="py-1.5 px-3 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          {uploadAward.isPending ? t('editor.uploading') : t('editor.addCertificate')}
        </button>
        <p className="mt-2 text-xs text-slate-400">{t('editor.certHint')}</p>
      </section>

      <ShowcasesEditor />

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t('editor.links')}</h2>
        <ul className="space-y-2 mb-6">
          {links.length === 0 && <li className="text-sm text-slate-400">{t('editor.noLinks')}</li>}
          {links.map((link, i) =>
            editingId === link.id ? (
              <li key={link.id} className="border border-indigo-300 rounded-md px-3 py-2 space-y-2">
                {link.type === 'GENERIC' && (
                  <input
                    aria-label={t('editor.editLabelAria')}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                )}
                {hasPrefix(link.type) ? (
                  <div className="flex items-stretch">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-xs text-slate-500 whitespace-nowrap">
                      {LINK_PREFIX[link.type]}
                    </span>
                    <input
                      aria-label={t('editor.editUrlAria')}
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-r-md"
                    />
                  </div>
                ) : (
                  <input
                    aria-label="Edit URL"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(link)}
                    disabled={updateLink.isPending || !editUrl || (link.type === 'GENERIC' && !editLabel.trim())}
                    className="py-1.5 px-3 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {updateLink.isPending ? t('editor.savingProfile') : t('common.save')}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="py-1.5 px-3 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={link.id}
                className="flex items-center gap-2 border border-slate-200 rounded-md px-3 py-2 transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{link.label}</p>
                  <p className="text-xs text-slate-500 truncate">{link.url}</p>
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
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
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
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          )}
          {hasPrefix(type) ? (
            <div className="flex items-stretch">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-sm text-slate-500 whitespace-nowrap">
                {LINK_PREFIX[type]}
              </span>
              <input
                placeholder={VALUE_PLACEHOLDER[type]}
                aria-label={`${TYPE_LABELS[type]} link`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-r-md"
              />
            </div>
          ) : (
            <input
              placeholder={VALUE_PLACEHOLDER[type]}
              aria-label={isGeneric ? 'URL' : `${TYPE_LABELS[type]} link`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          )}
          <button
            onClick={addLink}
            disabled={createLink.isPending || !canAdd}
            className="py-2 px-4 bg-slate-800 text-white font-medium rounded-md hover:bg-slate-900 disabled:opacity-50"
          >
            {createLink.isPending ? t('editor.addingLink') : t('editor.addLinkButton')}
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}

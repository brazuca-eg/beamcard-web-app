import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { problemOf } from '../../api/problem';
import { useAuthStore } from '../../stores/authStore';
import { ADD_ROW_BTN, EmptyState, SectionHead, UPLOAD_BTN } from './editorUi';
import {
  getMyShowcases,
  saveShowcases,
  uploadShowcaseImage,
  SHOWCASE_CONTENT_TYPES,
  type Showcase,
  type ShowcaseStep,
} from './showcases';

const MAX_STEPS = 5; // mirrors the backend limit (profile-service rejects > 5 steps per showcase)
const AUTOSAVE_MS = 700;

/** Loads the owner's showcases, then mounts the editor form seeded from them. */
export function ShowcasesEditor() {
  const token = useAuthStore((s) => s.token);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['showcases', 'me'],
    queryFn: getMyShowcases,
    enabled: Boolean(token),
  });

  if (isLoading || isError || !data) {
    return null; // fail quietly — the rest of the editor stays usable
  }
  return <ShowcasesForm initial={data} />;
}

function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir;
  if (next < 0 || next >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

function ShowcasesForm({ initial }: { initial: Showcase[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showcases, setShowcases] = useState<Showcase[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const firstRenderRef = useRef(true);

  const save = useMutation({
    mutationFn: () => saveShowcases(showcases),
    // Don't re-seed local state from the response: with auto-save firing while the
    // user is still typing, setShowcases(saved) would clobber in-progress edits.
    // Blob previews stay valid for the session; a reload hydrates the CDN urls.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['showcases', 'me'] }),
    onError: (e) => setError(problemOf(e)?.detail ?? t('editor.showcaseSaveError')),
  });
  const saveRef = useRef(save);
  saveRef.current = save;

  // Auto-save: debounce writes so a burst of edits collapses into one request.
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setError(null);
      saveRef.current.mutate();
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcases]);

  const patchShowcase = (i: number, patch: Partial<Showcase>) =>
    setShowcases((list) => list.map((sc, idx) => (idx === i ? { ...sc, ...patch } : sc)));

  const patchStep = (i: number, j: number, patch: Partial<ShowcaseStep>) =>
    setShowcases((list) =>
      list.map((sc, idx) =>
        idx === i ? { ...sc, steps: sc.steps.map((st, k) => (k === j ? { ...st, ...patch } : st)) } : sc,
      ),
    );

  const addStep = async (i: number, file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!SHOWCASE_CONTENT_TYPES.includes(file.type)) {
      setError(t('editor.showcaseImageType'));
      return;
    }
    setUploading(true);
    try {
      const key = await uploadShowcaseImage(file);
      const preview = URL.createObjectURL(file); // instant preview until the next save returns the CDN url
      setShowcases((list) =>
        list.map((sc, idx) =>
          idx === i ? { ...sc, steps: [...sc.steps, { image_key: key, image_url: preview, description: '' }] } : sc,
        ),
      );
    } catch {
      setError(t('editor.showcaseUploadError'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section>
      <SectionHead
        icon="image"
        title={t('editor.showcases')}
        hint={t('editor.showcasesHint')}
        aside={
          <span className="text-xs text-slate-400" role="status" aria-live="polite">
            {save.isPending ? t('editor.saving') : t('editor.savedAll')}
          </span>
        }
      />

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {showcases.length === 0 && (
        <div className="mb-3">
          <EmptyState icon="image" text={t('editor.noShowcases')} />
        </div>
      )}

      <div className="space-y-4">
        {showcases.map((sc, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{t('editor.showcaseN', { n: i + 1 })}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={t('editor.showcaseMoveUp', { n: i + 1 })}
                  onClick={() => setShowcases((list) => move(list, i, -1))}
                  disabled={i === 0}
                  className="px-2 text-slate-500 transition-transform duration-150 hover:-translate-y-0.5 hover:text-slate-900 active:scale-90 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={t('editor.showcaseMoveDown', { n: i + 1 })}
                  onClick={() => setShowcases((list) => move(list, i, 1))}
                  disabled={i === showcases.length - 1}
                  className="px-2 text-slate-500 transition-transform duration-150 hover:translate-y-0.5 hover:text-slate-900 active:scale-90 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={t('editor.removeShowcase', { n: i + 1 })}
                  onClick={() => setShowcases((list) => list.filter((_, idx) => idx !== i))}
                  className="px-2 text-red-600 transition-transform duration-150 hover:scale-125 hover:text-red-800 active:scale-90"
                >
                  ✕
                </button>
              </div>
            </div>

            <input
              aria-label={t('editor.showcaseN', { n: i + 1 })}
              placeholder={t('editor.showcaseTitlePlaceholder')}
              value={sc.title ?? ''}
              maxLength={120}
              onChange={(e) => patchShowcase(i, { title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            <textarea
              placeholder={t('editor.showcaseIntroPlaceholder')}
              value={sc.intro ?? ''}
              maxLength={500}
              rows={2}
              onChange={(e) => patchShowcase(i, { intro: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />

            <ul className="space-y-2">
              {sc.steps.map((step, j) => (
                <li key={j} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                    {j + 1}
                  </span>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {step.image_url && (
                      <img src={step.image_url} alt="" className="max-h-full max-w-full object-contain" />
                    )}
                  </div>
                  <input
                    aria-label={t('editor.stepCaptionAria', { n: j + 1 })}
                    placeholder={t('editor.stepCaptionPlaceholder')}
                    value={step.description ?? ''}
                    maxLength={300}
                    onChange={(e) => patchStep(i, j, { description: e.target.value })}
                    className="min-w-0 flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                  <button
                    type="button"
                    aria-label={t('editor.stepMoveUp', { n: j + 1 })}
                    onClick={() => patchShowcase(i, { steps: move(sc.steps, j, -1) })}
                    disabled={j === 0}
                    className="px-2 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t('editor.stepMoveDown', { n: j + 1 })}
                    onClick={() => patchShowcase(i, { steps: move(sc.steps, j, 1) })}
                    disabled={j === sc.steps.length - 1}
                    className="px-2 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={t('editor.removeStep', { n: j + 1 })}
                    onClick={() => patchShowcase(i, { steps: sc.steps.filter((_, k) => k !== j) })}
                    className="px-2 text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3">
              {sc.steps.length < MAX_STEPS && (
                <label className={`cursor-pointer ${UPLOAD_BTN}`}>
                  {uploading ? t('editor.uploading') : t('editor.addStep')}
                  <input
                    type="file"
                    accept={SHOWCASE_CONTENT_TYPES.join(',')}
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      void addStep(i, file);
                    }}
                  />
                </label>
              )}
              <span className="text-xs text-slate-400">
                {sc.steps.length} / {MAX_STEPS}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowcases((list) => [...list, { title: '', intro: '', steps: [] }])}
          className={ADD_ROW_BTN}
        >
          {t('editor.addShowcase')}
        </button>
      </div>
    </section>
  );
}

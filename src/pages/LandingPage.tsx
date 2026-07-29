import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MarketingHeader } from '../components/MarketingHeader';
import { SiteFooter } from '../components/SiteFooter';
import { useAuthStore } from '../stores/authStore';

/**
 * Public marketing page. At `/` signed-in visitors skip the pitch and go to their
 * dashboard; at `/about` it always renders (so logged-in users can revisit it).
 */
export function LandingPage({ forceShow = false }: { forceShow?: boolean }) {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  if (token && !forceShow) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingHeader>
        <Link to="/login" className="px-2 py-1 text-sm font-medium text-slate-600 hover:text-slate-900">
          {t('landing.navLogin')}
        </Link>
        <Link
          to="/signup"
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[.98]"
        >
          {t('landing.navGetStarted')}
        </Link>
      </MarketingHeader>

      <Hero />
      <Audience />
      <ShowcaseDemo />
      <Features />
      <Steps />
      <FinalCta />

      <SiteFooter />
    </div>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section className="bg-gradient-to-b from-indigo-50/60 to-white">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
        <div className="bc-fade-in text-center lg:text-left">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-600 lg:mx-0">
            {t('landing.heroSubtitle')}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link
              to="/signup"
              className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[.99] sm:w-auto"
            >
              {t('landing.heroCta')}
            </Link>
            <a
              href="#how"
              className="w-full rounded-xl border border-slate-200 px-6 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              {t('landing.heroSecondary')}
            </a>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <MockCard />
        </div>
      </div>
    </section>
  );
}

/** A stylized preview of a real Beamcard public card — pure decoration. */
function MockCard() {
  const { t } = useTranslation();
  return (
    <div className="bc-fade-in w-full max-w-[17rem] rotate-1 rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200/70 transition-transform duration-300 hover:rotate-0">
      <img
        src="/showcase/avatar.jpg"
        alt="Dr. Alex Rivera"
        className="mx-auto h-20 w-20 rounded-full object-cover shadow-md ring-4 ring-white"
      />
      <p className="mt-3 text-lg font-bold text-slate-900">Dr. Alex Rivera</p>
      <p className="text-sm text-slate-500">{t('landing.mockRole')}</p>
      <div className="mt-5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white">
        ＋ {t('publicCard.saveContact')}
      </div>
      <div className="mt-3 space-y-2">
        <div className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700">
          {t('landing.mockLink1')}
        </div>
        <div className="rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700">
          {t('landing.mockLink2')}
        </div>
      </div>
    </div>
  );
}

function Audience() {
  const { t } = useTranslation();
  const cards = [
    { emoji: '🩺', title: t('landing.audienceDoctors'), desc: t('landing.audienceDoctorsDesc') },
    { emoji: '🏋️', title: t('landing.audienceTrainers'), desc: t('landing.audienceTrainersDesc') },
    { emoji: '💇', title: t('landing.audienceBeauty'), desc: t('landing.audienceBeautyDesc') },
    { emoji: '🛠️', title: t('landing.audienceTrades'), desc: t('landing.audienceTradesDesc') },
    { emoji: '💼', title: t('landing.audienceConsultants'), desc: t('landing.audienceConsultantsDesc') },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {t('landing.audienceTitle')}
      </h2>
      <div className="mt-10 flex flex-wrap justify-center gap-5">
        {cards.map((c) => (
          <div
            key={c.title}
            className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:w-64"
          >
            <div className="text-3xl" aria-hidden="true">
              {c.emoji}
            </div>
            <h3 className="mt-3 font-semibold text-slate-900">{c.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

type DemoStep = { src: string; caption: string; badge?: string };
type DemoExample = { label: string; title: string; intro: string; steps: DemoStep[] };

/**
 * Three real before→after showcases (dentist / nail artist / renovator), each
 * rendered exactly like a live card's timeline — numbered nodes, Before/Result
 * badges, variable step counts. Photos are bundled stock images from Pexels
 * (free license).
 */
function ShowcaseDemo() {
  const { t } = useTranslation();
  const before = t('publicCard.showcaseBefore');
  const result = t('publicCard.showcaseResult');
  const examples: DemoExample[] = [
    {
      label: t('landing.demoForDentist'),
      title: t('landing.demoDentistTitle'),
      intro: t('landing.demoDentistIntro'),
      steps: [
        { src: '/showcase/teeth-before.jpg', caption: t('landing.demoDentistStep1'), badge: before },
        { src: '/showcase/teeth-after.jpg', caption: t('landing.demoDentistStep2'), badge: result },
      ],
    },
    {
      label: t('landing.demoForNails'),
      title: t('landing.demoNailsTitle'),
      intro: t('landing.demoNailsIntro'),
      steps: [
        { src: '/showcase/nails-1.jpg', caption: t('landing.demoNailsStep1'), badge: before },
        { src: '/showcase/nails-2.jpg', caption: t('landing.demoNailsStep2') },
        { src: '/showcase/nails-3.jpg', caption: t('landing.demoNailsStep3'), badge: result },
      ],
    },
    {
      label: t('landing.demoForRepair'),
      title: t('landing.demoCardTitle'),
      intro: t('landing.demoCardIntro'),
      steps: [
        { src: '/showcase/room-before.jpg', caption: t('landing.demoStep1'), badge: before },
        { src: '/showcase/room-after.jpg', caption: t('landing.demoStep2'), badge: result },
      ],
    },
  ];
  return (
    <section className="bg-slate-50/70 py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t('landing.demoTitle')}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-slate-600">{t('landing.demoSubtitle')}</p>

        <div className="mt-10 grid items-start gap-6 md:grid-cols-3">
          {examples.map((ex) => (
            <DemoCard key={ex.title} example={ex} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoCard({ example }: { example: DemoExample }) {
  const { label, title, intro, steps } = example;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">{label}</span>
        <h3 className="mt-0.5 text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{intro}</p>
      </header>
      <ol className="px-4 py-4">
        {steps.map((step, j) => {
          const isResult = j === steps.length - 1;
          return (
            <li key={j} className="relative pb-5 pl-9 last:pb-0">
              {j < steps.length - 1 && (
                <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-7 w-px bg-slate-200" />
              )}
              <span
                aria-hidden="true"
                className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white ring-4 ring-white ${
                  isResult ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
              >
                {j + 1}
              </span>
              {step.badge && (
                <span
                  className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    isResult ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {step.badge}
                </span>
              )}
              <img
                src={step.src}
                alt={`${title} — ${step.caption}`}
                loading="lazy"
                className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover"
              />
              <p className="mt-1.5 text-sm text-slate-600">{step.caption}</p>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function Features() {
  const { t } = useTranslation();
  const features = [
    { emoji: '🔗', title: t('landing.featureLinksTitle'), desc: t('landing.featureLinksDesc') },
    { emoji: '🎓', title: t('landing.featureAwardsTitle'), desc: t('landing.featureAwardsDesc') },
    { emoji: '📸', title: t('landing.featureShowcasesTitle'), desc: t('landing.featureShowcasesDesc') },
    { emoji: '📍', title: t('landing.featureMapsTitle'), desc: t('landing.featureMapsDesc') },
    { emoji: '📇', title: t('landing.featureVcardTitle'), desc: t('landing.featureVcardDesc') },
    { emoji: '🔳', title: t('landing.featureQrTitle'), desc: t('landing.featureQrDesc') },
    { emoji: '🌍', title: t('landing.featureLangTitle'), desc: t('landing.featureLangDesc') },
  ];
  return (
    <section className="py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t('landing.featuresTitle')}
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-5">
          {features.map((f) => (
            <div key={f.title} className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:w-64">
              <div className="text-2xl" aria-hidden="true">
                {f.emoji}
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const { t } = useTranslation();
  const steps = [
    { title: t('landing.step1Title'), desc: t('landing.step1Desc') },
    { title: t('landing.step2Title'), desc: t('landing.step2Desc') },
    { title: t('landing.step3Title'), desc: t('landing.step3Desc') },
  ];
  return (
    <section id="how" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-16 sm:px-6">
      <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {t('landing.stepsTitle')}
      </h2>
      <ol className="mt-10 grid gap-8 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
              {i + 1}
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
            <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-slate-600">{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FinalCta() {
  const { t } = useTranslation();
  return (
    <section className="px-4 pb-16 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-indigo-600 px-6 py-12 text-center shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t('landing.finalTitle')}</h2>
        <p className="mx-auto mt-2 max-w-md text-indigo-100">{t('landing.finalSubtitle')}</p>
        <Link
          to="/signup"
          className="mt-6 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-[.99]"
        >
          {t('landing.finalCta')}
        </Link>
      </div>
    </section>
  );
}

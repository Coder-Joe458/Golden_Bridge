"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { apiFetch } from "@/lib/api-client";
import type { Locale } from "@/lib/chat/logic";

type TranslationFn = (en: string, zh: string) => string;

type LocalizedText = {
  en: string;
  zh: string;
};

type DealMedia = {
  src: string;
  alt: LocalizedText;
};

type Deal = {
  id: string;
  city: string;
  state: string;
  price: LocalizedText;
  timeline: LocalizedText;
  highlight: LocalizedText;
  borrowerType: LocalizedText;
  product: LocalizedText;
  heroImage: DealMedia;
  gallery: DealMedia[];
};

type DealCaseApi = {
  id?: string;
  city?: string;
  state?: string;
  price?: Partial<LocalizedText> | null;
  timeline?: Partial<LocalizedText> | null;
  highlight?: Partial<LocalizedText> | null;
  borrowerType?: Partial<LocalizedText> | null;
  product?: Partial<LocalizedText> | null;
  heroImage?: {
    src?: string;
    alt?: Partial<LocalizedText> | null;
  } | null;
  gallery?: Array<{
    src?: string;
    alt?: Partial<LocalizedText> | null;
  } | null> | null;
};

type DealCaseApiResponse = {
  cases?: DealCaseApi[];
  total?: number;
};

type DealsShowcaseProps = {
  locale: Locale;
  t: TranslationFn;
  className?: string;
};

const ensureLocalized = (value: Partial<LocalizedText> | null | undefined, fallbackEn = "", fallbackZh = ""): LocalizedText => ({
  en: typeof value?.en === "string" && value.en.trim().length ? value.en : fallbackEn,
  zh: typeof value?.zh === "string" && value.zh.trim().length ? value.zh : fallbackZh
});

export function DealsShowcase({ locale, t, className }: DealsShowcaseProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState<boolean>(false);
  const [dealError, setDealError] = useState<string | null>(null);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [startY, setStartY] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDeals = async () => {
      setDealsLoading(true);
      setDealError(null);

      try {
        const response = await apiFetch("/api/deal-cases?limit=12");
        if (!response.ok) {
          throw new Error(`Failed to load deal cases (status ${response.status})`);
        }
        const payload = (await response.json()) as DealCaseApiResponse;
        if (!isMounted) return;

        const normalized = (payload?.cases ?? [])
          .map((deal): Deal | null => {
            if (!deal?.id || !deal.city || !deal.state || !deal.heroImage?.src) {
              return null;
            }

            const fallbackEn = `${deal.city}, ${deal.state}`;
            const fallbackZh = `${deal.city}（${deal.state}）`;

            return {
              id: deal.id,
              city: deal.city,
              state: deal.state,
              price: ensureLocalized(deal.price, "", ""),
              timeline: ensureLocalized(deal.timeline, "", ""),
              highlight: ensureLocalized(deal.highlight, "", ""),
              borrowerType: ensureLocalized(deal.borrowerType, "", ""),
              product: ensureLocalized(deal.product, "", ""),
              heroImage: {
                src: deal.heroImage.src,
                alt: ensureLocalized(deal.heroImage.alt, fallbackEn, fallbackZh)
              },
              gallery: Array.isArray(deal.gallery)
                ? deal.gallery
                    .filter(
                      (image): image is { src: string; alt?: Partial<LocalizedText> | null } =>
                        typeof image?.src === "string" && image.src.trim().length > 0
                    )
                    .map((image) => ({
                      src: image.src,
                      alt: ensureLocalized(image.alt, fallbackEn, fallbackZh)
                    }))
                : []
            };
          })
          .filter((value): value is Deal => value !== null);

        setDeals(normalized);
      } catch (error) {
        if (!isMounted) return;
        setDealError(error instanceof Error ? error.message : "Failed to load deal cases.");
        setDeals([]);
      } finally {
        if (isMounted) {
          setDealsLoading(false);
        }
      }
    };

    void loadDeals();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeDeal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeDeal]);

  useEffect(() => {
    if (!activeDeal) return;
    if (!deals.some((deal) => deal.id === activeDeal.id)) {
      setActiveDeal(null);
    }
  }, [deals, activeDeal]);

  const pickText = useCallback(
    (copy: LocalizedText, fallback = "") => {
      const text = locale === "zh" ? copy.zh : copy.en;
      const trimmed = text?.trim();
      return trimmed?.length ? trimmed : fallback;
    },
    [locale]
  );

  const localizedGallery = useMemo(() => {
    if (!activeDeal) return [];

    const heroEntry = {
      src: activeDeal.heroImage.src,
      alt: pickText(activeDeal.heroImage.alt, activeDeal.id)
    };

    const additionalEntries = activeDeal.gallery.map((image) => ({
      src: image.src,
      alt: pickText(image.alt, activeDeal.id)
    }));

    const combined = [heroEntry, ...additionalEntries];
    const deduped: Array<{ src: string; alt: string }> = [];

    for (const item of combined) {
      if (!item.src) continue;
      if (!deduped.some((existing) => existing.src === item.src)) {
        deduped.push(item);
      }
    }

    return deduped;
  }, [activeDeal, pickText]);

  const hasDeals = deals.length > 0;

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setStartY(event.touches[0]?.clientY ?? null);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (startY === null) return;
    const currentY = event.touches[0]?.clientY ?? 0;
    if (currentY - startY > 90) {
      setActiveDeal(null);
      setStartY(null);
    }
  };

  const handleTouchEnd = () => {
    setStartY(null);
  };

  return (
    <section
      className={clsx(
        "relative mt-16 space-y-6 rounded-3xl border border-white/10 bg-slate-950/60 p-6 text-slate-100 shadow-2xl shadow-black/20",
        className
      )}
    >
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-brand-primary/80">
          {t("Recent Closings", "近期成交案例")}
        </p>
        <h2 className="text-2xl font-semibold text-white md:text-3xl">
          {t("What borrowers achieved with Golden Bridge", "借款人在金桥的成交成果")}
        </h2>
        <p className="text-sm text-slate-400 md:max-w-2xl">
          {t(
            "Every closing is anonymised. Swipe through to discover how different borrowing profiles reached the finish line.",
            "所有案例均做匿名与信息模糊化处理。左右滑动即可了解不同借款场景的成交路径。"
          )}
        </p>
      </header>

      {dealError && (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {t("We couldn't load the latest case studies. Please try again shortly.", "暂时无法加载最新案例，请稍后再试。")}
        </p>
      )}

      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto pb-4 md:hidden">
        {dealsLoading &&
          Array.from({ length: 2 }).map((_, index) => (
            <div
              key={`deal-skeleton-${index}`}
              className="relative min-w-[280px] snap-start rounded-3xl border border-white/5 bg-gradient-to-b from-white/5 via-slate-900/60 to-slate-950/80 p-4 shadow-xl shadow-black/20"
            >
              <div className="h-48 rounded-2xl bg-white/10" />
              <div className="mt-4 space-y-3">
                <div className="h-5 w-2/3 rounded bg-white/10" />
                <div className="h-4 w-1/2 rounded bg-white/10" />
                <div className="h-4 w-full rounded bg-white/10" />
              </div>
            </div>
          ))}

        {!dealsLoading && hasDeals &&
          deals.map((deal) => (
            <button
              type="button"
              key={deal.id}
              onClick={() => setActiveDeal(deal)}
              className="relative min-w-[280px] snap-start rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 via-slate-900/60 to-slate-950/80 p-4 text-left shadow-xl shadow-black/30 transition hover:translate-y-1 hover:border-brand-primary/40"
            >
              <div className="relative h-48 overflow-hidden rounded-2xl">
                <Image
                  src={deal.heroImage.src}
                  alt={pickText(deal.heroImage.alt, `${deal.city} showcase`)}
                  fill
                  sizes="(max-width: 768px) 280px, 320px"
                  className="object-cover"
                  priority={false}
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-3">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                    {deal.id}
                  </span>
                  <span className="text-xs text-slate-200">
                    {deal.city}, {deal.state}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-lg font-semibold text-white">
                    {pickText(deal.price)}
                  </p>
                  <p className="text-xs text-brand-primary/80">
                    {pickText(deal.timeline)}
                  </p>
                </div>
                <p className="text-sm text-slate-200">
                  {pickText(deal.borrowerType)}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-100">
                  {[deal.product, deal.highlight].map((item, index) => (
                    <span
                      key={`${deal.id}-badge-${index}`}
                      className={clsx(
                        "rounded-full border px-3 py-1",
                        index === 0 ? "border-brand-primary/40 bg-brand-primary/10 text-brand-primary" : "border-white/15 bg-white/5"
                      )}
                    >
                      {pickText(item)}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}

        {!dealsLoading && !hasDeals && (
          <div className="flex min-w-[280px] snap-start flex-col justify-center rounded-3xl border border-dashed border-white/15 px-6 py-8 text-sm text-slate-300">
            <p>{t("Real borrower success stories will appear here soon.", "真实成交案例即将上线，敬请期待。")}</p>
          </div>
        )}
      </div>

      <div className="hidden gap-6 md:grid md:grid-cols-3">
        {dealsLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`deal-desktop-skeleton-${index}`}
              className="h-72 rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 via-slate-900/40 to-slate-950/70 shadow-xl shadow-black/10"
            />
          ))}

        {!dealsLoading && hasDeals &&
          deals.map((deal) => (
            <article
              key={deal.id}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-brand-primary/50"
            >
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={deal.heroImage.src}
                  alt={pickText(deal.heroImage.alt, `${deal.city} showcase`)}
                  fill
                  sizes="(min-width: 1024px) 360px, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority={false}
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-4 text-slate-200">
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">{deal.id}</span>
                  <span className="text-sm">
                    {deal.city}, {deal.state}
                  </span>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <p className="text-xl font-semibold text-white">
                    {pickText(deal.price)}
                  </p>
                  <p className="text-xs text-brand-primary/80">
                    {pickText(deal.timeline)}
                  </p>
                </div>
                <p className="text-sm text-slate-200">
                  {pickText(deal.borrowerType)}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-100">
                  {[deal.product, deal.highlight].map((item, index) => (
                    <span
                      key={`${deal.id}-desktop-badge-${index}`}
                      className={clsx(
                        "rounded-full border px-3 py-1 transition",
                        index === 0
                          ? "border-brand-primary/40 bg-brand-primary/10 text-brand-primary group-hover:border-brand-primary/60 group-hover:bg-brand-primary/20"
                          : "border-white/15 bg-white/5 group-hover:border-white/30 group-hover:bg-white/10"
                      )}
                    >
                      {pickText(item)}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDeal(deal)}
                className="absolute inset-0"
                aria-label={t("View deal detail", "查看成交详情")}
              />
            </article>
          ))}

        {!dealsLoading && !hasDeals && (
          <div className="col-span-3 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 p-10 text-sm text-slate-300">
            <p>{t("Real borrower success stories will appear here soon.", "真实成交案例即将上线，敬请期待。")}</p>
          </div>
        )}
      </div>

      {activeDeal && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm" onClick={() => setActiveDeal(null)} />
          <div
                className={clsx(
                  "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-slate-950/95 text-slate-100 shadow-2xl transition-transform duration-300 md:hidden",
                  activeDeal ? "translate-y-0" : "translate-y-full"
                )}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div className="flex items-center justify-between px-5 pt-5">
                  <span className="text-xs uppercase tracking-widest text-brand-primary/70">Case Study</span>
                  <button
                    type="button"
                onClick={() => setActiveDeal(null)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-brand-primary/40 hover:text-brand-primary"
              >
                {t("Close", "关闭")}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-8">
                <div className="relative mt-4 h-56 overflow-hidden rounded-2xl">
                  <Image
                    src={localizedGallery[0]?.src ?? activeDeal.heroImage.src}
                    alt={localizedGallery[0]?.alt ?? pickText(activeDeal.heroImage.alt, activeDeal.id)}
                    fill
                    sizes="(max-width: 768px) 90vw"
                    className="object-cover"
                    unoptimized
                  />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/90 to-transparent p-3">
                  <p className="text-sm font-medium">
                    {activeDeal.city}, {activeDeal.state}
                  </p>
                  <p className="text-xs text-brand-primary/80">{activeDeal.id}</p>
                </div>
              </div>

                  {localizedGallery.length > 1 && (
                    <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
                      {localizedGallery.slice(1).map((image, index) => (
                        <div key={`${activeDeal.id}-thumb-${index}`} className="relative h-24 min-w-[120px] overflow-hidden rounded-xl">
                          <Image src={image.src} alt={image.alt} fill sizes="120px" className="object-cover" unoptimized />
                        </div>
                      ))}
                    </div>
                  )}

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-2xl font-semibold text-white">
                    {pickText(activeDeal.price)}
                  </p>
                  <p className="text-xs text-brand-primary/80">
                    {pickText(activeDeal.timeline)}
                  </p>
                </div>
                <p className="text-sm text-slate-200">
                  {pickText(activeDeal.borrowerType)}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[activeDeal.product, activeDeal.highlight].map((item, index) => (
                    <div key={`${activeDeal.id}-metric-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-400">
                        {index === 0 ? t("Loan program", "贷款方案") : t("Result highlight", "成交亮点")}
                      </p>
                      <p className="mt-1 text-sm text-white">{pickText(item)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="mt-6 w-full rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-brand-dark shadow-lg shadow-brand-primary/40 transition hover:-translate-y-0.5"
              >
                {t("Request a similar strategy", "我也想要类似方案")}
              </button>
            </div>
          </div>

          <div
            className={clsx(
              "fixed inset-y-0 right-0 z-50 hidden w-full max-w-[420px] flex-col border-l border-white/10 bg-slate-950/95 text-slate-100 shadow-2xl transition-transform duration-300 md:flex",
              activeDeal ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-brand-primary/70">{t("Closing highlight", "成交亮点")}</p>
                <p className="text-lg font-semibold text-white">{activeDeal.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDeal(null)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-brand-primary/40 hover:text-brand-primary"
              >
                {t("Close", "关闭")}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8">
              <div className="relative mt-4 h-48 overflow-hidden rounded-2xl">
                <Image
                  src={localizedGallery[0]?.src ?? activeDeal.heroImage.src}
                  alt={localizedGallery[0]?.alt ?? pickText(activeDeal.heroImage.alt, activeDeal.id)}
                  fill
                  sizes="420px"
                  className="object-cover"
                  unoptimized
                />
              </div>

              {localizedGallery.length > 1 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {localizedGallery.slice(1).map((image, index) => (
                    <div key={`${activeDeal.id}-desktop-thumb-${index}`} className="relative h-28 overflow-hidden rounded-xl border border-white/10">
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="210px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{t("Location", "城市")}</p>
                  <p className="mt-1 text-sm text-white">
                    {activeDeal.city}, {activeDeal.state}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{t("Timeline", "放款周期")}</p>
                  <p className="mt-1 text-sm text-white">
                    {pickText(activeDeal.timeline)}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{t("Loan amount", "成交金额")}</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {pickText(activeDeal.price)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{t("Borrower profile", "客户画像")}</p>
                  <p className="mt-1 text-sm text-slate-200">
                    {pickText(activeDeal.borrowerType)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{t("Solution", "解决方案")}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-200">
                    <li>{pickText(activeDeal.product)}</li>
                    <li>{pickText(activeDeal.highlight)}</li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                className="mt-6 w-full rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-brand-dark shadow-lg shadow-brand-primary/40 transition hover:-translate-y-0.5"
              >
                {t("Talk to our team", "联系金桥顾问")}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

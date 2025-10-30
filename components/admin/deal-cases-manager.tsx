"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";

type Locale = "en" | "zh";

type LocalizedCopy = {
  en: string;
  zh: string;
};

type AdminDealCaseImage = {
  id: string;
  url: string;
  signedUrl: string;
  alt: LocalizedCopy;
  sortOrder: number;
};

type AdminDealCase = {
  id: string;
  caseCode: string;
  city: string;
  state: string;
  published: boolean;
  heroImage: { url: string; signedUrl: string };
  price: LocalizedCopy;
  timeline: LocalizedCopy;
  borrowerType: LocalizedCopy;
  product: LocalizedCopy;
  highlight: LocalizedCopy;
  gallery: AdminDealCaseImage[];
  createdAt: string;
  updatedAt: string;
};

type DealCaseFormImage = {
  id?: string;
  url: string;
  altEn: string;
  altZh: string;
  sortOrder: number;
};

type DealCaseFormState = {
  caseCode: string;
  city: string;
  state: string;
  heroImageUrl: string;
  published: boolean;
  priceEn: string;
  priceZh: string;
  timelineEn: string;
  timelineZh: string;
  borrowerEn: string;
  borrowerZh: string;
  productEn: string;
  productZh: string;
  highlightEn: string;
  highlightZh: string;
  gallery: DealCaseFormImage[];
};

type DealCasePayload = {
  caseCode: string;
  city: string;
  state: string;
  heroImageUrl: string;
  published: boolean;
  price: LocalizedCopy;
  timeline: LocalizedCopy;
  borrowerType: LocalizedCopy;
  product: LocalizedCopy;
  highlight: LocalizedCopy;
  gallery: Array<{ url: string; alt: LocalizedCopy; sortOrder: number }>;
};

type CaseMutationInput = {
  id?: string;
  payload: DealCasePayload;
};

function emptyForm(): DealCaseFormState {
  return {
    caseCode: "",
    city: "",
    state: "",
    heroImageUrl: "",
    published: true,
    priceEn: "",
    priceZh: "",
    timelineEn: "",
    timelineZh: "",
    borrowerEn: "",
    borrowerZh: "",
    productEn: "",
    productZh: "",
    highlightEn: "",
    highlightZh: "",
    gallery: [
      {
        url: "",
        altEn: "",
        altZh: "",
        sortOrder: 0
      }
    ]
  };
}

function mapCaseToForm(deal: AdminDealCase): DealCaseFormState {
  return {
    caseCode: deal.caseCode,
    city: deal.city,
    state: deal.state,
    heroImageUrl: deal.heroImage.url,
    published: deal.published,
    priceEn: deal.price.en,
    priceZh: deal.price.zh,
    timelineEn: deal.timeline.en,
    timelineZh: deal.timeline.zh,
    borrowerEn: deal.borrowerType.en,
    borrowerZh: deal.borrowerType.zh,
    productEn: deal.product.en,
    productZh: deal.product.zh,
    highlightEn: deal.highlight.en,
    highlightZh: deal.highlight.zh,
    gallery:
      deal.gallery.length > 0
        ? deal.gallery.map((image) => ({
            id: image.id,
            url: image.url,
            altEn: image.alt.en,
            altZh: image.alt.zh,
            sortOrder: image.sortOrder
          }))
        : emptyForm().gallery
  };
}

function buildPayload(form: DealCaseFormState): DealCasePayload {
  return {
    caseCode: form.caseCode.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    heroImageUrl: form.heroImageUrl.trim(),
    published: form.published,
    price: { en: form.priceEn.trim(), zh: form.priceZh.trim() },
    timeline: { en: form.timelineEn.trim(), zh: form.timelineZh.trim() },
    borrowerType: { en: form.borrowerEn.trim(), zh: form.borrowerZh.trim() },
    product: { en: form.productEn.trim(), zh: form.productZh.trim() },
    highlight: { en: form.highlightEn.trim(), zh: form.highlightZh.trim() },
    gallery: form.gallery
      .filter((image) => image.url.trim().length > 0)
      .map((image, index) => ({
        url: image.url.trim(),
        alt: { en: image.altEn.trim(), zh: image.altZh.trim() },
        sortOrder: Number.isFinite(image.sortOrder) ? image.sortOrder : index
      }))
  };
}

async function fetchDealCases(): Promise<AdminDealCase[]> {
  const response = await fetch("/api/admin/deal-cases", { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load deal cases");
  }
  const body = (await response.json()) as { cases: AdminDealCase[] };
  return body.cases;
}

async function mutateDealCase({ id, payload }: CaseMutationInput, method: "POST" | "PUT") {
  const response = await fetch(id ? `/api/admin/deal-cases/${id}` : "/api/admin/deal-cases", {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to save deal case");
  }
  return response.json();
}

async function deleteDealCase(id: string) {
  const response = await fetch(`/api/admin/deal-cases/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to delete deal case");
  }
  return response.json();
}

type AdminDealCasesManagerProps = {
  locale: Locale;
};

export function AdminDealCasesManager({ locale }: AdminDealCasesManagerProps) {
  const t = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const pick = (copy: LocalizedCopy) => (locale === "zh" ? copy.zh : copy.en);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "deal-cases"],
    queryFn: fetchDealCases
  });

  const [formState, setFormState] = useState<DealCaseFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: DealCasePayload) => mutateDealCase({ payload }, "POST"),
    onSuccess: () => refetch()
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DealCasePayload }) => mutateDealCase({ id, payload }, "PUT"),
    onSuccess: () => refetch()
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDealCase(id),
    onSuccess: () => refetch()
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormState(emptyForm());
    setFormError(null);
  };

  const handleOpenEdit = (deal: AdminDealCase) => {
    setEditingId(deal.id);
    setFormState(mapCaseToForm(deal));
    setFormError(null);
  };

  const handleCloseForm = () => {
    setFormState(null);
    setEditingId(null);
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState) return;
    setFormError(null);
    const payload = buildPayload(formState);

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      handleCloseForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("Failed to save case", "保存案例失败"));
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      t("Are you sure you want to delete this case? This cannot be undone.", "确定要删除该案例吗？此操作不可恢复。")
    );
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("Failed to delete case", "删除案例失败"));
    }
  };

  const cases = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{t("Deal Cases", "成交案例")}</h2>
          <p className="text-sm text-slate-400">
            {t("Create, update, and publish borrower success stories.", "创建、更新并发布真实成交案例。")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-full bg-brand-primary px-4 py-2 text-sm font-medium text-brand-dark shadow-lg shadow-brand-primary/40 transition hover:-translate-y-0.5 disabled:opacity-60"
          disabled={isSaving}
        >
          {t("New Case", "新建案例")}
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-center text-sm text-slate-300">
          {t("Loading cases...", "案例加载中...")}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error.message}</div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-slate-300">
          {t("No cases yet. Create the first one to showcase wins.", "暂无案例，可先创建几条用于展示。")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">{t("Case Code", "编号")}</th>
                <th className="px-4 py-3 text-left">{t("Location", "城市")}</th>
                <th className="px-4 py-3 text-left">{t("Headline", "摘要")}</th>
                <th className="px-4 py-3 text-left">{t("Published", "状态")}</th>
                <th className="px-4 py-3 text-left">{t("Updated", "更新时间")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cases.map((deal) => (
                <tr key={deal.id}>
                  <td className="px-4 py-3 font-medium text-white">{deal.caseCode}</td>
                  <td className="px-4 py-3">{deal.city}, {deal.state}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{pick(deal.highlight)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                        deal.published ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/50 text-slate-300"
                      )}
                    >
                      {deal.published ? t("Published", "已发布") : t("Draft", "草稿")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(deal.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(deal)}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-brand-primary/60 hover:text-white"
                      >
                        {t("Edit", "编辑")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(deal.id)}
                        className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-200 transition hover:bg-red-500/10"
                        disabled={deleteMutation.isPending}
                      >
                        {t("Delete", "删除")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formState && (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-brand-primary/20 bg-slate-900/80 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {editingId ? t("Edit Case", "编辑案例") : t("Create Case", "新建案例")}
              </h3>
              <p className="text-xs text-slate-400">{t("Fields without special notes are required.", "除特别说明外均为必填项。")}</p>
            </div>
            <button
              type="button"
              onClick={handleCloseForm}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-white/30 hover:text-white"
              disabled={isSaving}
            >
              {t("Cancel", "取消")}
            </button>
          </div>

          {formError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{formError}</p>}

          <div className="grid gap-4 md:grid-cols-2">
            <FormLabel
              label={t("Case Code", "案例编号")}
              value={formState.caseCode}
              onChange={(value) =>
                setFormState((prev) => (prev ? { ...prev, caseCode: value.toUpperCase() } : prev))
              }
              required
            />
            <FormLabel
              label={t("City", "城市")}
              value={formState.city}
              onChange={(value) => setFormState((prev) => (prev ? { ...prev, city: value } : prev))}
              required
            />
            <FormLabel
              label={t("State / Region", "州 / 地区")}
              value={formState.state}
              onChange={(value) => setFormState((prev) => (prev ? { ...prev, state: value.toUpperCase() } : prev))}
              required
            />
            <FormLabel
              label={t("Hero Image URL", "主图地址")}
              value={formState.heroImageUrl}
              onChange={(value) => setFormState((prev) => (prev ? { ...prev, heroImageUrl: value } : prev))}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <LocalizedField
              locale={locale}
              label={t("Price Display", "金额显示")}
              valueEn={formState.priceEn}
              valueZh={formState.priceZh}
              onChange={(en, zh) => setFormState((prev) => (prev ? { ...prev, priceEn: en, priceZh: zh } : prev))}
            />
            <LocalizedField
              locale={locale}
              label={t("Timeline", "放款时长")}
              valueEn={formState.timelineEn}
              valueZh={formState.timelineZh}
              onChange={(en, zh) => setFormState((prev) => (prev ? { ...prev, timelineEn: en, timelineZh: zh } : prev))}
            />
            <LocalizedField
              locale={locale}
              label={t("Borrower Profile", "客户画像")}
              valueEn={formState.borrowerEn}
              valueZh={formState.borrowerZh}
              onChange={(en, zh) => setFormState((prev) => (prev ? { ...prev, borrowerEn: en, borrowerZh: zh } : prev))}
            />
            <LocalizedField
              locale={locale}
              label={t("Loan Program", "贷款方案")}
              valueEn={formState.productEn}
              valueZh={formState.productZh}
              onChange={(en, zh) => setFormState((prev) => (prev ? { ...prev, productEn: en, productZh: zh } : prev))}
            />
            <LocalizedField
              locale={locale}
              label={t("Deal Highlight", "成交亮点")}
              valueEn={formState.highlightEn}
              valueZh={formState.highlightZh}
              onChange={(en, zh) => setFormState((prev) => (prev ? { ...prev, highlightEn: en, highlightZh: zh } : prev))}
            />
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm">
              <input
                id="published"
                type="checkbox"
                checked={formState.published}
                onChange={(event) => setFormState((prev) => (prev ? { ...prev, published: event.target.checked } : prev))}
                className="h-4 w-4 rounded border-white/20 bg-slate-900 text-brand-primary focus:ring-brand-primary"
              />
              <label htmlFor="published" className="text-slate-200">
                {t("Published (visible on web & mobile)", "发布上线（网页/移动端可见）")}
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">{t("Gallery Images", "案例图集")}</h4>
              <button
                type="button"
                onClick={() =>
                  setFormState((prev) =>
                    prev
                      ? {
                          ...prev,
                          gallery: [
                            ...prev.gallery,
                            {
                              url: "",
                              altEn: "",
                              altZh: "",
                              sortOrder: prev.gallery.length
                            }
                          ]
                        }
                      : prev
                  )
                }
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-brand-primary/60 hover:text-white"
              >
                {t("Add image", "新增图片")}
              </button>
            </div>

            <div className="space-y-4">
              {formState.gallery.map((image, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="flex-1">
                      <SmallLabel
                        locale={locale}
                        label={t("Image URL", "图片地址")}
                        value={image.url}
                        onChange={(value) =>
                          setFormState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  gallery: prev.gallery.map((item, idx) => (idx === index ? { ...item, url: value } : item))
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                    <SmallLabel
                      locale={locale}
                      label={t("Sort", "排序")}
                      value={image.sortOrder.toString()}
                      type="number"
                      onChange={(value) =>
                        setFormState((prev) =>
                          prev
                            ? {
                                ...prev,
                                gallery: prev.gallery.map((item, idx) =>
                                  idx === index
                                    ? {
                                        ...item,
                                        sortOrder: Number.parseInt(value, 10) || 0
                                      }
                                    : item
                                )
                              }
                            : prev
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((prev) =>
                          prev
                            ? {
                                ...prev,
                                gallery: prev.gallery.filter((_, idx) => idx !== index)
                              }
                            : prev
                        )
                      }
                      className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-200 transition hover:bg-red-500/10"
                    >
                      {t("Remove", "移除")}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <SmallLabel
                      locale={locale}
                      label={t("Alt (English)", "替代文本（英文）")}
                      value={image.altEn}
                      onChange={(value) =>
                        setFormState((prev) =>
                          prev
                            ? {
                                ...prev,
                                gallery: prev.gallery.map((item, idx) => (idx === index ? { ...item, altEn: value } : item))
                              }
                            : prev
                        )
                      }
                    />
                    <SmallLabel
                      locale={locale}
                      label={t("Alt (Chinese)", "替代文本（中文）")}
                      value={image.altZh}
                      onChange={(value) =>
                        setFormState((prev) =>
                          prev
                            ? {
                                ...prev,
                                gallery: prev.gallery.map((item, idx) => (idx === index ? { ...item, altZh: value } : item))
                              }
                            : prev
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseForm}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:text-white"
              disabled={isSaving}
            >
              {t("Cancel", "取消")}
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-dark shadow-lg shadow-brand-primary/40 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving
                ? t("Saving...", "保存中...")
                : editingId
                ? t("Save changes", "保存修改")
                : t("Create case", "创建案例")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type FormLabelProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

function FormLabel({ label, value, onChange, required }: FormLabelProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-300">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
        required={required}
      />
    </label>
  );
}

type LocalizedFieldProps = {
  locale: Locale;
  label: string;
  valueEn: string;
  valueZh: string;
  onChange: (en: string, zh: string) => void;
};

function LocalizedField({ locale, label, valueEn, valueZh, onChange }: LocalizedFieldProps) {
  const t = (en: string, zh: string) => (locale === "zh" ? zh : en);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
      <span className="text-xs uppercase tracking-widest text-slate-400">{label}</span>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t("English", "英文")}
        <textarea
          value={valueEn}
          onChange={(event) => onChange(event.target.value, valueZh)}
          rows={2}
          className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        {t("Chinese", "中文")}
        <textarea
          value={valueZh}
          onChange={(event) => onChange(valueEn, event.target.value)}
          rows={2}
          className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
        />
      </label>
    </div>
  );
}

type SmallLabelProps = {
  locale: Locale;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
};

function SmallLabel({ locale, label, value, onChange, type = "text" }: SmallLabelProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
      />
    </label>
  );
}


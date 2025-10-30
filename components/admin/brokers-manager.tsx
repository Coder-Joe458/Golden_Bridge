"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

type BrokerProfile = {
  id: string;
  company: string | null;
  headline: string | null;
  bio: string | null;
  licenseStates: string[];
  yearsExperience: number | null;
  website: string | null;
  minRate: number | null;
  maxRate: number | null;
  loanPrograms: string[];
  minCreditScore: number | null;
  maxLoanToValue: number | null;
  notes: string | null;
  closingSpeedDays: number | null;
  updatedAt: string;
};

type AdminBroker = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  createdAt: string;
  profile: BrokerProfile | null;
};

type BrokerFormState = {
  company: string;
  headline: string;
  bio: string;
  licenseStates: string;
  yearsExperience: string;
  website: string;
  minRate: string;
  maxRate: string;
  loanPrograms: string;
  minCreditScore: string;
  maxLoanToValue: string;
  notes: string;
  closingSpeedDays: string;
};

type CreateBrokerFormState = {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  profile: BrokerFormState;
};

function mapProfileToForm(profile: BrokerProfile | null): BrokerFormState {
  if (!profile) {
    return {
      company: "",
      headline: "",
      bio: "",
      licenseStates: "",
      yearsExperience: "",
      website: "",
      minRate: "",
      maxRate: "",
      loanPrograms: "",
      minCreditScore: "",
      maxLoanToValue: "",
      notes: "",
      closingSpeedDays: ""
    };
  }
  return {
    company: profile.company ?? "",
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    licenseStates: profile.licenseStates.join(", "),
    yearsExperience: profile.yearsExperience?.toString() ?? "",
    website: profile.website ?? "",
    minRate: profile.minRate?.toString() ?? "",
    maxRate: profile.maxRate?.toString() ?? "",
    loanPrograms: profile.loanPrograms.join(", "),
    minCreditScore: profile.minCreditScore?.toString() ?? "",
    maxLoanToValue: profile.maxLoanToValue?.toString() ?? "",
    notes: profile.notes ?? "",
    closingSpeedDays: profile.closingSpeedDays?.toString() ?? ""
  };
}

function buildBrokerPayload(form: BrokerFormState) {
  const licenseStates = form.licenseStates
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const loanPrograms = form.loanPrograms
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const toNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    company: form.company.trim() || null,
    headline: form.headline.trim() || null,
    bio: form.bio.trim() || null,
    licenseStates,
    yearsExperience: toNumber(form.yearsExperience),
    website: form.website.trim() || null,
    minRate: toNumber(form.minRate),
    maxRate: toNumber(form.maxRate),
    loanPrograms,
    minCreditScore: toNumber(form.minCreditScore),
    maxLoanToValue: toNumber(form.maxLoanToValue),
    notes: form.notes.trim() || null,
    closingSpeedDays: toNumber(form.closingSpeedDays)
  };
}

function initialCreateForm(): CreateBrokerFormState {
  return {
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    profile: mapProfileToForm(null)
  };
}

function buildCreatePayload(form: CreateBrokerFormState) {
  const profilePayload = buildBrokerPayload(form.profile);
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phoneNumber: form.phoneNumber.trim() || null,
    password: form.password,
    profile: profilePayload
  };
}

async function fetchBrokers(): Promise<AdminBroker[]> {
  const response = await fetch("/api/admin/brokers", { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load broker list");
  }
  const body = (await response.json()) as { brokers: AdminBroker[] };
  return body.brokers;
}

async function updateBroker(userId: string, payload: ReturnType<typeof buildBrokerPayload>) {
  const response = await fetch(`/api/admin/brokers/${userId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to update broker profile");
  }
  return response.json();
}

async function createBroker(payload: ReturnType<typeof buildCreatePayload>) {
  const response = await fetch("/api/admin/brokers", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to create broker");
  }
  return response.json();
}

async function deleteBroker(userId: string) {
  const response = await fetch(`/api/admin/brokers/${userId}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to delete broker");
  }
  return response.json();
}

export function AdminBrokersManager() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "brokers"],
    queryFn: fetchBrokers
  });

  const [activeBroker, setActiveBroker] = useState<AdminBroker | null>(null);
  const [formState, setFormState] = useState<BrokerFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateBrokerFormState | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: ReturnType<typeof buildBrokerPayload> }) =>
      updateBroker(userId, payload),
    onSuccess: () => refetch()
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildCreatePayload>) => createBroker(payload),
    onSuccess: () => refetch()
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteBroker(userId),
    onSuccess: () => refetch()
  });

  const handleSelectBroker = (broker: AdminBroker) => {
    setCreateForm(null);
    setActiveBroker(broker);
    setFormState(mapProfileToForm(broker.profile));
    setFormError(null);
  };

  const handleSubmitUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeBroker || !formState) return;
    setFormError(null);
    try {
      await updateMutation.mutateAsync({ userId: activeBroker.id, payload: buildBrokerPayload(formState) });
      setActiveBroker(null);
      setFormState(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update broker profile");
    }
  };

  const handleOpenCreate = () => {
    setActiveBroker(null);
    setFormState(null);
    setFormError(null);
    setCreateForm(initialCreateForm());
    setCreateError(null);
  };

  const handleSubmitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm) return;
    setCreateError(null);
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError("Passwords do not match");
      return;
    }

    try {
      await createMutation.mutateAsync(buildCreatePayload(createForm));
      setCreateForm(null);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create broker");
    }
  };

  const handleDelete = async (broker: AdminBroker) => {
    const label = broker.name ?? broker.email ?? "this broker";
    if (!window.confirm(`确定要删除 ${label} 吗？该操作不可恢复。`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(broker.id);
      if (activeBroker?.id === broker.id) {
        setActiveBroker(null);
        setFormState(null);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete broker");
    }
  };

  const generatePassword = () => {
    try {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    } catch {
      return Math.random().toString(36).slice(-10);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Broker Directory</h2>
          <p className="text-sm text-slate-400">Manage合作伙伴账号及档案信息。</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-full bg-brand-primary px-4 py-2 text-sm font-medium text-brand-dark shadow-lg shadow-brand-primary/40 transition hover:-translate-y-0.5 disabled:opacity-60"
          disabled={createMutation.isPending}
        >
          新建贷款机构
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-center text-sm text-slate-300">Loading brokers...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error.message}</div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-slate-300">
          暂无经纪人账号，可以通过“新建贷款机构”快速冷启动一批资料。
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-sm text-slate-200">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">States</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((broker) => (
                <tr key={broker.id}>
                  <td className="px-4 py-3 font-medium text-white">{broker.name ?? "—"}</td>
                  <td className="px-4 py-3">{broker.email ?? "—"}</td>
                  <td className="px-4 py-3">{broker.profile?.company ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {broker.profile?.licenseStates?.length ? broker.profile.licenseStates.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {broker.profile ? new Date(broker.profile.updatedAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectBroker(broker)}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-brand-primary/60 hover:text-white"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(broker)}
                        className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-200 transition hover:bg-red-500/10"
                        disabled={deleteMutation.isPending}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createForm && (
        <form onSubmit={handleSubmitCreate} className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">创建新贷款机构账号</h3>
              <p className="text-xs text-slate-400">填写账号信息和初始档案，稍后可以继续在后台编辑。</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateForm(null);
                setCreateError(null);
              }}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-white/30 hover:text-white"
              disabled={createMutation.isPending}
            >
              取消
            </button>
          </div>

          {createError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{createError}</p>}

          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Name" value={createForm.name} onChange={(value) => setCreateForm((prev) => prev ? { ...prev, name: value } : prev)} />
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={createForm.email}
              onChange={(value) => setCreateForm((prev) => prev ? { ...prev, email: value } : prev)}
            />
            <TextField
              label="Phone Number"
              autoComplete="tel"
              value={createForm.phoneNumber}
              onChange={(value) => setCreateForm((prev) => prev ? { ...prev, phoneNumber: value } : prev)}
            />
            <div className="flex items-end gap-2">
              <TextField
                label="Temporary Password"
                type="password"
                autoComplete="new-password"
                value={createForm.password}
                onChange={(value) => setCreateForm((prev) => prev ? { ...prev, password: value } : prev)}
              />
              <button
                type="button"
                onClick={() => {
                  const suggestion = generatePassword();
                  setCreateForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          password: suggestion,
                          confirmPassword: suggestion
                        }
                      : prev
                  );
                }}
                className="h-10 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-brand-primary/60 hover:text-white"
              >
                生成密码
              </button>
            </div>
            <TextField
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              value={createForm.confirmPassword}
              onChange={(value) => setCreateForm((prev) => prev ? { ...prev, confirmPassword: value } : prev)}
            />
          </div>

          <BrokerProfileFields
            profile={createForm.profile}
            onChange={(profile) => setCreateForm((prev) => (prev ? { ...prev, profile } : prev))}
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setCreateForm(null);
                setCreateError(null);
              }}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:text-white"
              disabled={createMutation.isPending}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-dark shadow-lg shadow-brand-primary/40 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "创建中..." : "创建贷款机构"}
            </button>
          </div>
        </form>
      )}

      {activeBroker && formState && (
        <form onSubmit={handleSubmitUpdate} className="space-y-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-white">{activeBroker.name ?? activeBroker.email ?? "Broker"}</h3>
            <p className="text-xs text-slate-400">
              {activeBroker.email && <span className="mr-2">{activeBroker.email}</span>}
              {activeBroker.phoneNumber && <span>{activeBroker.phoneNumber}</span>}
            </p>
          </div>

          {formError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{formError}</p>}

          <BrokerProfileFields profile={formState} onChange={setFormState} />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveBroker(null);
                setFormState(null);
                setFormError(null);
              }}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:text-white"
              disabled={updateMutation.isPending}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-brand-dark shadow-lg shadow-brand-primary/40 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "保存中..." : "保存修改"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
};

function TextField({ label, value, onChange, placeholder, type = "text", autoComplete }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-300">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
      />
    </label>
  );
}

type TextAreaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
};

function TextAreaField({ label, value, onChange, rows = 4 }: TextAreaFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-2">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 focus:border-brand-primary focus:outline-none"
      />
    </label>
  );
}

type BrokerProfileFieldsProps = {
  profile: BrokerFormState;
  onChange: (profile: BrokerFormState) => void;
};

function BrokerProfileFields({ profile, onChange }: BrokerProfileFieldsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField label="Company" value={profile.company} onChange={(value) => onChange({ ...profile, company: value })} />
      <TextField label="Headline" value={profile.headline} onChange={(value) => onChange({ ...profile, headline: value })} />
      <TextAreaField label="Bio" value={profile.bio} rows={4} onChange={(value) => onChange({ ...profile, bio: value })} />
      <TextField
        label="License States (comma separated)"
        value={profile.licenseStates}
        onChange={(value) => onChange({ ...profile, licenseStates: value })}
        placeholder="CA, TX, WA"
      />
      <TextField label="Years Experience" value={profile.yearsExperience} onChange={(value) => onChange({ ...profile, yearsExperience: value })} />
      <TextField label="Website" value={profile.website} onChange={(value) => onChange({ ...profile, website: value })} />
      <TextField label="Min Rate" value={profile.minRate} onChange={(value) => onChange({ ...profile, minRate: value })} placeholder="5.75" />
      <TextField label="Max Rate" value={profile.maxRate} onChange={(value) => onChange({ ...profile, maxRate: value })} placeholder="6.40" />
      <TextField
        label="Loan Programs (comma separated)"
        value={profile.loanPrograms}
        onChange={(value) => onChange({ ...profile, loanPrograms: value })}
        placeholder="Jumbo, DSCR"
      />
      <TextField label="Min Credit Score" value={profile.minCreditScore} onChange={(value) => onChange({ ...profile, minCreditScore: value })} />
      <TextField label="Max LTV" value={profile.maxLoanToValue} onChange={(value) => onChange({ ...profile, maxLoanToValue: value })} />
      <TextAreaField label="Notes" value={profile.notes} rows={3} onChange={(value) => onChange({ ...profile, notes: value })} />
      <TextField label="Closing Speed Days" value={profile.closingSpeedDays} onChange={(value) => onChange({ ...profile, closingSpeedDays: value })} />
    </div>
  );
}


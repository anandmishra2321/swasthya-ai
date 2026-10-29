import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, CalendarDays, FlaskConical, LifeBuoy, MapPin, Package, Pill, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useAsync } from '../../hooks/useAsync';
import { getRoleDefinition, type PanelId } from '../../config/roles';
import {
  NotConfigured,
  Panel,
  PanelEmpty,
  PanelError,
  PanelLoading,
  StatCard,
  StatusPill,
  formatDate,
  formatDateTime,
  toneForStatus,
} from '../../components/workspace/WorkspaceUI';

/**
 * Shared console for roles that do not have a bespoke dashboard page.
 *
 * Every panel reads from a real API endpoint and renders the genuine result —
 * including empty, forbidden and not-configured states. Nothing here falls back
 * to placeholder clinical data.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);

const WorkspaceSelect: React.FC = () => {
  const { workspaces, user, switchWorkspace } = useAuth();
  const [busy, setBusy] = useState(false);

  if (workspaces.length <= 1) {
    const only = workspaces[0];
    return only ? (
      <span className="text-xs text-slate-500">
        Workspace: <strong className="text-slate-700">{only.organizationName}</strong>
      </span>
    ) : null;
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      Workspace
      <select
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
        value={user?.activeWorkspaceId || ''}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          try {
            await switchWorkspace(e.target.value || null);
          } finally {
            setBusy(false);
          }
        }}
      >
        {workspaces.map((w) => (
          <option key={w.organizationId} value={w.organizationId}>
            {w.organizationName}
          </option>
        ))}
      </select>
    </label>
  );
};

const BedsPanel: React.FC<{ organizationId?: string | null }> = ({ organizationId }) => {
  const query = organizationId ? `?organizationId=${organizationId}` : '';
  const { data, error, loading, reload } = useAsync<any>(() => api.get(`/beds${query}`), [query]);

  if (loading) return <PanelLoading label="Loading bed status…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const beds: any[] = data?.data || [];
  if (beds.length === 0) {
    return (
      <PanelEmpty
        title="No bed inventory published"
        hint="Your organisation has not published ward-level bed counts yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      {beds.map((bed) => (
        <div key={bed._id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {bed.ward} · <span className="capitalize">{bed.category}</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Updated {formatDateTime(bed.lastUpdatedAt)} ({bed.ageHours}h ago)
              </p>
            </div>
            {bed.isStale ? <StatusPill value="stale" tone="warn" /> : <StatusPill value="fresh" tone="good" />}
          </div>

          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              { k: 'Total', v: bed.totalCapacity },
              { k: 'Available', v: bed.available },
              { k: 'Occupied', v: bed.occupied },
              { k: 'Cleaning', v: `${bed.cleaning}/${bed.reserved} res.` },
            ].map((cell) => (
              <div key={cell.k} className="rounded-lg bg-slate-50 py-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{cell.k}</dt>
                <dd className="text-lg font-extrabold tabular-nums text-slate-900">{cell.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
};

const AppointmentsPanel: React.FC<{ date?: string }> = ({ date }) => {
  const query = date ? `?date=${date}` : '';
  const { data, error, loading, reload } = useAsync<any>(() => api.get(`/appointments${query}`), [query]);

  if (loading) return <PanelLoading label="Loading appointments…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];
  if (rows.length === 0) {
    return <PanelEmpty title="No appointments found" hint="No bookings match the selected scope." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-bold">Token</th>
            <th className="py-2 pr-3 font-bold">Patient</th>
            <th className="py-2 pr-3 font-bold">Doctor</th>
            <th className="py-2 pr-3 font-bold">Date / Slot</th>
            <th className="py-2 pr-3 font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((a) => (
            <tr key={a._id}>
              <td className="py-2.5 pr-3 font-bold tabular-nums text-slate-700">
                #{a.tokenNumber ?? '—'}
              </td>
              <td className="py-2.5 pr-3 text-slate-700">{a.patientId?.name || '—'}</td>
              <td className="py-2.5 pr-3 text-slate-700">
                {a.doctorId?.userId?.name || a.doctorId?.specialty || '—'}
              </td>
              <td className="py-2.5 pr-3 text-slate-600">
                {a.appointmentDate} · {a.timeSlot}
              </td>
              <td className="py-2.5 pr-3">
                <StatusPill value={a.status} tone={toneForStatus(a.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RecordsPanel: React.FC = () => {
  const { error, loading, reload, data } = useAsync<any>(() => api.get('/records'), []);

  if (loading) return <PanelLoading label="Loading clinical records…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];
  if (rows.length === 0) {
    return (
      <PanelEmpty
        title="No records visible to you"
        hint="Records are scoped to the patients you have a care relationship with. Open a specific patient chart to view their notes."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r._id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">{r.title}</p>
            <StatusPill value={String(r.type).replace(/_/g, ' ')} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {r.patientId?.name || 'Unknown patient'} · {formatDate(r.recordDate)}
          </p>
          {r.clinicalNotes?.diagnosis && (
            <p className="mt-2 text-xs text-slate-600">
              <strong>Diagnosis:</strong> {r.clinicalNotes.diagnosis}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
};

const LabOrdersPanel: React.FC<{ organizationId?: string | null }> = ({ organizationId }) => {
  const { data, error, loading, reload } = useAsync<any>(() => api.get('/lab-orders'), [organizationId]);

  if (loading) return <PanelLoading label="Loading lab work queue…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];
  if (rows.length === 0) {
    return <PanelEmpty title="No lab orders" hint="No specimens are attached to this scope." />;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((o) => (
        <li
          key={o._id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3.5"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">{o.testName}</p>
            <p className="text-[11px] text-slate-500">
              {o.sampleId} · {o.patientId?.name || 'Unknown patient'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill value={o.sampleStatus} tone={toneForStatus(o.sampleStatus)} />
            <StatusPill
              value={o.isReleasedToPatient ? 'released' : 'withheld'}
              tone={o.isReleasedToPatient ? 'good' : 'warn'}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

const TicketsPanel: React.FC = () => {
  const { data, error, loading, reload } = useAsync<any>(() => api.get('/support'), []);

  if (loading) return <PanelLoading label="Loading support queue…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];
  if (rows.length === 0) {
    return <PanelEmpty title="No tickets in the queue" hint="New tickets raised by patients or providers appear here." />;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((t) => (
        <li key={t._id} className="rounded-xl border border-slate-200 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">{t.subject}</p>
            <div className="flex items-center gap-1.5">
              <StatusPill value={t.priority} tone={t.priority === 'urgent' ? 'bad' : 'neutral'} />
              <StatusPill value={t.status} tone={toneForStatus(t.status)} />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {t.userId?.name || 'Unknown requester'} · {formatDateTime(t.createdAt)}
          </p>
          <p className="mt-2 text-xs text-slate-600 line-clamp-2">{t.description}</p>
        </li>
      ))}
    </ul>
  );
};

const TeamPanel: React.FC<{ organizationId?: string | null }> = ({ organizationId }) => {
  const { data, error, loading, reload } = useAsync<any>(
    () => (organizationId ? api.get(`/organizations/${organizationId}/members`) : Promise.resolve(null)),
    [organizationId]
  );

  if (!organizationId) {
    return (
      <NotConfigured
        label="Staff directory"
        detail="No organisation is selected in this workspace, so there is no team to list."
      />
    );
  }
  if (loading) return <PanelLoading label="Loading team…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];
  if (rows.length === 0) {
    return <PanelEmpty title="No staff members yet" hint="Invite colleagues to give them access to this workspace." />;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((m) => (
        <li key={m._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">{m.userId?.name || 'Member'}</p>
            <p className="text-[11px] text-slate-500">{m.userId?.email}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusPill value={String(m.role).replace(/_/g, ' ')} />
            <StatusPill value={m.status} tone={toneForStatus(m.status)} />
          </div>
        </li>
      ))}
    </ul>
  );
};

const OrganizationPanel: React.FC<{ organizationId?: string | null }> = ({ organizationId }) => {
  const { data, error, loading, reload } = useAsync<any>(
    () => (organizationId ? api.get(`/organizations/${organizationId}`) : Promise.resolve(null)),
    [organizationId]
  );

  if (!organizationId) {
    return (
      <NotConfigured
        label="Organisation profile"
        detail="This account is not affiliated with an organisation."
      />
    );
  }
  if (loading) return <PanelLoading label="Loading organisation…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const org = data?.data;
  if (!org) return <PanelEmpty title="Organisation not found" />;

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {[
        { k: 'Name', v: org.name },
        { k: 'Type', v: String(org.type || '').replace(/_/g, ' ') },
        { k: 'Phone', v: org.phone },
        { k: 'Email', v: org.email },
        { k: 'Operating hours', v: org.operatingHours },
        {
          k: 'Address',
          v: [org.address?.street, org.address?.area, org.address?.city, org.address?.pincode, org.address?.state]
            .filter(Boolean)
            .join(', '),
        },
        { k: 'Registration', v: org.registrationNumber },
        { k: 'Verification', v: String(org.verificationStatus || '').replace(/_/g, ' ') },
      ].map((row) => (
        <div key={row.k}>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{row.k}</dt>
          <dd className="text-slate-800">{row.v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
};

const DiscoveryPanel: React.FC = () => (
  <div className="space-y-3">
    <p className="text-xs text-slate-600">
      The healthcare directory is powered by the live platform database. Distances are computed from your chosen
      coordinates, and facility operating data is labelled with its freshness.
    </p>
    <div className="flex flex-wrap gap-2">
      <Link
        to="/discovery"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
      >
        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
        Open the care map
      </Link>
      <Link
        to="/hospitals"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Browse facilities
      </Link>
    </div>
  </div>
);

const PatientsPanel: React.FC = () => {
  const { data, error, loading, reload } = useAsync<any>(() => api.get('/clinician/patients'), []);

  if (loading) return <PanelLoading label="Loading consented patients…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];
  if (rows.length === 0) {
    return (
      <PanelEmpty
        title="No patient has granted you consent"
        hint="A patient appears here only after granting an active health-data consent to you or to your organisation. A role alone never exposes a patient chart."
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((p) => (
        <li key={p.patientId} className="rounded-xl border border-slate-200 p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">{p.name}</p>
              <p className="text-[11px] text-slate-500">
                {p.phone || p.email || 'No contact on file'} · consent granted {formatDate(p.grantedAt)}
                {p.expiresAt ? ` · expires ${formatDate(p.expiresAt)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(p.grantedCategories || []).map((c: string) => (
                <StatusPill key={c} value={c} />
              ))}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            {p.wearableConnected ? (
              <StatusPill
                value={`${String(p.connectedPlatform).replace(/_/g, ' ')} ${p.isStale ? 'stale sync' : 'live'}`}
                tone={p.isStale ? 'warn' : 'good'}
              />
            ) : (
              <StatusPill value="no device connected" />
            )}
            {p.latestHeartRate && (
              <span>
                Last heart rate <strong className="tabular-nums">{p.latestHeartRate.value} bpm</strong> ·{' '}
                {formatDateTime(p.latestHeartRate.measuredAt)}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

const PrescriptionsPanel: React.FC = () => {
  const { data, error, loading, reload } = useAsync<any>(() => api.get('/prescriptions'), []);

  if (loading) return <PanelLoading label="Loading prescriptions…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];
  if (rows.length === 0) {
    return (
      <PanelEmpty
        title="No prescriptions in this scope"
        hint="Prescriptions appear here once a clinician issues one for a patient within your scope."
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((rx) => (
        <li key={rx._id} className="rounded-xl border border-slate-200 p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">{rx.diagnosis}</p>
              <p className="text-[11px] text-slate-500">
                {rx.patientId?.name || 'Unknown patient'} ·{' '}
                {rx.doctorId?.name ? `prescribed by ${rx.doctorId.name}` : 'prescriber not loaded'} ·{' '}
                {formatDate(rx.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {rx.allergyWarningTriggered && <StatusPill value="allergy warning" tone="bad" />}
              <StatusPill value={rx.status} tone={toneForStatus(rx.status)} />
            </div>
          </div>

          <ul className="mt-2 space-y-1">
            {(rx.medicines || []).map((m: any, i: number) => (
              <li key={i} className="text-xs text-slate-600">
                <strong className="text-slate-800">{m.name}</strong> · {m.dosage} · {m.frequency} · {m.duration}
              </li>
            ))}
          </ul>

          {rx.allergyDetails && <p className="mt-2 text-[11px] font-semibold text-rose-700">{rx.allergyDetails}</p>}
        </li>
      ))}
    </ul>
  );
};

const InventoryPanel: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'lowStock' | 'nearExpiry'>('all');
  const query = filter === 'lowStock' ? '?lowStockOnly=true' : filter === 'nearExpiry' ? '?nearExpiryOnly=true' : '';
  const { data, error, loading, reload } = useAsync<any>(() => api.get(`/inventory${query}`), [query]);

  const alerts = data?.alerts;
  const rows: any[] = data?.data || [];

  const filterButton = (id: typeof filter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
        filter === id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filterButton('all', 'All stock')}
        {filterButton('lowStock', `Low stock${alerts ? ` (${alerts.lowStockCount})` : ''}`)}
        {filterButton('nearExpiry', `Near expiry / expired${alerts ? ` (${alerts.nearExpiryCount + alerts.expiredCount})` : ''}`)}
      </div>

      {alerts && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Low stock" value={alerts.lowStockCount} tone={alerts.lowStockCount > 0 ? 'warn' : 'good'} />
          <StatCard
            label="Near expiry (60d)"
            value={alerts.nearExpiryCount}
            tone={alerts.nearExpiryCount > 0 ? 'warn' : 'good'}
          />
          <StatCard label="Expired" value={alerts.expiredCount} tone={alerts.expiredCount > 0 ? 'bad' : 'good'} />
        </div>
      )}

      {loading && <PanelLoading label="Loading inventory…" />}
      {error && <PanelError message={error} onRetry={reload} />}

      {!loading && !error && rows.length === 0 && (
        <PanelEmpty
          title="No stock records match this filter"
          hint="Batches added to this store through the inventory API appear here with expiry and stock alerts."
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-bold">Medicine</th>
                <th className="py-2 pr-3 font-bold">Batch</th>
                <th className="py-2 pr-3 font-bold">Qty</th>
                <th className="py-2 pr-3 font-bold">Expiry</th>
                <th className="py-2 pr-3 font-bold">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((item) => (
                <tr key={item._id}>
                  <td className="py-2.5 pr-3">
                    <p className="font-bold text-slate-800">{item.medicineName}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.brand} · {item.strength} · ₹{item.price}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-600">{item.batchNumber}</td>
                  <td className="py-2.5 pr-3 text-xs tabular-nums text-slate-700">
                    {item.quantity}
                    <span className="text-slate-400"> / {item.lowStockThreshold}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-600">{formatDate(item.expiryDate)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1.5">
                      {item.isExpired && <StatusPill value="expired" tone="bad" />}
                      {item.isNearExpiry && <StatusPill value="near expiry" tone="warn" />}
                      {item.isLowStock && <StatusPill value="low stock" tone="warn" />}
                      {!item.isExpired && !item.isNearExpiry && !item.isLowStock && (
                        <StatusPill value="ok" tone="good" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const VerificationPanel: React.FC = () => {
  const { data, error, loading, reload } = useAsync<any>(() => api.get('/verification/queue'), []);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const decide = async (id: string, status: 'verified' | 'rejected' | 'needs_update') => {
    if (reason.trim().length < 3) {
      setActionError('Record a decision reason of at least 3 characters before submitting.');
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      await api.patch(`/verification/${id}/decision`, { status, decisionReason: reason.trim() });
      setReason('');
      reload();
    } catch (err: any) {
      setActionError(err?.message || 'The decision could not be recorded.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PanelLoading label="Loading verification queue…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];

  return (
    <div className="space-y-4">
      {actionError && <PanelError message={actionError} />}

      {rows.length === 0 ? (
        <PanelEmpty
          title="Verification queue is empty"
          hint="Provider credential cases submitted by hospitals, pharmacies, labs and clinicians arrive here for review."
        />
      ) : (
        <>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Decision reason (applied to the case you act on)
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Licences verified against state health directorate records"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <ul className="space-y-3">
            {rows.map((c) => (
              <li key={c._id} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{c.targetName}</p>
                    <p className="text-[11px] text-slate-500">
                      {String(c.targetType).replace(/_/g, ' ')} · submitted by{' '}
                      {c.submittedBy?.name || 'unknown'} · {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <StatusPill value={c.status} tone={toneForStatus(c.status)} />
                </div>

                <ul className="mt-2 space-y-1">
                  {(c.documents || []).map((d: any, i: number) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-700">{d.docType}</span>
                      <span>{d.documentNumber}</span>
                      <span className="text-slate-400">
                        {formatDate(d.issueDate)} → {formatDate(d.expiryDate)}
                      </span>
                      <StatusPill value={d.status} tone={toneForStatus(d.status)} />
                    </li>
                  ))}
                </ul>

                {c.reviewerNotes && (
                  <p className="mt-2 text-[11px] text-slate-500">Reviewer notes: {c.reviewerNotes}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'verified', label: 'Verify', cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
                      { id: 'needs_update', label: 'Request update', cls: 'bg-amber-500 hover:bg-amber-600 text-white' },
                      { id: 'rejected', label: 'Reject', cls: 'bg-rose-600 hover:bg-rose-700 text-white' },
                    ] as const
                  ).map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={busyId === c._id}
                      onClick={() => decide(c._id, action.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 ${action.cls}`}
                    >
                      {busyId === c._id ? 'Saving…' : action.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const AuditPanel: React.FC = () => {
  const { data, error, loading, reload } = useAsync<any>(() => api.get('/audit-logs?limit=50'), []);

  if (loading) return <PanelLoading label="Loading audit trail…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const rows: any[] = data?.data || [];
  if (rows.length === 0) {
    return (
      <PanelEmpty
        title="No audit events recorded"
        hint="Privileged actions such as record access, dispensing and verification decisions are written here."
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((log) => (
        <li key={log._id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-800">{String(log.action).replace(/_/g, ' ')}</p>
              <p className="text-[11px] text-slate-500">
                {log.actorId?.name || log.actorEmail || 'system'} · {String(log.actorRole || '').replace(/_/g, ' ')}
                {log.targetType ? ` · ${log.targetType}` : ''}
              </p>
            </div>
            <span className="text-[11px] text-slate-400">{formatDateTime(log.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
};

const AnalyticsPanel: React.FC = () => {
  const { data, error, loading, reload } = useAsync<any>(() => api.get('/analytics/public-health'), []);

  if (loading) return <PanelLoading label="Loading aggregate health metrics…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const d = data?.data;
  if (!d) return <PanelEmpty title="No aggregate data available" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Hospitals" value={d.facilities.hospitals} />
        <StatCard label="Clinics" value={d.facilities.clinics} />
        <StatCard label="Pharmacies" value={d.facilities.pharmacies} />
        <StatCard label="Diagnostic labs" value={d.facilities.diagnosticLabs} />
        <StatCard label="Registered doctors" value={d.facilities.registeredDoctors} />
        <StatCard label="Registered patients" value={d.facilities.registeredPatients} />
        <StatCard
          label="Bed occupancy"
          value={`${d.beds.occupancyRatePercentage}%`}
          hint={`${d.beds.totalAvailable} of ${d.beds.totalCapacity} available`}
          tone={d.beds.occupancyRatePercentage >= 90 ? 'bad' : d.beds.occupancyRatePercentage >= 75 ? 'warn' : 'good'}
        />
        <StatCard
          label="ICU occupancy"
          value={`${d.beds.icuOccupancyRatePercentage}%`}
          hint={`${d.beds.icuAvailable} of ${d.beds.icuCapacity} available`}
          tone={d.beds.icuOccupancyRatePercentage >= 90 ? 'bad' : d.beds.icuOccupancyRatePercentage >= 75 ? 'warn' : 'good'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total bookings" value={d.appointments.totalBookings} />
        <StatCard label="Completed" value={d.appointments.completed} tone="good" />
        <StatCard label="Cancelled" value={d.appointments.cancelled} tone={d.appointments.cancelled > 0 ? 'warn' : 'default'} />
      </div>

      {d.notice && <p className="text-[11px] text-slate-500">{d.notice}</p>}
    </div>
  );
};

const CONSENT_CATEGORIES = ['vitals', 'activity', 'sleep', 'prescriptions', 'records'] as const;

const ConsentPanel: React.FC = () => {
  const consents = useAsync<any>(() => api.get('/consent/my-consents'), []);
  const doctors = useAsync<any>(() => api.get('/consent/available-doctors'), []);
  const [clinicianId, setClinicianId] = useState('');
  const [categories, setCategories] = useState<string[]>(['vitals']);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggle = (c: string) =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const grant = async () => {
    if (!clinicianId) {
      setActionError('Select a clinician to grant consent to.');
      return;
    }
    if (categories.length === 0) {
      setActionError('Select at least one data category.');
      return;
    }
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      await api.post('/consent/grant', { clinicianId, categories });
      setNotice('Consent granted. The clinician can now view only the categories you selected.');
      consents.reload();
    } catch (err: any) {
      setActionError(err?.message || 'Consent could not be granted.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (consentId: string) => {
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      await api.post('/consent/revoke', { consentId });
      setNotice('Consent revoked. Clinician access to those metrics has been terminated.');
      consents.reload();
    } catch (err: any) {
      setActionError(err?.message || 'Consent could not be revoked.');
    } finally {
      setBusy(false);
    }
  };

  const doctorList: any[] = doctors.data?.data || [];
  const rows: any[] = consents.data?.data || [];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-800">Grant health-data consent</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Consent is scoped to one clinician and to the exact categories you tick. Clinicians cannot read categories you
          leave unticked, even if they share your hospital.
        </p>

        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Clinician</span>
            <select
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
            >
              <option value="">
                {doctors.loading ? 'Loading verified clinicians…' : doctorList.length === 0 ? 'No verified clinicians listed' : 'Select a clinician'}
              </option>
              {doctorList.map((doc) => (
                <option key={doc._id} value={doc.userId?._id || ''}>
                  {doc.userId?.name || 'Clinician'} — {doc.specialty}
                  {doc.organizationId?.name ? ` (${doc.organizationId.name})` : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-3">
            {CONSENT_CATEGORIES.map((c) => (
              <label key={c} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <input type="checkbox" checked={categories.includes(c)} onChange={() => toggle(c)} />
                {c}
              </label>
            ))}
          </div>

          {actionError && <PanelError message={actionError} />}
          {notice && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[11px] font-semibold text-emerald-800">
              {notice}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={grant}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Grant consent'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-800">Consents you have granted</h3>
        {consents.loading && <PanelLoading label="Loading consents…" />}
        {consents.error && <PanelError message={consents.error} onRetry={consents.reload} />}
        {!consents.loading && !consents.error && rows.length === 0 && (
          <PanelEmpty
            title="You have not granted any consent"
            hint="No clinician can read your health metrics or records until you grant consent here."
          />
        )}

        <ul className="mt-2 space-y-2.5">
          {rows.map((c) => (
            <li
              key={c._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3.5"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {c.clinicianId?.name || c.organizationId?.name || 'Unknown recipient'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {(c.categories || []).join(', ')} · granted {formatDate(c.grantedAt)}
                  {c.expiresAt ? ` · expires ${formatDate(c.expiresAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill value={c.status} tone={toneForStatus(c.status)} />
                {c.status === 'active' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => revoke(c._id)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const WearablesPanel: React.FC = () => {
  const status = useAsync<any>(() => api.get('/wearables/status'), []);
  const summary = useAsync<any>(() => api.get('/wearables/summary'), []);
  const [pairing, setPairing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const generatePairingToken = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res: any = await api.post('/wearables/companion-token', { platform: 'health_connect' });
      setPairing(res.pairingToken);
    } catch (err: any) {
      setActionError(err?.message || 'A pairing token could not be generated.');
    } finally {
      setBusy(false);
    }
  };

  if (status.loading) return <PanelLoading label="Loading device status…" />;
  if (status.error) return <PanelError message={status.error} onRetry={status.reload} />;

  const platformConfig = status.data?.platformConfig || {};
  const connections = status.data?.connections || {};
  const summaryData = summary.data?.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(platformConfig).map(([key, cfg]: [string, any]) => (
          <div key={key} className="rounded-xl border border-slate-200 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold capitalize text-slate-900">{key.replace(/([A-Z])/g, ' $1')}</p>
              {cfg.configured ? (
                <StatusPill value="configured" tone="good" />
              ) : (
                <StatusPill value="not configured" tone="warn" />
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Supported metrics: {(cfg.supportedMetrics || []).join(', ') || '—'}
            </p>
            {connections[key] && (
              <p className="mt-1 text-[11px] text-slate-500">
                {connections[key].deviceName || 'device'} · last sync {formatDateTime(connections[key].lastSyncAt)}
                {connections[key].isStale ? ' (stale)' : ''}
              </p>
            )}
            {!cfg.configured && (
              <p className="mt-1 text-[11px] text-amber-700">
                Live vendor authorization is unavailable until server credentials are supplied.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-800">Companion app pairing</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Generate a pairing token and pass it from your Android or iOS companion app to{' '}
          <code className="text-[10px]">POST /api/v1/wearables/sync</code>. Tokens are stored against your account.
        </p>
        {actionError && <div className="mt-2"><PanelError message={actionError} /></div>}
        <button
          type="button"
          disabled={busy}
          onClick={generatePairingToken}
          className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Generate pairing token'}
        </button>
        {pairing && (
          <p className="mt-2 break-all rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] font-mono text-slate-700">
            {pairing}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold text-slate-800">Today's ingested metrics</h3>
        {summary.loading && <PanelLoading label="Loading today's summary…" />}
        {summary.error && <div className="mt-2"><PanelError message={summary.error} onRetry={summary.reload} /></div>}
        {!summary.loading && !summary.error && !summaryData && (
          <p className="mt-2 text-[11px] text-slate-500">
            No samples have been ingested for today. Nothing is displayed until a real device or companion app syncs.
          </p>
        )}
        {summaryData && (
          <dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { k: 'Resting heart rate', v: summaryData.restingHeartRate ? `${summaryData.restingHeartRate} bpm` : '—' },
              { k: 'Heart rate range', v: summaryData.minHeartRate ? `${summaryData.minHeartRate}–${summaryData.maxHeartRate} bpm` : '—' },
              { k: 'Steps', v: summaryData.totalSteps ?? '—' },
              { k: 'Sleep', v: summaryData.sleepMinutes ? `${summaryData.sleepMinutes} min` : '—' },
              { k: 'SpO₂', v: summaryData.avgSpo2 ? `${summaryData.avgSpo2}%` : '—' },
              { k: 'Last updated', v: formatDateTime(summaryData.lastUpdatedAt) },
            ].map((row) => (
              <div key={row.k}>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{row.k}</dt>
                <dd className="text-slate-800 tabular-nums">{row.v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
};

const IntegrationsPanel: React.FC = () => {
  const { data, error, loading, reload } = useAsync<any>(() => api.get('/integrations'), []);

  if (loading) return <PanelLoading label="Loading integration status…" />;
  if (error) return <PanelError message={error} onRetry={reload} />;

  const integrations = data?.data?.integrations || {};
  const flat: { key: string; label: string; cfg: any }[] = [];
  Object.entries(integrations).forEach(([group, value]: [string, any]) => {
    if (value && typeof value === 'object' && 'configured' in value) {
      flat.push({ key: group, label: group, cfg: value });
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([sub, subCfg]: [string, any]) => {
        if (subCfg && typeof subCfg === 'object' && 'configured' in subCfg) {
          flat.push({ key: `${group}.${sub}`, label: `${group} · ${sub}`, cfg: subCfg });
        }
      });
    }
  });

  if (flat.length === 0) return <PanelEmpty title="No integration status reported" />;

  return (
    <ul className="divide-y divide-slate-100">
      {flat.map((row) => (
        <li key={row.key} className="flex flex-wrap items-start justify-between gap-2 py-3">
          <div>
            <p className="text-sm font-bold capitalize text-slate-900">{row.label.replace(/_/g, ' ')}</p>
            {row.cfg.requires && <p className="text-[11px] text-slate-500">{row.cfg.requires}</p>}
            {row.cfg.provider && <p className="text-[11px] text-slate-400">provider: {row.cfg.provider}</p>}
          </div>
          {row.cfg.configured ? (
            <StatusPill value="configured" tone="good" />
          ) : (
            <StatusPill value="not configured" tone="warn" />
          )}
        </li>
      ))}
    </ul>
  );
};

const ProfilePanel: React.FC = () => {
  const { user, workspaces } = useAuth();

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {[
          { k: 'Name', v: user?.name },
          { k: 'Email', v: user?.email },
          { k: 'Phone', v: user?.phone },
          { k: 'Role', v: String(user?.role || '').replace(/_/g, ' ') },
          { k: 'Language', v: user?.preferredLanguage === 'hi' ? 'Hindi' : 'English' },
          { k: 'Email verified', v: user?.isEmailVerified ? 'Yes' : 'No' },
        ].map((row) => (
          <div key={row.k}>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{row.k}</dt>
            <dd className="text-slate-800">{row.v || '—'}</dd>
          </div>
        ))}
      </dl>

      {workspaces.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Affiliations</h3>
          <ul className="mt-2 space-y-2">
            {workspaces.map((w) => (
              <li
                key={w.organizationId}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{w.organizationName}</p>
                  <p className="text-[11px] text-slate-500">
                    {String(w.organizationType).replace(/_/g, ' ')} · {String(w.role).replace(/_/g, ' ')}
                  </p>
                </div>
                {user?.activeWorkspaceId === w.organizationId && <StatusPill value="active" tone="good" />}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Some profile fields are read-only in the demo tenant. Contact a platform administrator to change them.
      </p>
    </div>
  );
};

const OverviewPanel: React.FC<{ nav: { id: PanelId }[]; organizationId?: string | null }> = ({
  nav,
  organizationId,
}) => {
  const has = (id: PanelId) => nav.some((n) => n.id === id);
  const bedQuery = organizationId ? `?organizationId=${organizationId}` : '';
  const date = todayIso();

  const beds = useAsync<any>(() => (has('beds') ? api.get(`/beds${bedQuery}`) : Promise.resolve(null)), [bedQuery]);
  const appts = useAsync<any>(
    () => (has('appointments') ? api.get(`/appointments?date=${date}`) : Promise.resolve(null)),
    [date]
  );
  const labs = useAsync<any>(() => (has('lab-orders') ? api.get('/lab-orders') : Promise.resolve(null)), []);
  const tickets = useAsync<any>(() => (has('tickets') ? api.get('/support') : Promise.resolve(null)), []);
  const team = useAsync<any>(
    () =>
      has('team') && organizationId
        ? api.get(`/organizations/${organizationId}/members`)
        : Promise.resolve(null),
    [organizationId]
  );
  const prescriptions = useAsync<any>(
    () => (has('prescriptions') ? api.get('/prescriptions') : Promise.resolve(null)),
    []
  );
  const inventory = useAsync<any>(() => (has('inventory') ? api.get('/inventory') : Promise.resolve(null)), []);
  const verification = useAsync<any>(
    () => (has('verification') ? api.get('/verification/queue') : Promise.resolve(null)),
    []
  );

  const bedRows: any[] = beds.data?.data || [];
  const bedTotals = useMemo(
    () =>
      bedRows.reduce(
        (acc, b) => ({ available: acc.available + (b.available || 0), total: acc.total + (b.totalCapacity || 0) }),
        { available: 0, total: 0 }
      ),
    [bedRows]
  );

  const cards: React.ReactNode[] = [];

  if (has('beds')) {
    cards.push(
      <StatCard
        key="beds"
        label="Beds available"
        value={beds.loading ? '…' : `${bedTotals.available}/${bedTotals.total}`}
        hint={beds.error ? 'Unavailable' : `${bedRows.length} ward records`}
        tone={beds.error ? 'bad' : 'good'}
        icon={<BedDouble className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      />
    );
  }

  if (has('appointments')) {
    const rows: any[] = appts.data?.data || [];
    cards.push(
      <StatCard
        key="appts"
        label="Appointments today"
        value={appts.loading ? '…' : rows.length}
        hint={appts.error ? 'Unavailable' : date}
        icon={<CalendarDays className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      />
    );
  }

  if (has('lab-orders')) {
    const rows: any[] = labs.data?.data || [];
    const pending = rows.filter((o) => o.sampleStatus !== 'completed').length;
    cards.push(
      <StatCard
        key="labs"
        label="Open lab orders"
        value={labs.loading ? '…' : pending}
        hint={labs.error ? 'Unavailable' : `${rows.length} total in scope`}
        tone={pending > 0 ? 'warn' : 'default'}
        icon={<FlaskConical className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      />
    );
  }

  if (has('tickets')) {
    const rows: any[] = tickets.data?.data || [];
    const open = rows.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
    cards.push(
      <StatCard
        key="tickets"
        label="Open tickets"
        value={tickets.loading ? '…' : open}
        hint={tickets.error ? 'Unavailable' : `${rows.length} total`}
        tone={open > 0 ? 'warn' : 'good'}
        icon={<LifeBuoy className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      />
    );
  }

  if (has('team')) {
    const rows: any[] = team.data?.data || [];
    cards.push(
      <StatCard
        key="team"
        label="Team members"
        value={team.loading ? '…' : rows.length}
        hint={team.error ? 'Unavailable' : 'In this organisation'}
        icon={<Users className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      />
    );
  }

  if (has('prescriptions')) {
    const rows: any[] = prescriptions.data?.data || [];
    const pending = rows.filter((r) => r.status === 'active').length;
    cards.push(
      <StatCard
        key="rx"
        label="Active prescriptions"
        value={prescriptions.loading ? '…' : pending}
        hint={prescriptions.error ? 'Unavailable' : `${rows.length} in scope`}
        icon={<Pill className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      />
    );
  }

  if (has('inventory')) {
    const alerts = inventory.data?.alerts;
    cards.push(
      <StatCard
        key="inv"
        label="Stock alerts"
        value={inventory.loading ? '…' : alerts ? alerts.lowStockCount + alerts.expiredCount : '—'}
        hint={inventory.error ? 'Unavailable' : 'Low stock + expired batches'}
        tone={alerts && alerts.expiredCount > 0 ? 'bad' : alerts && alerts.lowStockCount > 0 ? 'warn' : 'good'}
        icon={<Package className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      />
    );
  }

  if (has('verification')) {
    const rows: any[] = verification.data?.data || [];
    const pending = rows.filter((c) => c.status === 'pending' || c.status === 'in_review').length;
    cards.push(
      <StatCard
        key="verify"
        label="Cases awaiting review"
        value={verification.loading ? '…' : pending}
        hint={verification.error ? 'Unavailable' : `${rows.length} total cases`}
        tone={pending > 0 ? 'warn' : 'good'}
        icon={<ShieldCheck className="w-4 h-4 text-slate-400" aria-hidden="true" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {cards.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards}</div>
      ) : (
        <PanelEmpty title="No metrics for this role" hint="Use the panels in the sidebar to work in this workspace." />
      )}

      {errorsOf([beds.error, appts.error, labs.error, tickets.error, team.error]).map((message) => (
        <PanelError key={message} message={message} />
      ))}
    </div>
  );
};

function errorsOf(list: (string | null)[]): string[] {
  return list.filter((e): e is string => !!e);
}

export const RoleWorkspacePage: React.FC = () => {
  const { user, activeWorkspace } = useAuth();
  const def = getRoleDefinition(user?.role);
  const [panel, setPanel] = useState<PanelId>('overview');

  const organizationId = activeWorkspace?.organizationId || user?.activeWorkspaceId || null;
  const activePanel = useMemo(() => (def?.nav.some((n) => n.id === panel) ? panel : 'overview'), [def, panel]);

  if (!def) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <NotConfigured
          label="Workspace"
          detail="This account's role is not mapped to a workspace console. Ask a platform administrator to review the role assignment."
        />
      </div>
    );
  }

  const body = (() => {
    switch (activePanel) {
      case 'beds':
        return <BedsPanel organizationId={organizationId} />;
      case 'appointments':
        return <AppointmentsPanel date={todayIso()} />;
      case 'records':
        return <RecordsPanel />;
      case 'prescriptions':
        return <PrescriptionsPanel />;
      case 'patients':
        return <PatientsPanel />;
      case 'inventory':
        return <InventoryPanel />;
      case 'verification':
        return <VerificationPanel />;
      case 'audit':
        return <AuditPanel />;
      case 'analytics':
        return <AnalyticsPanel />;
      case 'wearables':
        return <WearablesPanel />;
      case 'consent':
        return <ConsentPanel />;
      case 'integrations':
        return <IntegrationsPanel />;
      case 'lab-orders':
        return <LabOrdersPanel organizationId={organizationId} />;
      case 'tickets':
        return <TicketsPanel />;
      case 'team':
        return <TeamPanel organizationId={organizationId} />;
      case 'organization':
        return <OrganizationPanel organizationId={organizationId} />;
      case 'discovery':
        return <DiscoveryPanel />;
      case 'profile':
        return <ProfilePanel />;
      case 'overview':
        return <OverviewPanel nav={def.nav} organizationId={organizationId} />;
      default:
        return (
          <NotConfigured
            label={def.nav.find((n) => n.id === activePanel)?.label || 'Panel'}
            detail="This panel is served by a dedicated console for other roles and is not available in the shared workspace."
          />
        );
    }
  })();

  const activeNav = def.nav.find((n) => n.id === activePanel);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{def.label} console</h1>
            <p className="mt-1 text-xs text-slate-600 max-w-2xl">{def.summary}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-xs text-slate-500">
              Signed in as <strong className="text-slate-700">{user?.name}</strong>
            </span>
            <WorkspaceSelect />
          </div>
        </div>
      </header>

      <nav
        className="mb-5 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3"
        aria-label={`${def.label} sections`}
      >
        {def.nav.map((item) => {
          const isActive = item.id === activePanel;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPanel(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <Panel title={activeNav?.label} description={def.summary}>
        {body}
      </Panel>
    </div>
  );
};

export default RoleWorkspacePage;

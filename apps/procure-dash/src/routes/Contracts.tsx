import { useMemo, useState } from 'react';
import { contracts } from '../data/contracts';
import { formatDate, formatEur } from '../data/format';
import { supplierById } from '../data/suppliers';
import { useDemoState } from '../hooks';
import {
  Button,
  DataCell,
  DataCellMuted,
  DataRow,
  DataTable,
  DataToolbar,
  Drawer,
  EmptyState,
  ErrorState,
  SearchInput,
  Skeleton,
  StatusBadge,
  Tabs,
} from '../ui';
import type { Contract } from '../data/types';

const TAB_DEFS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'renewal', label: 'Renewal window' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
];

export function Contracts() {
  const demoState = useDemoState();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Contract | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (tab !== 'all' && contract.state !== tab) return false;
      if (normalized && !contract.title.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [tab, query]);

  const tabs = TAB_DEFS.map((definition) => ({
    ...definition,
    count: definition.value === 'all' ? contracts.length : contracts.filter((contract) => contract.state === definition.value).length,
  }));

  if (demoState === 'loading') {
    return <Skeleton rows={7} />;
  }

  if (demoState === 'error') {
    return <ErrorState title="Contract engine unavailable" detail="Extraction service is offline. Terms shown may be stale until the next sync." onRetry={() => window.location.reload()} />;
  }

  const selectedSupplier = selected ? supplierById(selected.supplierId) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Contracts</h1>
          <p className="mt-1 text-sm text-text-muted">Renewal windows, notice periods, and extracted commercial terms.</p>
        </div>
        <Button variant="secondary">Sync from CLM</Button>
      </div>

      <DataToolbar>
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
        <SearchInput value={query} onChange={setQuery} placeholder="Search contracts" className="w-full max-w-xs" />
      </DataToolbar>

      {filtered.length === 0 ? (
        <EmptyState title="No contracts in this view" detail="Switch to another tab or clear the search to see all contracts in the portfolio." />
      ) : (
        <DataTable
          columns={[
            { id: 'contract', label: 'Contract' },
            { id: 'supplier', label: 'Supplier' },
            { id: 'value', label: 'Annual value', align: 'right' },
            { id: 'renewal', label: 'Renewal' },
            { id: 'notice', label: 'Notice', align: 'right' },
            { id: 'state', label: 'State' },
          ]}
        >
          {filtered.map((contract) => (
            <DataRow key={contract.id} onClick={() => setSelected(contract)}>
              <DataCell>
                <span className="block font-medium">{contract.title}</span>
                <span className="block text-xs text-text-muted">{contract.id} · {contract.category}</span>
              </DataCell>
              <DataCellMuted>{supplierById(contract.supplierId)?.name ?? contract.supplierId}</DataCellMuted>
              <DataCell align="right">{formatEur(contract.annualValueEur)}</DataCell>
              <DataCellMuted>{formatDate(contract.renewalDate)}</DataCellMuted>
              <DataCell align="right">{contract.noticeDays} days</DataCell>
              <DataCell>
                <StatusBadge state={contract.state} />
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      )}

      <Drawer
        open={selected !== null}
        title={selected?.title ?? ''}
        subtitle={selectedSupplier ? `${selectedSupplier.name} · ${selected?.category ?? ''}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border bg-surface-raised p-3">
                <dt className="text-xs text-text-muted">Annual value</dt>
                <dd className="mt-1 font-medium tabular-nums">{formatEur(selected.annualValueEur)}</dd>
              </div>
              <div className="rounded-md border border-border bg-surface-raised p-3">
                <dt className="text-xs text-text-muted">Renewal date</dt>
                <dd className="mt-1 font-medium">{formatDate(selected.renewalDate)}</dd>
              </div>
              <div className="rounded-md border border-border bg-surface-raised p-3">
                <dt className="text-xs text-text-muted">Notice period</dt>
                <dd className="mt-1 font-medium">{selected.noticeDays} days</dd>
              </div>
              <div className="rounded-md border border-border bg-surface-raised p-3">
                <dt className="text-xs text-text-muted">Owner</dt>
                <dd className="mt-1 font-medium">{selected.owner}</dd>
              </div>
            </dl>
            <div>
              <h3 className="text-sm font-medium">Extracted terms</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {selected.terms.map((term) => (
                  <li key={term} className="rounded-md border border-border px-3 py-2 text-sm text-text-muted">
                    {term}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <Button>Open playbook</Button>
              <Button variant="secondary">Mark for renewal</Button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { formatEur, formatEurCompact } from '../data/format';
import { suppliers } from '../data/suppliers';
import { useDemoState } from '../hooks';
import { SupplierRiskNote } from '../legacy/SupplierRiskNote';
import {
  Button,
  DataCell,
  DataCellMuted,
  DataRow,
  DataTable,
  DataToolbar,
  EmptyState,
  ErrorState,
  Pagination,
  RiskBadge,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  SupplierMark,
} from '../ui';

const PAGE_SIZE = 10;

export function Suppliers() {
  const demoState = useDemoState();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (normalized && !supplier.name.toLowerCase().includes(normalized)) return false;
      if (category !== 'all' && supplier.category !== category) return false;
      if (risk !== 'all' && supplier.risk !== risk) return false;
      return true;
    });
  }, [query, category, risk]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const categories = [...new Set(suppliers.map((supplier) => supplier.category))].sort();

  if (demoState === 'loading') {
    return <Skeleton rows={8} />;
  }

  if (demoState === 'error') {
    return <ErrorState title="Supplier directory unavailable" detail="Master data service is not responding. Retry or continue with the cached directory." onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Suppliers</h1>
          <p className="mt-1 text-sm text-text-muted">{filtered.length} of {suppliers.length} suppliers in the active portfolio.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary">Import list</Button>
          <Button>Add supplier</Button>
        </div>
      </div>

      <DataToolbar>
        <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search suppliers" className="w-full max-w-xs" />
        <Select
          label="Category"
          value={category}
          onChange={(value) => { setCategory(value); setPage(1); }}
          options={[{ value: 'all', label: 'All categories' }, ...categories.map((entry) => ({ value: entry, label: entry }))]}
        />
        <Select
          label="Risk"
          value={risk}
          onChange={(value) => { setRisk(value); setPage(1); }}
          options={[
            { value: 'all', label: 'All levels' },
            { value: 'healthy', label: 'Healthy' },
            { value: 'watch', label: 'Watch' },
            { value: 'critical', label: 'Critical' },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setCategory('all'); setRisk('all'); setPage(1); }}>
          Clear filters
        </Button>
      </DataToolbar>

      {pageRows.length === 0 ? (
        <EmptyState title="No suppliers match these filters" detail="Adjust the search term or clear the category and risk filters to see the full portfolio." />
      ) : (
        <DataTable
          columns={[
            { id: 'supplier', label: 'Supplier' },
            { id: 'category', label: 'Category' },
            { id: 'country', label: 'Country' },
            { id: 'spend', label: 'Annual spend', align: 'right' },
            { id: 'savings', label: 'Savings identified', align: 'right' },
            { id: 'risk', label: 'Risk' },
            { id: 'contract', label: 'Contract' },
          ]}
        >
          {pageRows.map((supplier) => (
            <DataRow key={supplier.id}>
              <DataCell>
                <span className="flex items-center gap-3">
                  <SupplierMark name={supplier.name} category={supplier.category} />
                  <span>
                    <span className="block font-medium">{supplier.name}</span>
                    <span className="block text-xs text-text-muted">{supplier.owner}</span>
                  </span>
                </span>
              </DataCell>
              <DataCellMuted>{supplier.category}</DataCellMuted>
              <DataCellMuted>{supplier.country}</DataCellMuted>
              <DataCell align="right">{formatEur(supplier.spendEur)}</DataCell>
              <DataCell align="right">{formatEurCompact(supplier.savingsEur)}</DataCell>
              <DataCell>
                <RiskBadge level={supplier.risk} />
              </DataCell>
              <DataCell>
                <StatusBadge state={supplier.contractState} />
              </DataCell>
            </DataRow>
          ))}
        </DataTable>
      )}

      <Pagination page={page} pageCount={pageCount} onChange={setPage} />

      <SupplierRiskNote
        note="Legacy risk note retained from the 2024 supplier review. Kept for audit traceability."
        owner="Procurement excellence"
      />
    </div>
  );
}

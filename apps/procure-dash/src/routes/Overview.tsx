import { alerts } from '../data/alerts';
import { categories } from '../data/categories';
import { formatEurCompact } from '../data/format';
import { contractTrend, kpis, riskTrend, savingsTrend, spendTrend } from '../data/metrics';
import { suppliers } from '../data/suppliers';
import { useDemoState } from '../hooks';
import {
  AlertBanner,
  Button,
  CategoryBars,
  ChartFrame,
  DataCell,
  DataCellMuted,
  DataRow,
  DataTable,
  DonutChart,
  EmptyState,
  ErrorState,
  RiskMeter,
  Skeleton,
  StatCard,
  SupplierMark,
} from '../ui';

export function Overview() {
  const demoState = useDemoState();

  if (demoState === 'loading') {
    return <Skeleton rows={6} />;
  }

  if (demoState === 'empty') {
    return <EmptyState title="No spend data for FY26 yet" detail="Connect an ERP source or import a spend file to see category and supplier coverage." />;
  }

  if (demoState === 'error') {
    return <ErrorState title="Spend warehouse unavailable" detail="The analytics service did not respond within the timeout window." onRetry={() => window.location.reload()} />;
  }

  const topSuppliers = [...suppliers].sort((left, right) => right.spendEur - left.spendEur).slice(0, 5);
  const riskSplit = [
    { label: 'Healthy', value: suppliers.filter((supplier) => supplier.risk === 'healthy').length, className: 'text-success' },
    { label: 'Watch', value: suppliers.filter((supplier) => supplier.risk === 'watch').length, className: 'text-warning' },
    { label: 'Critical', value: suppliers.filter((supplier) => supplier.risk === 'critical').length, className: 'text-danger' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Procurement overview</h1>
          <p className="mt-1 text-sm text-text-muted">Savings pipeline, spend coverage, and risk posture for the current quarter.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary">Export</Button>
          <Button>New negotiation</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Savings identified" value={formatEurCompact(kpis.savingsIdentifiedEur)} delta="+12.4% vs Q2" trend={savingsTrend} trendTone="success" />
        <StatCard label="Spend under management" value={formatEurCompact(kpis.spendUnderManagementEur)} delta="+2.1% vs Q2" trend={spendTrend} />
        <StatCard label="Contracts expiring in 90 days" value={String(kpis.contractsExpiring90d)} delta="2 without an owner" trend={contractTrend} trendTone="danger" />
        <StatCard label="Suppliers at risk" value={String(kpis.suppliersAtRisk)} delta="1 crossed critical" trend={riskTrend} trendTone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ChartFrame title="Spend by category" meta="FY26 to date, grouped by procurement category">
          <CategoryBars categories={categories} />
        </ChartFrame>
        <ChartFrame title="Supplier risk split" meta={`${suppliers.length} active suppliers`}>
          <DonutChart segments={riskSplit} centerLabel="suppliers" centerValue={String(suppliers.length)} />
        </ChartFrame>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Priority alerts</h2>
          {alerts.map((alert) => (
            <AlertBanner key={alert.id} severity={alert.severity} title={alert.title} detail={alert.detail} age={alert.age} />
          ))}
        </section>
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Top suppliers by spend</h2>
            <Button variant="ghost" size="sm" onClick={() => { window.location.hash = '/suppliers'; }}>
              View all
            </Button>
          </div>
          <DataTable
            columns={[
              { id: 'supplier', label: 'Supplier' },
              { id: 'category', label: 'Category' },
              { id: 'spend', label: 'Spend', align: 'right' },
              { id: 'risk', label: 'Risk' },
            ]}
          >
            {topSuppliers.map((supplier) => (
              <DataRow key={supplier.id}>
                <DataCell>
                  <span className="flex items-center gap-3">
                    <SupplierMark name={supplier.name} category={supplier.category} />
                    <span className="font-medium">{supplier.name}</span>
                  </span>
                </DataCell>
                <DataCellMuted>{supplier.category}</DataCellMuted>
                <DataCell align="right">{formatEurCompact(supplier.spendEur)}</DataCell>
                <DataCell>
                  <RiskMeter score={supplier.riskScore} level={supplier.risk} />
                </DataCell>
              </DataRow>
            ))}
          </DataTable>
        </section>
      </div>
    </div>
  );
}

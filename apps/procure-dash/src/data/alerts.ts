import type { Alert } from './types';

export const alerts: Alert[] = [
  {
    id: 'alert-steel-index',
    severity: 'warning',
    title: 'Steel HRC index dropped 12% since the last contract review',
    detail: '14 contracts reference the HRC index. Renegotiation window opens in 28 days.',
    age: '2h ago',
  },
  {
    id: 'alert-expiring',
    severity: 'warning',
    title: '6 contracts expire within 90 days without a renewal owner',
    detail: 'Assign owners for logistics and MRO contracts before the notice period closes.',
    age: '5h ago',
  },
  {
    id: 'alert-supplier-risk',
    severity: 'danger',
    title: 'Ostwald Stahlwerke risk score crossed the critical threshold',
    detail: 'Payment behavior and credit signals deteriorated over the last two quarters.',
    age: '1d ago',
  },
  {
    id: 'alert-savings',
    severity: 'info',
    title: 'Cost model found a 4.2% gap versus benchmark for steel castings',
    detail: 'Negotiation playbook draft is ready for review.',
    age: '2d ago',
  },
  {
    id: 'alert-cleanup',
    severity: 'info',
    title: 'Spend classification improved for 312 line items',
    detail: 'Category mapping now covers 97% of the FY26 spend under management.',
    age: '4d ago',
  },
];

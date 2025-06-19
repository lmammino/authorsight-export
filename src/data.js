export const DATA_TYPES = [
  {
    type: 'amazon_units_daily',
    endpoint: 'amazon-daily',
    csvFields: ['print_units', 'kindle_units'],
    totalKeys: ['total_print_units', 'total_kindle_units'],
    granularity: 'monthly',
  },
  {
    type: 'direct_units_daily',
    endpoint: 'direct-daily',
    csvFields: ['print_units', 'digital_units'],
    totalKeys: ['total_print_units', 'total_digital_units'],
    granularity: 'monthly',
  },
  {
    type: 'revenue_monthly',
    endpoint: 'monthly',
    csvFields: ['Amazon', 'Direct', 'Other'],
    totalKeys: [], // not used
    granularity: 'yearly',
  },
  {
    type: 'revenue_quarterly',
    endpoint: 'quarterly',
    csvFields: ['Amazon', 'Direct', 'Other'],
    totalKeys: [], // not used
    granularity: 'yearly',
  },
]

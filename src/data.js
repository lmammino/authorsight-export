export const DATA_TYPES = [
  {
    type: 'amazon_daily',
    endpoint: 'amazon-daily',
    csvFields: ['print_units', 'kindle_units'],
    totalKeys: ['total_print_units', 'total_kindle_units'],
  },
  {
    type: 'direct_daily',
    endpoint: 'direct-daily',
    csvFields: ['print_units', 'digital_units'],
    totalKeys: ['total_print_units', 'total_digital_units'],
  },
]

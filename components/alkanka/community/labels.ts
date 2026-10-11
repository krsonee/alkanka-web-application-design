export const COMPLAINT_STATUS = {
  open: { label: 'İnceleniyor', className: 'bg-secondary text-secondary-foreground' },
  forwarded: { label: 'Siteye iletildi', className: 'bg-primary/15 text-primary' },
  resolved: { label: 'Çözüldü', className: 'bg-primary text-primary-foreground' },
  rejected: { label: 'Reddedildi', className: 'bg-destructive/15 text-destructive' },
} as const

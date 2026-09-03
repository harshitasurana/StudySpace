export const regionalDefaults = {
  timezone: "UTC",
  date_format: "MM/DD/YYYY",
  time_format: "12h",
  currency: "USD",
  number_locale: "en-US", // ✅ ADD THIS
  first_day_of_week: "sunday",
};

export const brandingDefaults = {
  logo_url: '',
  favicon_url: '',
  primary_color: '#007bff',
  secondary_color: '#6c757d',
  theme_mode: 'light',
  font_family: 'Arial, sans-serif',
  email_header_text: 'Welcome',
  email_footer_text: 'Best regards, the team'
};

export const securityDefaults = {
  password_expiry_days: 90,
  min_password_length: 8,
  require_uppercase: true,
  require_number: true,
  require_special_character: true,
  enable_2fa: false,
  session_timeout: 3600,
  max_login_attempts: 5,
  enable_account_lockout: true,
  lockout_duration_minutes: 15,
  encrypt_sensitive_data: true,
  enable_audit_logs: true,
  log_retention_period: 30
};

export const systemDefaults = {
  maintenance_mode: false,
  backup_frequency: 'daily',
  backup_retention_days: 30,
  last_backup_at: null
};

// ==========================================
// Module 2: Notification Settings Defaults
// ==========================================
export const notificationDefaults = {
  email_enabled: true,
  sms_enabled: false,
  push_enabled: true,
  in_app_enabled: true,
  email_provider: 'smtp',
  email_host: '',
  email_port: 587,
  email_username: '',
  email_password: '',
  email_from_address: '',
  email_from_name: '',
  email_use_tls: true,
  sms_provider: 'twilio',
  sms_api_key: '',
  sms_api_secret: '',
  sms_from_number: '',
  notify_billing_invoice: true,
  notify_system_maintenance: true,
  notify_security_alerts: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
};

export const notificationTemplateDefaults = [
  { template_key: 'billing_invoice', template_name: 'Billing Invoice', channel: 'email', subject: 'Invoice #{{invoice_number}}', body: 'Dear {{customer_name}},\n\nPlease find your invoice #{{invoice_number}} for {{amount}}.\n\nDue date: {{due_date}}\n\nBest regards,\nThe team' },
  { template_key: 'security_alert', template_name: 'Security Alert', channel: 'email', subject: 'Security Alert', body: 'Dear {{user_name}},\n\nA new login was detected from {{ip_address}} at {{login_time}}.\n\nIf this was not you, please change your password immediately.\n\nBest regards,\nThe team' },
];

// ==========================================
// Module 3: Working Hours Defaults
// ==========================================
const daySchedule = { enabled: true, open: '09:00', close: '17:00', breaks: [{ start: '12:00', end: '13:00' }] };
const weekendOff = { enabled: false, open: null, close: null, breaks: [] };

export const workingHoursDefaults = {
  monday: { ...daySchedule },
  tuesday: { ...daySchedule },
  wednesday: { ...daySchedule },
  thursday: { ...daySchedule },
  friday: { ...daySchedule },
  saturday: { ...weekendOff },
  sunday: { ...weekendOff },
  slot_duration: 30,
  buffer_time: 10,
  allow_same_day_booking: true,
  advance_booking_days: 30,
  min_booking_notice: 2,
  timezone: 'UTC',
};

// ==========================================
// Module 4: Integration Defaults
// ==========================================
export const integrationDefaults = [
  {
    integration_key: 'email_smtp',
    display_name: 'Email (SMTP)',
    category: 'messaging',
    description: 'Send emails via SMTP server',
    config: { host: '', port: 587, username: '', password: '', use_tls: true },
  },
  {
    integration_key: 'sms_twilio',
    display_name: 'Twilio SMS',
    category: 'messaging',
    description: 'Send SMS messages via Twilio',
    config: { account_sid: '', auth_token: '', from_number: '' },
  },
  {
    integration_key: 'payment_stripe',
    display_name: 'Stripe',
    category: 'payment',
    description: 'Process payments via Stripe',
    config: { publishable_key: '', secret_key: '', webhook_secret: '' },
  },
  {
    integration_key: 'google_analytics',
    display_name: 'Google Analytics',
    category: 'analytics',
    description: 'Track website analytics',
    config: { tracking_id: '' },
  },
];

// Shared branded shell for every transactional email this file sends.
const wrapBrandedEmail = (bodyHtml) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F7F2;padding:32px 0;font-family:Inter,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#283593;padding:28px 32px;">
            <span style="font-family:Inter,Arial,sans-serif;font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:0.5px;">EduAI</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background-color:#F8F7F2;">
            <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:12px;color:#3B82C4;">You're receiving this because of activity on your EduAI account. If this wasn't you, contact support.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

export const accountCreatedTemplate = (name) => wrapBrandedEmail(`
  <h1 style="margin:0 0 16px;font-family:Inter,Arial,sans-serif;font-size:22px;color:#172033;">Welcome, ${name}! 🎉</h1>
  <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#172033;">Your EduAI account has been created successfully. Log in any time to get started.</p>
`);

export const accountStatusChangedTemplate = (status) => wrapBrandedEmail(`
  <h1 style="margin:0 0 16px;font-family:Inter,Arial,sans-serif;font-size:22px;color:#172033;">Account Status Updated</h1>
  <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#172033;">Your account has been <strong>${status}</strong>.</p>
`);

// Merge-field templates for emails whose subject/body vary per send
// (password reset links, role-specific welcome copy). Plain JS constants,
// not admin-editable.
const MERGE_FIELD_TEMPLATES = {
  student_welcome: {
    subject: "Welcome to EduAI, {{first_name}}!",
    body_html:
      "<p>Welcome, {{first_name}}! Your EduAI account is ready.</p><p>Your Student Code: <strong>{{student_code}}</strong></p>",
  },
  forgot_password: {
    subject: "Password Reset Request",
    body_html:
      "<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href=\"{{reset_link}}\">Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p>",
  },
};

// A placeholder with no matching variable is left as-is rather than
// replaced with "undefined", so a template referencing an irrelevant
// variable fails visibly instead of silently corrupting real mail.
const renderTemplateString = (str, variables) =>
  str.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in variables ? String(variables[key]) : match));

export const renderEmailTemplate = (templateKey, variables = {}) => {
  const source = MERGE_FIELD_TEMPLATES[templateKey];
  if (!source) throw new Error(`No email template configured for "${templateKey}"`);

  return {
    subject: renderTemplateString(source.subject, variables),
    body_html: renderTemplateString(source.body_html, variables),
  };
};


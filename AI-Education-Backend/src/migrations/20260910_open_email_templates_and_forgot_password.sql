-- Turns Email Templates from a closed, edit-only set of exactly 2 rows
-- (see 20260908_add_education_email_templates.sql's own comment: "no
-- create/delete needed, only edit, so template_key is locked down by the
-- CHECK constraint") into a real, admin-extensible system: any
-- transactional email can get its own admin-editable template, not just
-- student_welcome/parent_welcome.
--
-- Seeds a first real example — forgot_password — wired up in the same
-- commit (see user_service.js's forgotPassword(), previously a hardcoded
-- JS template in emailTemplates.js with no admin control at all).

BEGIN;

ALTER TABLE education_email_templates
  DROP CONSTRAINT education_email_templates_template_key_check;

INSERT INTO education_email_templates (template_key, template_name, subject, body_html) VALUES
(
  'forgot_password',
  'Forgot Password Email',
  'Password Reset Request',
  $HTML$<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F7F2;padding:32px 0;font-family:Inter,Arial,sans-serif;">
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
            <h1 style="margin:0 0 16px;font-family:Inter,Arial,sans-serif;font-size:22px;color:#172033;">Password Reset Request</h1>
            <p style="margin:0 0 20px;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#172033;">Click the button below to reset your password. This link expires in 1 hour.</p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background-color:#283593;">
                  <a href="{{reset_link}}" style="display:inline-block;padding:12px 24px;font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">Reset Password</a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-family:Inter,Arial,sans-serif;font-size:13px;color:#3B82C4;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background-color:#F8F7F2;">
            <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:12px;color:#3B82C4;">You're receiving this because of activity on your EduAI account. If this wasn't you, contact itdesk@myntiqtech.com.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>$HTML$
)
ON CONFLICT (template_key) DO NOTHING;

-- Grant can_create/can_delete on the existing "Email Templates" feature
-- (previously only can_read/can_update — see
-- 20260908b_add_email_templates_feature.sql) so a super admin can now
-- actually create/remove templates, not just edit the fixed set.
UPDATE features
SET permissions = '["can_read","can_create","can_update","can_delete"]'::json
WHERE feature_name = 'Email Templates';

INSERT INTO feature_permissions (role_id, feature_id, permission_name, is_enabled, permission_display_name)
SELECT 1, f.feature_id, perm.name, true, perm.display_name
FROM features f
CROSS JOIN (VALUES
  ('can_create', 'Create'),
  ('can_delete', 'Delete')
) AS perm(name, display_name)
WHERE f.feature_name = 'Email Templates'
ON CONFLICT DO NOTHING;

COMMIT;

import { createClient } from './supabase/client';

interface AuditParams {
  projectId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export async function logAuditEvent({
  projectId,
  userId,
  action,
  entityType,
  entityId,
  metadata = {},
  details,
}: AuditParams) {
  try {
    const supabase = createClient();

    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      effectiveUserId = user?.id || null;
    }

    const payload = details || metadata || {};

    const { error } = await supabase.from('audit_logs').insert({
      project_id: projectId,
      user_id: effectiveUserId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: payload,
    });

    if (error) {
      console.warn('Audit log write warning:', error.message);
    }
  } catch (err) {
    console.warn('Audit log exception:', err);
  }
}

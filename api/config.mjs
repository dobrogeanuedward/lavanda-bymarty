import { configuration, json, requireMethod, sendError } from '../lib/cms.mjs';

export default async function handler(req, res) {
  try {
    requireMethod(req, ['GET']);
    const c = configuration();
    json(res, 200, { configured: c.configured, mediaConfigured: c.configured, analyticsConfigured: c.configured && c.analytics, setupRequired: !c.configured, auth: 'httpOnly-cookie', storage: c.configured ? 'supabase' : null, maxMediaBytes: 3 * 1024 * 1024 });
  } catch (error) { sendError(res, error); }
}

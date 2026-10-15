import { authenticate, configuration, cookies, fail, json, readBody, requireConfiguration, requireMethod, requireOrigin, sendError, setSession, string, upstream } from '../lib/cms.mjs';

export default async function handler(req, res) {
  const config = configuration();
  try {
    requireMethod(req, ['GET','POST']);
    requireConfiguration(config);
    if (req.method === 'GET') {
      const { user, profile } = await authenticate(req, config);
      return json(res, 200, { data: { user, profile } });
    }
    requireOrigin(req, config);
    const input = await readBody(req, 12000);
    if (input.action === 'logout') {
      const token = cookies(req, config).access;
      // Clear this browser even if the upstream is unavailable. A failed revocation is explicit.
      setSession(res, null, config);
      if (token) await upstream(config, '/auth/v1/logout?scope=local', { token, method: 'POST' });
      return json(res, 200, { data: { signedOut: true } });
    }
    if (input.action === 'refresh') {
      const refresh = cookies(req, config).refresh;
      if (!refresh) fail(401, 'AUTH_REQUIRED', 'Accedi per aprire la redazione.');
      const response = await upstream(config, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refresh } });
      const session = await response.json();
      if (!session.access_token || !session.refresh_token) fail(502, 'INVALID_SESSION', 'La sessione non è stata rinnovata.');
      const verifyReq = { headers: { cookie: `${config.secure ? '__Host-lv_' : 'lv_'}access=${encodeURIComponent(session.access_token)}` } };
      const { user, profile } = await authenticate(verifyReq, config);
      setSession(res, session, config);
      return json(res, 200, { data: { refreshed: true, user, profile } });
    }
    if (input.action !== 'login') fail(422, 'INVALID_ACTION', 'Operazione di accesso non riconosciuta.');
    const email = string(input.email, 'email', 254, { required: true });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422, 'INVALID_EMAIL', 'Inserisci un indirizzo email valido.');
    // Do not trim or log passwords.
    if (typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 1024) fail(422, 'INVALID_PASSWORD', 'Inserisci la password.');
    let response;
    try { response = await upstream(config, '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: input.password } }); }
    catch (error) { if ([401,422,502].includes(error.status)) fail(401, 'INVALID_CREDENTIALS', 'Email o password non corrette, oppure account non ancora confermato.'); throw error; }
    const session = await response.json();
    if (!session.access_token || !session.refresh_token) fail(401, 'INVALID_CREDENTIALS', 'Accesso non riuscito.');
    // Verify identity and membership before ever issuing a browser session.
    const verifyReq = { headers: { cookie: `${config.secure ? '__Host-lv_' : 'lv_'}access=${encodeURIComponent(session.access_token)}` } };
    const { user, profile } = await authenticate(verifyReq, config);
    setSession(res, session, config);
    json(res, 200, { data: { user, profile } });
  } catch (error) {
    sendError(res, error);
  }
}

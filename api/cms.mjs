import { RESOURCES, authenticate, authorize, configuration, fail, json, query, readBody, requireMethod, requireOrigin, rows, sendError, uuid, validatePublish, validateResource, version, upstream } from '../lib/cms.mjs';

async function withEditorialNotes(config,entries,token){
 if(!entries.length)return entries;
 const ids=entries.map(e=>uuid(e.id)).join(',');
 const result=await rows(config,'cms_entry_notes',`select=entry_id,body&entry_id=in.(${ids})`,{token});
 const notes=new Map(result.data.map(n=>[n.entry_id,n.body]));
 return entries.map(e=>({...e,editorial_notes:notes.get(e.id)||''}));
}
async function saveEntry(config,session,id,expected,data){
 const notes=Object.hasOwn(data,'editorial_notes')?data.editorial_notes:null;
 delete data.editorial_notes;
 const response=await upstream(config,'/rest/v1/rpc/cms_save_entry',{token:session.token,method:'POST',body:{p_id:id,p_expected_version:expected,p_entry:data,p_editorial_notes:notes}});
 return response.json();
}

function filters(params, resource, id) {
  const out = new URLSearchParams({ select: '*' });
  if (id) out.set('id', `eq.${id}`);
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 50));
  const offset = Math.max(0, Math.min(100000, Number(params.get('offset')) || 0));
  out.set('limit', String(Math.floor(limit))); out.set('offset', String(Math.floor(offset)));
  out.set('order', ['profiles','settings','taxonomies'].includes(resource) ? 'updated_at.desc' : 'created_at.desc');
  if (params.has('type') && resource === 'entries') { const type=params.get('type');if(!['post','page','fanzine'].includes(type))fail(422,'INVALID_TYPE','Tipo di contenuto non valido.');out.set('type',`eq.${type}`); }
  if (params.has('status') && ['entries','comments'].includes(resource)) {
    const value = params.get('status');
    const allowed = resource === 'entries' ? ['draft','review','published','scheduled','archived','trash'] : ['pending','approved','spam','trash'];
    if (!allowed.includes(value)) fail(422,'INVALID_STATUS','Stato non valido.');
    out.set('status', `eq.${value}`);
  }
  if (params.has('entry_id') && resource === 'revisions') out.set('entry_id', `eq.${uuid(params.get('entry_id'))}`);
  if (params.has('search') && ['entries','media','taxonomies'].includes(resource)) {
    const search = params.get('search').trim();
    if (search.length > 100) fail(422,'SEARCH_TOO_LONG','La ricerca è troppo lunga.');
    // PostgREST filter syntax is never accepted from the client.
    const clean = search.replace(/[^\p{L}\p{N}\s-]/gu,'').trim();
    if (clean) out.set(resource === 'taxonomies' ? 'name' : 'title', `ilike.*${clean}*`);
  }
  return out;
}
export default async function handler(req, res) {
  const config = configuration();
  try {
    requireMethod(req, ['GET','POST','PATCH','DELETE']);
    const session = await authenticate(req, config);
    const params = query(req), resource = params.get('resource') || 'entries';
    if (resource === 'analytics') {
      if (req.method !== 'GET') fail(405,'READ_ONLY','Le misurazioni sono di sola lettura.');
      const days = Math.max(1, Math.min(365, Math.floor(Number(params.get('days')) || 30)));
      const response = await upstream(config, '/rest/v1/rpc/cms_analytics', { token: session.token, method:'POST', body:{p_days:days} });
      return json(res,200,{data:await response.json()});
    }
    const def = RESOURCES[resource];
    if (!def) fail(404,'UNKNOWN_RESOURCE','Questa raccolta non esiste.');
    authorize(session.profile, resource, req.method);
    const id = params.has('id') ? uuid(params.get('id')) : null;
    if (req.method === 'GET') {
      const result = await rows(config, def.table, filters(params,resource,id), {token:session.token});
      if (id && !result.data.length) fail(404,'NOT_FOUND','Il contenuto non esiste o non è accessibile.');
      if(resource==='entries')result.data=await withEditorialNotes(config,result.data,session.token);
      return json(res,200,id ? {data:result.data[0]} : result);
    }
    requireOrigin(req,config);
    if (def.readOnly) fail(405,'READ_ONLY','Questa raccolta è di sola lettura.');
    const body = await readBody(req);
    if (req.method === 'POST') {
      if (id || ['profiles','media'].includes(resource)) fail(405,'CREATE_NOT_ALLOWED', resource === 'media' ? 'Carica i file dalla raccolta media.' : 'Gli account si creano dal servizio di autenticazione.');
      const data = validateResource(resource,body,true);
      delete data.version;
      authorize(session.profile,resource,'POST',null,data);
      if (resource === 'entries') { validatePublish(data);return json(res,201,{data:await saveEntry(config,session,null,null,data)}); }
      const result = await rows(config,def.table,'select=*',{token:session.token,method:'POST',body:data});
      return json(res,201,{data:result.data[0]});
    }
    if (!id) fail(422,'ID_REQUIRED','Scegli il contenuto da modificare.');
    const current = await rows(config,def.table,`select=*&id=eq.${id}&limit=1`,{token:session.token});
    if (!current.data[0]) fail(404,'NOT_FOUND','Il contenuto non esiste o non è accessibile.');
    const row = current.data[0], expectedVersion = version(body.version);
    if (row.version !== expectedVersion) fail(409,'VERSION_CONFLICT','Il contenuto è stato modificato. Ricaricalo prima di salvare.');
    let data;
    if (req.method === 'DELETE') {
      if (Object.keys(body).some(k=>k!=='version')) fail(422,'UNKNOWN_FIELD','La richiesta di eliminazione non è valida.');
      if (['settings','profiles','media'].includes(resource)) fail(405,'DELETE_NOT_ALLOWED', resource === 'media' ? 'Per eliminare un file usa la raccolta media.' : 'Questa raccolta non può essere eliminata.');
      authorize(session.profile,resource,'DELETE',row);
      // Articles retain their revisions and can be restored from the trash.
      if (resource === 'entries' || resource === 'comments') data={status:'trash'};
      else {
        const result=await rows(config,def.table,`id=eq.${id}&version=eq.${expectedVersion}`,{token:session.token,method:'DELETE'});
        if (!result.data.length) fail(409,'VERSION_CONFLICT','Il contenuto è stato modificato. Ricaricalo prima di salvare.');
        return json(res,200,{data:result.data[0],deleted:true});
      }
    } else {
      data=validateResource(resource,body,false); delete data.version;
      authorize(session.profile,resource,'PATCH',row,data);
      if (resource==='entries') validatePublish({...row,...data});
      if (resource==='profiles') {
        if (id===session.user.id && (data.role && data.role!=='admin' || data.active===false)) fail(422,'SELF_LOCKOUT','Non puoi rimuovere il tuo accesso amministratore.');
      }
    }
    if(resource==='entries')return json(res,200,{data:await saveEntry(config,session,id,expectedVersion,data)});
    const result=await rows(config,def.table,`id=eq.${id}&version=eq.${expectedVersion}&select=*`,{token:session.token,method:'PATCH',body:data});
    if (!result.data.length) fail(409,'VERSION_CONFLICT','Il contenuto è stato modificato o non è più accessibile. Ricaricalo prima di salvare.');
    json(res,200,{data:result.data[0]});
  } catch(error) { sendError(res,error); }
}

import { authenticate, authorize, configuration, fail, headers, json, newId, publicMediaPath, query, readBody, requireConfiguration, requireMethod, requireOrigin, rows, sendError, upstream, uuid, validateMedia, version } from '../lib/cms.mjs';

export default async function handler(req,res) {
  try {
    requireMethod(req,['GET','POST','DELETE']);
    const config=configuration(); requireConfiguration(config);
    const p=query(req), id=p.has('id')?uuid(p.get('id')):null;
    if(req.method==='GET') {
      if(!id)fail(422,'ID_REQUIRED','File non specificato.');
      // Anonymous access can see only explicitly published media. Draft assets require a verified session.
      let token=null;
      const publicResult=await rows(config,'cms_media',`select=*&id=eq.${id}&published=eq.true&limit=1`);
      let media=publicResult.data[0];
      if(!media){const session=await authenticate(req,config);token=session.token;const r=await rows(config,'cms_media',`select=*&id=eq.${id}&limit=1`,{token});media=r.data[0];}
      if(!media)fail(404,'NOT_FOUND','File non trovato.');
      // Storage read policy repeats publication/ownership checks, even when a URL is guessed.
      const response=await upstream(config,`/storage/v1/object/authenticated/${config.bucket}/${media.storage_path}`,{token});
      const bytes=Buffer.from(await response.arrayBuffer());
      res.statusCode=200;res.setHeader('Content-Type',media.mime_type);res.setHeader('Content-Length',String(bytes.length));res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control',media.published?'public, max-age=300':'private, no-store');
      res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
      if(media.mime_type==='application/pdf')res.setHeader('Content-Disposition',`attachment; filename="lavanda-${media.id}.pdf"`);
      return res.end(bytes);
    }
    requireOrigin(req,config);
    const session=await authenticate(req,config);authorize(session.profile,'media',req.method);
    const input=await readBody(req,4_250_000);
    if(req.method==='DELETE') {
      if(!id)fail(422,'ID_REQUIRED','Scegli il file da eliminare.');
      const v=version(input.version),result=await rows(config,'cms_media',`select=*&id=eq.${id}&limit=1`,{token:session.token}),media=result.data[0];
      if(!media)fail(404,'NOT_FOUND','File non trovato.');
      authorize(session.profile,'media','DELETE',media);
      if(media.version!==v)fail(409,'VERSION_CONFLICT','Il file è stato modificato. Ricaricalo.');
      if(media.published)fail(422,'MEDIA_PUBLISHED','Rendi privato il file prima di eliminarlo.');
      // Metadata is deleted first: foreign keys refuse deletion while a content cover uses it.
      const deleted=await rows(config,'cms_media',`id=eq.${id}&version=eq.${v}`,{token:session.token,method:'DELETE'});
      if(!deleted.data.length)fail(409,'VERSION_CONFLICT','Il file è stato modificato. Ricaricalo.');
      // Storage DELETE policy uses the original owner path; no arbitrary paths are accepted.
      await upstream(config,`/storage/v1/object/${config.bucket}`,{token:session.token,method:'DELETE',body:{prefixes:[media.storage_path]}});
      return json(res,200,{data:{id,deleted:true}});
    }
    if(id)fail(422,'INVALID_UPLOAD','Non è possibile sovrascrivere un file esistente.');
    const media=validateMedia(input),mediaId=newId(),storagePath=`${session.user.id}/${mediaId}.${media.ext}`;
    await upstream(config,`/storage/v1/object/${config.bucket}/${storagePath}`,{token:session.token,method:'POST',body:media.bytes,raw:true,extraHeaders:{'Content-Type':media.mime,'x-upsert':'false'}});
    try {
      const result=await rows(config,'cms_media','select=*',{token:session.token,method:'POST',body:{id:mediaId,title:media.title,alt:media.alt,folder:media.folder,mime_type:media.mime,size_bytes:media.bytes.length,storage_path:storagePath,public_url:publicMediaPath(mediaId),author_id:session.user.id}});
      json(res,201,{data:result.data[0]});
    }catch(error){
      // Best-effort removal of an orphaned upload. An unlisted object remains inaccessible to public RLS.
      try{await upstream(config,`/storage/v1/object/${config.bucket}`,{token:session.token,method:'DELETE',body:{prefixes:[storagePath]}});}catch{}
      throw error;
    }
  }catch(error){sendError(res,error);}
}

import { configuration, fail, json, query, requireConfiguration, requireMethod, rows, sendError, SLUG } from '../lib/cms.mjs';

const ENTRY_FIELDS='id,type,title,slug,excerpt,body,cover_media_id,category_id,tags,seo,metadata,published_at,updated_at,fanzine_pages';
export default async function handler(req,res) {
  try {
    requireMethod(req,['GET']);
    const config=configuration();requireConfiguration(config);
    const p=query(req),resource=p.get('resource')||'entries';
    if(!['entries','issues','media','settings','taxonomies'].includes(resource))fail(404,'UNKNOWN_RESOURCE','Raccolta pubblica non trovata.');
    if(resource==='settings'){
      const result=await rows(config,'cms_settings','select=site_title,tagline,site_description,seo,social_links,navigation&limit=1');
      return json(res,200,{data:result.data[0]||null});
    }
    const q=new URLSearchParams({select:'*',limit:String(Math.floor(Math.min(100,Math.max(1,Number(p.get('limit'))||24)))),offset:String(Math.floor(Math.max(0,Math.min(100000,Number(p.get('offset'))||0))))});
    let table;
    if(resource==='entries'||resource==='issues'){
      table='cms_entries';const type=resource==='issues'?'fanzine':p.get('type')||'post';
      if(!['post','page','fanzine'].includes(type))fail(422,'INVALID_TYPE','Tipo di contenuto non valido.');
      q.set('select',ENTRY_FIELDS);q.set('type',`eq.${type}`);q.set('status','in.(published,scheduled)');q.set('published_at',`lte.${new Date().toISOString()}`);q.set('order','published_at.desc');
      const slug=p.get('slug');if(slug){if(!SLUG.test(slug)||slug.length>150)fail(422,'INVALID_SLUG','Slug non valido.');q.set('slug',`eq.${slug}`);q.set('limit','1');}
    }else if(resource==='media'){
      table='cms_media';q.set('select','id,title,alt,caption,credit,mime_type,size_bytes,public_url,folder,updated_at');q.set('published','eq.true');q.set('order','created_at.desc');
    }else{table='cms_taxonomies';q.set('select','id,name,slug,kind,description');q.set('order','name.asc');}
    const result=await rows(config,table,q);
    if(p.has('slug')){if(!result.data[0])fail(404,'NOT_FOUND','Contenuto non trovato.');return json(res,200,{data:result.data[0]});}
    json(res,200,result);
  }catch(error){sendError(res,error);}
}

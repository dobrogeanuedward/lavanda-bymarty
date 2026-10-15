import { configuration, fail, json, query, requireConfiguration, requireMethod, rows, sendError, SLUG } from '../lib/cms.mjs';

// Public reading uses the publishable key and the same RLS as direct Data API calls.
export default async function handler(req,res) {
  try {
    requireMethod(req,['GET']);
    const config=configuration(); requireConfiguration(config);
    const p=query(req), type=p.get('type')||'post', slug=p.get('slug');
    if (!['post','page','fanzine'].includes(type)) fail(422,'INVALID_TYPE','Tipo di contenuto non valido.');
    if (slug && (!SLUG.test(slug)||slug.length>150)) fail(422,'INVALID_SLUG','Slug non valido.');
    const q=new URLSearchParams({select:'id,type,title,slug,excerpt,body,cover_media_id,category_id,tags,seo,published_at,updated_at,fanzine_pages',type:`eq.${type}`,status:'in.(published,scheduled)',published_at:`lte.${new Date().toISOString()}`,order:'published_at.desc',limit:String(slug?1:Math.min(100,Math.max(1,Number(p.get('limit'))||24)))});
    if(slug)q.set('slug',`eq.${slug}`);
    const result=await rows(config,'cms_entries',q);
    if(slug&&!result.data.length)fail(404,'NOT_FOUND','Contenuto non trovato.');
    json(res,200,slug?{data:result.data[0]}:result);
  } catch(error){sendError(res,error);}
}

import { analyticsSignature, configuration, fail, json, readBody, requireConfiguration, requireMethod, requireOrigin, sendError, upstream, validateEvent } from '../lib/cms.mjs';

export default async function handler(req,res) {
  try {
    requireMethod(req,['POST']);
    const config=configuration(); requireConfiguration(config); requireOrigin(req,config,false);
    if(!config.analytics)fail(503,'ANALYTICS_SETUP_REQUIRED','Le misurazioni aggregate non sono ancora collegate.');
    if(req.headers?.dnt==='1'||req.headers?.['sec-gpc']==='1')return json(res,200,{data:{recorded:false,reason:'privacy-preference'}});
    const payload=validateEvent(await readBody(req,2000));
    const timestamp=Math.floor(Date.now()/1000);
    const signature=analyticsSignature(config.analyticsKey,timestamp,payload);
    const response=await upstream(config,'/rest/v1/rpc/cms_record_event',{method:'POST',body:{p_event:payload.event,p_path:payload.path,p_timestamp:timestamp,p_signature:signature}});
    json(res,200,{data:{recorded:await response.json()}});
  }catch(error){sendError(res,error);}
}

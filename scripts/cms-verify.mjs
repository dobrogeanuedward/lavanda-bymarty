import {authenticate,configuration,rows}from'../lib/cms.mjs';

// A read-only post-configuration check. Does not print keys, session tokens or personal data.
const config=configuration();
if(!config.configured){console.error('SETUP_REQUIRED: configura il progetto Supabase dedicato. Nessuna richiesta eseguita.');process.exitCode=2;}
else{
 try{
  const settings=await rows(config,'cms_settings','select=site_title&limit=1');
  if(!settings.data[0])throw Error('Manca il record impostazioni iniziale.');
  await rows(config,'cms_entries','select=id&status=in.(published,scheduled)&limit=1');
  console.log('OK: schema pubblico raggiungibile con chiave non privilegiata.');
  // The private notes table must not be readable by anon, even without the app proxy.
  let notesDenied=false;
  try{await rows(config,'cms_entry_notes','select=entry_id&limit=1');}catch(error){if(error.status===403)notesDenied=true;else throw error;}
  if(!notesDenied)throw Error('Le note private risultano leggibili senza sessione: correggi i privilegi.');
  console.log('OK: note editoriali non leggibili da anon.');
  if(process.env.CMS_ACCESS_TOKEN){
   const prefix=config.secure?'__Host-lv_':'lv_';
   const session=await authenticate({headers:{cookie:`${prefix}access=${encodeURIComponent(process.env.CMS_ACCESS_TOKEN)}`}},config);
   await rows(config,'cms_entries','select=id,version&limit=1',{token:session.token});
   console.log(`OK: sessione verificata, ruolo ${session.profile.role}.`);
  }
  console.log('Controllo di sola lettura completato. Pubblicazione, upload e ripristino richiedono il collaudo dalla redazione.');
 }catch(error){console.error(`${error.code||'VERIFY_FAILED'}: ${error.message}`);process.exitCode=1;}
}

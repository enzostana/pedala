import {readFileSync} from 'node:fs';
/** Read credentials server-side only. Never serialize credentials into responses. */
export function geoapifyKey(env:NodeJS.ProcessEnv=process.env):string|undefined {
 const direct=env.GEOAPIFY_API_KEY?.trim();if(direct)return direct;
 try{return readFileSync(env.GEOAPIFY_API_KEY_FILE||'/run/secrets/pedala_geoapify_api_key','utf8').trim()||undefined;}catch{return undefined;}
}

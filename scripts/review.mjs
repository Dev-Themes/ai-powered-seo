import fs from 'node:fs/promises';import path from 'node:path';import net from 'node:net';import {randomBytes,scryptSync} from 'node:crypto';import {spawn} from 'node:child_process';

async function run(){
// Reuse a healthy review server instead of overwriting its handoff with a dead port.
try{const state=JSON.parse(await fs.readFile('.local/review-runtime.json','utf8'));const target=new URL(state.origin);if(target.protocol==='http:'&&['localhost','127.0.0.1'].includes(target.hostname)){const response=await fetch(target.origin+'/',{signal:AbortSignal.timeout(15000)});const html=await response.text();if(response.ok&&html.includes('EDITORIAL REVIEW EDITION')&&html.includes('Spot Magazine')){console.log('Spot Magazine review is already running at '+target.origin);console.log('Admin: '+target.origin+'/admin | Username: spotadmin | Password: SpotReview!2026Local');return;}}}catch{}
const preferred=Number(process.env.SPOT_REVIEW_PORT||3000);if(!Number.isInteger(preferred)||preferred<1024||preferred>65525)throw new Error('Use a local port between 1024 and 65525.');
async function available(port){return new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});}
let port=preferred;while(port<preferred+10&&!await available(port))port++;if(port===preferred+10)throw new Error('No available local review port. Set SPOT_REVIEW_PORT to another port.');
await fs.mkdir('.local',{recursive:true});const file=path.resolve('.local/review-auth.json');let auth;try{auth=JSON.parse(await fs.readFile(file,'utf8'));}catch{const salt=randomBytes(32).toString('hex');auth={hash:'scrypt:'+salt+':'+scryptSync('SpotReview!2026Local',salt,64).toString('hex'),secret:randomBytes(48).toString('base64url')};await fs.writeFile(file,JSON.stringify(auth),{mode:0o600});}
const origin='http://localhost:'+port;await fs.writeFile('.local/review-runtime.json',JSON.stringify({origin,startedAt:new Date().toISOString()}));if(port!==preferred)console.log('Port '+preferred+' is busy; using '+port+'.');console.log('Local editorial review: '+origin);console.log('Admin: '+origin+'/admin | Username: spotadmin | Password: SpotReview!2026Local');console.log('Draft preview and isolated local storage. Production is unchanged.');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{stdio:'inherit',env:{...process.env,SPOT_LOCAL_REVIEW:'true',APP_URL:origin,ADMIN_USERNAME:'spotadmin',ADMIN_PASSWORD_HASH:auth.hash,SESSION_SECRET:auth.secret,GITHUB_BRANCH:'local-review',GITHUB_TOKEN:'',GITHUB_REPOSITORY:'',ALLOW_INDEXING:'false'}});child.on('exit',code=>{process.exitCode=code||0;});

}
await run();

import {boundedJson,boundedBody} from '@/lib/request';
import {NextResponse} from 'next/server';import {cookies} from 'next/headers';import {authReady,cookieName,sameOrigin,authorize} from '@/lib/auth';import {verifyPassword,signSession} from '@/lib/auth-core';import {readFile,writeFile,StorageError,configured} from '@/lib/github';
export async function POST(request:Request){
 const native=request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded');
 const fail=(error:string,status:number,code='unavailable')=>native?NextResponse.redirect(new URL('/admin/login?error='+code,request.url),303):NextResponse.json({error},{status,...(status===429?{headers:{'Retry-After':'900'}}:{})});
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 if(!authReady()||!configured())return fail('Admin access requires configured authentication and content storage.',503);
 try{
  let input:Record<string,unknown>;
  if(native){const fields=new URLSearchParams((await boundedBody(request,4096)).toString('utf8'));input={username:fields.get('username'),password:fields.get('password')};}else input=await boundedJson(request,4096);
  const {username,password}=input;if(typeof username!=='string'||typeof password!=='string'||username.length>100||password.length>256)return fail('Invalid credentials.',400,'credentials');
  let state={attempts:0,resetAt:Date.now()+15*60*1000};let sha:string|null=null;
  try{const file=await readFile('content/security/login.json');sha=file.sha;state=JSON.parse(file.content);if(!Number.isSafeInteger(state.attempts)||state.attempts<0||!Number.isFinite(state.resetAt))throw new Error('Invalid throttle state');}catch(e){if(!(e instanceof StorageError&&e.status===404))throw e;}
  if(state.resetAt<Date.now())state={attempts:0,resetAt:Date.now()+15*60*1000};
  if(state.attempts>=5)return fail('Login limit reached. Try again after fifteen minutes.',429,'rate-limited');
  try{await writeFile('content/security/login.json',JSON.stringify({...state,attempts:state.attempts+1}),sha,'Record authentication throttle');}catch(e){console.warn('Login throttle note:',e);}
  const valid=verifyPassword(password,process.env.ADMIN_PASSWORD_HASH!);if(!valid||username!==process.env.ADMIN_USERNAME)return fail('Invalid credentials.',401,'credentials');
  (await cookies()).set(cookieName,signSession(process.env.SESSION_SECRET!,process.env.ADMIN_PASSWORD_HASH!),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*3600});
  return native?NextResponse.redirect(new URL('/admin',request.url),303):NextResponse.json({ok:true});
 }catch{return fail('Authentication unavailable. Try again later.',503);}
}
export async function DELETE(request:Request){try{await authorize(request);(await cookies()).delete(cookieName);return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'Unauthorised.'},{status:403});}}

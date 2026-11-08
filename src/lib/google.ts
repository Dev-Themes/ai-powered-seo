import {GoogleAuth} from 'google-auth-library';
const authClients=new Map<string,GoogleAuth>();
export function googleReady(){return !!(process.env.GOOGLE_CLIENT_EMAIL&&process.env.GOOGLE_PRIVATE_KEY);}
async function call(url:string,scope:string,body:unknown){
 if(!googleReady())throw new Error('Google credentials are not configured.');
 let auth=authClients.get(scope);
 if(!auth){auth=new GoogleAuth({credentials:{client_email:process.env.GOOGLE_CLIENT_EMAIL,private_key:process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g,'\n')},scopes:[scope]});authClients.set(scope,auth);}
 const client=await auth.getClient();
 for(let attempt=0;;attempt++){
  try{const response=await client.request({url,method:'POST',data:body,timeout:25000,retry:false});return response.data;}
  catch(error){const status=(error as {response?:{status?:number}}).response?.status;if(attempt>=2||(status!==undefined&&status!==429&&status<500))throw error;await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));}
 }
}
export async function collectGoogle(){
 const end=new Date(Date.now()-4*86400000).toISOString().slice(0,10);
 const start=new Date(Date.parse(end)-27*86400000).toISOString().slice(0,10);
 const previousEnd=new Date(Date.parse(start)-86400000).toISOString().slice(0,10);
 const previousStart=new Date(Date.parse(start)-28*86400000).toISOString().slice(0,10);
 const previous={startDate:previousStart,endDate:previousEnd};
 const gscUrl='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(process.env.GSC_PROPERTY||'sc-domain:spotmagazine.co.uk')+'/searchAnalytics/query';
 const gsc=(dimensions:string[],extra:object={},range={startDate:start,endDate:end})=>call(gscUrl,'https://www.googleapis.com/auth/webmasters.readonly',{...range,dataState:'final',dimensions,rowLimit:25000,...extra});
 const branded={dimensionFilterGroups:[{filters:[{dimension:'query',operator:'includingRegex',expression:'(?i)^(spot magazine|spotmagazine\\.co\\.uk)$'}]}]};
 const homepage={dimensionFilterGroups:[{filters:[{dimension:'page',operator:'equals',expression:'https://spotmagazine.co.uk/'}]}]};
 const tasks=[gsc([]),gsc(['date']),gsc(['query','page']),gsc(['device']),gsc(['country']),gsc(['query'],branded),gsc(['date'],homepage),gsc([],{},previous),gsc(['query'],branded,previous),gsc([],homepage,previous),
 process.env.GA4_PROPERTY_ID?call('https://analyticsdata.googleapis.com/v1beta/properties/'+process.env.GA4_PROPERTY_ID+':runReport','https://www.googleapis.com/auth/analytics.readonly',{
  dateRanges:[{startDate:start,endDate:end}],dimensions:[{name:'date'},{name:'landingPagePlusQueryString'}],metrics:[{name:'sessions'},{name:'engagedSessions'},{name:'engagementRate'}],
  dimensionFilter:{filter:{fieldName:'sessionDefaultChannelGroup',stringFilter:{value:'Organic Search',matchType:'EXACT'}}},limit:10000
 }):Promise.reject(new Error('GA4 property is not configured.'))];
 const settled=await Promise.allSettled(tasks);
 const names=['totals','trend','queries','devices','countries','branded','homepage','previousPeriod','previousBranded','previousHomepage','ga4'];
 return {collectedAt:new Date().toISOString(),period:{start,end,previousStart,previousEnd},caveats:[
  'Search Console uses final data with a four-day safety lag. Top query rows can be incomplete and anonymised.',
  'Average position is aggregated search appearance, not a live or guaranteed rank.',
  'GA4 organic sessions and Search Console clicks are separate measurements.'
 ],sources:Object.fromEntries(settled.map((r,i)=>[names[i],r.status==='fulfilled'?{status:'connected',data:r.value}:{status:'unavailable',message:'Data unavailable. Check credentials, property access and API quota.'}]))};
}

import type {NextConfig} from 'next';
import redirects from './content/config/redirects.json';
const development=process.env.NODE_ENV==='development';
const csp=["default-src 'self'",`script-src 'self' 'unsafe-inline'${development?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'",`connect-src 'self'${development?' ws://localhost:* ws://127.0.0.1:*':''}`,"frame-src 'none'","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'"].join('; ');
const config:NextConfig={poweredByHeader:false,distDir:process.env.SPOT_LOCAL_REVIEW==='true'&&development?'.next-review':'.next',outputFileTracingExcludes:{'/*':['./.local/**/*','./.next-review/**/*','./docs/**/*','./tests/**/*']},async redirects(){return redirects;},async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},{key:'Content-Security-Policy',value:csp}]}];}};
export default config;

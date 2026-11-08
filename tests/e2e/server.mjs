// Isolated local test server. This file is never imported by the application.
import {randomBytes,scryptSync} from 'node:crypto';
const salt=randomBytes(32).toString('hex');
Object.assign(process.env,{SPOT_TEST_TRANSPORT:'true',APP_URL:'http://localhost:3100',ADMIN_USERNAME:'test-editor',ADMIN_PASSWORD_HASH:'scrypt:'+salt+':'+scryptSync('test-fixture-password-only-123456',salt,64).toString('hex'),SESSION_SECRET:randomBytes(48).toString('base64url'),GITHUB_TOKEN:'test-fixture-not-a-real-token',GITHUB_REPOSITORY:'test/spot',GITHUB_BRANCH:'test-content',GOOGLE_CLIENT_EMAIL:'',GOOGLE_PRIVATE_KEY:'',GEMINI_API_KEY:'',ALLOW_INDEXING:'false'});
await import('./mock-github.mjs');
const {startServer}=await import('next/dist/server/lib/start-server.js');
await startServer({dir:process.cwd(),isDev:false,port:3100,hostname:'localhost'});

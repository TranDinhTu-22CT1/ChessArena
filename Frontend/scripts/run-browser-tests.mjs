import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5187','--strictPort'],{stdio:'pipe',windowsHide:true});
let serverError='';
let serverExited=false;
server.stderr.on('data',chunk=>{serverError+=chunk.toString();});
server.on('exit',()=>{serverExited=true;});
const stop=()=>server.kill();
process.on('SIGINT',stop);
process.on('SIGTERM',stop);
try {
  let ready=false;
  for(let attempt=0;attempt<100&&!ready;attempt++) {
    if(serverExited)throw new Error(serverError||'Browser test server stopped.');
    try { ready=(await fetch('http://127.0.0.1:5187/tests/browser/fixture.html')).ok; } catch { /* Wait for Vite. */ }
    if(!ready)await delay(150);
  }
  if(!ready)throw new Error('Browser test server did not become ready.');
  const runner=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{
    stdio:'inherit',windowsHide:true,env:{...process.env,PLAYWRIGHT_EXTERNAL_SERVER:'1'}
  });
  process.exitCode=await new Promise((resolve,reject)=>{runner.on('exit',code=>resolve(code??1));runner.on('error',reject);});
} finally { stop(); }

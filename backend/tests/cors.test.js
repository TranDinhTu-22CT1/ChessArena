import test from 'node:test';
import assert from 'node:assert/strict';
import { corsHeaders, frontendReturnOrigin, isAllowedCorsOrigin, mutationGuard } from '../src/lib/cors.js';

const productionEnv = {
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://chessarena2.vercel.app',
  FRONTEND_URLS: 'https://app.chessarena.example,https://chessarena2-preview-team.vercel.app',
  FRONTEND_VERCEL_PROJECTS: 'chessarena2'
};

test('CORS accepts exact configured origins, never a Vercel name prefix', () => {
  assert.equal(isAllowedCorsOrigin('https://app.chessarena.example', productionEnv), true);
  assert.equal(isAllowedCorsOrigin('https://chessarena2-git-main-team.vercel.app', productionEnv), false);
  assert.equal(isAllowedCorsOrigin('https://chessarena2-preview-team.vercel.app', productionEnv), true);
});

test('mutation guard rejects cross-site cookie writes, missing/null Origin and simple forms', () => {
  const request = (origin, type='application/json', method='POST', path='/api/auth/session') => new Request('https://api.example'+path, {
    method, headers:{...(origin ? {Origin:origin}:{}), 'Content-Type':type, Cookie:'session=test'}
  });
  for(const origin of [undefined,'null','https://evil.test','https://chessarena2-impostor.vercel.app','https://app.chessarena.example/extra']) {
    for(const method of ['POST','PUT','PATCH','DELETE']) assert.equal(mutationGuard(request(origin,'application/json',method),productionEnv).status,403);
  }
  assert.equal(mutationGuard(request('https://app.chessarena.example'),productionEnv),null);
  assert.equal(mutationGuard(request('https://api.example'),productionEnv),null);
  for(const type of ['text/plain','application/x-www-form-urlencoded','multipart/form-data'])assert.equal(mutationGuard(request('https://app.chessarena.example',type),productionEnv).status,415);
  assert.equal(mutationGuard(request('https://app.chessarena.example','application/json; charset=utf-8'),productionEnv),null);
  for(const method of ['GET','HEAD','OPTIONS'])assert.equal(mutationGuard(request(undefined,'application/json',method),productionEnv),null);
  assert.equal(mutationGuard(request(undefined,'application/json','POST','/api/paypal/webhook'),productionEnv).status,403);
});

test('only authenticated server-to-server handlers may receive originless requests', () => {
  for(const path of ['/api/paypal/webhook','/api/internal/maintenance'])assert.equal(mutationGuard(new Request('https://api.example'+path,{method:'POST'}),productionEnv),null);
  assert.equal(mutationGuard(new Request('https://api.example/api/online/match',{method:'POST'}),productionEnv).status,403);
});

test('local launcher origins supplement rather than replace deployed frontend origins', () => {
  const env={...productionEnv,LOCAL_FRONTEND_ORIGINS:'http://192.168.1.10:5173'};
  assert.equal(isAllowedCorsOrigin('http://192.168.1.10:5173',env),true);
  assert.equal(isAllowedCorsOrigin('https://app.chessarena.example',env),true);
  assert.equal(isAllowedCorsOrigin('http://192.168.1.11:5173',env),false);
});

test('CORS rejects unrelated Vercel apps and production localhost', () => {
  assert.equal(isAllowedCorsOrigin('https://unrelated-project.vercel.app', productionEnv), false);
  assert.equal(isAllowedCorsOrigin('http://localhost:5173', productionEnv), false);
});

test('CORS accepts local Vite ports in development', () => {
  assert.equal(isAllowedCorsOrigin('http://localhost:5199', { NODE_ENV: 'development' }), true);
  assert.equal(isAllowedCorsOrigin('http://127.0.0.1:4173', { NODE_ENV: 'test' }), true);
});

test('CORS response reflects only an allowed origin', () => {
  const allowedRequest = new Request('https://api.example/api/health', {
    headers: { Origin: 'https://chessarena2-preview-team.vercel.app' }
  });
  const rejectedRequest = new Request('https://api.example/api/health', {
    headers: { Origin: 'https://example.net' }
  });

  assert.equal(
    corsHeaders(allowedRequest, productionEnv)['Access-Control-Allow-Origin'],
    'https://chessarena2-preview-team.vercel.app'
  );
  assert.equal(corsHeaders(rejectedRequest, productionEnv)['Access-Control-Allow-Origin'], undefined);
});

test('payment callbacks return to the origin that started checkout', () => {
  assert.equal(
    frontendReturnOrigin('https://chessarena2-preview-team.vercel.app', productionEnv),
    'https://chessarena2-preview-team.vercel.app'
  );
  assert.equal(
    frontendReturnOrigin('https://unrelated-project.vercel.app', productionEnv),
    'https://chessarena2.vercel.app'
  );
});

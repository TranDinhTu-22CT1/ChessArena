import test from 'node:test';
import assert from 'node:assert/strict';
import { corsHeaders, frontendReturnOrigin, isAllowedCorsOrigin } from '../src/lib/cors.js';

const productionEnv = {
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://chessarena2.vercel.app',
  FRONTEND_URLS: 'https://app.chessarena.example',
  FRONTEND_VERCEL_PROJECTS: 'chessarena2'
};

test('CORS accepts configured frontend and its Vercel previews', () => {
  assert.equal(isAllowedCorsOrigin('https://app.chessarena.example', productionEnv), true);
  assert.equal(isAllowedCorsOrigin('https://chessarena2-git-main-team.vercel.app', productionEnv), true);
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

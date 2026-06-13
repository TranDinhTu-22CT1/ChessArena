import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMomoSignature,
  isMomoPendingResult,
  momoRequestType,
  momoResultMessage,
  momoReturnOrigin
} from '../src/lib/momo.js';

test('MoMo returns to the frontend origin that started checkout', () => {
  const env = {
    NODE_ENV: 'development',
    FRONTEND_URL: 'http://localhost:5173'
  };
  assert.equal(momoReturnOrigin('http://localhost:5174', env), 'http://localhost:5174');
  assert.equal(momoReturnOrigin('https://evil.example', env), 'http://localhost:5173');
});

test('MoMo result codes distinguish pending, cancellation and issuer rejection', () => {
  assert.equal(isMomoPendingResult(1000), true);
  assert.equal(isMomoPendingResult(7002), true);
  assert.equal(isMomoPendingResult(1006), false);
  assert.match(momoResultMessage(1002), /nhà phát hành/i);
  assert.match(momoResultMessage(1006), /hủy|từ chối/i);
});

test('MoMo signatures support the wallet capture request type', () => {
  const signature = createMomoSignature({
    amount: 125000,
    extraData: '',
    ipnUrl: 'https://api.example/momo/confirm',
    orderId: 'CA123',
    orderInfo: 'ChessArena plus monthly',
    partnerCode: 'MOMO',
    redirectUrl: 'https://app.example/membership?momo=return',
    requestId: 'CA123',
    requestType: 'captureWallet'
  });
  assert.match(signature, /^[a-f0-9]{64}$/);
});

test('MoMo checkout only creates domestic ATM payments', () => {
  assert.equal(momoRequestType(), 'payWithATM');
  assert.equal(momoRequestType('wallet'), 'payWithATM');
});

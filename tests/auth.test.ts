import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { verifyPassword, signSession, decodeSession } from '../src/lib/auth-core';

test('password hashing and signed session reject incorrect, expired and modified credentials', () => {
  const salt = randomBytes(32).toString('hex');
  const hash = 'scrypt:' + salt + ':' + scryptSync('a test password with enough length', salt, 64).toString('hex');

  // Verify valid password
  assert.ok(verifyPassword('a test password with enough length', hash));

  // Reject wrong password
  assert.equal(verifyPassword('incorrect', hash), false);

  // Reject malformed hash
  assert.equal(verifyPassword('anything', 'malformed'), false);

  // Signed session verification
  const key = randomBytes(40).toString('hex');
  const token = signSession(key, hash, 1000);

  // Valid session decodes
  assert.ok(decodeSession(token, key, hash, 2000));

  // Tampered token fails
  assert.equal(decodeSession(token + 'a', key, hash, 2000), null);

  // Rotated credentials fail
  assert.equal(decodeSession(token, key, 'rotated', 2000), null);

  // Expired session fails (after 8 hours)
  assert.equal(decodeSession(token, key, hash, 1000 + 9 * 3600000), null);
});

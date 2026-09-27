import { describe, expect, it } from 'vitest';

import { apiErrorMessage } from './api';

describe('apiErrorMessage', () => {
  it('formats FastAPI validation details for form errors', () => {
    const message = apiErrorMessage(422, [
      { loc: ['body', 'email'], msg: 'value is not a valid email address' },
      { loc: ['body', 'password'], msg: 'String should have at least 8 characters' },
    ]);

    expect(message).toBe(
      'email: value is not a valid email address password: String should have at least 8 characters',
    );
  });

  it('uses backend detail strings directly', () => {
    expect(apiErrorMessage(401, 'Invalid email or password')).toBe('Invalid email or password');
  });

  it('uses the enhanced backend error envelope', () => {
    expect(apiErrorMessage(500, { error: 'ignored' })).toBe('The server had a problem. Please try again.');
    expect(apiErrorMessage(500, { message: 'Class preparation failed at curriculum stage' })).toBe(
      'Class preparation failed at curriculum stage',
    );
  });
});

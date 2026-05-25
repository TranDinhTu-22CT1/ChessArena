export function authCookieOptions(maxAge = 60 * 60) {
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge
  };
}

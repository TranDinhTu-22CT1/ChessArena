import React from 'react';

export default function BrandMark({ className = '' }) {
  return <img className={`brand-mark ${className}`.trim()} src="/chessarena-mark.svg" alt="" />;
}

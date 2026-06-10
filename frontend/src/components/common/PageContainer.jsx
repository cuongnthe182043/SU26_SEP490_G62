import React from 'react';
import { C } from '../../styles/theme';

/**
 * Card wrapper — matches the template table card style.
 * Table children receive full horizontal width; padded sections
 * should use the `padded` helper class or inline padding on their own wrappers.
 */
export default function PageContainer({ children, style }) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 12,
      border: `1px solid ${C.outlineVariant}30`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

/** Padded block inside a PageContainer (for header / filter rows) */
export function CardSection({ children, style }) {
  return (
    <div style={{ padding: '20px 24px', ...style }}>
      {children}
    </div>
  );
}

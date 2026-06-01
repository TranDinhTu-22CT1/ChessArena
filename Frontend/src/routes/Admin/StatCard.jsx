import React from 'react';

export default function StatCard({ icon: Icon, label, value, tone = '' }) {
  return (
    <div className={`admin-stat-card ${tone}`}>
      <Icon size={22} />
      <strong>{value ?? '--'}</strong>
      <span>{label}</span>
    </div>
  );
}

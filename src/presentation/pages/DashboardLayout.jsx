// src/components/layout/DashboardLayout.jsx
import React from 'react';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import { HomePage } from '../components/layout/HomePage.jsx';

export function DashboardLayout() {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Idhu unga Left Menu */}
      <Sidebar />
      
      {/* Idhu unga Right Side Content Area */}
      <HomePage />
    </div>
  );
}
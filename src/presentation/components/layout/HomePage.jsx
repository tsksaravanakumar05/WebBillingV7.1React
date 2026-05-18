// src/pages/HomePage.jsx
import React from 'react';
import * as Icons from 'lucide-react'; // <-- Intha line thaan romba mukkiyam!

export function HomePage() {
  const userDetails = {
    name: localStorage.getItem("username") || "saravana1@gmail.com",
    role: "Admin",
    company: "MSR"
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', height: '100vh', overflow: 'auto' }}>
      
      {/* HEADER */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button style={styles.iconBtn}><Icons.ChevronLeft size={20} color="#fff" /></button>
          <h2 style={{ margin: '0 20px', fontSize: '18px', fontWeight: 'bold' }}>{userDetails.company}</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button style={styles.outlineBtn}><Icons.Maximize size={18} /></button>
          <button style={styles.outlineBtn}><Icons.Home size={18} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px' }}>
            <div style={styles.avatar}>S</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{userDetails.name}</span>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>{userDetails.role}</span>
            </div>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <div style={{ padding: '20px' }}>
        
        {/* Top KPI Cards (White) */}
        <div style={styles.cardGrid}>
           <div style={styles.whiteCard}><span style={styles.iconCircleGreen}><Icons.DollarSign size={20}/></span> <h3>Yesterday Sale</h3></div>
           <div style={styles.whiteCard}><span style={styles.iconCircleBlue}><Icons.TrendingDown size={20}/></span> <h3>Weekly Sale</h3></div>
           <div style={styles.whiteCard}><span style={styles.iconCircleRed}><Icons.TrendingUp size={20}/></span> <h3>Monthly Sale</h3></div>
        </div>

        {/* Action Colored Cards */}
        <div style={{ ...styles.cardGrid, marginTop: '20px' }}>
           <div style={{ ...styles.colorCard, background: '#f97316' }}><Icons.User size={30} /> <span>Customers</span></div>
           <div style={{ ...styles.colorCard, background: '#06b6d4' }}><Icons.UserCheck size={30} /> <span>Suppliers</span></div>
           <div style={{ ...styles.colorCard, background: '#1e293b' }}><Icons.FileText size={30} /> <span>Purchase Invoice</span></div>
           <div style={{ ...styles.colorCard, background: '#22c55e' }}><Icons.FileSpreadsheet size={30} /> <span>Sales Invoice</span></div>
        </div>

        {/* Bottom Layout (Charts & Lists) */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          {/* Chart Area */}
          <div style={{ flex: 2, backgroundColor: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: '350px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 15px 0' }}>Bar Chart</h3>
            <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#9ca3af' }}>Chart Placeholder</div>
          </div>

          {/* Top 10 List Area */}
          <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '16px', margin: 0 }}>Weekly Top 10 Sales</h3>
              <Icons.MoreVertical size={18} color="#6b7280" />
            </div>
            <table style={{ width: '100%', fontSize: '13px', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                  <th style={{ padding: '8px 0' }}>Sno</th>
                  <th style={{ padding: '8px 0' }}>Products</th>
                  <th style={{ padding: '8px 0' }}>Qty</th>
                  <th style={{ padding: '8px 0' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {/* Data varumbodhu loop panni potukalam */}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  header: { height: '60px', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #e5e7eb' },
  iconBtn: { background: '#f97316', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  outlineBtn: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' },
  avatar: { width: '35px', height: '35px', borderRadius: '50%', backgroundColor: '#1e3a8a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' },
  whiteCard: { backgroundColor: '#fff', padding: '20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  colorCard: { color: '#fff', padding: '25px 20px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  iconCircleGreen: { background: '#dcfce7', color: '#16a34a', padding: '10px', borderRadius: '50%' },
  iconCircleBlue: { background: '#cffafe', color: '#0891b2', padding: '10px', borderRadius: '50%' },
  iconCircleRed: { background: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '50%' }
};
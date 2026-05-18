// src/components/layout/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react'; // Fetching icons dynamically

export function Sidebar() {
  const [quickLinks, setQuickLinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    // 1. LocalStorage la irundhu menu data edukkrom
    const rawMenu = JSON.parse(localStorage.getItem('menuList') || '[]');
    
    // View access irukkura items mattum (View === 1)
    const visibleMenu = rawMenu.filter(item => item.View === 1);

    // 2. TopMenu: 1 irukkura items (Mela irukkura direct links)
    const quick = visibleMenu.filter(item => item.TopMenu === 1);
    setQuickLinks(quick);

    // 3. Parent and Child items logic (Dropdowns)
    const parents = visibleMenu.filter(item => item.ParentId === null);
    const nested = parents.map(parent => {
      return {
        ...parent,
        children: visibleMenu.filter(child => child.ParentId === parent.Id && child.TopMenu === 0)
      };
    }).filter(parent => parent.children.length > 0); // Children irundha mattum kaatu

    setCategories(nested);
  }, []);

  // Dynamic icon renderer
  const renderIcon = (iconName) => {
    if (!iconName) return <Icons.Circle size={18} />;
    // Convert 'file-text' to 'FileText' format
    const formattedName = iconName.split('-').map(str => str.charAt(0).toUpperCase() + str.slice(1)).join('');
    const IconComponent = Icons[formattedName] || Icons.Circle;
    return <IconComponent size={18} style={{ marginRight: '10px', color: '#6b7280' }} />;
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.logoArea}>
        <h2 style={{ color: '#1e3a8a', fontWeight: 'bold', fontSize: '24px', margin: 0 }}>
          Dreams<span style={{ fontSize: '12px', color: '#f97316', verticalAlign: 'top' }}>POS</span>
        </h2>
      </div>

      <div style={styles.menuContainer}>
        {/* QUICK LINKS */}
        <ul style={styles.menuList}>
          {quickLinks.map(item => (
            <li key={item.Id} style={styles.menuItem}>
              {renderIcon(item.Icon)}
              <span style={styles.menuText}>{item.PageName}</span>
            </li>
          ))}
        </ul>

        <hr style={styles.divider} />

        {/* DROPDOWN CATEGORIES */}
        <ul style={styles.menuList}>
          {categories.map(category => (
            <li key={category.Id} style={{ display: 'flex', flexDirection: 'column' }}>
              <div 
                style={styles.categoryItem} 
                onClick={() => setOpenDropdown(openDropdown === category.Id ? null : category.Id)}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {renderIcon(category.Icon)}
                  <span style={styles.menuText}>{category.PageName}</span>
                </div>
                <Icons.ChevronRight 
                  size={16} 
                  style={{ 
                    color: '#9ca3af', 
                    transform: openDropdown === category.Id ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s'
                  }} 
                />
              </div>

              {/* Sub-menu items */}
              {openDropdown === category.Id && (
                <ul style={styles.subMenuList}>
                  {category.children.map(child => (
                    <li key={child.Id} style={styles.subMenuItem}>
                      <span style={styles.menuText}>{child.PageName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const styles = {
  sidebar: { width: '250px', height: '100vh', backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' },
  logoArea: { height: '60px', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #f3f4f6' },
  menuContainer: { flex: 1, overflowY: 'auto', padding: '15px 10px' },
  menuList: { listStyle: 'none', padding: 0, margin: 0 },
  menuItem: { display: 'flex', alignItems: 'center', padding: '10px 15px', cursor: 'pointer', borderRadius: '8px', marginBottom: '4px', color: '#4b5563' },
  categoryItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', cursor: 'pointer', borderRadius: '8px', color: '#4b5563' },
  subMenuList: { listStyle: 'none', padding: '0 0 0 40px', margin: 0 },
  subMenuItem: { padding: '8px 10px', cursor: 'pointer', color: '#6b7280', fontSize: '13.5px' },
  menuText: { fontSize: '14.5px', fontWeight: '500' },
  divider: { border: 'none', borderTop: '1px solid #f3f4f6', margin: '15px 0' }
};
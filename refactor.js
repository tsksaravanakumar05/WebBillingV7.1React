const fs = require('fs');
const file = 'e:/KodeeWorkSpaceNew/WebBillingV7.1React/src/Transaction/Saleorder.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace panelStyle
content = content.replace(/style=\{\{\s*\.\.\.panelStyle\s*,\s*(.*?)\s*\}\}/g, 'className="so-panel" style={{ $1 }}');
content = content.replace(/style=\{panelStyle\}/g, 'className="so-panel"');

// Replace fieldLabel
content = content.replace(/style=\{\{\s*\.\.\.fieldLabel\s*,\s*(.*?)\s*\}\}/g, 'className="so-field-label" style={{ $1 }}');
content = content.replace(/style=\{fieldLabel\}/g, 'className="so-field-label"');

// Replace fieldInput
content = content.replace(/style=\{\{\s*\.\.\.fieldInput\s*,\s*(.*?)\s*\}\}/g, 'className="so-field-input" style={{ $1 }}');
content = content.replace(/style=\{fieldInput\}/g, 'className="so-field-input"');

// Replace panelTitle
content = content.replace(/style=\{\{\s*\.\.\.panelTitle\s*,\s*(.*?)\s*\}\}/g, 'className="so-panel-title" style={{ $1 }}');
content = content.replace(/style=\{panelTitle\}/g, 'className="so-panel-title"');

fs.writeFileSync(file, content);
console.log('Replaced inline styles successfully in SaleOrder.jsx!');

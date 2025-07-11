// Copyright IBM Corp. 2025
// Assisted by CursorAI

window.initFieldAccessReportPanel = function(report) {
  const root = document.getElementById('fieldAccessReportRoot');
  if (!root) return;

  // Helper: create element with class and text
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  // --- Summary/Insights Box ---
  function renderSummary() {
    const summary = report.summary;
    const box = el('div', 'insights-summary');
    function countSpan(count, cls, label) {
      const span = el('span');
      const badge = el('span', 'insight-count ' + cls, count);
      span.appendChild(badge);
      span.appendChild(document.createTextNode(label));
      return span;
    }
    // Compute open/protected/restricted/defaulted
    let open = 0, protected_ = 0, restricted = 0, defaulted = 0;
    Object.values(report.rootTypeAccess).forEach(fields => {
      fields.forEach(field => {
        let access = 'protected';
        if (field.condition === 'true') access = 'open';
        else if (field.condition === 'false') access = 'restricted';
        if (!field.ruleName) defaulted++;
        if (access === 'open') open++;
        else if (access === 'protected') protected_++;
        else if (access === 'restricted') restricted++;
      });
    });
    box.appendChild(countSpan(open, 'insight-open', ' Open'));
    box.appendChild(countSpan(protected_, 'insight-protected', ' Protected'));
    box.appendChild(countSpan(restricted, 'insight-restricted', ' Restricted'));
    box.appendChild(countSpan(defaulted, 'insight-default', ' fields use policy default'));
    return box;
  }

  // --- Legend ---
  function renderLegend() {
    const legend = el('div', 'access-legend');
    [
      ['open', 'Open Access'],
      ['protected', 'Protected Access'],
      ['restricted', 'Restricted Access']
    ].forEach(([cls, label]) => {
      const item = el('div', 'access-legend-item');
      const badge = el('span', 'badge ' + cls);
      item.appendChild(badge);
      item.appendChild(document.createTextNode(' ' + label));
      legend.appendChild(item);
    });
    return legend;
  }

  // --- Section Header ---
  function sectionHeader(title) {
    const h = el('div', 'section-header');
    h.appendChild(el('h2', 'section-title', title));
    return h;
  }

  // --- Root Types Table ---
  function renderRootTypes() {
    const section = el('div', 'section');
    section.appendChild(sectionHeader('Root Types (Query, Mutation, Subscription)'));
    const content = el('div', 'section-content expanded');
    Object.entries(report.rootTypeAccess).forEach(([typeName, fields]) => {
      // Group fields by new logic
      const openDefaultFields = [], openPublicFields = [], openSecureFields = [], restrictedFields = [];
      fields.forEach(field => {
        if (!field.ruleName && field.condition === 'true') openDefaultFields.push(field); // policy default, public
        else if (field.ruleName && field.condition === 'true') openPublicFields.push(field); // rule, public
        else if (field.ruleName && field.condition !== 'true' && field.condition !== 'false') openSecureFields.push(field); // rule, secure
        else restrictedFields.push(field); // blocked
      });
      const grouped = [
        { label: 'Open (Default)', fields: openDefaultFields, badge: 'open-default' },
        { label: 'Open (Public)', fields: openPublicFields, badge: 'open-public' },
        { label: 'Open (Secure)', fields: openSecureFields, badge: 'open-secure' },
        { label: 'Restricted', fields: restrictedFields, badge: 'restricted' }
      ];
      const typeSection = el('div', 'type-section');
      const typeHeader = el('div', 'type-header');
      typeHeader.appendChild(el('span', 'type-name', typeName));
      const stats = el('span', 'type-stats', `${fields.filter(f => f.ruleName).length} of ${fields.length} fields controlled`);
      typeHeader.appendChild(stats);
      typeSection.appendChild(typeHeader);
      const table = el('table', 'fields-table');
      const thead = el('thead');
      thead.innerHTML = '<tr><th>Field</th><th>Access</th><th>Rule</th><th>Condition</th><th>Reason</th></tr>';
      table.appendChild(thead);
      const tbody = el('tbody');
      grouped.forEach(group => {
        if (group.fields.length === 0) return;
        const groupRow = document.createElement('tr');
        const groupCell = document.createElement('td');
        groupCell.colSpan = 5;
        groupCell.style.background = 'var(--vscode-panel-border)';
        groupCell.style.fontWeight = '600';
        groupCell.textContent = group.label + ' Fields';
        groupRow.appendChild(groupCell);
        tbody.appendChild(groupRow);
        group.fields.forEach(field => {
          const isDefault = !field.ruleName;
          const tr = document.createElement('tr');
          if (isDefault) tr.style.background = 'rgba(255,255,0,0.08)';
          // Field name + star
          const tdField = el('td');
          tdField.appendChild(el('span', 'field-name', field.field));
          if (isDefault) {
            const star = document.createElement('span');
            star.title = 'Uses policy default';
            star.style.color = 'var(--vscode-warningForeground)';
            star.style.fontSize = '14px';
            star.textContent = ' ★';
            tdField.appendChild(star);
          }
          tr.appendChild(tdField);
          // Access badge
          const tdAccess = el('td');
          const badge = el('span', 'access-badge ' + group.badge, group.label);
          tdAccess.appendChild(badge);
          tr.appendChild(tdAccess);
          // Rule
          const tdRule = el('td');
          tdRule.innerHTML = field.ruleName ? `<span class="rule-name">${field.ruleName}</span>` : '-';
          tr.appendChild(tdRule);
          // Condition (truncate/tooltip)
          const tdCond = el('td');
          if (field.condition && field.condition.length > 32) {
            const span = document.createElement('span');
            span.title = field.condition;
            span.textContent = field.condition.slice(0, 32) + '…';
            tdCond.appendChild(span);
          } else {
            tdCond.textContent = field.condition || '-';
          }
          tr.appendChild(tdCond);
          // Reason (truncate/tooltip)
          const tdReason = el('td');
          if (field.reason && field.reason.length > 32) {
            const span = document.createElement('span');
            span.title = field.reason;
            span.textContent = field.reason.slice(0, 32) + '…';
            tdReason.appendChild(span);
          } else {
            tdReason.textContent = field.reason || '-';
          }
          tr.appendChild(tdReason);
          tbody.appendChild(tr);
        });
      });
      table.appendChild(tbody);
      typeSection.appendChild(table);
      content.appendChild(typeSection);
    });
    section.appendChild(content);
    return section;
  }

  // --- Access Path Color Helper ---
  function accessPathColor(path) {
    if (path.status !== 'accessible') return 'ap-blocked';
    if (!path.ruleName) return 'ap-gap'; // Red
    if (path.condition === 'true') return 'ap-public'; // Yellow
    return 'ap-secure'; // Green
  }

  // --- Access Path Legend ---
  function renderAccessPathLegend() {
    const legend = el('div', 'access-path-legend');
    [
      ['ap-gap', 'Accessible (policy default, potential security gap)'],
      ['ap-public', 'Accessible (public, condition: true)'],
      ['ap-secure', 'Accessible (covered by rule)'],
      ['ap-blocked', 'Blocked (not accessible)']
    ].forEach(([cls, label]) => {
      const item = el('span', 'access-path-legend-item');
      const badge = el('span', 'access-path ' + cls);
      item.appendChild(badge);
      item.appendChild(document.createTextNode(' ' + label));
      legend.appendChild(item);
    });
    return legend;
  }

  // --- Custom Types Table ---
  function renderCustomTypes() {
    const section = el('div', 'section');
    section.appendChild(sectionHeader('Custom Types'));
    const content = el('div', 'section-content expanded');
    // Explanation
    const expl = el('div', 'custom-types-explanation');
    expl.innerHTML = '<strong>Controlled:</strong> This type has its own field policy. <strong>Inherited:</strong> This type\'s access depends on the root type(s) that return it.';
    content.appendChild(expl);
    content.appendChild(renderAccessPathLegend());
    Object.entries(report.customTypeAccess).forEach(([typeName, typeData]) => {
      const typeSection = el('div', 'type-section');
      const typeHeader = el('div', 'type-header');
      typeHeader.appendChild(el('span', 'type-name', typeName));
      const eff = el('span', 'effective-access effective-' + typeData.effectiveAccess, typeData.effectiveAccess);
      const stats = el('span', 'type-stats', `${typeData.fields.filter(f => f.access === 'controlled').length} of ${typeData.fields.length} fields controlled`);
      const headerRight = el('div');
      headerRight.style.display = 'flex';
      headerRight.style.alignItems = 'center';
      headerRight.style.gap = '12px';
      headerRight.appendChild(eff);
      headerRight.appendChild(stats);
      typeHeader.appendChild(headerRight);
      typeSection.appendChild(typeHeader);

      // Always show access paths for this type
      const ap = el('div', 'access-paths');
      ap.innerHTML = '<strong>Access Paths:</strong><br>' +
        typeData.accessPaths.map(path => {
          const span = el('span', 'access-path ' + accessPathColor(path), path.rootField);
          span.title = 'Path: ' + (path.path ? path.path.join(' → ') : path.rootField) + '\n' + (path.reason || '');
          return span.outerHTML;
        }).join(' ');
      typeSection.appendChild(ap);

      if (typeData.hasPolicy) {
        // Group fields by new logic
        const openDefaultFields = [], openPublicFields = [], openSecureFields = [], restrictedFields = [];
        typeData.fields.forEach(field => {
          if (!field.ruleName && field.condition === 'true') openDefaultFields.push(field); // policy default, public
          else if (field.ruleName && field.condition === 'true') openPublicFields.push(field); // rule, public
          else if (field.ruleName && field.condition !== 'true' && field.condition !== 'false') openSecureFields.push(field); // rule, secure
          else restrictedFields.push(field); // blocked
        });
        const grouped = [
          { label: 'Open (Default)', fields: openDefaultFields, badge: 'open-default' },
          { label: 'Open (Public)', fields: openPublicFields, badge: 'open-public' },
          { label: 'Open (Secure)', fields: openSecureFields, badge: 'open-secure' },
          { label: 'Restricted', fields: restrictedFields, badge: 'restricted' }
        ];
        const table = el('table', 'fields-table');
        const thead = el('thead');
        thead.innerHTML = '<tr><th>Field</th><th>Access</th><th>Rule</th><th>Condition</th><th>Reason</th></tr>';
        table.appendChild(thead);
        const tbody = el('tbody');
        grouped.forEach(group => {
          if (group.fields.length === 0) return;
          const groupRow = document.createElement('tr');
          const groupCell = document.createElement('td');
          groupCell.colSpan = 5;
          groupCell.style.background = 'var(--vscode-panel-border)';
          groupCell.style.fontWeight = '600';
          groupCell.textContent = group.label + ' Fields';
          groupRow.appendChild(groupCell);
          tbody.appendChild(groupRow);
          group.fields.forEach(field => {
            const isDefault = !field.ruleName;
            const tr = document.createElement('tr');
            if (isDefault) tr.style.background = 'rgba(255,255,0,0.08)';
            // Field name + star
            const tdField = el('td');
            tdField.appendChild(el('span', 'field-name', field.field));
            if (isDefault) {
              const star = document.createElement('span');
              star.title = 'Uses policy default';
              star.style.color = 'var(--vscode-warningForeground)';
              star.style.fontSize = '14px';
              star.textContent = ' ★';
              tdField.appendChild(star);
            }
            tr.appendChild(tdField);
            // Access badge
            const tdAccess = el('td');
            const badge = el('span', 'access-badge ' + group.badge, group.label);
            tdAccess.appendChild(badge);
            tr.appendChild(tdAccess);
            // Rule
            const tdRule = el('td');
            tdRule.innerHTML = field.ruleName ? `<span class="rule-name">${field.ruleName}</span>` : '-';
            tr.appendChild(tdRule);
            // Condition (truncate/tooltip)
            const tdCond = el('td');
            if (field.condition && field.condition.length > 32) {
              const span = document.createElement('span');
              span.title = field.condition;
              span.textContent = field.condition.slice(0, 32) + '…';
              tdCond.appendChild(span);
            } else {
              tdCond.textContent = field.condition || '-';
            }
            tr.appendChild(tdCond);
            // Reason (truncate/tooltip)
            const tdReason = el('td');
            if (field.reason && field.reason.length > 32) {
              const span = document.createElement('span');
              span.title = field.reason;
              span.textContent = field.reason.slice(0, 32) + '…';
              tdReason.appendChild(span);
            } else {
              tdReason.textContent = field.reason || '-';
            }
            tr.appendChild(tdReason);
            tbody.appendChild(tr);
          });
        });
        table.appendChild(tbody);
        typeSection.appendChild(table);
      } else {
        const note = el('div');
        note.style.marginTop = '12px';
        note.style.color = 'var(--vscode-descriptionForeground)';
        note.style.fontSize = '12px';
        note.textContent = 'No direct policy - access depends on root type access';
        typeSection.appendChild(note);
      }
      content.appendChild(typeSection);
    });
    section.appendChild(content);
    return section;
  }

  // --- Main Render ---
  root.innerHTML = '';
  root.appendChild(renderSummary());
  root.appendChild(renderLegend());
  root.appendChild(renderRootTypes());
  root.appendChild(renderCustomTypes());
}; 
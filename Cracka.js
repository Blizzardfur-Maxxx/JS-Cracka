(async () => {
  function isEditableValue(val) {
    val = val.trim();
    if (val === 'true' || val === 'false') return true;
    if (/^-?\d+(\.\d+)?$/.test(val) || /^0x[0-9a-f]+$/i.test(val)) return true;
    if (/^(['"]).*\1$/.test(val)) return true;
    return false;
  }

  function extractEditableVariables(code, filterByType = false) {
    const reserved = [
      'get', 'set', 'function', 'class', 'delete', 'typeof', 'instanceof',
      'constructor', '__proto__', 'hasOwnProperty', 'prototype', 'toString'
    ];

    const patterns = [
      /(?:^|\s)(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*([^;\n]+)/g,
      /([a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+)\s*=\s*([^;\n]+)/g,
      /export\s+(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*([^;\n]+)/g,
      /function\s+[a-zA-Z0-9_$]*\s*\(([^)]*)\)/g,
      /\(([^)]*=[^)]*)\)\s*=>/g,
      /this\.([a-zA-Z0-9_$]+)\s*=\s*([^;\n]+)/g,
      /{([^}]+)}/g,
      /([a-zA-Z0-9_$]+)\s*=\s*([^;\n]+)/g
    ];

    let results = [];

    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(code)) !== null) {
        if (regex.source.includes('function') || regex.source.includes('=>')) {
          const paramDefaults = match[1]
            .split(',')
            .map(p => p.trim())
            .filter(p => p.includes('='));
          for (const pd of paramDefaults) {
            const [name, value] = pd.split('=').map(s => s.trim());
            if (reserved.includes(name)) continue;
            if (!filterByType || isEditableValue(value)) {
              results.push({ name, value, fullMatch: pd });
            }
          }
        } else if (regex.source.startsWith('{')) {
          const props = match[1].split(',').map(p => p.trim()).filter(Boolean);
          for (const prop of props) {
            if (prop.includes('=')) {
              const [name, value] = prop.split('=').map(s => s.trim());
              if (reserved.includes(name)) continue;
              if (!filterByType || isEditableValue(value)) {
                results.push({ name, value, fullMatch: prop });
              }
            }
          }
        } else {
          const name = (regex.source.includes('this.') || match[1].includes('.')) 
            ? match[1] 
            : match[2] || match[1];
          if (reserved.includes(name)) continue;
          const value = match[3] || match[2];
          if (!filterByType || isEditableValue(value.trim())) {
            results.push({ name, value: value.trim(), fullMatch: match[0] });
          }
        }
      }
    }

    return results;
  }

  const sidebar = document.createElement('div');
  sidebar.style = `position: fixed; top: 20px; right: 20px; width: 720px; height: 85vh; background: rgba(0,0,0,0.5); backdrop-filter: blur(12px); z-index: 999999; font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.1); color: #e0e0e0; transition: height 0.3s ease;`;
  document.body.appendChild(sidebar);

  const header = document.createElement('div');
  header.style = `padding: 10px 16px; background: rgba(0,0,0,0.6); border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;`;
  const title = document.createElement('span');
  title.innerText = 'JS Cracka (Live Script + Var Editor)';
  header.appendChild(title);

  const minimizeBtn = document.createElement('div');
  minimizeBtn.innerText = '−';
  minimizeBtn.style = `cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid #444; padding: 2px 8px; font-size: 18px; line-height: 1; text-align: center; color: #fff;`;
  header.appendChild(minimizeBtn);
  sidebar.appendChild(header);

  const list = document.createElement('select');
  list.style = `margin: 10px 16px; padding: 6px; border: 1px solid #333; background: rgba(24,24,24,0.7); color: #eee; width: calc(100% - 32px); font-size: 14px;`;
  sidebar.appendChild(list);

  const container = document.createElement('div');
  container.style = `display: flex; flex: 1; overflow: hidden; gap: 0; padding: 0 16px; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1);`;

  const editor = document.createElement('textarea');
  editor.style = `width: 50%; height: 100%; background: rgba(15,15,15,0.9); color: #f0f0f0; border: none; font-family: monospace; font-size: 13px; padding: 8px; resize: none;`;
  container.appendChild(editor);

  const rightPanel = document.createElement('div');
  rightPanel.style = 'width: 50%; display: flex; flex-direction: column;';

  const boolNumStrCheckboxLabel = document.createElement('label');
  boolNumStrCheckboxLabel.style = `color: #ccc; font-size: 13px; display: flex; align-items: center; gap: 6px; margin: 10px 0 0 0;`;

  const boolNumStrCheckbox = document.createElement('input');
  boolNumStrCheckbox.type = 'checkbox';
  boolNumStrCheckbox.checked = true;
  boolNumStrCheckbox.style.width = '16px';
  boolNumStrCheckbox.style.height = '16px';
  boolNumStrCheckbox.style.margin = '0';
  boolNumStrCheckbox.style.accentColor = '#eee';

  boolNumStrCheckboxLabel.appendChild(boolNumStrCheckbox);
  boolNumStrCheckboxLabel.appendChild(document.createTextNode('Scan only Boolean, Numeric, String'));
  rightPanel.appendChild(boolNumStrCheckboxLabel);

  const searchInput = document.createElement('input');
  searchInput.placeholder = 'Search variables...';
  searchInput.style = `padding: 6px; margin: 6px 0 10px 0; background: rgba(30,30,30,0.9); border: 1px solid #444; color: #ccc; font-size: 13px; width: calc(100% - 16px);`;
  rightPanel.appendChild(searchInput);

  const varsPanel = document.createElement('div');
  varsPanel.style = `flex: 1; overflow-y: auto; padding: 0 8px 8px 0;`;
  rightPanel.appendChild(varsPanel);

  container.appendChild(rightPanel);
  sidebar.appendChild(container);

  const btnContainer = document.createElement('div');
  btnContainer.style = `padding: 10px 16px; background: rgba(0,0,0,0.4); display: flex; justify-content: flex-end; gap: 12px;`;
  const btnStyle = `padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid #444; color: #fff; font-size: 13px; text-align: center; cursor: pointer;`;

  const applyBtn = document.createElement('div');
  applyBtn.innerText = 'Apply';
  applyBtn.style = btnStyle;
  btnContainer.appendChild(applyBtn);
  sidebar.appendChild(btnContainer);

  const refreshBtn = document.createElement('div');
  refreshBtn.innerText = 'Refresh';
  refreshBtn.style = btnStyle;
  btnContainer.appendChild(refreshBtn);

  const scripts = Array.from(document.querySelectorAll('script')).filter(s => !s.type || s.type === 'text/javascript');

  async function fetchScriptContent(src) {
    try {
      const resp = await fetch(src);
      if (resp.ok) return await resp.text();
    } catch {}
    return '';
  }

  async function populateList() {
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const label = script.src ? script.src : `inline #${i + 1}`;
      const content = script.src ? await fetchScriptContent(script.src) : script.textContent;
      list.options.add(new Option(label, i));
      scripts[i].__content = content || '';
    }
    if (scripts.length) loadEditor(0);
  }

  let currentVars = [];

  function loadEditor(index) {
    const content = scripts[index].__content;
    editor.value = content;
    currentVars = extractEditableVariables(content, boolNumStrCheckbox.checked);
    updateVarsPanel(currentVars);
  }

  function updateVarsPanel(vars, filter = '') {
    varsPanel.innerHTML = '';
    const lower = filter.toLowerCase();
    vars.filter(v => v.name.toLowerCase().includes(lower)).forEach(v => {
      const wrapper = document.createElement('div');
      wrapper.style = `margin-bottom: 6px; padding: 4px; border-bottom: 1px solid #333;`;
      const label = document.createElement('div');
      label.textContent = `${v.name} =`;
      label.style = 'font-size: 12px; margin-bottom: 4px;';
      const input = document.createElement('input');
      input.value = v.value;
      input.setAttribute('data-varname', v.name);
      input.style = `width: 100%; padding: 4px; font-family: monospace; background: rgba(0,0,0,0.3); border: 1px solid #333; color: #eee; font-size: 12px;`;
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      varsPanel.appendChild(wrapper);
    });
  }

  searchInput.addEventListener('input', () => {
    updateVarsPanel(currentVars, searchInput.value);
  });

  boolNumStrCheckbox.addEventListener('change', () => {
    const index = parseInt(list.value);
    if (index >= 0) {
      const content = scripts[index].__content;
      currentVars = extractEditableVariables(content, boolNumStrCheckbox.checked);
      updateVarsPanel(currentVars, searchInput.value);
    }
  });

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeForCode(str) {
    // Escapes single quotes and backslashes, safest for code strings
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function replaceVarInCode(code, varName, newVal) {
    // Regex for matching variable declarations with word boundaries
    const regex = new RegExp(
      `(export\\s+)?(const|let|var)\\s+\\b${escapeRegex(varName)}\\b\\s*=\\s*([^;\\n]+)`,
      'g'
    );
    return code.replace(regex, (match, exportPart, declType, oldVal) => {
      // Replace with same export/declType + newVal properly escaped if needed
      if (/^['"]/.test(newVal) || /^(true|false|\d+(\.\d+)?|0x[a-f0-9]+)$/i.test(newVal)) {
        // Assume newVal is safe literal (boolean, number, hex, or quoted string)
        return `${exportPart || ''}${declType} ${varName} = ${newVal}`;
      } else {
        // Otherwise, quote it safely
        return `${exportPart || ''}${declType} ${varName} = '${escapeForCode(newVal)}'`;
      }
    });
  }

  function updateScriptTag(index, newCode) {
    const oldScript = scripts[index];
    const newScript = document.createElement('script');
    newScript.type = oldScript.type || 'text/javascript';

    if (oldScript.src) {
      // External script - reload with cache busting param
      const separator = oldScript.src.includes('?') ? '&' : '?';
      newScript.src = oldScript.src + separator + '_cb=' + Date.now();
      newScript.async = oldScript.async;
      newScript.defer = oldScript.defer;
    } else {
      // Inline script - inject as is, no IIFE wrapping
      newScript.textContent = newCode;
    }

    oldScript.parentNode.insertBefore(newScript, oldScript.nextSibling);
    oldScript.remove();
    scripts[index] = newScript; // Update reference
    newScript.__content = newCode;
  }

  applyBtn.addEventListener('click', () => {
    const index = parseInt(list.value);
    if (index < 0) return;
    let code = editor.value;
    const inputs = Array.from(varsPanel.querySelectorAll('input'));
    inputs.forEach(input => {
      const varName = input.getAttribute('data-varname');
      const newVal = input.value.trim();
      if (varName && newVal !== undefined) {
        code = replaceVarInCode(code, varName, newVal);
      }
    });

    try {
      updateScriptTag(index, code);
      scripts[index].__content = code;
      currentVars = extractEditableVariables(code, boolNumStrCheckbox.checked);
      updateVarsPanel(currentVars);
      alert('Script updated successfully!');
    } catch (e) {
      alert('Failed to update script: ' + e.message);
    }
  });

  list.addEventListener('change', () => {
    const index = parseInt(list.value);
    if (index >= 0) loadEditor(index);
  });

  refreshBtn.addEventListener('click', () => {
    location.reload();
  });

  minimizeBtn.addEventListener('click', () => {
    if (sidebar.style.height === '40px') {
      sidebar.style.height = '85vh';
      minimizeBtn.innerText = '−';
      list.style.display = 'block';
      container.style.display = 'flex';
      btnContainer.style.display = 'flex';
    } else {
      sidebar.style.height = '40px';
      minimizeBtn.innerText = '+';
      list.style.display = 'none';
      container.style.display = 'none';
      btnContainer.style.display = 'none';
    }
  });

  await populateList();
})();

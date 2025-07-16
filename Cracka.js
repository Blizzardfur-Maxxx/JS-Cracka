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

    const results = [];

    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(code)) !== null) {
        if (regex.source.includes('function') || regex.source.includes('=>')) {
          const paramDefaults = match[1].split(',').map(p => p.trim()).filter(p => p.includes('='));
          for (const pd of paramDefaults) {
            const [name, value] = pd.split('=').map(s => s.trim());
            if (!reserved.includes(name) && (!filterByType || isEditableValue(value))) {
              results.push({ name, value, fullMatch: pd });
            }
          }
        } else if (regex.source.startsWith('{')) {
          const props = match[1].split(',').map(p => p.trim()).filter(Boolean);
          for (const prop of props) {
            if (prop.includes('=')) {
              const [name, value] = prop.split('=').map(s => s.trim());
              if (!reserved.includes(name) && (!filterByType || isEditableValue(value))) {
                results.push({ name, value, fullMatch: prop });
              }
            }
          }
        } else {
          const name = (regex.source.includes('this.') || match[1].includes('.')) ? match[1] : match[2] || match[1];
          const value = match[3] || match[2];
          if (!reserved.includes(name) && (!filterByType || isEditableValue(value.trim()))) {
            results.push({ name, value: value.trim(), fullMatch: match[0] });
          }
        }
      }
    }

    return results;
  }

  const sleep = ms => new Promise(res => setTimeout(res, ms));

  const sidebar = document.createElement('div');
  sidebar.style = `position: fixed; top: 20px; right: 20px; width: 720px; height: 85vh; background: rgba(0,0,0,0.5); backdrop-filter: blur(12px); z-index: 999999; font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.1); color: #e0e0e0; transition: height 0.3s ease;`;
  document.body.appendChild(sidebar);

  const header = document.createElement('div');
  header.style = `padding: 10px 16px; background: rgba(0,0,0,0.6); border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;`;
  header.innerHTML = `<span>JS Cracka (Live Script + Var Editor)</span>`;
  const minimizeBtn = document.createElement('div');
  minimizeBtn.innerText = '−';
  minimizeBtn.style = `cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid #444; padding: 2px 8px; font-size: 18px; line-height: 1; color: #fff;`;
  header.appendChild(minimizeBtn);
  sidebar.appendChild(header);

  const list = document.createElement('select');
  list.style = `margin: 10px 16px; padding: 6px; border: 1px solid #333; background: rgba(24,24,24,0.7); color: #eee; width: calc(100% - 32px); font-size: 14px;`;
  sidebar.appendChild(list);

  const container = document.createElement('div');
  container.style = `display: flex; flex: 1; overflow: hidden; padding: 0 16px;`;
  sidebar.appendChild(container);

  const editor = document.createElement('textarea');
  editor.style = `width: 50%; height: 100%; background: #111; color: #eee; font-family: monospace; font-size: 13px; padding: 8px; border: none; resize: none; overflow: auto;`;
  container.appendChild(editor);

  const rightPanel = document.createElement('div');
  rightPanel.style = 'width: 50%; display: flex; flex-direction: column;';
  container.appendChild(rightPanel);

  const boolNumStrCheckboxLabel = document.createElement('label');
  boolNumStrCheckboxLabel.style = `color: #ccc; font-size: 13px; display: flex; align-items: center; gap: 6px; margin: 10px 0 0 0;`;
  const boolNumStrCheckbox = document.createElement('input');
  boolNumStrCheckbox.type = 'checkbox';
  boolNumStrCheckbox.checked = true;
  boolNumStrCheckboxLabel.appendChild(boolNumStrCheckbox);
  boolNumStrCheckboxLabel.appendChild(document.createTextNode('Scan only Boolean, Numeric, String'));
  rightPanel.appendChild(boolNumStrCheckboxLabel);

  const searchInput = document.createElement('input');
  searchInput.placeholder = 'Search variables...';
  searchInput.style = `padding: 6px; margin: 6px 0; background: #222; border: 1px solid #444; color: #ccc; font-size: 13px; width: calc(100% - 16px);`;
  rightPanel.appendChild(searchInput);

  const varsPanel = document.createElement('div');
  varsPanel.style = `flex: 1; overflow-y: auto; padding: 4px 8px 8px 0; font-size: 12px;`;
  rightPanel.appendChild(varsPanel);

  const btnContainer = document.createElement('div');
  btnContainer.style = `padding: 10px 16px; background: rgba(0,0,0,0.4); display: flex; justify-content: flex-end; gap: 12px;`;
  const btnStyle = `padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid #444; color: #fff; font-size: 13px; cursor: pointer;`;

  const applyBtn = document.createElement('div');
  applyBtn.innerText = 'Apply';
  applyBtn.style = btnStyle;
  btnContainer.appendChild(applyBtn);

  const refreshBtn = document.createElement('div');
  refreshBtn.innerText = 'Refresh';
  refreshBtn.style = btnStyle;
  btnContainer.appendChild(refreshBtn);

  sidebar.appendChild(btnContainer);

  const scripts = Array.from(document.querySelectorAll('script')).filter(s => !s.type || s.type === 'text/javascript');

  async function fetchScriptContent(src) {
    try {
      const resp = await fetch(src);
      return resp.ok ? await resp.text() : '';
    } catch {
      return '';
    }
  }

  async function populateList() {
    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i];
      const label = s.src ? s.src : `inline #${i + 1}`;
      const content = s.src ? await fetchScriptContent(s.src) : s.textContent;
      list.options.add(new Option(label, i));
      s.__content = content || '';
    }
    if (scripts.length) loadEditor(0);
  }

  let currentVars = [];

  function loadEditor(index) {
    const content = scripts[index].__content;
    editor.value = content.slice(0, 2e6); // limit 2MB for render safety
    currentVars = extractEditableVariables(content, boolNumStrCheckbox.checked);
    updateVarsPanel(currentVars);
  }

  function updateVarsPanel(vars, filter = '') {
    varsPanel.innerHTML = '';
    const lower = filter.toLowerCase();
    vars.filter(v => v.name.toLowerCase().includes(lower)).forEach(v => {
      const wrapper = document.createElement('div');
      wrapper.style = `margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 4px;`;
      const label = document.createElement('div');
      label.textContent = `${v.name} =`;
      const input = document.createElement('input');
      input.value = v.value;
      input.setAttribute('data-varname', v.name);
      input.style = `width: 100%; font-family: monospace; background: #222; color: #eee; border: 1px solid #444; padding: 4px;`;
      wrapper.append(label, input);
      varsPanel.appendChild(wrapper);
    });
  }

  function replaceVarInCode(code, varName, newVal) {
    const regex = new RegExp(`(export\\s+)?(const|let|var)\\s+\\b${varName}\\b\\s*=\\s*([^;\\n]+)`, 'g');
    return code.replace(regex, (_, exportPart, decl, oldVal) => {
      const safeVal = /^['"]/.test(newVal) || /^(true|false|\d+(\.\d+)?|0x[a-f0-9]+)$/i.test(newVal)
        ? newVal : `'${newVal.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
      return `${exportPart || ''}${decl} ${varName} = ${safeVal}`;
    });
  }

  function updateScriptTag(index, newCode) {
    const old = scripts[index];
    const tag = document.createElement('script');
    tag.type = old.type || 'text/javascript';
    if (old.src) {
      const sep = old.src.includes('?') ? '&' : '?';
      tag.src = `${old.src}${sep}_cb=${Date.now()}`;
    } else {
      tag.textContent = newCode;
    }
    old.replaceWith(tag);
    scripts[index] = tag;
    tag.__content = newCode;
  }

  applyBtn.onclick = () => {
    const idx = parseInt(list.value);
    if (idx < 0) return;
    let code = editor.value;
    varsPanel.querySelectorAll('input').forEach(input => {
      const name = input.dataset.varname;
      const val = input.value.trim();
      code = replaceVarInCode(code, name, val);
    });
    try {
      updateScriptTag(idx, code);
      scripts[idx].__content = code;
      currentVars = extractEditableVariables(code, boolNumStrCheckbox.checked);
      updateVarsPanel(currentVars);
      alert('Updated!');
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  };

  refreshBtn.onclick = () => location.reload();
  list.onchange = () => loadEditor(parseInt(list.value));
  boolNumStrCheckbox.onchange = () => {
    const idx = parseInt(list.value);
    if (idx >= 0) {
      currentVars = extractEditableVariables(scripts[idx].__content, boolNumStrCheckbox.checked);
      updateVarsPanel(currentVars, searchInput.value);
    }
  };
  searchInput.oninput = () => updateVarsPanel(currentVars, searchInput.value);

  minimizeBtn.onclick = () => {
    const collapsed = sidebar.style.height === '40px';
    sidebar.style.height = collapsed ? '85vh' : '40px';
    minimizeBtn.innerText = collapsed ? '−' : '+';
    [list, container, btnContainer].forEach(el => el.style.display = collapsed ? '' : 'none');
  };

  await populateList();
})();

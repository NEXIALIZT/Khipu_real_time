const fs = require('fs');
const path = require('path');

function patchDir(d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach(f => {
    const full = path.join(d, f);
    try {
      if (fs.statSync(full).isDirectory()) {
        if (f === 'node_modules' || !f.startsWith('.')) {
          patchDir(full);
        }
      } else if (f === 'parse.js' && full.includes('@expo') && full.includes('env') && full.includes('build')) {
        let c = fs.readFileSync(full, 'utf8');
        if (c.includes('_nodeUtil().parseEnv') && !c.includes('parser = (0, _nodeUtil().parseEnv) ||')) {
          const patch = `const parser = (0, _nodeUtil().parseEnv) || function(str) {
    const res = {};
    str.toString().split('\\n').forEach(l => {
      const m = l.match(/^\\s*([\\w.-]+)\\s*=\\s*(.*)?\\s*$/);
      if (m && m[1] !== '#') {
        let v = m[2] || '';
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\\\n/g, '\\n');
        else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
        res[m[1]] = v.trim();
      }
    });
    return res;
  };
  const parsed = parser(contents);`;
          c = c.replace('const parsed = (0, _nodeUtil().parseEnv)(contents);', patch);
          fs.writeFileSync(full, c, 'utf8');
          console.log('Successfully patched:', full);
        }
      }
    } catch (e) { }
  });
}

patchDir(path.join(__dirname, 'node_modules'));
console.log('All @expo/env instances patched for Node v20.9.0!');

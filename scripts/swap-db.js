const fs = require('fs');
const path = require('path');

function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }

(function main(){
  const dataDir = path.resolve(process.cwd(), 'data');
  const backupsDir = path.join(dataDir, 'backups');
  const src = path.join(dataDir, 'resto-system.new.db');
  const dst = path.join(dataDir, 'resto-system.db');
  ensureDir(dataDir); ensureDir(backupsDir);
  if (!fs.existsSync(src)) {
    console.error('Source not found:', src);
    process.exit(1);
  }
  if (fs.existsSync(dst)) {
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const backupName = `before-swap-${ts}.db`;
    fs.copyFileSync(dst, path.join(backupsDir, backupName));
    console.log('Backed up current DB to', path.join('data','backups', backupName));
  }
  fs.copyFileSync(src, dst);
  console.log('Copied', path.join('data','resto-system.new.db'), '->', path.join('data','resto-system.db'));
})();

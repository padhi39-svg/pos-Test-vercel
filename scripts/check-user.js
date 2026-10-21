const Database = require('better-sqlite3');
const db = new Database('C:/Users/DELL/CascadeProjects/Nay System/data/resto-system.db');
const users = db.prepare("SELECT id, code, name, email, password_hash, aktif FROM master_users").all();
console.log('Users:');
users.forEach(u => console.log('  id:', u.id, 'code:', u.code, 'name:', u.name, 'email:', u.email, 'hash:', u.password_hash, 'aktif:', u.aktif));
db.close();

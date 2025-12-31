import { db } from './db.js';
import { hashPassword } from './auth.js';

async function resetAdminPassword() {
  const email = 'r@teambarker.com';
  const newPassword = 'Admin2024!';
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    console.error(`User ${email} not found!`);
    process.exit(1);
  }
  
  console.log(`Resetting password for ${email}...`);
  const password_hash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);
  console.log(`✓ Password reset for ${email}`);
  console.log(`  New password: ${newPassword}`);
}

resetAdminPassword()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });


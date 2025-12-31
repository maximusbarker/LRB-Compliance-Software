import { db } from './db.js';
import { hashPassword, findUserByEmail, createUser } from './auth.js';
import { v4 as uuid } from 'uuid';

async function createAdminUsers() {
  // Get or create an admin organization
  let adminOrg = db.prepare('SELECT * FROM organizations WHERE code = ?').get('ADMIN');
  
  if (!adminOrg) {
    const orgId = uuid();
    db.prepare('INSERT INTO organizations (id, name, code) VALUES (?, ?, ?)').run(
      orgId,
      'Administration',
      'ADMIN'
    );
    adminOrg = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
    console.log('Created ADMIN organization');
  }

  const adminEmails = ['r@teambarker.com', 'm@teambarker.com'];
  const defaultPassword = 'Admin2024!'; // Change this password after first login
  
  console.log('Creating admin users...');
  console.log('Default password for both accounts:', defaultPassword);
  console.log('Please change these passwords after first login!\n');

  for (const email of adminEmails) {
    // Check if user already exists
    const existing = findUserByEmail(email);
    if (existing) {
      // Update to admin role if not already
      if (existing.role !== 'admin') {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', existing.id);
        console.log(`✓ Updated ${email} to admin role`);
      } else {
        console.log(`✓ ${email} already exists as admin`);
      }
      continue;
    }

    // Create new admin user
    try {
      const password_hash = await hashPassword(defaultPassword);
      const user = createUser({
        email: email.toLowerCase(),
        password_hash,
        role: 'admin',
        org_id: adminOrg.id
      });
      console.log(`✓ Created admin user: ${email}`);
    } catch (err) {
      console.error(`✗ Failed to create ${email}:`, err.message);
    }
  }

  console.log('\nAdmin user creation complete!');
  console.log('Both accounts can now log in with:');
  console.log('  Email: r@teambarker.com or m@teambarker.com');
  console.log('  Password: Admin2024!');
  console.log('\n⚠️  IMPORTANT: Change these passwords after first login!');
}

createAdminUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });


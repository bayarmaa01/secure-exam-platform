import { pool } from './src/db'
import bcrypt from 'bcrypt'

async function checkPasswords() {
  const client = await pool.connect()
  try {
    console.log('=== CHECKING PASSWORDS ===\n')
    
    // Get all users with their password hashes
    const usersResult = await client.query('SELECT id, email, name, role, password_hash FROM users')
    console.log('Users in database:')
    console.table(usersResult.rows)
    
    // Test password verification for each user
    const testPasswords = ['password123', 'Password123!', 'teacher', 'student']
    
    for (const user of usersResult.rows) {
      console.log(`\n--- Testing passwords for ${user.email} ---`)
      
      for (const testPwd of testPasswords) {
        try {
          const isMatch = await bcrypt.compare(testPwd, user.password_hash)
          console.log(`Password "${testPwd}": ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`)
        } catch (error) {
          console.log(`Password "${testPwd}": ❌ ERROR - ${error.message}`)
        }
      }
    }
    
    // Let's also create a test user with a known password
    console.log('\n--- Creating test user with known password ---')
    const testPassword = 'Password123!'
    const hash = await bcrypt.hash(testPassword, 10)
    
    await client.query(
      `INSERT INTO users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO UPDATE SET password_hash = $2`,
      ['test-teacher@example.com', hash, 'Test Teacher', 'teacher']
    )
    
    console.log('Created/updated test-teacher@example.com with password: Password123!')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkPasswords()

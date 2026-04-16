import { pool } from './src/db'
import bcrypt from 'bcrypt'

async function fixStudentPassword() {
  const client = await pool.connect()
  try {
    console.log('=== FIXING STUDENT PASSWORD ===\n')
    
    // Update student password with a known password
    const testPassword = 'Password123!'
    const hash = await bcrypt.hash(testPassword, 10)
    
    await client.query(
      `UPDATE users 
       SET password_hash = $1 
       WHERE email = 'test@example.com'`,
      [hash]
    )
    
    console.log('✅ Updated test@example.com password to: Password123!')
    
    // Verify the update
    const userResult = await client.query(
      'SELECT email, name, role FROM users WHERE email = $1',
      ['test@example.com']
    )
    
    console.log('Updated user:', userResult.rows[0])
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

fixStudentPassword()

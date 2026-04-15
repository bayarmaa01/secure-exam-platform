import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `http://localhost:3005/reset-password?token=${resetToken}`
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset - Secure Exam Platform',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested to reset your password for the Secure Exam Platform. Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>Secure Exam Platform Team</p>
      </div>
    `
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log('Password reset email sent to:', email)
  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw new Error('Failed to send password reset email')
  }
}

export async function verifyEmailConfiguration() {
  try {
    await transporter.verify()
    console.log('Email service is ready')
    return true
  } catch (error) {
    console.error('Email service configuration error:', error)
    return false
  }
}

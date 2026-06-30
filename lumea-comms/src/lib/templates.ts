const appUrl = () => process.env.APP_URL ?? "https://lumea.ink";

export const templates = {
  otp: (otp: string, name: string) => ({
    subject: "Your Lumea verification code",
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#1a1a1a;font-size:24px">Hi ${name},</h1>
  <p style="color:#555">Your verification code is:</p>
  <div style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#18181b">${otp}</span>
  </div>
  <p style="color:#888;font-size:14px">Valid for 10 minutes. Don't share this with anyone.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Lumea · Fill your paper with the breathings of your heart.</p>
</div>`,
  }),

  passwordReset: (token: string, name: string) => ({
    subject: "Reset your Lumea password",
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#1a1a1a">Hi ${name},</h1>
  <p>Click the link below to reset your password. Valid for 60 minutes.</p>
  <a href="${appUrl()}/reset-password?token=${token}"
     style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
    Reset Password
  </a>
  <p style="color:#888;font-size:14px">If you didn't request this, you can safely ignore this email.</p>
</div>`,
  }),

  welcome: (name: string, username: string) => ({
    subject: `Welcome to Lumea, ${name}!`,
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#1a1a1a">Welcome, ${name}! 🎉</h1>
  <p>Your account <strong>@${username}</strong> is ready.</p>
  <a href="${appUrl()}"
     style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
    Start Reading
  </a>
  <p style="color:#888;font-size:14px">Lumea · Fill your paper with the breathings of your heart.</p>
</div>`,
  }),

  newFollower: (followerName: string, followerUsername: string, recipientName: string) => ({
    subject: `${followerName} started following you on Lumea`,
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <p>Hi ${recipientName},</p>
  <p><strong>${followerName}</strong> (@${followerUsername}) is now following you on Lumea.</p>
  <a href="${appUrl()}/u/${followerUsername}"
     style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
    View Profile
  </a>
</div>`,
  }),
};

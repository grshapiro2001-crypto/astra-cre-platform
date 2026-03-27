"""Email service for transactional emails.

Uses Resend (resend.com) for email delivery.
Set RESEND_API_KEY environment variable to enable.
When not configured, emails are logged but not sent (dev mode).
"""
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "Talisman IO <hello@talisman.io>")


async def _send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend API. Returns True on success."""
    if not RESEND_API_KEY:
        logger.info(f"[EMAIL DEV MODE] Would send to={to} subject={subject}")
        return True

    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": FROM_EMAIL,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
            if response.status_code == 200:
                logger.info(f"Email sent to {to}: {subject}")
                return True
            else:
                logger.warning(f"Email failed ({response.status_code}): {response.text}")
                return False
    except Exception as e:
        logger.warning(f"Email send error: {e}")
        return False


async def send_waitlist_confirmation(to: str, name: Optional[str] = None) -> bool:
    """Send waitlist confirmation email."""
    greeting = f"Hi {name}," if name else "Hi there,"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-family: 'Cinzel', serif; font-size: 28px; color: #D4AF37; margin: 0;">Talisman IO</h1>
        <p style="color: #888; font-size: 13px; margin-top: 4px;">AI Deal Intelligence for CRE</p>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px;">
        <h2 style="color: #f9fafb; font-size: 20px; margin: 0 0 16px;">{greeting}</h2>
        <p style="color: #9ca3af; line-height: 1.6; margin: 0 0 16px;">
          Welcome to the Talisman IO waitlist. You're now in line for early access to the AI-native
          multifamily investment platform.
        </p>
        <p style="color: #9ca3af; line-height: 1.6; margin: 0 0 24px;">
          <strong style="color: #f9fafb;">What to expect:</strong><br/>
          We're rolling out access in batches. When your spot opens up, you'll get an email with
          login credentials and a quick-start guide. Most waitlist members get access within a week.
        </p>
        <div style="border-top: 1px solid #1f2937; padding-top: 20px; margin-top: 20px;">
          <p style="color: #6b7280; font-size: 13px; margin: 0;">
            Questions? Reply to this email or reach out at griffin@talisman.io.
          </p>
        </div>
      </div>
      <p style="color: #4b5563; font-size: 12px; text-align: center; margin-top: 24px;">
        &copy; 2026 Talisman IO &middot; AI-powered CRE deal intelligence
      </p>
    </div>
    """
    return await _send_email(to, "You're on the Talisman IO waitlist", html)


async def send_welcome_email(to: str, name: Optional[str] = None) -> bool:
    """Send welcome email on account creation."""
    greeting = f"Welcome, {name}!" if name else "Welcome to Talisman!"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-family: 'Cinzel', serif; font-size: 28px; color: #D4AF37; margin: 0;">Talisman IO</h1>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px;">
        <h2 style="color: #f9fafb; font-size: 20px; margin: 0 0 16px;">{greeting}</h2>
        <p style="color: #9ca3af; line-height: 1.6; margin: 0 0 16px;">
          Your Talisman IO account is ready. Here's how to get started:
        </p>
        <ol style="color: #9ca3af; line-height: 1.8; padding-left: 20px;">
          <li><strong style="color: #f9fafb;">Upload a deal</strong> — Drop an OM, rent roll, or T-12 PDF</li>
          <li><strong style="color: #f9fafb;">Review the extraction</strong> — AI parses every line item</li>
          <li><strong style="color: #f9fafb;">Check the deal score</strong> — 0-100 with full factor breakdown</li>
        </ol>
      </div>
    </div>
    """
    return await _send_email(to, f"{greeting} Your Talisman IO account is ready", html)


async def send_password_reset(to: str, reset_token: str) -> bool:
    """Send password reset email."""
    # Use the frontend URL for the reset link
    reset_url = f"https://talisman.io/reset-password?token={reset_token}"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-family: 'Cinzel', serif; font-size: 28px; color: #D4AF37; margin: 0;">Talisman IO</h1>
      </div>
      <div style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px;">
        <h2 style="color: #f9fafb; font-size: 20px; margin: 0 0 16px;">Reset your password</h2>
        <p style="color: #9ca3af; line-height: 1.6; margin: 0 0 24px;">
          Click the button below to reset your password. This link expires in 1 hour.
        </p>
        <div style="text-align: center;">
          <a href="{reset_url}" style="display: inline-block; background: #D4AF37; color: #0A0F1C; padding: 12px 32px; border-radius: 8px; font-weight: 600; text-decoration: none;">
            Reset password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
    """
    return await _send_email(to, "Reset your Talisman IO password", html)

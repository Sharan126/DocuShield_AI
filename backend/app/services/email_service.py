import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from app.config import settings

logger = logging.getLogger("docushield.email")

def send_reset_password_email(username: str, dest_email: str, reset_link: str) -> bool:
    subject = "DocuShield AI - Password Reset Request"
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #020617; color: #f1f5f9; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #1e293b; border-radius: 12px; background-color: #0f172a; padding: 30px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #06b6d4; margin: 0; letter-spacing: 2px;">DOCUSHIELD AI</h2>
            <p style="font-size: 10px; color: #64748b; text-transform: uppercase; margin: 5px 0 0 0;">System Security Clearance</p>
          </div>
          <hr style="border: none; border-top: 1px solid #1e293b; margin: 20px 0;" />
          <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">Hello <strong>{username}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">A password reset request has been initiated for your DocuShield underwriter account. To complete the configuration of your new credentials, please proceed to the reset link below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" style="background-color: #06b6d4; color: #020617; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px; font-size: 14px; display: inline-block;">Configure New Credentials</a>
          </div>
          
          <p style="font-size: 12px; color: #64748b; line-height: 1.6; margin-top: 30px;">If the button above does not work, copy and paste this URL into your browser:</p>
          <p style="font-size: 12px; word-break: break-all; color: #06b6d4; background-color: #020617; padding: 10px; border-radius: 6px; border: 1px solid #1e293b;">{reset_link}</p>
          
          <hr style="border: none; border-top: 1px solid #1e293b; margin-top: 30px;" />
          <p style="font-size: 11px; color: #64748b; text-align: center; margin-bottom: 0;">This is a system-generated alert. If you did not request this, please contact your security administrator.</p>
        </div>
      </body>
    </html>
    """

    # If SMTP host is configured, try sending real email
    if settings.SMTP_HOST:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = dest_email

            part = MIMEText(html_content, "html")
            msg.attach(part)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.starttls()
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, dest_email, msg.as_string())
            
            logger.info(f"Successfully sent real password reset email to {dest_email} via SMTP.")
            return True
        except Exception as smtp_err:
            logger.error(f"SMTP email transmission failed: {smtp_err}. Falling back to mock email saving.")

    # Fallback/Development mode: Save email as HTML file to disk
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"reset_{username}_{timestamp}.html"
        filepath = os.path.join(settings.EMAIL_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"Subject: {subject}\n")
            f.write(f"To: {dest_email}\n")
            f.write(f"Date: {datetime.now().isoformat()}\n")
            f.write("-" * 40 + "\n")
            f.write(html_content)

        logger.info(f"Saved mock reset password email to {filepath}.")
        print(f"\n[DEV MODE - EMAIL SIMULATOR]")
        print(f"To: {dest_email}")
        print(f"Subject: {subject}")
        print(f"Mock email file saved at: file:///{os.path.abspath(filepath).replace(os.sep, '/')}\n")
        return True
    except Exception as io_err:
        logger.error(f"Failed to write mock email to disk: {io_err}")
        return False

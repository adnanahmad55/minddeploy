import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_EMAIL = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASS", "")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

def send_otp_email(recipient_email: str, otp_code: str, purpose: str):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"--- MOCK EMAIL ---")
        print(f"To: {recipient_email}")
        print(f"OTP: {otp_code} for {purpose}")
        print(f"------------------")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = recipient_email
        if purpose == 'signup':
            msg['Subject'] = "MindDeploy - Email Verification"
            body = f"Your verification code is: {otp_code}\n\nThis code will expire in 10 minutes."
        elif purpose == 'reset':
            msg['Subject'] = "MindDeploy - Password Reset"
            body = f"Your password reset code is: {otp_code}\n\nThis code will expire in 10 minutes."
        else:
            msg['Subject'] = "MindDeploy - Verification Code"
            body = f"Your code is: {otp_code}"

        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

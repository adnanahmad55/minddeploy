import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
# Resend requires the "from" address to be onboarding@resend.dev if you haven't verified your own domain
RESEND_FROM = os.environ.get("RESEND_FROM", "onboarding@resend.dev")

def send_otp_email(recipient_email: str, otp_code: str, purpose: str):
    if not RESEND_API_KEY:
        print(f"--- MOCK EMAIL ---")
        print(f"To: {recipient_email}")
        print(f"OTP: {otp_code} for {purpose}")
        print(f"------------------")
        return True, "Mock email sent (No RESEND_API_KEY provided)"

    if purpose == 'signup':
        subject = "MindDeploy - Email Verification"
        body = f"Your verification code is: {otp_code}\n\nThis code will expire in 10 minutes."
    elif purpose == 'reset':
        subject = "MindDeploy - Password Reset"
        body = f"Your password reset code is: {otp_code}\n\nThis code will expire in 10 minutes."
    else:
        subject = "MindDeploy - Verification Code"
        body = f"Your code is: {otp_code}"

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "MindDeploy-Backend/1.0"
    }
    data = {
        "from": RESEND_FROM,
        "to": [recipient_email],
        "subject": subject,
        "text": body
    }
    
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            print(f"Resend API Response: {res_body}")
            return True, "Success"
    except urllib.error.HTTPError as e:
        error_info = e.read().decode("utf-8")
        print(f"Resend HTTPError: {e.code} - {error_info}")
        return False, f"Resend API Error: {error_info}"
    except Exception as e:
        print(f"Error sending email via Resend: {e}")
        return False, str(e)


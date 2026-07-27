import random
from django.core.mail import send_mail
from django.conf import settings
from .models import OTP

def generate_and_send_otp(email):
    # Invalidate previous OTPs for this email
    OTP.objects.filter(email=email, is_verified=False).update(is_verified=True)

    # Generate 6 digit OTP
    code = f"{random.randint(100000, 999999)}"

    # Save to DB
    OTP.objects.create(email=email, code=code)

    # Send Email
    subject = "Your CRM Authentication OTP"
    message = f"Your OTP code is {code}. It is valid for 5 minutes."
    try:
        send_mail(
            subject,
            message,
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

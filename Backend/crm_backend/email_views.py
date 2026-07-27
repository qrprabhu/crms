from django.core.mail import send_mail
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_email_view(request):
    to = request.data.get('to', '').strip()
    subject = request.data.get('subject', '').strip()
    body = request.data.get('body', '').strip()
    from_email = (
        request.data.get('from_email', '').strip()
        or getattr(settings, 'DEFAULT_FROM_EMAIL', None)
        or getattr(settings, 'EMAIL_HOST_USER', None)
        or 'noreply@crms.com'
    )

    if not to:
        return Response({'error': 'Recipient email is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not subject:
        return Response({'error': 'Subject is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[to],
            fail_silently=False,
        )
        return Response({'message': f'Email sent to {to}'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

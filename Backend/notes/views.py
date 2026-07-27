from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from accounts.permissions import can_access_account_owner
from contacts.permissions import can_access_contact_owner
from deals.permissions import can_access_deal_owner

from .models import LeadNote
from .serializers import LeadNoteSerializer
from .services import (
    delete_account_note,
    delete_contact_note,
    delete_deal_note,
    update_account_note,
    update_contact_note,
    update_deal_note,
)


class LeadNoteViewSet(ReadOnlyModelViewSet):
    queryset = LeadNote.objects.select_related("lead", "contact", "account", "deal", "created_by").all()
    serializer_class = LeadNoteSerializer
    permission_classes = [IsAuthenticated]


class NoteDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, note_id: int):
        note_text = request.data.get("note")
        if not note_text:
            return Response({"note": "This field is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            note = LeadNote.objects.select_related("contact", "account", "deal").get(pk=note_id)
        except LeadNote.DoesNotExist:
            return Response({"detail": "Note not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            if note.contact_id:
                if not can_access_contact_owner(
                    user=request.user,
                    owner_id=note.contact.contact_owner_id if note.contact else None,
                ):
                    return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
                updated = update_contact_note(note_id=note_id, note=note_text, user=request.user)
            elif note.account_id:
                if not can_access_account_owner(
                    user=request.user,
                    owner_id=note.account.account_owner_id if note.account else None,
                ):
                    return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
                updated = update_account_note(note_id=note_id, note=note_text, user=request.user)
            elif note.deal_id:
                if not can_access_deal_owner(
                    user=request.user,
                    owner_id=note.deal.deal_owner_id if note.deal else None,
                ):
                    return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
                updated = update_deal_note(note_id=note_id, note=note_text, user=request.user)
            else:
                return Response(
                    {"detail": "This note type is not editable via this endpoint."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except LeadNote.DoesNotExist:
            return Response({"detail": "Note not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(LeadNoteSerializer(updated).data)

    def delete(self, request, note_id: int):
        try:
            note = LeadNote.objects.select_related("contact", "account", "deal").get(pk=note_id)
        except LeadNote.DoesNotExist:
            return Response({"detail": "Note not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            if note.contact_id:
                if not can_access_contact_owner(
                    user=request.user,
                    owner_id=note.contact.contact_owner_id if note.contact else None,
                ):
                    return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
                delete_contact_note(note_id=note_id, user=request.user)
            elif note.account_id:
                if not can_access_account_owner(
                    user=request.user,
                    owner_id=note.account.account_owner_id if note.account else None,
                ):
                    return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
                delete_account_note(note_id=note_id, user=request.user)
            elif note.deal_id:
                if not can_access_deal_owner(
                    user=request.user,
                    owner_id=note.deal.deal_owner_id if note.deal else None,
                ):
                    return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
                delete_deal_note(note_id=note_id, user=request.user)
            else:
                return Response(
                    {"detail": "This note type is not deletable via this endpoint."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except LeadNote.DoesNotExist:
            return Response({"detail": "Note not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)

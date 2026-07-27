from rest_framework import serializers

from .models import LeadNote


class LeadNoteSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()

    class Meta:
        model = LeadNote
        fields = ["id", "note", "created_by", "created_at"]

    def get_created_by(self, obj):
        if not obj.created_by:
            return None
        return getattr(obj.created_by, "username", None) or getattr(obj.created_by, "email", str(obj.created_by))

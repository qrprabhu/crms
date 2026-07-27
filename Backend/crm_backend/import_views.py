from __future__ import annotations

from pathlib import Path
from datetime import datetime

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_file_view(request):
    uploaded = request.FILES.get("file")
    module = (request.data.get("module") or "unknown").strip().lower()

    if not uploaded:
        return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

    safe_module = "".join(ch for ch in module if ch.isalnum() or ch in {"-", "_"}).strip("_-")
    if not safe_module:
        safe_module = "unknown"

    base_dir = Path(settings.BASE_DIR)
    upload_dir = base_dir / "import_uploads" / safe_module
    upload_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    filename = f"{timestamp}_{uploaded.name}"
    file_path = upload_dir / filename

    with file_path.open("wb") as target:
        for chunk in uploaded.chunks():
            target.write(chunk)

    return Response(
        {
            "message": "File uploaded successfully.",
            "file_name": uploaded.name,
            "saved_as": filename,
            "module": safe_module,
            "size": uploaded.size,
        },
        status=status.HTTP_201_CREATED,
    )

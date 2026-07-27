from django.db import transaction
from .models import (
    Project, ProjectTask, ProjectPhase, ProjectIssue,
    ProjectMember, ProjectFile, ProjectNote, ProjectTimeLog,
)


def get_project_queryset():
    return Project.objects.prefetch_related(
        'projectdesk_tasks', 'projectdesk_meetings', 'phases', 'issues', 'members', 'files', 'notes', 'time_logs'
    )


@transaction.atomic
def create_project(data: dict) -> Project:
    project = Project.objects.create(**data)
    return project


@transaction.atomic
def update_project(project: Project, data: dict) -> Project:
    for field, value in data.items():
        setattr(project, field, value)
    project.save()
    return project


@transaction.atomic
def delete_project(project: Project) -> None:
    project.delete()


# ── Tasks ──────────────────────────────────────────────────────────────────────

@transaction.atomic
def add_task(project: Project, data: dict) -> ProjectTask:
    return ProjectTask.objects.create(project=project, **data)


@transaction.atomic
def update_task(task: ProjectTask, data: dict) -> ProjectTask:
    for field, value in data.items():
        setattr(task, field, value)
    task.save()
    return task


# ── Phases ─────────────────────────────────────────────────────────────────────

@transaction.atomic
def add_phase(project: Project, data: dict) -> ProjectPhase:
    return ProjectPhase.objects.create(project=project, **data)


@transaction.atomic
def update_phase(phase: ProjectPhase, data: dict) -> ProjectPhase:
    for field, value in data.items():
        setattr(phase, field, value)
    phase.save()
    return phase


# ── Issues ─────────────────────────────────────────────────────────────────────

@transaction.atomic
def add_issue(project: Project, data: dict) -> ProjectIssue:
    return ProjectIssue.objects.create(project=project, **data)


@transaction.atomic
def update_issue(issue: ProjectIssue, data: dict) -> ProjectIssue:
    for field, value in data.items():
        setattr(issue, field, value)
    issue.save()
    return issue


# ── Members ────────────────────────────────────────────────────────────────────

@transaction.atomic
def add_member(project: Project, data: dict) -> ProjectMember:
    return ProjectMember.objects.create(project=project, **data)


# ── Files ──────────────────────────────────────────────────────────────────────

@transaction.atomic
def add_file(project: Project, data: dict) -> ProjectFile:
    return ProjectFile.objects.create(project=project, **data)


# ── Notes ──────────────────────────────────────────────────────────────────────

@transaction.atomic
def add_note(project: Project, data: dict) -> ProjectNote:
    return ProjectNote.objects.create(project=project, **data)


# ── Time Logs ──────────────────────────────────────────────────────────────────

@transaction.atomic
def add_time_log(project: Project, data: dict) -> ProjectTimeLog:
    return ProjectTimeLog.objects.create(project=project, **data)

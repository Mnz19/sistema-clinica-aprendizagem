# Migration manual: renomear valores de status existentes no banco.
# CANCELADO → DESMARCADO, REALIZADO → ATENDIDO
# Deve rodar ANTES da migration de schema (0006) que atualiza os choices.
from django.db import migrations


def renomear_status(apps, schema_editor):
    Agendamento = apps.get_model("clinica", "Agendamento")
    Agendamento.objects.filter(status="CANCELADO").update(status="DESMARCADO")
    Agendamento.objects.filter(status="REALIZADO").update(status="ATENDIDO")


def reverter_status(apps, schema_editor):
    Agendamento = apps.get_model("clinica", "Agendamento")
    Agendamento.objects.filter(status="DESMARCADO").update(status="CANCELADO")
    Agendamento.objects.filter(status="ATENDIDO").update(status="REALIZADO")


class Migration(migrations.Migration):

    dependencies = [
        ("clinica", "0004_merge_20260714_1918"),
    ]

    operations = [
        migrations.RunPython(renomear_status, reverter_status),
    ]

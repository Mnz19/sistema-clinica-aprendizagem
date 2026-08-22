# Migration manual: substituir Servico.valor por valor_clinica + valor_repasse.
# Ordem das operações:
#   1. Adicionar valor_clinica (default=0 para registros existentes)
#   2. Adicionar valor_repasse (default=0 para registros existentes)
#   3. RunPython: copiar valor → valor_clinica
#   4. Remover campo valor
from decimal import Decimal

from django.db import migrations, models


def copiar_valor_para_clinica(apps, schema_editor):
    Servico = apps.get_model("clinica", "Servico")
    for servico in Servico.objects.all():
        servico.valor_clinica = servico.valor
        servico.save(update_fields=["valor_clinica"])


def reverter_clinica_para_valor(apps, schema_editor):
    Servico = apps.get_model("clinica", "Servico")
    for servico in Servico.objects.all():
        servico.valor = servico.valor_clinica
        servico.save(update_fields=["valor"])


class Migration(migrations.Migration):

    dependencies = [
        ("clinica", "0007_serie_recorrente_e_fk_agendamento"),
    ]

    operations = [
        migrations.AddField(
            model_name="servico",
            name="valor_clinica",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=10,
                verbose_name="valor clínica",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="servico",
            name="valor_repasse",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=10,
                verbose_name="repasse profissional",
            ),
            preserve_default=False,
        ),
        migrations.RunPython(copiar_valor_para_clinica, reverter_clinica_para_valor),
        migrations.RemoveField(
            model_name="servico",
            name="valor",
        ),
    ]

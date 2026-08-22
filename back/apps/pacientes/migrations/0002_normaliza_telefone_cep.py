"""
Normaliza dados legados: telefone e CEP passam a ser guardados só com dígitos.

Antes, telefone e CEP eram gravados com máscara (ex.: "(91) 90000-0000",
"66000-000"). A máscara agora é apenas visual no front — o banco guarda dígitos.
Esta migration limpa os registros já existentes (idempotente). O CPF já era
armazenado só com dígitos, então não é tocado aqui.
"""
import re

from django.db import migrations


def apenas_digitos(valor):
    return re.sub(r"\D", "", valor or "")


def normalizar(apps, schema_editor):
    Paciente = apps.get_model("pacientes", "Paciente")
    Responsavel = apps.get_model("pacientes", "Responsavel")

    for paciente in Paciente.objects.all().iterator():
        tel = apenas_digitos(paciente.telefone)
        cep = apenas_digitos(paciente.cep)
        if tel != paciente.telefone or cep != paciente.cep:
            paciente.telefone = tel
            paciente.cep = cep
            paciente.save(update_fields=["telefone", "cep"])

    for resp in Responsavel.objects.all().iterator():
        tel = apenas_digitos(resp.telefone)
        if tel != resp.telefone:
            resp.telefone = tel
            resp.save(update_fields=["telefone"])


def noop(apps, schema_editor):
    # Não há como recompor a máscara com segurança; a normalização é o estado desejado.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("pacientes", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(normalizar, noop),
    ]

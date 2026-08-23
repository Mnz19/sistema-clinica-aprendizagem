"""
Semeia os cinco papéis (``PapelUsuario``) e faz o backfill do conjunto
``Usuario.papeis`` a partir do ``role`` atual de cada usuário.

Após esta migration, todo usuário existente tem ``papeis = {role}`` — ninguém
muda de comportamento; a partir daí é possível atribuir papéis adicionais.
"""
from django.db import migrations

# Espelha apps.accounts.models.Papel (valores fixos; não importar o enum em migration).
CODIGOS_PAPEL = ["DIRECAO", "SUPERVISAO", "PROFISSIONAL", "RECEPCAO", "FINANCEIRO"]


def seed_e_backfill(apps, schema_editor):
    PapelUsuario = apps.get_model("accounts", "PapelUsuario")
    Usuario = apps.get_model("accounts", "Usuario")

    papel_por_codigo = {
        codigo: PapelUsuario.objects.get_or_create(codigo=codigo)[0]
        for codigo in CODIGOS_PAPEL
    }

    for usuario in Usuario.objects.all():
        codigo = usuario.role or "PROFISSIONAL"
        papel = papel_por_codigo.get(codigo)
        if papel is None:  # papel desconhecido: cria para não perder o vínculo
            papel = PapelUsuario.objects.get_or_create(codigo=codigo)[0]
        usuario.papeis.add(papel)


def remover(apps, schema_editor):
    # Reverso: limpa os vínculos e os papéis semeados (o ``role`` permanece).
    Usuario = apps.get_model("accounts", "Usuario")
    PapelUsuario = apps.get_model("accounts", "PapelUsuario")
    for usuario in Usuario.objects.all():
        usuario.papeis.clear()
    PapelUsuario.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_papelusuario_alter_usuario_role_usuario_papeis"),
    ]

    operations = [
        migrations.RunPython(seed_e_backfill, remover),
    ]

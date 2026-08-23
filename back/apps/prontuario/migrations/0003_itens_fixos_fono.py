"""Realinha o catálogo de itens fixos para a clínica de fonoaudiologia.

- Remove (ou oculta, se já tiver registros) os itens fixos genéricos herdados do
  template (Dobras cutâneas, Receita de óculos, Vacina, Odontograma, etc.).
- Provisiona os novos itens fixos — as atividades da clínica — para todos os
  profissionais que já tinham o prontuário configurado. A Anamnese vem como
  formulário com o schema seed (perguntas configuráveis depois).
"""
import copy

from django.db import migrations

# Chaves dos itens fixos antigos (template genérico) que não fazem mais sentido.
CHAVES_ANTIGAS = {
    "HISTORICO_CLINICO",
    "PRE_ATENDIMENTO",
    "DOBRAS_CUTANEAS",
    "RECEITA_OCULOS",
    "RECEITUARIO",
    "SOLICITACAO_EXAMES",
    "CID",
    "ANEXOS",
    "ATESTADO",
    "VACINA",
    "ODONTOGRAMA",
}


def aplicar(apps, schema_editor):
    from apps.prontuario.models import ITENS_FIXOS  # catálogo atual (dados)

    ItemProntuario = apps.get_model("prontuario", "ItemProntuario")
    EntradaProntuario = apps.get_model("prontuario", "EntradaProntuario")

    # 1) Limpa os itens fixos obsoletos: apaga os sem registros, oculta os demais.
    for item in ItemProntuario.objects.filter(chave_fixa__in=CHAVES_ANTIGAS):
        if EntradaProntuario.objects.filter(item=item).exists():
            if item.visivel:
                item.visivel = False
                item.save(update_fields=["visivel"])
        else:
            item.delete()

    # 2) Provisiona os novos itens fixos para quem já usa o prontuário.
    prof_ids = (
        ItemProntuario.objects.values_list("profissional_id", flat=True).distinct()
    )
    for prof_id in prof_ids:
        existentes = set(
            ItemProntuario.objects.filter(profissional_id=prof_id)
            .exclude(chave_fixa="")
            .values_list("chave_fixa", flat=True)
        )
        for ordem, (chave, nome, tipo, visivel, schema) in enumerate(ITENS_FIXOS):
            if chave not in existentes:
                ItemProntuario.objects.create(
                    profissional_id=prof_id,
                    nome=nome,
                    tipo_item=str(tipo),
                    chave_fixa=chave,
                    visivel=visivel,
                    ordem=ordem,
                    formulario_schema=copy.deepcopy(schema),
                )


def reverter(apps, schema_editor):
    # Sem rollback de dados: os itens antigos não são recriados.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("prontuario", "0002_comentarioentrada"),
    ]

    operations = [
        migrations.RunPython(aplicar, reverter),
    ]

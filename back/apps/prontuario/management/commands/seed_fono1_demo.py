"""
Popula o prontuário do profissional "Fono 1" para demonstração/visualização.

Provisiona os itens fixos e cadastra os itens personalizados da referência
(igual à tela do stakeholder). Re-executável: usa ``get_or_create`` por nome.

Uso::

    ./venv/bin/python manage.py seed_fono1_demo
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import Papel, Usuario
from apps.prontuario.models import ITENS_FIXOS, ItemProntuario, TipoItem


def _campo(cid, tipo, rotulo, ordem, *, obrigatorio=False, opcoes=None):
    return {
        "id": cid,
        "tipo": tipo,
        "rotulo": rotulo,
        "ordem": ordem,
        "obrigatorio": obrigatorio,
        "opcoes": opcoes or [],
    }


# As atividades da clínica (Anamnese, Plano de atendimento, Evolução, Visita
# escolar, Reflexões do terapeuta, Encerramento, Atualizações) agora são itens
# FIXOS do sistema (ver ``ITENS_FIXOS`` em apps.prontuario.models), então não são
# recriadas aqui como personalizadas. Adicione abaixo apenas itens extra de demo.
ITENS_PERSONALIZADOS = []


class Command(BaseCommand):
    help = 'Popula o prontuário do profissional "Fono 1" (itens fixos + personalizados).'

    def handle(self, *args, **options):
        prof = (
            Usuario.objects.filter(nome__iexact="Fono 1").first()
            or Usuario.objects.filter(
                nome__icontains="Fono", role=Papel.PROFISSIONAL
            ).first()
        )
        if prof is None:
            self.stderr.write(self.style.ERROR('Profissional "Fono 1" não encontrado.'))
            return

        # Itens fixos.
        fixos_criados = 0
        existentes_fixos = set(
            ItemProntuario.objects.filter(profissional=prof)
            .exclude(chave_fixa="")
            .values_list("chave_fixa", flat=True)
        )
        for ordem, (chave, nome, tipo, visivel, schema) in enumerate(ITENS_FIXOS):
            if chave not in existentes_fixos:
                ItemProntuario.objects.create(
                    profissional=prof,
                    nome=nome,
                    tipo_item=tipo,
                    chave_fixa=chave,
                    visivel=visivel,
                    ordem=ordem,
                    formulario_schema=list(schema),
                )
                fixos_criados += 1

        # Itens personalizados.
        personalizados_criados = 0
        base_ordem = len(ITENS_FIXOS)
        for i, (nome, tipo, schema) in enumerate(ITENS_PERSONALIZADOS):
            _, created = ItemProntuario.objects.get_or_create(
                profissional=prof,
                nome=nome,
                defaults={
                    "tipo_item": tipo,
                    "formulario_schema": schema,
                    "ordem": base_ordem + i,
                    "visivel": True,
                },
            )
            if created:
                personalizados_criados += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Fono 1 (id={prof.id}): {fixos_criados} itens fixos e "
                f"{personalizados_criados} personalizados criados."
            )
        )

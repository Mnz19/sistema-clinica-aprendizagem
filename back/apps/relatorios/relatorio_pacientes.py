"""
Relatório de Pacientes — dados cadastrais completos.

Público: DIREÇÃO, SUPERVISÃO e RECEPÇÃO. Traz o cadastro consolidado (contato,
endereço, escola, filiação, responsável principal e profissionais vinculados)
para conferência e recadastramento.

O período filtra a **data de cadastro** (``criado_em``), não a data de
nascimento — é o recorte que a recepção usa ("quem entrou neste mês").

⚠️ LGPD: a planilha carrega dado pessoal de menor (CPF, endereço, diagnóstico,
CID). O acesso é restrito por papel e o download fica registrado na trilha de
auditoria pelo ``LogRelatorio``.
"""
from __future__ import annotations

from typing import Any

from django.db.models import Prefetch, QuerySet
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Usuario
from apps.pacientes.models import Paciente, Responsavel, UF
from apps.relatorios.comum import rotulo_registro
from apps.relatorios.excel import (
    FORMATO_DATA,
    FORMATO_DATA_HORA,
    FORMATO_INTEIRO,
    Coluna,
    Relatorio,
)
from apps.relatorios.filtros import (
    FiltrosAplicados,
    ler_booleano,
    ler_id,
    ler_periodo,
    ler_texto,
)

TITULO = "Relatório de Pacientes"
NOME_ARQUIVO = "relatorio_pacientes"

COLUNAS: tuple[Coluna, ...] = (
    Coluna("nome_completo", "Nome completo", largura=32),
    Coluna("data_nascimento", "Nascimento", largura=13, formato=FORMATO_DATA),
    Coluna("idade", "Idade", largura=8, formato=FORMATO_INTEIRO),
    Coluna("cpf", "CPF", largura=15),
    Coluna("rg", "RG", largura=14),
    Coluna("telefone", "Telefone", largura=16),
    Coluna("email", "E-mail", largura=26),
    Coluna("responsavel_nome", "Responsável principal", largura=30),
    Coluna("responsavel_parentesco", "Parentesco", largura=14),
    Coluna("responsavel_telefone", "Tel. responsável", largura=16),
    Coluna("nome_mae", "Nome da mãe", largura=30),
    Coluna("nome_pai", "Nome do pai", largura=30),
    Coluna("endereco", "Endereço", largura=40),
    Coluna("bairro", "Bairro", largura=20),
    Coluna("cidade", "Cidade", largura=20),
    Coluna("estado", "UF", largura=6),
    Coluna("cep", "CEP", largura=11),
    Coluna("escola", "Escola", largura=28),
    Coluna("serie_escolar", "Série", largura=18),
    Coluna("diagnostico", "Diagnóstico", largura=36),
    Coluna("cid", "CID", largura=10),
    Coluna("alertas", "Alertas", largura=26),
    Coluna("profissionais", "Profissionais vinculados", largura=34),
    Coluna("situacao", "Situação", largura=12),
    Coluna("cadastro_completo", "Cadastro", largura=14),
    Coluna("criado_em", "Cadastrado em", largura=18, formato=FORMATO_DATA_HORA),
)


def _ler_filtros(params) -> FiltrosAplicados:
    """Valida os filtros do relatório e monta a descrição legível."""
    filtros = FiltrosAplicados()
    ler_periodo(params, filtros)

    ativo = ler_booleano(params, "ativo")
    if ativo is not None:
        filtros.registrar(
            "ativo", ativo, f"Situação: {'ativos' if ativo else 'inativos'}"
        )

    incompleto = ler_booleano(params, "cadastro_incompleto")
    if incompleto is not None:
        filtros.registrar(
            "cadastro_incompleto",
            incompleto,
            f"Cadastro: {'incompletos' if incompleto else 'completos'}",
        )

    profissional = ler_id(params, "profissional")
    if profissional:
        filtros.registrar(
            "profissional",
            profissional,
            rotulo_registro(Usuario, profissional, "Profissional"),
        )

    estado = (params.get("estado") or "").strip().upper()
    if estado:
        if estado not in UF.values:
            raise ValidationError({"estado": f"UF inválida: '{estado}'."})
        filtros.registrar("estado", estado, f"UF: {estado}")

    cidade = ler_texto(params, "cidade")
    if cidade:
        filtros.registrar("cidade", cidade, f"Cidade: {cidade}")

    busca = ler_texto(params, "busca")
    if busca:
        filtros.registrar("busca", busca, f"Busca: “{busca}”")

    return filtros


def _montar_queryset(filtros: FiltrosAplicados) -> QuerySet[Paciente]:
    """Aplica os filtros validados e pré-carrega os vínculos usados nas colunas."""
    # O responsável principal vem via Prefetch filtrado para não gerar N+1 nem
    # trazer a lista inteira de responsáveis de cada paciente.
    responsaveis_principais = Prefetch(
        "responsaveis",
        queryset=Responsavel.objects.filter(principal=True),
        to_attr="responsaveis_principais",
    )
    qs = (
        Paciente.objects.select_related("criado_por")
        .prefetch_related("profissionais", responsaveis_principais)
        .all()
    )

    if (inicio := filtros.get("data_inicio")) is not None:
        qs = qs.filter(criado_em__date__gte=inicio)
    if (fim := filtros.get("data_fim")) is not None:
        qs = qs.filter(criado_em__date__lte=fim)
    if (ativo := filtros.get("ativo")) is not None:
        qs = qs.filter(ativo=ativo)
    if (incompleto := filtros.get("cadastro_incompleto")) is not None:
        qs = qs.filter(cadastro_incompleto=incompleto)
    if profissional := filtros.get("profissional"):
        qs = qs.filter(profissionais__id=profissional)
    if estado := filtros.get("estado"):
        qs = qs.filter(estado=estado)
    if cidade := filtros.get("cidade"):
        qs = qs.filter(cidade__icontains=cidade)
    if busca := filtros.get("busca"):
        qs = qs.filter(nome_completo__icontains=busca)

    # `profissionais__id` é um join M2M: sem o distinct, um paciente com vários
    # vínculos apareceria repetido.
    return qs.distinct().order_by("nome_completo")


def _endereco_completo(paciente: Paciente) -> str:
    """Logradouro, número e complemento em uma única célula."""
    partes = [paciente.logradouro, paciente.numero, paciente.complemento]
    return ", ".join(parte for parte in partes if parte)


def _linha(paciente: Paciente) -> dict[str, Any]:
    """Converte um paciente na linha do relatório."""
    principais = getattr(paciente, "responsaveis_principais", [])
    responsavel = principais[0] if principais else None

    return {
        "nome_completo": paciente.nome_completo,
        "data_nascimento": paciente.data_nascimento,
        "idade": paciente.idade,
        "cpf": paciente.cpf or "",
        "rg": paciente.rg,
        "telefone": paciente.telefone,
        "email": paciente.email,
        "responsavel_nome": responsavel.nome if responsavel else "",
        "responsavel_parentesco": (
            responsavel.get_parentesco_display() if responsavel else ""
        ),
        "responsavel_telefone": responsavel.telefone if responsavel else "",
        "nome_mae": paciente.nome_mae,
        "nome_pai": paciente.nome_pai,
        "endereco": _endereco_completo(paciente),
        "bairro": paciente.bairro,
        "cidade": paciente.cidade,
        "estado": paciente.estado,
        "cep": paciente.cep,
        "escola": paciente.escola,
        "serie_escolar": paciente.get_serie_escolar_display() or "",
        "diagnostico": paciente.diagnostico,
        "cid": paciente.cid,
        "alertas": paciente.alertas,
        "profissionais": ", ".join(
            profissional.nome for profissional in paciente.profissionais.all()
        ),
        "situacao": "Ativo" if paciente.ativo else "Inativo",
        "cadastro_completo": (
            "Incompleto" if paciente.cadastro_incompleto else "Completo"
        ),
        "criado_em": paciente.criado_em,
    }


def montar(params) -> Relatorio:
    """Monta o relatório de pacientes a partir dos filtros da query string."""
    filtros = _ler_filtros(params)
    pacientes = _montar_queryset(filtros)
    return Relatorio(
        titulo=TITULO,
        nome_arquivo=NOME_ARQUIVO,
        colunas=COLUNAS,
        linhas=[_linha(paciente) for paciente in pacientes],
        filtros_descricao=filtros.descricao,
    )

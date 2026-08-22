"""
Resolução de macros dos atestados.

As macros são tokens entre colchetes (ex.: ``[NOME_PACIENTE]``) usadas no corpo
de um ``ModeloAtestado``. Na geração, elas são substituídas pelos valores reais
do paciente/profissional/serviço e o resultado é congelado em
``Atestado.corpo_resolvido``. Tokens desconhecidos são preservados; valores
ausentes viram string vazia.
"""
import re

from django.conf import settings
from django.utils import timezone

MACRO_RE = re.compile(r"\[[A-Z_]+\]")

# Descrição de cada macro (exposta ao frontend na paleta do editor).
MACROS_DISPONIVEIS = [
    ("[NOME_PACIENTE]", "Nome do paciente"),
    ("[RG_PACIENTE]", "RG do paciente"),
    ("[CPF_PACIENTE]", "CPF do paciente"),
    ("[NOME_UNIDADE]", "Nome da unidade/clínica"),
    ("[NOME_SERVICO]", "Nome do serviço"),
    ("[NOME_PAI]", "Nome do pai"),
    ("[NOME_MAE]", "Nome da mãe"),
    ("[IDADE_PAC]", "Idade do paciente"),
    ("[DATA_ATUAL]", "Data do atendimento"),
    ("[HORA_ATUAL]", "Hora do atendimento"),
    ("[LISTA_CID]", "Lista de CID (código + descrição)"),
    ("[LISTA_CODIGO_CID]", "Lista de códigos de CID"),
]


def _fmt_cpf(cpf):
    d = "".join(filter(str.isdigit, cpf or ""))
    if len(d) != 11:
        return cpf or ""
    return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"


def _lista_cid(cids, *, so_codigo=False, fallback=""):
    """Monta a lista de CID a partir do request; cai no CID do paciente."""
    if cids:
        partes = []
        for c in cids:
            codigo = (c.get("codigo") or "").strip()
            descricao = (c.get("descricao") or "").strip()
            if so_codigo or not descricao:
                if codigo:
                    partes.append(codigo)
            elif codigo:
                partes.append(f"{codigo} — {descricao}")
            elif descricao:
                partes.append(descricao)
        return ", ".join(partes)
    return fallback or ""


def resolver_macros(
    texto,
    *,
    paciente,
    profissional=None,
    servico=None,
    agendamento=None,
    cids=None,
    unidade_nome=None,
):
    """Substitui as macros de ``texto`` pelos valores reais.

    ``cids`` é uma lista de ``{codigo, descricao}``. ``unidade_nome`` sobrepõe o
    ``settings.CLINICA_NOME`` quando informado.
    """
    if not texto:
        return ""

    agora = timezone.localtime()
    servico_nome = ""
    if servico is not None:
        servico_nome = getattr(servico, "nome", "") or ""
    elif agendamento is not None and getattr(agendamento, "servico", None):
        servico_nome = agendamento.servico.nome

    valores = {
        "[NOME_PACIENTE]": paciente.nome_completo or "",
        "[RG_PACIENTE]": getattr(paciente, "rg", "") or "",
        "[CPF_PACIENTE]": _fmt_cpf(getattr(paciente, "cpf", "")),
        "[NOME_UNIDADE]": unidade_nome
        or getattr(settings, "CLINICA_NOME", "")
        or "",
        "[NOME_SERVICO]": servico_nome,
        "[NOME_PAI]": getattr(paciente, "nome_pai", "") or "",
        "[NOME_MAE]": getattr(paciente, "nome_mae", "") or "",
        "[IDADE_PAC]": str(paciente.idade) if paciente.idade is not None else "",
        "[DATA_ATUAL]": agora.strftime("%d/%m/%Y"),
        "[HORA_ATUAL]": agora.strftime("%H:%M"),
        "[LISTA_CID]": _lista_cid(
            cids, fallback=getattr(paciente, "cid", "")
        ),
        "[LISTA_CODIGO_CID]": _lista_cid(
            cids, so_codigo=True, fallback=getattr(paciente, "cid", "")
        ),
    }

    def _sub(match):
        token = match.group(0)
        # Token desconhecido é preservado como está.
        return valores.get(token, token)

    return MACRO_RE.sub(_sub, texto)

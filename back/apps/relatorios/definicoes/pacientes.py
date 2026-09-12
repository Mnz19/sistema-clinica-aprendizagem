"""
Relatório de Pacientes — dados cadastrais.

Exporta a ficha cadastral (identificação, contato, endereço, escola, vínculo
clínico e responsável principal) dos pacientes da clínica. É o relatório que a
recepção usa para conferir e completar cadastros.

Contém dado pessoal de menor de idade: o acesso é restrito a DIREÇÃO, SUPERVISÃO
e RECEPÇÃO (ver ``apps/relatorios/permissions.py``) e toda exportação fica
registrada na trilha de acesso (``apps/relatorios/views.py``).
"""
from apps.pacientes.models import UF, Paciente, Parentesco, SerieEscolar
from apps.relatorios.definicoes.base import Coluna, Formato, RelatorioBase, rotulos
from apps.relatorios.filtros import Filtros, validar_escolhas

_PARENTESCOS = rotulos(Parentesco)
_SERIES = rotulos(SerieEscolar)


class RelatorioPacientes(RelatorioBase):
    slug = "pacientes"
    titulo = "Relatório de Pacientes — Dados Cadastrais"
    nome_aba = "Pacientes"
    prefixo_arquivo = "relatorio_pacientes"
    campos_filtro = (
        "data_inicio",
        "data_fim",
        "profissional",
        "ativo",
        "cadastro_incompleto",
        "estado",
        "cidade",
        "busca",
    )
    colunas = [
        Coluna("nome_completo", "Nome completo", largura=34),
        Coluna("data_nascimento", "Nascimento", Formato.DATA, largura=13),
        Coluna("idade", "Idade", Formato.INTEIRO, largura=8),
        Coluna("cpf", "CPF", largura=15),
        Coluna("rg", "RG", largura=14),
        Coluna("telefone", "Telefone", largura=16),
        Coluna("email", "E-mail", largura=28),
        Coluna("cep", "CEP", largura=11),
        Coluna("logradouro", "Logradouro", largura=30),
        Coluna("numero", "Nº", largura=8),
        Coluna("complemento", "Complemento", largura=18),
        Coluna("bairro", "Bairro", largura=20),
        Coluna("cidade", "Cidade", largura=20),
        Coluna("estado", "UF", largura=6),
        Coluna("nome_mae", "Nome da mãe", largura=30),
        Coluna("nome_pai", "Nome do pai", largura=30),
        Coluna("responsavel_nome", "Responsável principal", largura=30),
        Coluna("responsavel_parentesco", "Parentesco", largura=16),
        Coluna("responsavel_telefone", "Tel. responsável", largura=16),
        Coluna("escola", "Escola", largura=26),
        Coluna("serie_escolar", "Série", largura=18),
        Coluna("diagnostico", "Diagnóstico", largura=36),
        Coluna("cid", "CID", largura=10),
        Coluna("alertas", "Alertas", largura=26),
        Coluna("profissionais", "Profissionais vinculados", largura=34),
        Coluna("situacao", "Situação", largura=12),
        Coluna("cadastro", "Cadastro", largura=14),
        Coluna("criado_em", "Cadastrado em", Formato.DATA_HORA, largura=18),
    ]

    def queryset(self, usuario, filtros: Filtros):
        qs = Paciente.objects.prefetch_related("profissionais", "responsaveis")

        # O recorte de data aqui é a **data de cadastro** do paciente.
        if filtros.data_inicio:
            qs = qs.filter(criado_em__date__gte=filtros.data_inicio)
        if filtros.data_fim:
            qs = qs.filter(criado_em__date__lte=filtros.data_fim)
        if filtros.profissional:
            qs = qs.filter(profissionais__id=filtros.profissional)
        if filtros.ativo is not None:
            qs = qs.filter(ativo=filtros.ativo)
        if filtros.cadastro_incompleto is not None:
            qs = qs.filter(cadastro_incompleto=filtros.cadastro_incompleto)
        if filtros.estado:
            validar_escolhas((filtros.estado.upper(),), UF.values, "estado")
            qs = qs.filter(estado=filtros.estado.upper())
        if filtros.cidade:
            qs = qs.filter(cidade__icontains=filtros.cidade)
        if filtros.busca:
            qs = qs.filter(nome_completo__icontains=filtros.busca)

        return qs.distinct().order_by("nome_completo")

    def linha(self, paciente: Paciente) -> dict:
        responsavel = _responsavel_principal(paciente)
        return {
            "nome_completo": paciente.nome_completo,
            "data_nascimento": paciente.data_nascimento,
            "idade": paciente.idade,
            "cpf": paciente.cpf or "",
            "rg": paciente.rg,
            "telefone": paciente.telefone,
            "email": paciente.email,
            "cep": paciente.cep,
            "logradouro": paciente.logradouro,
            "numero": paciente.numero,
            "complemento": paciente.complemento,
            "bairro": paciente.bairro,
            "cidade": paciente.cidade,
            "estado": paciente.estado,
            "nome_mae": paciente.nome_mae,
            "nome_pai": paciente.nome_pai,
            "responsavel_nome": responsavel.nome if responsavel else "",
            "responsavel_parentesco": (
                _PARENTESCOS.get(responsavel.parentesco, responsavel.parentesco)
                if responsavel
                else ""
            ),
            "responsavel_telefone": responsavel.telefone if responsavel else "",
            "escola": paciente.escola,
            "serie_escolar": _SERIES.get(paciente.serie_escolar, paciente.serie_escolar),
            "diagnostico": paciente.diagnostico,
            "cid": paciente.cid,
            "alertas": paciente.alertas,
            "profissionais": ", ".join(p.nome for p in paciente.profissionais.all()),
            "situacao": "Ativo" if paciente.ativo else "Inativo",
            "cadastro": "Incompleto" if paciente.cadastro_incompleto else "Completo",
            "criado_em": paciente.criado_em,
        }

    def descrever_filtros_especificos(self, filtros: Filtros) -> list[str]:
        frases = []
        if filtros.ativo is not None:
            frases.append(f"Situação: {'Ativos' if filtros.ativo else 'Inativos'}")
        if filtros.cadastro_incompleto is not None:
            frases.append(
                "Cadastro: "
                + ("Incompletos" if filtros.cadastro_incompleto else "Completos")
            )
        if filtros.estado:
            frases.append(f"UF: {filtros.estado.upper()}")
        if filtros.cidade:
            frases.append(f"Cidade: {filtros.cidade}")
        if filtros.busca:
            frases.append(f"Busca por nome: {filtros.busca}")
        return frases


def _responsavel_principal(paciente: Paciente):
    """Responsável marcado como principal; na falta dele, o primeiro cadastrado."""
    responsaveis = list(paciente.responsaveis.all())
    if not responsaveis:
        return None
    return next((r for r in responsaveis if r.principal), responsaveis[0])

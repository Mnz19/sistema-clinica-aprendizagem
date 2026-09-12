"""
Contrato comum dos relatórios.

Um relatório é uma classe que sabe três coisas: **quais filtros aceita**, **qual
queryset produz** e **como virar linha de planilha**. Tudo o mais — Excel, JSON
de pré-visualização, totais, descrição dos filtros no topo da planilha — é
derivado daqui, então nenhuma coluna precisa ser declarada duas vezes.
"""
from apps.relatorios.excel import Coluna, Formato, serializar_valor
from apps.relatorios.filtros import Filtros, formatar_data, parse_filtros


class RelatorioBase:
    """Base dos quatro relatórios da aba. Subclasses declaram colunas e queryset."""

    #: Identificador usado na URL (``/api/relatorios/<slug>/``).
    slug: str = ""
    titulo: str = ""
    nome_aba: str = "Relatório"
    prefixo_arquivo: str = "relatorio"
    #: Filtros aceitos — o que estiver fora daqui é ignorado (ver ``filtros.py``).
    campos_filtro: tuple[str, ...] = ()
    colunas: list[Coluna] = []

    # --- a implementar nas subclasses ---------------------------------------

    def queryset(self, usuario, filtros: Filtros):
        raise NotImplementedError

    def linha(self, objeto) -> dict:
        raise NotImplementedError

    def descrever_filtros_especificos(self, filtros: Filtros) -> list[str]:
        """Frases extras para o topo da planilha (ex.: "Status: Atendido")."""
        return []

    # --- comportamento compartilhado ----------------------------------------

    def ler_filtros(self, query_params) -> Filtros:
        return parse_filtros(query_params, self.campos_filtro)

    def linhas(self, usuario, filtros: Filtros) -> list[dict]:
        return [self.linha(objeto) for objeto in self.queryset(usuario, filtros)]

    def descrever_filtros(self, filtros: Filtros) -> list[str]:
        """Filtros aplicados em linguagem humana, impressos no topo da planilha."""
        frases: list[str] = []
        if filtros.data_inicio or filtros.data_fim:
            inicio = formatar_data(filtros.data_inicio) or "início"
            fim = formatar_data(filtros.data_fim) or "hoje"
            frases.append(f"Período: {inicio} a {fim}")
        if filtros.profissional:
            frases.append(f"Profissional: {_nome_usuario(filtros.profissional)}")
        if filtros.paciente:
            frases.append(f"Paciente: {_nome_paciente(filtros.paciente)}")
        frases.extend(self.descrever_filtros_especificos(filtros))
        if not frases:
            frases.append("Filtros: nenhum (todos os registros)")
        return frases

    def resumo(self, linhas: list[dict]) -> dict:
        """Contagem e somas das colunas marcadas com ``somar`` (cartões da tela)."""
        totais = {
            coluna.chave: float(
                sum(linha.get(coluna.chave) or 0 for linha in linhas)
            )
            for coluna in self.colunas
            if coluna.somar
        }
        return {"total_registros": len(linhas), "totais": totais}

    def colunas_json(self) -> list[dict]:
        """Metadados das colunas para a tabela do frontend montar o cabeçalho."""
        return [
            {
                "chave": coluna.chave,
                "titulo": coluna.titulo,
                "formato": coluna.formato.value,
                "somar": coluna.somar,
            }
            for coluna in self.colunas
        ]

    def linhas_json(self, linhas: list[dict]) -> list[dict]:
        return [
            {chave: serializar_valor(valor) for chave, valor in linha.items()}
            for linha in linhas
        ]


def _nome_usuario(pk: int) -> str:
    from django.contrib.auth import get_user_model

    usuario = get_user_model().objects.filter(pk=pk).only("nome").first()
    return usuario.nome if usuario else f"#{pk} (não encontrado)"


def _nome_paciente(pk: int) -> str:
    from apps.pacientes.models import Paciente

    paciente = Paciente.objects.filter(pk=pk).only("nome_completo").first()
    return paciente.nome_completo if paciente else f"#{pk} (não encontrado)"


def rotulos(choices) -> dict:
    """Mapa valor → rótulo legível de um ``TextChoices``."""
    return dict(choices.choices)


__all__ = ["RelatorioBase", "Coluna", "Formato", "rotulos"]

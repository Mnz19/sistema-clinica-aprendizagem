"""
Serializers de documentação da aba de Relatórios.

Os relatórios não devolvem um model serializado, e sim um envelope genérico
(colunas + linhas + totais) montado em ``excel.Relatorio``. Estes serializers
existem para o drf-spectacular descrever esse envelope em ``/api/docs/`` — não
são usados para validar entrada nem para montar a resposta.
"""
from rest_framework import serializers


class ColunaRelatorioSerializer(serializers.Serializer):
    """Descrição de uma coluna, para o frontend montar a tabela de prévia."""

    chave = serializers.CharField(help_text="Nome do campo nas linhas.")
    titulo = serializers.CharField(help_text="Rótulo exibido no cabeçalho.")
    formato = serializers.CharField(
        allow_null=True, help_text="Formato numérico do Excel (moeda, data)."
    )
    somar = serializers.BooleanField(
        help_text="Indica se a coluna entra no rodapé de totais."
    )


class RelatorioRespostaSerializer(serializers.Serializer):
    """
    Envelope de resposta dos quatro relatórios (``formato`` omitido ou ``json``).

    Com ``?formato=xlsx`` a mesma rota devolve o arquivo ``.xlsx`` em vez deste
    corpo.
    """

    titulo = serializers.CharField()
    colunas = ColunaRelatorioSerializer(many=True)
    linhas = serializers.ListField(
        child=serializers.DictField(),
        help_text="Uma entrada por registro, com as chaves declaradas em `colunas`.",
    )
    totais = serializers.DictField(
        help_text="Somas agregadas das colunas marcadas com `somar`."
    )
    total_registros = serializers.IntegerField()
    filtros_descricao = serializers.CharField(
        help_text="Descrição legível dos filtros aplicados (vai no topo da planilha)."
    )

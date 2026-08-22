"""
Regras de negócio das confirmações por WhatsApp.

- Resolve o telefone de destino e monta os parâmetros da mensagem.
- Envia a confirmação de um agendamento (idempotente) e registra o log.
- Processa a resposta do paciente (SIM confirma, NÃO cancela) atualizando o
  status do agendamento.
"""
import re
import unicodedata

from django.utils import timezone

from apps.clinica.models import StatusAgendamento
from apps.whatsapp.models import (
    ConfiguracaoConfirmacao,
    MensagemConfirmacao,
    StatusMensagem,
)
from apps.whatsapp.providers import WhatsAppError, get_provider

# Status que ainda aguardam resposta do paciente.
STATUS_AGUARDANDO = (
    StatusMensagem.ENVIADO,
    StatusMensagem.ENTREGUE,
    StatusMensagem.LIDO,
)


def estado_confirmacao(agendamento):
    """
    Estado de confirmação do agendamento, para exibição visual:

    - ``"CONFIRMADO"`` : paciente confirmou (ou status confirmado).
    - ``"DESMARCADO"`` : agendamento desmarcado.
    - ``"AGUARDANDO"`` : confirmação enviada, sem resposta ainda.
    - ``None``         : nenhum dos casos (exibição normal).
    """
    if agendamento.status == StatusAgendamento.CONFIRMADO:
        return "CONFIRMADO"
    if agendamento.status == StatusAgendamento.DESMARCADO:
        return "DESMARCADO"
    pendente = agendamento.confirmacoes.filter(status__in=STATUS_AGUARDANDO).exists()
    return "AGUARDANDO" if pendente else None


def _digitos(valor: str) -> str:
    return re.sub(r"\D", "", valor or "")


def formatar_e164(telefone: str) -> str:
    """
    Normaliza um telefone brasileiro para o formato aceito pela Meta (só dígitos,
    com código do país). Ex.: ``(91) 99227-4946`` → ``5591992274946``.
    """
    d = _digitos(telefone)
    if not d:
        return ""
    if d.startswith("55") and len(d) >= 12:
        return d
    return "55" + d


def telefone_destino(agendamento) -> tuple[str, str]:
    """
    Retorna (telefone_e164, nome_destinatario) do responsável principal do
    paciente; se não houver, usa o telefone do próprio paciente.
    """
    paciente = agendamento.paciente
    responsavel = (
        paciente.responsaveis.filter(principal=True).first()
        or paciente.responsaveis.exclude(telefone="").first()
    )
    if responsavel and responsavel.telefone:
        return formatar_e164(responsavel.telefone), responsavel.nome
    if paciente.telefone:
        return formatar_e164(paciente.telefone), paciente.nome_completo
    return "", (responsavel.nome if responsavel else paciente.nome_completo)


def montar_parametros(agendamento) -> list[str]:
    """Parâmetros do template, na ordem: paciente, data, hora, profissional."""
    return [
        agendamento.paciente.nome_completo,
        agendamento.data.strftime("%d/%m/%Y"),
        agendamento.horario_inicio.strftime("%H:%M"),
        agendamento.profissional.nome,
    ]


def montar_mensagem(config, agendamento) -> str:
    """Monta o texto da mensagem (prévia/simulado) a partir do template da config."""
    return config.mensagem.format(
        paciente=agendamento.paciente.nome_completo,
        data=agendamento.data.strftime("%d/%m/%Y"),
        hora=agendamento.horario_inicio.strftime("%H:%M"),
        profissional=agendamento.profissional.nome,
    )


def enviar_confirmacao(agendamento, config=None, provider=None, forcar=False):
    """
    Envia (ou reenvia) a confirmação de um agendamento e registra o log.

    Idempotente: se já houver uma confirmação enviada com sucesso para este
    agendamento, não envia de novo (a menos que ``forcar=True``).
    """
    config = config or ConfiguracaoConfirmacao.carregar()
    provider = provider or get_provider()

    existente = agendamento.confirmacoes.exclude(status=StatusMensagem.ERRO).first()
    if existente and not forcar:
        return existente

    telefone, nome = telefone_destino(agendamento)
    registro = MensagemConfirmacao(
        agendamento=agendamento, telefone=telefone, destinatario_nome=nome
    )

    if not telefone:
        registro.status = StatusMensagem.ERRO
        registro.erro = "Paciente/responsável sem telefone cadastrado."
        registro.save()
        return registro

    try:
        wa_id = provider.enviar_template(
            telefone=telefone,
            template_nome=config.template_meta_nome or "confirmacao_consulta",
            idioma=config.template_meta_idioma,
            parametros=montar_parametros(agendamento),
        )
        registro.wa_message_id = wa_id
        registro.status = StatusMensagem.ENVIADO
        registro.enviado_em = timezone.now()
    except WhatsAppError as exc:
        registro.status = StatusMensagem.ERRO
        registro.erro = str(exc)

    registro.save()
    return registro


def _normalizar(texto: str) -> str:
    """Maiúsculas, sem acentos e sem espaços nas bordas."""
    t = unicodedata.normalize("NFKD", texto or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    return t.strip().upper()


def interpretar_resposta(texto: str):
    """Retorna True (confirmar), False (cancelar) ou None (não reconhecido)."""
    t = _normalizar(texto)
    if t in {"SIM", "S", "CONFIRMAR", "CONFIRMO", "OK"}:
        return True
    if t in {"NAO", "N", "CANCELAR", "CANCELO"}:
        return False
    return None


def processar_resposta(telefone: str, texto: str):
    """
    Processa a resposta do paciente para a confirmação mais recente daquele
    telefone. Atualiza o agendamento (SIM → confirmado, NÃO → cancelado).

    Retorna a ``MensagemConfirmacao`` afetada, ou ``None`` se nada casar.
    """
    e164 = formatar_e164(telefone)
    registro = (
        MensagemConfirmacao.objects.filter(
            telefone=e164, status__in=STATUS_AGUARDANDO
        )
        .select_related("agendamento")
        .order_by("-criado_em")
        .first()
    )
    if registro is None:
        return None

    decisao = interpretar_resposta(texto)
    if decisao is None:
        return registro  # resposta não reconhecida; mantém aguardando

    agendamento = registro.agendamento
    registro.resposta_texto = texto[:255]
    registro.respondido_em = timezone.now()

    if decisao:
        registro.status = StatusMensagem.RESPONDIDO_SIM
        agendamento.status = StatusAgendamento.CONFIRMADO
        agendamento.save(update_fields=["status", "atualizado_em"])
    else:
        registro.status = StatusMensagem.RESPONDIDO_NAO
        agendamento.status = StatusAgendamento.DESMARCADO
        agendamento.parecer_status = "Desmarcado pelo paciente via WhatsApp."
        agendamento.save(update_fields=["status", "parecer_status", "atualizado_em"])

    registro.save()
    return registro


def atualizar_status_entrega(wa_message_id: str, status_meta: str):
    """Atualiza o status de entrega (sent/delivered/read/failed) via webhook."""
    mapa = {
        "sent": StatusMensagem.ENVIADO,
        "delivered": StatusMensagem.ENTREGUE,
        "read": StatusMensagem.LIDO,
        "failed": StatusMensagem.ERRO,
    }
    novo = mapa.get(status_meta)
    if not novo:
        return None
    registro = MensagemConfirmacao.objects.filter(wa_message_id=wa_message_id).first()
    if registro is None:
        return None
    # Não rebaixa um status de resposta já registrado.
    if registro.status in {StatusMensagem.RESPONDIDO_SIM, StatusMensagem.RESPONDIDO_NAO}:
        return registro
    registro.status = novo
    registro.save(update_fields=["status", "atualizado_em"])
    return registro

"""
Serviços da integração com o Google Agenda.

Responsabilidades:
  1. **OAuth 2.0** por profissional: gerar a URL de consentimento e processar o
     callback, guardando o refresh token (criptografado) em ``ContaGoogle``.
  2. **Credenciais**: reconstruir/renovar o access token a partir do refresh
     token, mantendo um cache no banco.
  3. **Sincronização (mão única app → Google)**: criar/atualizar/remover o evento
     no calendário do profissional a partir de um ``Agendamento``.

Nada aqui levanta exceção para o fluxo de agendamento: os *signals* chamam os
invólucros ``*_seguro``, que capturam e registram falhas sem quebrar o save.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone as dt_timezone

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.utils import timezone

from apps.clinica.models import Agendamento, StatusAgendamento
from apps.google_agenda.models import ContaGoogle, EventoGoogle

logger = logging.getLogger(__name__)

# Assinatura do parâmetro ``state`` do OAuth: carimba o id do usuário de forma
# assinada e com validade, dispensando sessão no callback.
_STATE_SALT = "google_agenda.oauth.state"
_STATE_MAX_AGE = 600  # 10 minutos entre iniciar e concluir o consentimento

_TOKEN_URI = "https://oauth2.googleapis.com/token"
_AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
_REVOKE_URI = "https://oauth2.googleapis.com/revoke"

# Status cujo agendamento NÃO deve ter evento no Google (é removido se existir).
_STATUS_SEM_EVENTO = {StatusAgendamento.DESMARCADO}


class IntegracaoDesabilitada(RuntimeError):
    """Faltam CLIENT_ID/SECRET/chave: a integração está desligada."""


class SemRefreshToken(RuntimeError):
    """O Google não devolveu refresh token (consentimento sem 'offline')."""


class ContaRevogada(RuntimeError):
    """O refresh token foi revogado/expirou; o profissional precisa reconectar."""


# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------
def esta_configurado() -> bool:
    """Indica se a integração tem as credenciais mínimas para operar."""
    return bool(
        settings.GOOGLE_CLIENT_ID
        and settings.GOOGLE_CLIENT_SECRET
        and settings.GOOGLE_TOKEN_ENCRYPTION_KEY
    )


def _exigir_configurado() -> None:
    if not esta_configurado():
        raise IntegracaoDesabilitada(
            "Integração com o Google Agenda não configurada (defina "
            "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_TOKEN_ENCRYPTION_KEY)."
        )


# ---------------------------------------------------------------------------
# Fluxo OAuth
# ---------------------------------------------------------------------------
def _flow():
    from google_auth_oauthlib.flow import Flow

    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": _AUTH_URI,
            "token_uri": _TOKEN_URI,
            "redirect_uris": [settings.GOOGLE_OAUTH_REDIRECT_URI],
        }
    }
    # PKCE desligado de propósito: como o app é um cliente confidencial (tem
    # client_secret), não precisamos de code_verifier — e não dá para preservá-lo
    # entre a URL de autorização e o callback, que usam instâncias distintas de
    # Flow (senão o Google retorna "Missing code verifier" na troca do code).
    flow = Flow.from_client_config(
        client_config,
        scopes=settings.GOOGLE_CALENDAR_SCOPES,
        autogenerate_code_verifier=False,
    )
    flow.redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
    return flow


def gerar_url_autorizacao(usuario) -> str:
    """Monta a URL de consentimento do Google para o profissional autenticado."""
    _exigir_configurado()
    flow = _flow()
    state = signing.dumps({"uid": usuario.pk}, salt=_STATE_SALT)
    url, _ = flow.authorization_url(
        access_type="offline",       # necessário para receber refresh token
        include_granted_scopes="true",
        prompt="consent",            # força refresh token mesmo em reconsentimento
        state=state,
    )
    return url


def processar_callback(code: str, state: str) -> ContaGoogle:
    """Troca o ``code`` por tokens e (re)cria a ``ContaGoogle`` do usuário."""
    _exigir_configurado()
    dados = signing.loads(state, salt=_STATE_SALT, max_age=_STATE_MAX_AGE)
    usuario = get_user_model().objects.get(pk=dados["uid"])

    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    if not creds.refresh_token:
        raise SemRefreshToken(
            "O Google não retornou refresh token. Refaça a conexão."
        )

    conta, _criado = ContaGoogle.objects.get_or_create(
        usuario=usuario,
        defaults={"refresh_token_cifrado": ""},
    )
    conta.definir_refresh_token(creds.refresh_token)
    conta.access_token = creds.token or ""
    conta.access_token_expira_em = _expiry_aware(creds.expiry)
    conta.scopes = " ".join(creds.scopes or [])
    conta.ativa = True
    conta.email_google = _descobrir_email(creds) or conta.email_google
    conta.save()
    logger.info("Google Agenda conectado para usuário %s", usuario.pk)
    return conta


def _descobrir_email(creds) -> str:
    """Melhor esforço: o id do calendário 'primary' é o e-mail da conta."""
    try:
        service = _build_service(creds)
        cal = service.calendars().get(calendarId="primary").execute()
        return cal.get("id", "")
    except Exception:  # noqa: BLE001 — apenas exibição; não é crítico
        return ""


def desconectar(usuario) -> bool:
    """
    Remove a conexão do profissional.

    Revoga o token no Google (melhor esforço) e apaga a ``ContaGoogle`` — o que,
    por cascata, remove os mapeamentos ``EventoGoogle``. Os eventos já criados
    permanecem no Google Agenda do profissional (pertencem a ele).
    """
    conta = ContaGoogle.objects.filter(usuario=usuario).first()
    if conta is None:
        return False
    try:
        requests.post(
            _REVOKE_URI,
            params={"token": conta.refresh_token},
            headers={"content-type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
    except Exception:  # noqa: BLE001 — revogação é melhor esforço
        logger.warning("Falha ao revogar token do Google (usuário %s)", usuario.pk)
    conta.delete()
    return True


def status_para(usuario) -> dict:
    """Resumo do estado da conexão do usuário (para o endpoint de status)."""
    conta = ContaGoogle.objects.filter(usuario=usuario).first()
    return {
        "configurado": esta_configurado(),
        "conectado": conta is not None,
        "ativa": bool(conta and conta.ativa),
        "email_google": conta.email_google if conta else "",
        "conectada_em": conta.conectada_em if conta else None,
    }


# ---------------------------------------------------------------------------
# Credenciais e cliente da Calendar API
# ---------------------------------------------------------------------------
def _expiry_aware(expiry) -> datetime | None:
    """``creds.expiry`` vem naive em UTC; converte para aware (USE_TZ=True)."""
    if expiry is None:
        return None
    return expiry.replace(tzinfo=dt_timezone.utc)


def _credenciais(conta: ContaGoogle):
    """Credenciais válidas do usuário, renovando o access token se necessário."""
    from google.auth.exceptions import RefreshError
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    from datetime import timedelta

    precisa_refresh = (
        not conta.access_token
        or conta.access_token_expira_em is None
        or conta.access_token_expira_em <= timezone.now() + timedelta(seconds=60)
    )

    creds = Credentials(
        token=conta.access_token or None,
        refresh_token=conta.refresh_token,
        token_uri=_TOKEN_URI,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=settings.GOOGLE_CALENDAR_SCOPES,
    )
    if precisa_refresh:
        try:
            creds.refresh(Request())
        except RefreshError as exc:
            # Token revogado pelo usuário ou expirado: desliga a conta.
            conta.ativa = False
            conta.save(update_fields=["ativa", "atualizado_em"])
            raise ContaRevogada(str(exc)) from exc
        conta.access_token = creds.token
        conta.access_token_expira_em = _expiry_aware(creds.expiry)
        conta.save(
            update_fields=["access_token", "access_token_expira_em", "atualizado_em"]
        )
    return creds


def _build_service(creds):
    from googleapiclient.discovery import build

    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _service(conta: ContaGoogle):
    return _build_service(_credenciais(conta))


# ---------------------------------------------------------------------------
# Montagem do evento e operações remotas
# ---------------------------------------------------------------------------
def _montar_payload(agendamento: Agendamento) -> dict:
    tz = timezone.get_current_timezone()
    inicio = timezone.make_aware(
        datetime.combine(agendamento.data, agendamento.horario_inicio), tz
    )
    fim = timezone.make_aware(
        datetime.combine(agendamento.data, agendamento.horario_fim), tz
    )

    if settings.GOOGLE_EVENTO_COM_DADOS_PACIENTE:
        summary = f"{agendamento.paciente} — {agendamento.servico.nome}"
        linhas = [
            f"Paciente: {agendamento.paciente}",
            f"Serviço: {agendamento.servico.nome}",
            f"Sala: {agendamento.sala.nome}",
            f"Status: {agendamento.get_status_display()}",
        ]
        if agendamento.observacoes:
            linhas.append(f"Observações: {agendamento.observacoes}")
        description = "\n".join(linhas)
    else:
        summary = "Atendimento"
        description = f"Status: {agendamento.get_status_display()}"
    description += "\n\n(Sincronizado da Clínica da Aprendizagem)"

    return {
        "summary": summary,
        "description": description,
        "location": agendamento.sala.nome,
        "start": {"dateTime": inicio.isoformat(), "timeZone": settings.TIME_ZONE},
        "end": {"dateTime": fim.isoformat(), "timeZone": settings.TIME_ZONE},
        # Sigilo do paciente: o evento nunca é público na agenda do profissional.
        "visibility": "private",
        "extendedProperties": {
            "private": {
                "clinica_agendamento_id": str(agendamento.pk),
                "origem": "clinica-erp",
            }
        },
        "reminders": {"useDefault": True},
    }


def _criar_remoto(conta: ContaGoogle, payload: dict) -> str:
    evento = (
        _service(conta)
        .events()
        .insert(calendarId=conta.calendar_id, body=payload)
        .execute()
    )
    return evento["id"]


def _atualizar_ou_recriar_remoto(
    conta: ContaGoogle, event_id: str, payload: dict
) -> str:
    from googleapiclient.errors import HttpError

    service = _service(conta)
    try:
        evento = (
            service.events()
            .update(calendarId=conta.calendar_id, eventId=event_id, body=payload)
            .execute()
        )
        return evento["id"]
    except HttpError as exc:
        # Evento apagado no próprio Google pelo profissional: recria.
        if exc.resp.status in (404, 410):
            evento = (
                service.events()
                .insert(calendarId=conta.calendar_id, body=payload)
                .execute()
            )
            return evento["id"]
        raise


def _apagar_remoto(conta: ContaGoogle, event_id: str) -> None:
    from googleapiclient.errors import HttpError

    try:
        _service(conta).events().delete(
            calendarId=conta.calendar_id, eventId=event_id
        ).execute()
    except HttpError as exc:
        if exc.resp.status in (404, 410):  # já não existe: ok
            return
        raise


# ---------------------------------------------------------------------------
# Orquestração da sincronização de um agendamento
# ---------------------------------------------------------------------------
def sincronizar_agendamento(agendamento: Agendamento) -> None:
    """
    Alinha o evento no Google ao estado atual do agendamento.

    Cobre criação, edição, mudança de status e transferência de profissional:
    - Sem conta ativa do profissional, ou status ``DESMARCADO`` → remove o evento
      (se existia) e não cria nada.
    - Profissional mudou → apaga o evento na conta antiga e recria na nova.
    """
    if not esta_configurado():
        return

    existente = (
        EventoGoogle.objects.select_related("conta")
        .filter(agendamento=agendamento)
        .first()
    )
    conta = ContaGoogle.objects.filter(
        usuario=agendamento.profissional, ativa=True
    ).first()
    deve_ter_evento = (
        conta is not None and agendamento.status not in _STATUS_SEM_EVENTO
    )

    # 1) Evento não deveria existir mais, ou migrou de conta → apaga o antigo.
    if existente and (
        not deve_ter_evento or existente.conta_id != (conta.id if conta else None)
    ):
        _apagar_remoto(existente.conta, existente.google_event_id)
        existente.delete()
        existente = None

    if not deve_ter_evento:
        return

    payload = _montar_payload(agendamento)
    if existente:
        novo_id = _atualizar_ou_recriar_remoto(
            conta, existente.google_event_id, payload
        )
        existente.google_event_id = novo_id
        existente.save(update_fields=["google_event_id", "ultima_sincronizacao"])
    else:
        event_id = _criar_remoto(conta, payload)
        EventoGoogle.objects.create(
            agendamento=agendamento, conta=conta, google_event_id=event_id
        )


# ---------------------------------------------------------------------------
# Invólucros "seguros" chamados pelos signals (nunca levantam exceção)
# ---------------------------------------------------------------------------
def sincronizar_agendamento_seguro(agendamento_id: int) -> None:
    """Sincroniza por id, engolindo e registrando qualquer erro."""
    if not esta_configurado():
        return
    try:
        agendamento = (
            Agendamento.objects.select_related(
                "paciente", "profissional", "sala", "servico"
            )
            .filter(pk=agendamento_id)
            .first()
        )
        if agendamento is None:  # apagado nesse meio-tempo
            return
        sincronizar_agendamento(agendamento)
    except ContaRevogada:
        logger.warning(
            "Conta Google revogada ao sincronizar agendamento %s; conta desativada.",
            agendamento_id,
        )
    except Exception:  # noqa: BLE001 — sync nunca pode quebrar o fluxo de negócio
        logger.exception(
            "Falha ao sincronizar agendamento %s com o Google Agenda.",
            agendamento_id,
        )


def apagar_evento_seguro(conta: ContaGoogle, event_id: str) -> None:
    """Remove o evento remoto, engolindo e registrando qualquer erro."""
    if not esta_configurado():
        return
    try:
        _apagar_remoto(conta, event_id)
    except Exception:  # noqa: BLE001
        logger.exception("Falha ao remover evento %s do Google Agenda.", event_id)

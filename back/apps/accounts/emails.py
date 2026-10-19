"""
E-mails transacionais do app de contas.

Todos saem pelo backend configurado em ``EMAIL_BACKEND`` (Resend em produção) e
são renderizados a partir de ``templates/emails/<nome>.{html,txt}`` — o HTML
herda o layout de ``emails/base.html`` e o texto puro serve de alternativa para
clientes que não exibem HTML.

- **Convite**: a Direção/Supervisão cadastra um usuário no modo "convite" e ele
  recebe um link para definir a própria senha e ativar a conta.
- **Redefinição de senha**: "esqueci minha senha" na tela de login.
- **Senha alterada**: aviso de segurança após qualquer troca/redefinição.

Os links usam o gerador de tokens padrão do Django: valem uma única vez (o token
deixa de valer quando a senha muda) e expiram em ``PASSWORD_RESET_TIMEOUT``.
"""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

SEGUNDOS_POR_HORA = 60 * 60
# Logo servida pelo frontend (``front/public``); e-mail exige URL absoluta.
LOGO_EMAIL = "logo-email.png"


def gerar_uid_token(usuario):
    """Retorna (uid, token) para o fluxo de convite/redefinição."""
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    return uid, token


def _url_frontend(caminho: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/{caminho.lstrip('/')}"


def _link_com_token(usuario, caminho: str) -> str:
    uid, token = gerar_uid_token(usuario)
    return f"{_url_frontend(caminho)}?uid={uid}&token={token}"


def montar_link_convite(usuario):
    """Monta o link do frontend para aceitar o convite."""
    return _link_com_token(usuario, "convite")


def montar_link_redefinicao(usuario):
    """Monta o link do frontend para redefinir a senha."""
    return _link_com_token(usuario, "redefinir-senha")


def _primeiro_nome(usuario) -> str:
    return (usuario.nome or "").split(" ")[0] or "olá"


def _enviar_template(nome_template: str, assunto: str, usuario, contexto: dict):
    """Renderiza ``emails/<nome_template>`` (HTML + texto) e envia ao usuário."""
    contexto_completo = {
        "marca": settings.EMAIL_MARCA_NOME,
        "ano": timezone.localdate().year,
        "nome": _primeiro_nome(usuario),
        "logo_url": _url_frontend(LOGO_EMAIL),
        **contexto,
    }
    texto = render_to_string(f"emails/{nome_template}.txt", contexto_completo)
    html = render_to_string(f"emails/{nome_template}.html", contexto_completo)
    mensagem = EmailMultiAlternatives(
        subject=assunto,
        body=texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[usuario.email],
    )
    mensagem.attach_alternative(html, "text/html")
    mensagem.send(fail_silently=False)


def enviar_convite(usuario):
    """Envia o e-mail de convite com o link para o usuário definir a senha."""
    link = montar_link_convite(usuario)
    _enviar_template(
        "convite",
        f"Seu acesso à {settings.EMAIL_MARCA_NOME} está pronto",
        usuario,
        {"link": link},
    )
    return link


def enviar_redefinicao_senha(usuario):
    """Envia o link de redefinição de senha ("esqueci minha senha")."""
    link = montar_link_redefinicao(usuario)
    _enviar_template(
        "redefinir_senha",
        f"Redefinição de senha — {settings.EMAIL_MARCA_NOME}",
        usuario,
        {
            "link": link,
            "validade_horas": settings.PASSWORD_RESET_TIMEOUT // SEGUNDOS_POR_HORA,
        },
    )
    return link


def enviar_aviso_senha_alterada(usuario):
    """Avisa o usuário de que a senha da conta foi alterada (alerta de segurança)."""
    quando = timezone.localtime().strftime("%d/%m/%Y às %H:%M")
    _enviar_template(
        "senha_alterada",
        f"Sua senha foi alterada — {settings.EMAIL_MARCA_NOME}",
        usuario,
        {
            "email": usuario.email,
            "quando": quando,
            "link": _url_frontend("esqueci-senha"),
        },
    )

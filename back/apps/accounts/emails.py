"""
E-mails transacionais do app de contas.

Por ora, apenas o convite de acesso: quando a Direção/Supervisão cadastra um
usuário no modo "convite", enviamos um link para que ele defina a própria senha
e ative a conta. O token usa o gerador padrão do Django (válido enquanto a senha
não for definida/alterada).
"""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def gerar_uid_token(usuario):
    """Retorna (uid, token) para o fluxo de convite/redefinição."""
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    return uid, token


def montar_link_convite(usuario):
    """Monta o link do frontend para aceitar o convite."""
    uid, token = gerar_uid_token(usuario)
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/convite?uid={uid}&token={token}"


def enviar_convite(usuario):
    """Envia o e-mail de convite com o link para o usuário definir a senha."""
    link = montar_link_convite(usuario)
    assunto = "Convite de acesso — Clínica da Aprendizagem"
    corpo = (
        f"Olá, {usuario.nome}.\n\n"
        "Você foi convidado(a) a acessar o sistema da Clínica da Aprendizagem.\n"
        "Para definir sua senha e ativar o acesso, clique no link abaixo:\n\n"
        f"{link}\n\n"
        "Se você não esperava este convite, ignore este e-mail.\n\n"
        "Equipe Clínica da Aprendizagem"
    )
    send_mail(
        assunto,
        corpo,
        settings.DEFAULT_FROM_EMAIL,
        [usuario.email],
        fail_silently=False,
    )
    return link

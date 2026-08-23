"""Manager customizado do modelo de usuário (login por e-mail, sem username)."""
from django.contrib.auth.models import BaseUserManager


class UsuarioManager(BaseUserManager):
    """Gerencia a criação de usuários e superusuários usando e-mail como login."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        """Cria e persiste um usuário com o e-mail e a senha informados."""
        if not email:
            raise ValueError("O e-mail deve ser informado.")
        email = self.normalize_email(email)
        # ``papeis`` (M2M) não pode ser passado ao construtor; extrai antes.
        papeis = extra_fields.pop("papeis", None)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        self._sincronizar_papeis(user, papeis)
        return user

    def _sincronizar_papeis(self, user, papeis=None):
        """
        Garante o conjunto ``papeis`` do usuário (multi-papel).

        Compat: quem ainda cria usuário só com ``role=`` (código legado e testes)
        recebe automaticamente ``papeis = {role}``. O signal em ``models`` mantém
        o ``role`` como o papel principal derivado do conjunto.
        """
        from apps.accounts.models import PapelUsuario

        codigos = set(papeis) if papeis else {user.role}
        objs = [
            PapelUsuario.objects.using(self._db).get_or_create(codigo=c)[0]
            for c in codigos
        ]
        user.papeis.set(objs)

    def create_user(self, email, password=None, **extra_fields):
        """Cria um usuário comum (não administrativo)."""
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        """Cria um superusuário (acesso total, papel DIREÇÃO por padrão)."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        # Importado localmente para evitar dependência circular com models.
        from apps.accounts.models import Papel

        extra_fields.setdefault("role", Papel.DIRECAO)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superusuário precisa ter is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superusuário precisa ter is_superuser=True.")
        return self._create_user(email, password, **extra_fields)

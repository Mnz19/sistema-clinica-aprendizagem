"""Funções utilitárias do app de contas."""


def get_client_ip(request):
    """
    Extrai o IP de origem da requisição.

    Considera o cabeçalho ``X-Forwarded-For`` (usado quando há proxy/load balancer
    à frente da aplicação) e recai para ``REMOTE_ADDR`` caso contrário.
    """
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        # O primeiro IP da lista é o cliente original.
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")

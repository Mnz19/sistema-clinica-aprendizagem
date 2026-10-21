"""Logs de erro do Django no stderr em produção (Spec 54 do erp-backend do fontes).

Sem ``LOGGING``, com ``DEBUG=False`` o Django manda os erros 500 só para
``mail_admins`` e o traceback some. O ``dictConfig`` roda num subprocesso para
não mexer no logging do pytest. Fica em accounts/tests porque o pytest.ini
só coleta apps/.
"""
import importlib
import json
import re
import subprocess
import sys

import pytest

APLICAR_E_LOGAR = """
import json, logging, logging.config, sys
logging.config.dictConfig(json.loads(sys.argv[1]))
logging.getLogger("django.request").error("Internal Server Error: /api/x/")
logging.getLogger("django.request").warning("Not Found: /api/nao-existe/")
logging.getLogger("apps.pacientes").warning("aviso da aplicacao")
logging.getLogger("apps.pacientes").info("info da aplicacao")
"""


@pytest.fixture
def logging_prod(monkeypatch):
    monkeypatch.setenv("ALLOWED_HOSTS", "app.clinicadaaprendizagem.com.br")
    sys.modules.pop("config.settings.prod", None)
    sys.modules.pop("config.settings.base", None)
    yield importlib.import_module("config.settings.prod").LOGGING
    sys.modules.pop("config.settings.prod", None)
    sys.modules.pop("config.settings.base", None)


def _stderr_com(logging_config):
    resultado = subprocess.run(
        [sys.executable, "-c", APLICAR_E_LOGAR, json.dumps(logging_config)],
        capture_output=True, text=True, timeout=30, check=True,
    )
    return resultado.stderr.splitlines()


def test_erro_500_sai_no_stderr_comecando_pela_data(logging_prod):
    linhas = _stderr_com(logging_prod)

    erro = [linha for linha in linhas if "Internal Server Error" in linha]
    assert len(erro) == 1
    # O Alloy junta o traceback à linha que começa com a data.
    assert re.match(r"^\d{4}-\d{2}-\d{2} ", erro[0])
    assert "ERROR django.request" in erro[0]


def test_4xx_do_django_request_nao_sai(logging_prod):
    assert not any("Not Found" in linha for linha in _stderr_com(logging_prod))


def test_aviso_da_aplicacao_sai_e_info_nao(logging_prod):
    linhas = _stderr_com(logging_prod)

    assert any("aviso da aplicacao" in linha for linha in linhas)
    assert not any("info da aplicacao" in linha for linha in linhas)

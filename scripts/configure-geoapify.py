#!/usr/bin/env python3
"""Validate a private key file, install Docker Secret and deploy optional overlay.
No credentials are printed, committed or passed in process arguments.
"""
import os, sys, subprocess, secrets, urllib.request, urllib.parse, urllib.error
from pathlib import Path
root=Path(__file__).resolve().parents[1]
path=Path(sys.argv[1]).expanduser() if len(sys.argv)>1 else Path.home()/'.geoapify-api-key'
if not path.is_file():
 print('Credencial ausente. É necessário concluir o login Geoapify e fornecer a chave em arquivo privado.',file=sys.stderr);sys.exit(2)
os.chmod(path,0o600)
key=path.read_text().strip()
if not key or len(key)>512 or any(c.isspace() for c in key):
 print('Formato de credencial inválido.',file=sys.stderr);sys.exit(2)
url='https://api.geoapify.com/v1/geocode/autocomplete?'+urllib.parse.urlencode({'text':'Rua Ibituruna, Rio de Janeiro','limit':1,'apiKey':key})
try:
 with urllib.request.urlopen(url,timeout=15) as r:r.read()
except urllib.error.HTTPError as e:
 print(f'Provedor recusou a validação (HTTP {e.code}); configuração não alterada.',file=sys.stderr);sys.exit(3)
except Exception:
 print('Não foi possível validar a credencial; configuração não alterada.',file=sys.stderr);sys.exit(3)
name='pedala_geoapify_'+secrets.token_hex(6)
subprocess.run(['docker','secret','create',name,'-'],input=key.encode(),stdout=subprocess.DEVNULL,check=True)
state=Path.home()/'.local/share/pedala';state.mkdir(parents=True,exist_ok=True);os.chmod(state,0o700)
(state/'geoapify-secret-name').write_text(name+'\n')
env=dict(os.environ,GEOAPIFY_SECRET_NAME=name)
subprocess.run(['docker','stack','deploy','--resolve-image','never','-c','deploy/stack.yml','-c','deploy/geoapify.yml','pedala'],cwd=root,env=env,check=True)
print('Credencial validada e segredo instalado; atualização da aplicação iniciada.')

# Operação

## Servidor atual

Stack `pedala`, imagem `pedala:1.3.0`, aplicação no nó `s2951cetriov049`, PostgreSQL no manager e conector Cloudflare na rede overlay privada. Nenhuma porta do banco é publicada. DNS `pedala.enzostana.space` aponta para o túnel dedicado identificado em `deploy/tunnel.yml`.

Segredos externos esperados: `pedala_db_password` (senha PostgreSQL), `pedala_database_url` (URL completa usando host `db`) e `pedala_tunnel_credentials` (JSON de credenciais do túnel). Crie com `docker secret create NOME -`, enviando os valores pelo stdin. Não coloque esses valores no Git, em argumentos de shell ou no YAML.

```sh
docker build -t pedala:1.3.0 .
scripts/deploy-navigation.sh
curl --fail https://pedala.enzostana.space/api/health
docker service ls --filter name=pedala
docker service logs --tail 50 pedala_app
```

Em outro servidor, ajuste o hostname de placement, domínio, ID do túnel e credenciais. Configure a rota DNS para o UUID específico, sem herdar o túnel de configuração global do cloudflared. O banco exige volume persistente local ao nó selecionado. Não mova o serviço para outro nó sem mover os dados.

## Backup e restauração

Em um diretório privado fora do Git:

```sh
umask 077
docker ps --filter label=com.docker.swarm.service.name=pedala_db --format '{{.ID}}'
# Use o ID retornado como DB_CONTAINER.
docker exec DB_CONTAINER pg_dump -U pedala -d pedala -Fc > pedala.dump
```

Para validar um backup, crie banco separado dentro do mesmo PostgreSQL e restaure nele:

```sh
docker exec DB_CONTAINER createdb -U pedala pedala_restore_check
docker exec -i DB_CONTAINER pg_restore -U pedala -d pedala_restore_check < pedala.dump
docker exec DB_CONTAINER psql -U pedala -d pedala_restore_check -c 'SELECT count(*) FROM stations;'
docker exec DB_CONTAINER dropdb -U pedala pedala_restore_check
```

Para recuperação real, interrompa tráfego e aplicação antes de restaurar; mantenha cópia do banco anterior. Nunca execute os testes automatizados no banco real. Antes de atualizar esquema, gere e valide backup. Para rollback de código no mesmo esquema, retenha a imagem anterior e use `docker service update --image IMAGEM_ANTERIOR pedala_app`.

## Limites

Uma réplica, operação acadêmica de baixo volume. Não há limpeza automática de sessões, recuperação de bikes abandonadas, rate limiting distribuído ou tolerância à perda do servidor. Viagens abandonadas no modo compartilhado mantêm a bike em uso; para apresentação, prefira a demo isolada e reiniciável. Credenciais e backups são responsabilidade operacional do servidor.

Migração UVA: versão 1 em schema_migrations, executada sob advisory lock na inicialização. Acrescenta estação 07 e bikes PDL-025 a PDL-028 aos cenários existentes. Antes da atualização 1.1.0, backup before-uva.dump foi restaurado e validado em banco separado.

## Navegação sem serviços de rota externos

A stack usa Nominatim e Valhalla na rede privada `pedala`; nenhuma porta de navegação é publicada. O mapa visual continua usando tiles OpenStreetMap. O arquivo regional foi obtido de `https://download.openstreetmap.fr/extracts/south-america/brazil/southeast/rio-de-janeiro-latest.osm.pbf`, com SHA-256 `7770179316bd57bb8782eb821f18ffdac325e32a381638af0aa8e741eba4b196`. A data de aquisição e o checksum também ficam em `/home/cinadmin/pedala-geodata/source/`.

Os índices iniciais ficam no volume Docker `pedala_geocoder_data` e em `/home/cinadmin/pedala-geodata/valhalla`; o PBF de origem fica em `/home/cinadmin/pedala-geodata/source`. O estado ativo é selecionado em `/home/cinadmin/pedala-geodata/active.env`. A topologia fixa os serviços ao mesmo nó que contém esses dados. Não remova esses volumes nem mova os serviços sem transferir e validar os dados.

Nominatim tem limite operacional de 3 GB; Valhalla, 2 GB. As importações são sequenciais, com no máximo dois processadores e 6 GB por processo. O banco de aluguéis fica em volume independente. Os serviços de navegação não guardam logs de requisições ou coordenadas; monitore-os pela saúde dos contêineres e pela verificação de rota descrita abaixo.

Para reaplicar a versão configurada, incluindo **ambos** os arquivos de stack:

```sh
scripts/deploy-navigation.sh
docker service ls --filter name=pedala
docker service ps pedala_nominatim
docker service ps pedala_valhalla
curl --fail https://pedala.enzostana.space/api/health
```

### Atualização manual dos dados

Execute `scripts/build-navigation-data.sh 20261111a` com um identificador novo. O processo baixa o PBF, registra data e SHA-256, cria volume e diretório independentes, importa os serviços sequencialmente e valida uma busca e uma rota de bicicleta. Pode demorar; o conjunto anterior continua ativo. O snapshot final contém `activate.env` e ainda não está em produção.

Para trocar após o resultado validado, guarde uma cópia de `active.env`, copie o `activate.env` do snapshot para esse arquivo e execute `scripts/deploy-navigation.sh`; aguarde os serviços ficarem saudáveis e teste novamente busca, rota e aluguel. Para reverter, restaure a cópia anterior de `active.env` e reaplique o mesmo comando. Mantenha os dois conjuntos de volumes até validar a troca. O aplicativo precisa ser reiniciado na troca para atualizar o limite municipal mantido em memória.

Para rollback de aplicação sem trocar índices, use `docker service update --image pedala:1.2.2 pedala_app`. A versão anterior solicita Geoapify para busca e rota, mas preserva aluguéis. Para reinstalar 1.3.0, aplique `scripts/deploy-navigation.sh` novamente.

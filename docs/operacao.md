# Operação

## Servidor atual

Stack `pedala`, imagem `pedala:1.0.3`, aplicação no nó `s2951cetriov049`, PostgreSQL no manager e conector Cloudflare na rede overlay privada. Nenhuma porta do banco é publicada. DNS `pedala.enzostana.space` aponta para o túnel dedicado identificado em `deploy/tunnel.yml`.

Segredos externos esperados: `pedala_db_password` (senha PostgreSQL), `pedala_database_url` (URL completa usando host `db`) e `pedala_tunnel_credentials` (JSON de credenciais do túnel). Crie com `docker secret create NOME -`, enviando os valores pelo stdin. Não coloque esses valores no Git, em argumentos de shell ou no YAML.

```sh
docker build -t pedala:1.0.3 .
docker stack deploy --resolve-image never -c deploy/stack.yml pedala
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

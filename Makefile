docker-tag=zzave/homey-grafana:latest
docker-name=homey-grafana

build:
	docker build -t ${docker-tag} .
.PHONY: build

run:
	docker run --rm -i \
			--name ${docker-name} \
			--mount type=bind,source="$(PWD)"/settings,target=/root/.athom-cli \
			-p8080:8080 \
			-eDEBUG=* \
			${docker-tag}
.PHONY: run

run-all:
	docker-compose up
.PHONY: run-all

stop:
	docker stop ${docker-name}
.PHONY: stop

destroy:
	docker rmi ${docker-tag}
.PHONY: destroy

logs:
	docker logs -f ${docker-name}
.PHONY: log
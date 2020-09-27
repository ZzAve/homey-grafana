docker-tag=zzave/homey-grafana:latest
docker-name=homey-grafana

build:
	docker build -t ${docker-tag} .
.PHONY: build

run:
	docker run --name ${docker-name} --rm -d -p8080:8080 ${docker-tag}
.PHONY: run

stop:
	docker stop ${docker-name}
.PHONY: stop

destroy:
	docker rmi ${docker-tag}
.PHONY: destroy

logs:
	docker logs -f ${docker-name}
.PHONY: log
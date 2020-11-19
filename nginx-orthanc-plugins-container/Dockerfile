FROM nginx

WORKDIR /root/

ADD ./setup-locales.sh ./setup-locales.sh
RUN bash ./setup-locales.sh

ADD ./download-orthanc.sh ./download-orthanc.sh
RUN bash ./download-orthanc.sh

ADD ./create-config.sh ./create-config.sh
RUN bash ./create-config.sh

RUN rm ./setup-locales.sh ./download-orthanc.sh ./create-config.sh

ADD ./download-plugins.sh ./download-plugins.sh
RUN bash ./download-plugins.sh

RUN rm ./download-plugins.sh

COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
COPY ./nginx/server.crt /etc/nginx/server.crt
COPY ./nginx/server.key /etc/nginx/server.key

EXPOSE 4242
EXPOSE 8042
EXPOSE 443

RUN apt-get update
RUN apt-get install -y supervisor

ADD supervisord.conf /etc/supervisor/conf.d/supervisord.conf 

ENTRYPOINT ["/usr/bin/supervisord"]

ENV MALLOC_ARENA_MAX 5

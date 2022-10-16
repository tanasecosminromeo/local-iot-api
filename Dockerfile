FROM node:18.11.0-alpine3.16
LABEL version="0.1"
LABEL maintaner="tanasecosminromeo@gmail.com < Cosmin Romeo TANASE >"

# Install dependencies
RUN apk update \
  && apk add --no-cache py3-pip shadow cargo rust openssl-dev tzdata \
  && apk add --no-cache --virtual .pynacl_deps build-base python3-dev libffi-dev

# Create app directory
RUN groupadd -r app && useradd -r -g app app \
    && mkdir -p /home/app \
    && chown -R app:app /home/app

# remove build dependencies
RUN pip install python-miio
RUN apk del .pynacl_deps build-base cargo rust python3-dev openssl-dev \
    && rm -rf /var/cache/apk/*

# Set default timezone (required for miio)
RUN ln -fs /usr/share/zoneinfo/UTC /etc/localtime

# Set working directory
WORKDIR /home/app
ADD ./ /home/app/

# Use entrypoint
ADD entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
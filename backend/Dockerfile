FROM node:11
WORKDIR /app
COPY . /app
# Installing only production dependencies
RUN npm install --production
# Available enviroment variables
ENV CONFIG_FILE_PATH='/app/config.yml'
ENV PORT=3000
ENV LOGGER_LOG_LEVEL='info'
# Required volume mounts
VOLUME '/app/config.yml'
VOLUME '/app/assets'
# Default start the master process
CMD ["node", "bin/www"]

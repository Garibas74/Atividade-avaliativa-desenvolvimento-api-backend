FROM php:8.3-cli-bookworm
RUN apt-get update && apt-get install -y libsqlite3-dev libonig-dev unzip && docker-php-ext-install pdo_sqlite mbstring && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction
COPY . .
RUN mkdir -p data
CMD ["sh", "-c", "php init.php && php -S 0.0.0.0:8000 router.php"]

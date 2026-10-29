FROM php:8.5-apache

RUN pecl install xdebug \
    && docker-php-ext-enable xdebug


RUN apt-get update && apt-get upgrade -y && apt-get install -y git

RUN apt-get install -y \
        libzip-dev \
        zip \
  && docker-php-ext-install zip

RUN docker-php-ext-install -j$(nproc) pdo_mysql

# mod_rewrite для .htaccess (усі /api/... запити → index.php)
RUN a2enmod rewrite

RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
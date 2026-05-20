CREATE DATABASE IF NOT EXISTS fittrack;
USE fittrack;

CREATE USER IF NOT EXISTS 'fittrack_user'@'localhost' IDENTIFIED BY 'fittrack_pass';
GRANT ALL PRIVILEGES ON fittrack.* TO 'fittrack_user'@'localhost';
FLUSH PRIVILEGES;

-- Runs once, when the MySQL volume is first created.
CREATE DATABASE IF NOT EXISTS kuraat_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON kuraat_test.* TO 'kuraat'@'%';
FLUSH PRIVILEGES;

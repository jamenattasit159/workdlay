-- =============================================
-- Document Management System Schema
-- =============================================

CREATE DATABASE IF NOT EXISTS `doc_system` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `doc_system`;

-- -----------------------------------------
-- Stores: ร้านค้าในเครือ
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS `stores` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `branch` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `tax_id` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `logo_url` VARCHAR(500) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------
-- Document Templates: แม่แบบเอกสารของแต่ละร้าน
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS `document_templates` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `store_id` INT UNSIGNED NOT NULL,
  `primary_color` VARCHAR(20) DEFAULT '#1a5276',
  `accent_color` VARCHAR(20) DEFAULT '#2e86c1',
  `font_family` VARCHAR(100) DEFAULT 'Sarabun',
  `header_text` VARCHAR(500) DEFAULT NULL,
  `footer_text` TEXT DEFAULT NULL,
  `show_tax` TINYINT(1) DEFAULT 1,
  `tax_rate` DECIMAL(5,2) DEFAULT 7.00,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------
-- Documents: หัวเอกสาร
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS `documents` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `doc_number` VARCHAR(30) NOT NULL UNIQUE,
  `doc_type` ENUM('quotation','delivery','receipt') NOT NULL,
  `store_id` INT UNSIGNED NOT NULL,
  `customer_name` VARCHAR(200) DEFAULT NULL,
  `customer_address` TEXT DEFAULT NULL,
  `customer_phone` VARCHAR(50) DEFAULT NULL,
  `customer_tax_id` VARCHAR(20) DEFAULT NULL,
  `issue_date` DATE NOT NULL,
  `due_date` DATE DEFAULT NULL,
  `subtotal` DECIMAL(15,2) DEFAULT 0.00,
  `tax_amount` DECIMAL(15,2) DEFAULT 0.00,
  `total` DECIMAL(15,2) DEFAULT 0.00,
  `discount` DECIMAL(15,2) DEFAULT 0.00,
  `note` TEXT DEFAULT NULL,
  `status` ENUM('draft','issued','paid','cancelled') DEFAULT 'draft',
  `ref_doc_id` INT UNSIGNED DEFAULT NULL COMMENT 'reference to quotation or delivery',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------
-- Document Items: รายการสินค้า
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS `document_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `document_id` INT UNSIGNED NOT NULL,
  `seq` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `description` VARCHAR(500) NOT NULL,
  `unit` VARCHAR(50) DEFAULT 'ชิ้น',
  `quantity` DECIMAL(15,3) DEFAULT 1.000,
  `unit_price` DECIMAL(15,2) DEFAULT 0.00,
  `total_price` DECIMAL(15,2) GENERATED ALWAYS AS (`quantity` * `unit_price`) STORED,
  FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------
-- Users: ผู้ใช้งาน
-- -----------------------------------------
CREATE TABLE IF NOT EXISTS `doc_users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(200) DEFAULT NULL,
  `role` ENUM('superadmin','store_admin') DEFAULT 'store_admin',
  `store_id` INT UNSIGNED DEFAULT NULL COMMENT 'NULL = superadmin access all',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------
-- Seed Data
-- -----------------------------------------
INSERT INTO `stores` (`name`, `branch`, `address`, `phone`, `tax_id`, `email`) VALUES
('บริษัท เอเมอรัลด์ จำกัด', 'สาขาสำนักงานใหญ่', '123 ถ.พระราม 9 กรุงเทพฯ 10320', '02-123-4567', '0123456789012', 'info@emerald.co.th'),
('ร้านค้าในเครือ A', 'สาขา 1', '456 ถ.สุขุมวิท กรุงเทพฯ', '081-234-5678', '9876543210123', 'storea@emerald.co.th');

INSERT INTO `document_templates` (`store_id`, `primary_color`, `accent_color`, `font_family`, `footer_text`) VALUES
(1, '#1a3a5c', '#2980b9', 'Sarabun', 'ขอบคุณที่ใช้บริการ'),
(2, '#145a32', '#27ae60', 'Sarabun', 'ยินดีให้บริการเสมอ');

INSERT INTO `doc_users` (`username`, `password_hash`, `full_name`, `role`, `store_id`) VALUES
('superadmin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super Admin', 'superadmin', NULL),
('store1', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ผู้ดูแลร้าน 1', 'store_admin', 1);
-- default password: 'password'

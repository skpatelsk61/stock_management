-- XAMPP-Lite 8.5.5
-- https://xampplite.sf.net/
-- ----------------------------------------------------------------
-- Server version: 11.4.10-MariaDB-log
-- Date: Mon, 21 Sep 2026 07:55:27 +0100

-- MySQL compatibility and import directives (DO NOT REMOVE)
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Table `loan_emi_schedules` =====================================
CREATE TABLE `loan_emi_schedules` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `loan_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `installment_number` int(11) NOT NULL,
  `due_date` date NOT NULL,
  `emi_amount` decimal(12,2) NOT NULL,
  `principal_amount` decimal(12,2) NOT NULL,
  `interest_amount` decimal(12,2) NOT NULL,
  `status` enum('Pending','Paid','Skipped') NOT NULL DEFAULT 'Pending',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `tenants` ================================================
CREATE TABLE `tenants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_uuid` varchar(50) NOT NULL,
  `store_name` varchar(150) NOT NULL,
  `owner_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `gstin` varchar(15) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `database_name` varchar(100) NOT NULL,
  `subscription_status` varchar(20) DEFAULT 'Trial',
  `subscription_plan` varchar(30) DEFAULT 'Trial',
  `subscription_expires_at` date DEFAULT NULL,
  `trial_started_at` timestamp NULL DEFAULT NULL,
  `trial_ended_at` timestamp NULL DEFAULT NULL,
  `trial_used` tinyint(1) DEFAULT 0,
  `first_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_uuid` (`tenant_uuid`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `database_name` (`database_name`),
  KEY `idx_tenants_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
INSERT INTO `tenants` (`id`, `tenant_uuid`, `store_name`, `owner_name`, `email`, `phone`, `address`, `gstin`, `logo_url`, `database_name`, `subscription_status`, `subscription_plan`, `subscription_expires_at`, `trial_started_at`, `trial_ended_at`, `trial_used`, `first_login_at`, `created_at`, `updated_at`) VALUES
  (1,	'TENT-PZDF0P37T',	'Aman Mart',	'Aman Jain',	'aman@kirana.com',	'8585858585',	'Delhi',	NULL,	NULL,	'shop_aman001',	'Active',	'Trial',	'2026-10-01',	'2026-09-12 21:20:12',	'2026-09-19 21:20:12',	1,	'2026-09-12 21:20:12',	'2026-09-12 21:19:29',	'2026-09-12 21:21:23'),
  (2,	'TENT-39T6KYT4O',	'Hari kirana',	'Hariom',	'hariom@gmail.com',	'1111111111',	'Danish Kunj',	NULL,	NULL,	'shop_hariom001',	'Trial',	'Trial',	'2026-09-23',	'2026-09-16 06:00:54',	'2026-09-23 06:00:54',	1,	NULL,	'2026-09-16 06:00:54',	'2026-09-16 06:00:54'),
  (3,	'TENT-JLVC50ST9',	'Abhishek ki dukaan',	'Abhishek',	'abhishek@gmail.com',	'3333333333',	'Ashoka Garden',	NULL,	NULL,	'shop_abhishek001',	'Trial',	'Trial',	'2026-09-24',	'2026-09-17 09:54:55',	'2026-09-24 09:54:55',	1,	'2026-09-17 09:54:55',	'2026-09-16 07:25:04',	'2026-09-17 09:54:55');


-- Table `brands` =================================================
CREATE TABLE `brands` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
--


-- Table `payslips` ===============================================
CREATE TABLE `payslips` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `payroll_item_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `month` varchar(20) NOT NULL,
  `year` int(11) NOT NULL,
  `basic` decimal(12,2) DEFAULT 0.00,
  `hra` decimal(12,2) DEFAULT 0.00,
  `conveyance` decimal(12,2) DEFAULT 0.00,
  `medical` decimal(12,2) DEFAULT 0.00,
  `special` decimal(12,2) DEFAULT 0.00,
  `other_allowances` decimal(12,2) DEFAULT 0.00,
  `bonus` decimal(12,2) DEFAULT 0.00,
  `incentive` decimal(12,2) DEFAULT 0.00,
  `pf` decimal(12,2) DEFAULT 0.00,
  `esi` decimal(12,2) DEFAULT 0.00,
  `pt` decimal(12,2) DEFAULT 0.00,
  `tds` decimal(12,2) DEFAULT 0.00,
  `loan_deduction` decimal(12,2) DEFAULT 0.00,
  `gross_salary` decimal(12,2) DEFAULT 0.00,
  `total_deductions` decimal(12,2) DEFAULT 0.00,
  `net_salary` decimal(12,2) DEFAULT 0.00,
  `payment_date` date DEFAULT NULL,
  `payment_status` enum('Pending','Paid') DEFAULT 'Pending',
  `payment_mode` varchar(50) DEFAULT 'Bank Transfer',
  `pdf_url` varchar(512) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `employees` ==============================================
CREATE TABLE `employees` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `company_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `branch_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `department_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `manager_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `designation_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `photo` text DEFAULT NULL,
  `employeeId` text DEFAULT NULL,
  `employeeCode` text DEFAULT NULL,
  `profileStatus` text DEFAULT NULL,
  `profileCompletion` int(11) DEFAULT 0,
  `firstName` text DEFAULT NULL,
  `middleName` text DEFAULT NULL,
  `lastName` text DEFAULT NULL,
  `gender` text DEFAULT NULL,
  `dateOfBirth` text DEFAULT NULL,
  `maritalStatus` text DEFAULT NULL,
  `bloodGroup` text DEFAULT NULL,
  `nationality` text DEFAULT NULL,
  `company` text DEFAULT NULL,
  `branch` text DEFAULT NULL,
  `reportingManager` text DEFAULT NULL,
  `employeeType` text DEFAULT NULL,
  `employeeStatus` text DEFAULT NULL,
  `dateOfJoining` text DEFAULT NULL,
  `probationEndDate` text DEFAULT NULL,
  `confirmationDate` text DEFAULT NULL,
  `workLocation` text DEFAULT NULL,
  `shift` text DEFAULT NULL,
  `weeklyOff` text DEFAULT NULL,
  `mobileNumber` text DEFAULT NULL,
  `alternateMobile` text DEFAULT NULL,
  `personalEmail` text DEFAULT NULL,
  `officialEmail` text DEFAULT NULL,
  `currentAddress` text DEFAULT NULL,
  `permanentAddress` text DEFAULT NULL,
  `city` text DEFAULT NULL,
  `state` text DEFAULT NULL,
  `country` text DEFAULT NULL,
  `pinCode` text DEFAULT NULL,
  `aadhaarNumber` text DEFAULT NULL,
  `panNumber` text DEFAULT NULL,
  `passportNumber` text DEFAULT NULL,
  `drivingLicense` text DEFAULT NULL,
  `voterId` text DEFAULT NULL,
  `uanNumber` text DEFAULT NULL,
  `esicNumber` text DEFAULT NULL,
  `bankName` text DEFAULT NULL,
  `accountHolderName` text DEFAULT NULL,
  `accountNumber` text DEFAULT NULL,
  `ifscCode` text DEFAULT NULL,
  `branchName` text DEFAULT NULL,
  `salaryStructure` text DEFAULT NULL,
  `basicSalary` text DEFAULT NULL,
  `grossSalary` text DEFAULT NULL,
  `ctc` text DEFAULT NULL,
  `pfApplicable` tinyint(1) DEFAULT 0,
  `esiApplicable` tinyint(1) DEFAULT 0,
  `tdsApplicable` tinyint(1) DEFAULT 0,
  `emergencyContactName` text DEFAULT NULL,
  `emergencyRelation` text DEFAULT NULL,
  `emergencyMobile` text DEFAULT NULL,
  `emergencyAddress` text DEFAULT NULL,
  `education` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`education`)),
  `experience` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`experience`)),
  `skills` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`skills`)),
  `shiftPolicy` text DEFAULT NULL,
  `workingHours` text DEFAULT NULL,
  `attendancePolicy` text DEFAULT NULL,
  `biometricId` text DEFAULT NULL,
  `deviceId` text DEFAULT NULL,
  `overtimeEligible` tinyint(1) DEFAULT 0,
  `leavePolicy` text DEFAULT NULL,
  `casualLeave` text DEFAULT NULL,
  `sickLeave` text DEFAULT NULL,
  `earnedLeave` text DEFAULT NULL,
  `maternityLeave` text DEFAULT NULL,
  `paternityLeave` text DEFAULT NULL,
  `assets` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`assets`)),
  `username` text DEFAULT NULL,
  `confirmPassword` text DEFAULT NULL,
  `role` text DEFAULT NULL,
  `permissionGroup` text DEFAULT NULL,
  `twoFactorAuth` tinyint(1) DEFAULT 0,
  `documents` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`documents`)),
  `kpis` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`kpis`)),
  `rating` text DEFAULT NULL,
  `appraisalDate` text DEFAULT NULL,
  `promotionHistory` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`promotionHistory`)),
  `awards` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`awards`)),
  `resignationDate` text DEFAULT NULL,
  `lastWorkingDate` text DEFAULT NULL,
  `exitReason` text DEFAULT NULL,
  `exitInterview` text DEFAULT NULL,
  `clearanceStatus` text DEFAULT NULL,
  `finalSettlement` text DEFAULT NULL,
  `createdBy` text DEFAULT NULL,
  `createdDate` text DEFAULT NULL,
  `updatedBy` text DEFAULT NULL,
  `updatedDate` text DEFAULT NULL,
  `lastLogin` text DEFAULT NULL,
  `lastPasswordChange` text DEFAULT NULL,
  `recordStatus` text DEFAULT NULL,
  `activityTimeline` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`activityTimeline`)),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `professional_tax_contributions` =========================
CREATE TABLE `professional_tax_contributions` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `payroll_item_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `state` varchar(100) NOT NULL,
  `pt_amount` decimal(12,2) NOT NULL,
  `month` varchar(20) NOT NULL,
  `year` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `holidays` ===============================================
CREATE TABLE `holidays` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `holiday_name` varchar(255) NOT NULL,
  `holiday_date` date NOT NULL,
  `holiday_type` enum('Public','National','Restricted','Company Mandatory','Optional') DEFAULT 'Public',
  `branch` varchar(255) DEFAULT 'All Branches',
  `description` text DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `sales_returns` ==========================================
CREATE TABLE `sales_returns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `return_no` varchar(50) DEFAULT NULL,
  `sale_id` int(11) NOT NULL,
  `invoice_no` varchar(50) NOT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `customer_phone` varchar(50) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `refund_amount` decimal(10,2) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `return_type` varchar(50) DEFAULT 'Refund',
  `refund_method` varchar(50) DEFAULT 'Cash',
  `remarks` text DEFAULT NULL,
  `replacement_product_id` int(11) DEFAULT NULL,
  `replacement_quantity` int(11) DEFAULT NULL,
  `price_difference` decimal(10,2) DEFAULT 0.00,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `asset_allocation` =======================================
CREATE TABLE `asset_allocation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `allocationId` varchar(255) NOT NULL,
  `employee` varchar(255) NOT NULL,
  `empId` varchar(255) DEFAULT NULL,
  `employeeId` int(11) DEFAULT NULL,
  `assetCategory` varchar(255) DEFAULT NULL,
  `assetName` varchar(255) DEFAULT NULL,
  `assetCode` varchar(255) DEFAULT NULL,
  `serialNumber` varchar(255) DEFAULT NULL,
  `issueDate` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Assigned',
  PRIMARY KEY (`id`),
  UNIQUE KEY `allocationId` (`allocationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `payrolls` ===============================================
CREATE TABLE `payrolls` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employeeId` int(11) NOT NULL,
  `month` varchar(255) NOT NULL,
  `year` varchar(255) NOT NULL,
  `basicSalary` decimal(12,2) DEFAULT NULL,
  `allowances` decimal(12,2) DEFAULT NULL,
  `deductions` decimal(12,2) DEFAULT NULL,
  `netPay` decimal(12,2) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Draft',
  `paymentDate` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `daily_attendance` =======================================
CREATE TABLE `daily_attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empId` varchar(255) NOT NULL,
  `employeeId` int(11) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `date` varchar(255) NOT NULL,
  `checkIn` varchar(255) DEFAULT NULL,
  `checkOut` varchar(255) DEFAULT NULL,
  `workingHours` decimal(4,2) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Present',
  `lateComing` int(11) DEFAULT NULL,
  `earlyLeaving` int(11) DEFAULT NULL,
  `overtime` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `performance_improvement_plans` ==========================
CREATE TABLE `performance_improvement_plans` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `performance_issues` text DEFAULT NULL,
  `improvement_objectives` text DEFAULT NULL,
  `action_items` text DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `review_frequency` varchar(255) DEFAULT NULL,
  `assigned_manager_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `progress` decimal(5,2) DEFAULT 0.00,
  `outcome` text DEFAULT NULL,
  `status` enum('Active','Completed','Extended','Failed') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `employee_salary_assignments` ============================
CREATE TABLE `employee_salary_assignments` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `salary_structure_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `base_gross` decimal(12,2) NOT NULL,
  `ctc` decimal(12,2) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `rating_scales` ==========================================
CREATE TABLE `rating_scales` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `scale_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `min_rating` decimal(3,2) DEFAULT 1.00,
  `max_rating` decimal(3,2) DEFAULT 5.00,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `leave_type_masters` =====================================
CREATE TABLE `leave_type_masters` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `leave_code` varchar(255) NOT NULL,
  `leave_name` varchar(255) NOT NULL,
  `paid_type` enum('Paid','Unpaid') DEFAULT 'Paid',
  `max_days` int(11) DEFAULT 12,
  `carry_forward` tinyint(1) DEFAULT 0,
  `max_carry_forward_days` int(11) DEFAULT 0,
  `encashment` tinyint(1) DEFAULT 0,
  `approval_workflow` varchar(255) DEFAULT 'Manager -> HR',
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `tds_masters` ============================================
CREATE TABLE `tds_masters` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `financial_year` varchar(255) NOT NULL,
  `tax_regime` enum('New Tax Regime (Sec 115BAC)','Old Tax Regime') DEFAULT 'New Tax Regime (Sec 115BAC)',
  `standard_deduction` float DEFAULT 75000,
  `tax_slabs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tax_slabs`)),
  `cess_percentage` float DEFAULT 4,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `branches` ===============================================
CREATE TABLE `branches` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `branch_code` varchar(255) NOT NULL,
  `branch_name` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `state` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `timezone` varchar(255) DEFAULT 'UTC',
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `companyId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branch_code` (`branch_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `payroll_runs` ===========================================
CREATE TABLE `payroll_runs` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `month` varchar(20) NOT NULL,
  `year` int(11) NOT NULL,
  `status` enum('Draft','Pending_Approval','Approved','Processed','Locked','Cancelled') NOT NULL DEFAULT 'Draft',
  `approved_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `processed_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `locked_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `document_logs` ==========================================
CREATE TABLE `document_logs` (
  `id` char(36) NOT NULL,
  `document_name` varchar(255) DEFAULT NULL,
  `document_type` varchar(100) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `employee_id` char(36) DEFAULT NULL,
  `file_url` text DEFAULT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `file_size` varchar(50) DEFAULT NULL,
  `uploaded_by` varchar(150) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
--


-- Table `permissions` ============================================
CREATE TABLE `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `module` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `created_at`, `updated_at`) VALUES
  (1,	'view_dashboard',	'Dashboard',	'Access dashboard metrics and business analytics',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (2,	'view_products',	'Products',	'View product catalog and price list',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (3,	'view_categories',	'Category Master',	'View category master records',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (4,	'create_categories',	'Category Master',	'Create new product categories',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (5,	'edit_categories',	'Category Master',	'Modify category details',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (6,	'delete_categories',	'Category Master',	'Remove category listings',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (7,	'view_product_details',	'Product Master',	'View detailed product specifications',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (8,	'create_products',	'Product Master',	'Add new items to master catalog',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (9,	'edit_products',	'Product Master',	'Update product prices and meta',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (10,	'delete_products',	'Product Master',	'Permanently remove items',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (11,	'import_products',	'Product Master',	'Bulk import products via Excel/CSV',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (12,	'export_products',	'Product Master',	'Bulk export products via Excel/CSV',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (13,	'view_stock',	'Stock Management',	'View current inventory stocks across locations',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (14,	'adjust_stock',	'Stock Management',	'Perform manual inventory corrections and stock adjustments',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (15,	'transfer_stock',	'Stock Management',	'Initiate stocks transfers between branches',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (16,	'view_stock_history',	'Stock Management',	'Inspect product movement audit trails',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (17,	'view_purchases',	'Purchase',	'View vendor purchase records and invoices',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (18,	'create_purchases',	'Purchase',	'Create new purchases orders',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (19,	'delete_purchases',	'Purchase',	'Cancel and delete purchase records',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (20,	'view_sales',	'Sales',	'View sales transaction logs and billing logs',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (21,	'create_sales',	'Sales',	'Generate active POS bills and invoices',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (22,	'delete_sales',	'Sales',	'Void or cancel generated sales invoices',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (23,	'view_returns',	'Stock Return',	'Inspect client and supplier returns details',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (24,	'create_returns',	'Stock Return',	'Initiate vendor return notes or customer refund',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (25,	'approve_returns',	'Stock Return',	'Authorized verification for returns credit notes',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (26,	'view_borrow',	'Borrow Ledger',	'Inspect credit accounts and customer udhaar balances',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (27,	'create_borrow',	'Borrow Ledger',	'Log credit sales or customer payback payments',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (28,	'manage_borrow',	'Borrow Ledger',	'Forgive or settle customer accounts parameters',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (29,	'view_staff',	'Staff Management',	'View internal staff member lists',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (30,	'manage_users',	'Staff Management',	'Create, update, and manage employee accounts and roles',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (31,	'view_reports',	'Reports',	'View sales, stock levels, and audit trail logs report modules',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (32,	'export_reports',	'Reports',	'Download statistics as CSV, Excel, or PDF sheets',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (33,	'print_reports',	'Reports',	'Send analytics summaries directly to print devices',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (34,	'view_billing',	'Billing & Subscription',	'Access billing ledger and invoices',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (35,	'manage_subscription',	'Billing & Subscription',	'Renew plans and change subscription specifications',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (36,	'view_notifications',	'Notifications',	'Read system alarms, low stock alerts, and news',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (37,	'manage_notifications',	'Notifications',	'Mark alerts as read, delete, or modify targets',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (38,	'view_settings',	'Settings',	'Inspect shop metadata settings and profiles',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (39,	'manage_settings',	'Settings',	'Edit shop parameters, tax definitions, and profiles',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59'),
  (40,	'view_activity_logs',	'Settings',	'Inspect administrative audit trails and actions logs',	'2026-07-11 06:43:59',	'2026-07-11 06:43:59');


-- Table `grn_items` ==============================================
CREATE TABLE `grn_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grn_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity_received` int(11) NOT NULL,
  `quantity_damaged` int(11) NOT NULL DEFAULT 0,
  `quantity_rejected` int(11) NOT NULL DEFAULT 0,
  `batch_number` varchar(50) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `salary_structures` ======================================
CREATE TABLE `salary_structures` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `announcements_surveys` ==================================
CREATE TABLE `announcements_surveys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `postId` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `type` varchar(255) DEFAULT 'Announcement',
  `publishDate` varchar(255) DEFAULT NULL,
  `content` text DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `postId` (`postId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `overtime_masters` =======================================
CREATE TABLE `overtime_masters` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `overtime_name` varchar(255) NOT NULL,
  `rate_multiplier` float DEFAULT 1.5,
  `min_hours` float DEFAULT 1,
  `max_hours` float DEFAULT 4,
  `applicable_dept` varchar(255) DEFAULT 'All Departments',
  `requires_manager_approval` tinyint(1) DEFAULT 1,
  `requires_hr_approval` tinyint(1) DEFAULT 1,
  `payroll_integrated` tinyint(1) DEFAULT 1,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `competencies` ===========================================
CREATE TABLE `competencies` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `weight` int(11) DEFAULT 0,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `performance_goal_histories` =============================
CREATE TABLE `performance_goal_histories` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `goal_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `progress` decimal(5,2) NOT NULL,
  `comments` text DEFAULT NULL,
  `supporting_document` varchar(255) DEFAULT NULL,
  `updated_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `employee_promotions` ====================================
CREATE TABLE `employee_promotions` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `appraisal_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `current_designation_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `proposed_designation_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `reason` text DEFAULT NULL,
  `effective_date` date NOT NULL,
  `status` enum('Pending','Approved','Rejected','Implemented') DEFAULT 'Pending',
  `approved_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `purchase_order_items` ===================================
CREATE TABLE `purchase_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `purchase_order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `delivered_quantity` decimal(12,3) NOT NULL DEFAULT 0.000,
  `damaged_quantity` decimal(12,3) NOT NULL DEFAULT 0.000,
  `rejected_quantity` decimal(12,3) NOT NULL DEFAULT 0.000,
  `received_quantity` int(11) NOT NULL DEFAULT 0,
  `purchase_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `gst` decimal(5,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `leave_requests` =========================================
CREATE TABLE `leave_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reqId` varchar(255) NOT NULL,
  `empName` varchar(255) NOT NULL,
  `employeeId` int(11) DEFAULT NULL,
  `leaveType` varchar(255) NOT NULL,
  `fromDate` varchar(255) NOT NULL,
  `toDate` varchar(255) NOT NULL,
  `totalDays` decimal(4,1) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Pending',
  PRIMARY KEY (`id`),
  UNIQUE KEY `reqId` (`reqId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `sub_categories` =========================================
CREATE TABLE `sub_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `category_id` int(11) NOT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_subcat_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
--


-- Table `bonus_masters` ==========================================
CREATE TABLE `bonus_masters` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `bonus_name` varchar(255) NOT NULL,
  `bonus_type` enum('Performance','Festival/Diwali','Annual Statutory','Project Milestone','Retention') DEFAULT 'Performance',
  `calculation_type` enum('Fixed Amount','Percentage of Basic','Percentage of CTC') DEFAULT 'Fixed Amount',
  `value` float DEFAULT 5000,
  `department` varchar(255) DEFAULT 'All Departments',
  `designation` varchar(255) DEFAULT 'All Designations',
  `payout_frequency` enum('Monthly','Quarterly','Bi-Annually','Annually','One-Time') DEFAULT 'Annually',
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `payroll_items` ==========================================
CREATE TABLE `payroll_items` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `payroll_run_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `working_days` int(11) DEFAULT 0,
  `present_days` decimal(5,2) DEFAULT 0.00,
  `absent_days` decimal(5,2) DEFAULT 0.00,
  `leave_days` decimal(5,2) DEFAULT 0.00,
  `lop_days` decimal(5,2) DEFAULT 0.00,
  `overtime_hours` decimal(5,2) DEFAULT 0.00,
  `overtime_earnings` decimal(12,2) DEFAULT 0.00,
  `gross_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_allowances` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_deductions` decimal(12,2) NOT NULL DEFAULT 0.00,
  `net_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('Draft','Pending_Approval','Approved','Processed','Locked','Cancelled') NOT NULL DEFAULT 'Draft',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `designations` ===========================================
CREATE TABLE `designations` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `desig_code` varchar(255) NOT NULL,
  `desig_name` varchar(255) NOT NULL,
  `department_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `grade` varchar(255) DEFAULT NULL,
  `job_level` varchar(255) DEFAULT NULL,
  `reporting_to` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `min_experience` varchar(255) DEFAULT NULL,
  `max_experience` varchar(255) DEFAULT NULL,
  `job_category` varchar(255) DEFAULT NULL,
  `employment_type` varchar(255) DEFAULT NULL,
  `assigned_employees_count` int(11) DEFAULT 0,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `performance_masters` ====================================
CREATE TABLE `performance_masters` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `cycle_name` varchar(255) NOT NULL,
  `review_period` enum('Annual','Half-Yearly','Quarterly','Monthly') DEFAULT 'Annual',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `department` varchar(255) DEFAULT 'All Departments',
  `designation` varchar(255) DEFAULT 'All Designations',
  `rating_scale` varchar(255) DEFAULT '5-Point Scale (1: Low to 5: Outstanding)',
  `self_review_weight` int(11) DEFAULT 20,
  `manager_review_weight` int(11) DEFAULT 80,
  `status` enum('Active','Draft','Closed','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `grns` ===================================================
CREATE TABLE `grns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grn_no` varchar(50) NOT NULL,
  `purchase_order_id` int(11) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `grn_no` (`grn_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `salary_structure` =======================================
CREATE TABLE `salary_structure` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empName` varchar(255) NOT NULL,
  `employeeId` int(11) DEFAULT NULL,
  `basic` decimal(12,2) NOT NULL,
  `hra` decimal(12,2) DEFAULT NULL,
  `da` decimal(12,2) DEFAULT NULL,
  `special` decimal(12,2) DEFAULT NULL,
  `conveyance` decimal(12,2) DEFAULT NULL,
  `gross` decimal(12,2) DEFAULT NULL,
  `pfDeduction` decimal(12,2) DEFAULT NULL,
  `esiDeduction` decimal(12,2) DEFAULT NULL,
  `pt` decimal(12,2) DEFAULT NULL,
  `tds` decimal(12,2) DEFAULT NULL,
  `netSalary` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `navigation_menus` =======================================
CREATE TABLE `navigation_menus` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `parent_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `route` varchar(255) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `display_order` int(11) DEFAULT 0,
  `module` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `company` ================================================
CREATE TABLE `company` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `companyCode` varchar(255) NOT NULL,
  `companyName` varchar(255) NOT NULL,
  `shortName` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `regNumber` varchar(255) DEFAULT NULL,
  `cinNumber` varchar(255) DEFAULT NULL,
  `panNumber` varchar(255) DEFAULT NULL,
  `tanNumber` varchar(255) DEFAULT NULL,
  `gstNumber` varchar(255) DEFAULT NULL,
  `pfNumber` varchar(255) DEFAULT NULL,
  `esiNumber` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `address1` varchar(255) DEFAULT NULL,
  `address2` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL,
  `state` varchar(255) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `district` varchar(255) DEFAULT NULL,
  `pincode` varchar(255) DEFAULT NULL,
  `timezone` varchar(255) DEFAULT NULL,
  `currency` varchar(255) DEFAULT NULL,
  `financialYear` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `companyCode` (`companyCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `performance_goals` ======================================
CREATE TABLE `performance_goals` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `performance_master_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `target` varchar(255) DEFAULT NULL,
  `priority` enum('Low','Medium','High') DEFAULT 'Medium',
  `weightage` int(11) DEFAULT 0,
  `progress` decimal(5,2) DEFAULT 0.00,
  `status` enum('Not Started','In Progress','Completed','Approved','Rejected') DEFAULT 'Not Started',
  `assigned_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `comments` text DEFAULT NULL,
  `supporting_document` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `employee_loans` =========================================
CREATE TABLE `employee_loans` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `loan_type` varchar(50) NOT NULL,
  `requested_amount` decimal(12,2) NOT NULL,
  `approved_amount` decimal(12,2) DEFAULT NULL,
  `interest_rate` decimal(5,2) DEFAULT 0.00,
  `tenure_months` int(11) NOT NULL,
  `reason` text DEFAULT NULL,
  `supporting_document` varchar(512) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected','Closed') NOT NULL DEFAULT 'Pending',
  `outstanding_balance` decimal(12,2) DEFAULT 0.00,
  `total_paid` decimal(12,2) DEFAULT 0.00,
  `approved_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `approval_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `purchase_orders` ========================================
CREATE TABLE `purchase_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `purchase_order_no` varchar(50) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `expected_delivery_date` date DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `gst_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `status` varchar(30) NOT NULL DEFAULT 'Draft',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_order_no` (`purchase_order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `job_requisition` ========================================
CREATE TABLE `job_requisition` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reqId` varchar(255) NOT NULL,
  `jobTitle` varchar(255) NOT NULL,
  `department` varchar(255) DEFAULT NULL,
  `departmentId` int(11) DEFAULT NULL,
  `vacancies` int(11) DEFAULT NULL,
  `employmentType` varchar(255) DEFAULT NULL,
  `experienceRequired` varchar(255) DEFAULT NULL,
  `skills` text DEFAULT NULL,
  `budgetSalary` varchar(255) DEFAULT NULL,
  `joiningDate` varchar(255) DEFAULT NULL,
  `approvalStatus` varchar(255) DEFAULT 'Pending',
  `status` varchar(255) DEFAULT 'Open',
  PRIMARY KEY (`id`),
  UNIQUE KEY `reqId` (`reqId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `skills` =================================================
CREATE TABLE `skills` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `audit_logs` =============================================
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` varchar(255) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `roleName` varchar(255) DEFAULT NULL,
  `actionType` varchar(255) NOT NULL,
  `moduleName` varchar(255) NOT NULL,
  `recordId` varchar(255) DEFAULT NULL,
  `previousValues` text DEFAULT NULL,
  `newValues` text DEFAULT NULL,
  `httpMethod` varchar(255) DEFAULT NULL,
  `apiEndpoint` varchar(255) DEFAULT NULL,
  `requestBody` text DEFAULT NULL,
  `ipAddress` varchar(255) DEFAULT NULL,
  `userAgent` text DEFAULT NULL,
  `browser` varchar(255) DEFAULT NULL,
  `device` varchar(255) DEFAULT NULL,
  `os` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Success',
  `failureReason` text DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `payroll_earnings` =======================================
CREATE TABLE `payroll_earnings` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `payroll_item_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(100) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `departments` ============================================
CREATE TABLE `departments` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `company_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `branch_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `dept_code` varchar(255) NOT NULL,
  `dept_name` varchar(255) NOT NULL,
  `head_employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `parent_dept_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `description` text DEFAULT NULL,
  `hr_email` varchar(255) DEFAULT NULL,
  `hr_password` varchar(255) DEFAULT NULL,
  `assigned_modules` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`assigned_modules`)),
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `performance_kpi_histories` ==============================
CREATE TABLE `performance_kpi_histories` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `kpi_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `actual_achievement` decimal(12,2) NOT NULL,
  `recorded_date` date NOT NULL,
  `updated_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `goal_categories` ========================================
CREATE TABLE `goal_categories` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `salary_components` ======================================
CREATE TABLE `salary_components` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `salary_structure_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(100) NOT NULL,
  `type` enum('Earning','Deduction') NOT NULL,
  `calculation_type` enum('Fixed','Percentage') NOT NULL,
  `value` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reference_component` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `loan_repayments` ========================================
CREATE TABLE `loan_repayments` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `loan_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `payroll_item_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `emi_schedule_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_mode` varchar(50) NOT NULL DEFAULT 'Payroll Deduction',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `candidate_database` =====================================
CREATE TABLE `candidate_database` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `candidateId` varchar(255) NOT NULL,
  `firstName` varchar(255) NOT NULL,
  `lastName` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `qualification` varchar(255) DEFAULT NULL,
  `experience` decimal(5,2) DEFAULT NULL,
  `currentCompany` varchar(255) DEFAULT NULL,
  `expectedSalary` varchar(255) DEFAULT NULL,
  `skills` text DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Applied',
  PRIMARY KEY (`id`),
  UNIQUE KEY `candidateId` (`candidateId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `performance_appraisals` =================================
CREATE TABLE `performance_appraisals` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `performance_master_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `self_rating` decimal(3,2) DEFAULT 0.00,
  `manager_rating` decimal(3,2) DEFAULT 0.00,
  `hr_rating` decimal(3,2) DEFAULT 0.00,
  `final_rating` decimal(3,2) DEFAULT 0.00,
  `self_comment` text DEFAULT NULL,
  `manager_comment` text DEFAULT NULL,
  `hr_comment` text DEFAULT NULL,
  `strengths` text DEFAULT NULL,
  `weaknesses` text DEFAULT NULL,
  `achievements` text DEFAULT NULL,
  `employee_acknowledgement` tinyint(1) DEFAULT 0,
  `employee_acknowledged_at` datetime DEFAULT NULL,
  `status` enum('Draft','Submitted','Manager_Reviewed','HR_Reviewed','Completed','Acknowledged') DEFAULT 'Draft',
  `goals_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`goals_snapshot`)),
  `kpis_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`kpis_snapshot`)),
  `competencies_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`competencies_snapshot`)),
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `employee_increments` ====================================
CREATE TABLE `employee_increments` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `appraisal_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `current_salary_assignment_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `current_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `increment_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `increment_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `new_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reason` text DEFAULT NULL,
  `performance_score` decimal(3,2) DEFAULT 0.00,
  `effective_date` date NOT NULL,
  `status` enum('Pending','Approved','Rejected','Implemented') DEFAULT 'Pending',
  `approved_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `professional_tax_rules` =================================
CREATE TABLE `professional_tax_rules` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `state` varchar(100) NOT NULL,
  `min_salary` decimal(12,2) NOT NULL,
  `max_salary` decimal(12,2) NOT NULL,
  `tax_amount` decimal(12,2) NOT NULL,
  `effective_from` date NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `hr_tickets` =============================================
CREATE TABLE `hr_tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ticketNo` varchar(255) NOT NULL,
  `empName` varchar(255) NOT NULL,
  `employeeId` int(11) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `priority` varchar(255) DEFAULT 'Medium',
  `assignedTo` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Open',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticketNo` (`ticketNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `shift_master` ===========================================
CREATE TABLE `shift_master` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `shiftCode` varchar(255) NOT NULL,
  `shiftName` varchar(255) NOT NULL,
  `startTime` varchar(255) NOT NULL,
  `endTime` varchar(255) NOT NULL,
  `graceTime` int(11) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `shiftCode` (`shiftCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `ats_applicant_tracking` =================================
CREATE TABLE `ats_applicant_tracking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appId` varchar(255) NOT NULL,
  `candidate` varchar(255) DEFAULT NULL,
  `candidateId` int(11) DEFAULT NULL,
  `jobPosting` varchar(255) DEFAULT NULL,
  `recruitmentId` int(11) DEFAULT NULL,
  `appliedDate` varchar(255) DEFAULT NULL,
  `stage` varchar(255) DEFAULT 'Screening',
  `recruiter` varchar(255) DEFAULT NULL,
  `interviewerId` int(11) DEFAULT NULL,
  `rating` int(11) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'Active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `appId` (`appId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `payroll_deductions` =====================================
CREATE TABLE `payroll_deductions` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `payroll_item_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(100) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `dashboard_widgets` ======================================
CREATE TABLE `dashboard_widgets` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `title` varchar(255) NOT NULL,
  `component_name` varchar(255) NOT NULL,
  `size` enum('Small','Medium','Large','FullWidth') DEFAULT 'Small',
  `min_role_level` int(11) DEFAULT 4,
  `module` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `performance_kpis` =======================================
CREATE TABLE `performance_kpis` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `department_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `performance_master_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `target` varchar(255) DEFAULT NULL,
  `measurement_type` varchar(255) DEFAULT NULL,
  `frequency` enum('Monthly','Quarterly','Half-Yearly','Annual') DEFAULT 'Annual',
  `weight` int(11) DEFAULT 0,
  `actual_achievement` decimal(12,2) DEFAULT 0.00,
  `calculated_score` decimal(12,2) DEFAULT 0.00,
  `status` enum('Pending','In Progress','Achieved','Missed') DEFAULT 'Pending',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `esi_contributions` ======================================
CREATE TABLE `esi_contributions` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `employee_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `payroll_item_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `esi_number` varchar(50) DEFAULT NULL,
  `employee_contribution` decimal(12,2) NOT NULL DEFAULT 0.00,
  `employer_contribution` decimal(12,2) NOT NULL DEFAULT 0.00,
  `gross_wages` decimal(12,2) NOT NULL DEFAULT 0.00,
  `month` varchar(20) NOT NULL,
  `year` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `roles` ==================================================
CREATE TABLE `roles` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `subscriptions` ==========================================
CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `plan` varchar(30) NOT NULL DEFAULT 'Trial',
  `status` varchar(20) NOT NULL DEFAULT 'Trial',
  `trial_start_date` date DEFAULT NULL,
  `trial_end_date` date DEFAULT NULL,
  `subscription_start_date` date DEFAULT NULL,
  `subscription_expiry_date` date DEFAULT NULL,
  `payment_status` varchar(20) DEFAULT 'Pending',
  `payment_gateway` varchar(50) DEFAULT 'Razorpay',
  `payment_id` varchar(100) DEFAULT NULL,
  `order_id` varchar(100) DEFAULT NULL,
  `signature` varchar(255) DEFAULT NULL,
  `invoice_number` varchar(100) DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `subscriptions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
INSERT INTO `subscriptions` (`id`, `tenant_id`, `plan`, `status`, `trial_start_date`, `trial_end_date`, `subscription_start_date`, `subscription_expiry_date`, `payment_status`, `payment_gateway`, `payment_id`, `order_id`, `signature`, `invoice_number`, `amount`, `created_at`, `updated_at`) VALUES
  (1,	3,	'Monthly',	'Pending',	NULL,	NULL,	NULL,	NULL,	'Pending',	'Razorpay',	NULL,	'order_mock_OC926KC31',	NULL,	NULL,	800.00,	'2026-09-17 11:00:06',	'2026-09-17 11:00:06'),
  (2,	3,	'Monthly',	'Pending',	NULL,	NULL,	NULL,	NULL,	'Pending',	'Razorpay',	NULL,	'order_mock_V8DVB4MTC',	NULL,	NULL,	800.00,	'2026-09-17 11:00:15',	'2026-09-17 11:00:15');


-- Table `notifications` ==========================================
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `type` varchar(30) NOT NULL,
  `title` varchar(150) NOT NULL,
  `message` varchar(255) NOT NULL,
  `priority` varchar(20) DEFAULT 'Medium',
  `related_user` varchar(150) DEFAULT NULL,
  `related_module` varchar(50) DEFAULT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `reference_type` varchar(100) DEFAULT NULL,
  `target_roles` varchar(255) DEFAULT 'Super Admin',
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `module` varchar(50) DEFAULT 'General',
  `actor_id` int(11) DEFAULT NULL,
  `actor_name` varchar(150) DEFAULT NULL,
  `actor_role` varchar(50) DEFAULT NULL,
  `action` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notif_tenant_read` (`tenant_id`,`is_read`),
  KEY `idx_notif_module` (`module`),
  KEY `idx_notif_priority` (`priority`),
  KEY `idx_notif_created` (`created_at`),
  KEY `idx_notif_actor` (`actor_id`),
  KEY `idx_notif_actor_role` (`actor_role`),
  KEY `idx_notif_module_actor` (`module`,`actor_role`),
  KEY `idx_master_notif_created` (`created_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
INSERT INTO `notifications` (`id`, `tenant_id`, `user_id`, `type`, `title`, `message`, `priority`, `related_user`, `related_module`, `reference_id`, `reference_type`, `target_roles`, `is_read`, `created_at`, `updated_at`, `module`, `actor_id`, `actor_name`, `actor_role`, `action`) VALUES
  (1,	NULL,	NULL,	'User Login',	'Super Admin Login',	'Super Admin logged in successfully from IP ::1.',	'Low',	'superadmin@kiranamart.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-12 20:44:54',	'2026-09-12 20:44:54',	'Auth',	NULL,	'superadmin@kiranamart.com',	'System',	'User Login'),
  (2,	NULL,	1,	'User Logout',	'Super Admin Logout',	'Super Admin logged out.',	'Low',	'superadmin@kiranamart.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-12 20:51:51',	'2026-09-12 20:51:51',	'Auth',	1,	'superadmin@kiranamart.com',	'Super Admin',	'User Logout'),
  (3,	NULL,	NULL,	'User Login',	'Super Admin Login',	'Super Admin logged in successfully from IP ::1.',	'Low',	'superadmin@kiranamart.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-12 20:54:49',	'2026-09-12 20:54:49',	'Auth',	NULL,	'superadmin@kiranamart.com',	'System',	'User Login'),
  (4,	NULL,	NULL,	'New Store Registered',	'? New Merchant Store Registered',	'Merchant \"Aman Mart\" (Aman Jain) registered for 7-Day Free Trial.',	'High',	'aman@kirana.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-12 21:19:31',	'2026-09-12 21:19:31',	'Auth',	NULL,	'aman@kirana.com',	'System',	'New Store Registered'),
  (5,	NULL,	NULL,	'User Login',	'Super Admin Login',	'Super Admin logged in successfully from IP ::1.',	'Low',	'superadmin@kiranamart.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-12 21:20:28',	'2026-09-12 21:20:28',	'Auth',	NULL,	'superadmin@kiranamart.com',	'System',	'User Login'),
  (6,	1,	1,	'Subscription',	'Subscription Status Active',	'Tenant subscription status updated to \"Active\" (Plan: \"Trial\") by Super Admin.',	'High',	'Super Admin',	'Billing',	NULL,	NULL,	'Super Admin',	0,	'2026-09-12 21:21:06',	'2026-09-12 21:21:06',	'Billing',	1,	'Super Admin',	'Super Admin',	'Subscription'),
  (7,	1,	1,	'Subscription',	'Subscription Status Active',	'Tenant subscription status updated to \"Active\" (Plan: \"Trial\") by Super Admin.',	'High',	'Super Admin',	'Billing',	NULL,	NULL,	'Super Admin',	0,	'2026-09-12 21:21:23',	'2026-09-12 21:21:23',	'Billing',	1,	'Super Admin',	'Super Admin',	'Subscription'),
  (8,	NULL,	1,	'User Logout',	'Super Admin Logout',	'Super Admin logged out.',	'Low',	'superadmin@kiranamart.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-12 21:22:57',	'2026-09-12 21:22:57',	'Auth',	1,	'superadmin@kiranamart.com',	'Super Admin',	'User Logout'),
  (9,	NULL,	NULL,	'New Store Registered',	'? New Merchant Store Registered',	'Merchant \"Hari kirana\" (Hariom) registered for 7-Day Free Trial.',	'High',	'hariom@gmail.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-16 06:00:54',	'2026-09-16 06:00:54',	'Auth',	NULL,	'hariom@gmail.com',	'System',	'New Store Registered'),
  (10,	NULL,	NULL,	'Failed Login',	'Failed Login Attempt',	'Failed login attempt for unrecognized email/ID: \"as97529066@gmail.com\".',	'High',	'as97529066@gmail.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-16 07:22:32',	'2026-09-16 07:22:32',	'Auth',	NULL,	'as97529066@gmail.com',	'System',	'Failed Login'),
  (11,	NULL,	NULL,	'Failed Login',	'Failed Login Attempt',	'Failed login attempt for unrecognized email/ID: \"ajay@gmail.com\".',	'High',	'ajay@gmail.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-16 07:23:24',	'2026-09-16 07:23:24',	'Auth',	NULL,	'ajay@gmail.com',	'System',	'Failed Login'),
  (12,	NULL,	NULL,	'Failed Login',	'Failed Login Attempt',	'Failed login attempt for unrecognized email/ID: \"ajay@gmail.com\".',	'High',	'ajay@gmail.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-16 07:23:42',	'2026-09-16 07:23:42',	'Auth',	NULL,	'ajay@gmail.com',	'System',	'Failed Login'),
  (13,	NULL,	NULL,	'New Store Registered',	'? New Merchant Store Registered',	'Merchant \"Abhishek ki dukaan\" (Abhishek) registered for 7-Day Free Trial.',	'High',	'abhishek@gmail.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-16 07:25:05',	'2026-09-16 07:25:05',	'Auth',	NULL,	'abhishek@gmail.com',	'System',	'New Store Registered'),
  (14,	NULL,	NULL,	'Failed Login',	'Failed Login Attempt',	'Failed login attempt for unrecognized email/ID: \"as97529066@gmail.com\".',	'High',	'as97529066@gmail.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-17 09:54:31',	'2026-09-17 09:54:31',	'Auth',	NULL,	'as97529066@gmail.com',	'System',	'Failed Login'),
  (15,	NULL,	NULL,	'Failed Login',	'Failed Login Attempt',	'Failed login attempt for unrecognized email/ID: \"ajay@gmail.com\".',	'High',	'ajay@gmail.com',	'Auth',	NULL,	NULL,	'Super Admin',	0,	'2026-09-17 10:16:35',	'2026-09-17 10:16:35',	'Auth',	NULL,	'ajay@gmail.com',	'System',	'Failed Login');


-- Table `billing_history` ========================================
CREATE TABLE `billing_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `transaction_id` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `plan` varchar(30) NOT NULL,
  `payment_status` varchar(20) DEFAULT 'Paid',
  `billing_date` date NOT NULL,
  `next_renewal_date` date NOT NULL,
  `payment_method` varchar(50) NOT NULL DEFAULT 'AutoPay',
  `invoice_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `billing_history_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--


-- Table `users` ==================================================
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `login_id` varchar(50) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL,
  `status` varchar(20) DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `phone` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` timestamp NULL DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `login_id` (`login_id`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_login_id` (`login_id`),
  KEY `idx_users_tenant_role` (`tenant_id`,`role`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
INSERT INTO `users` (`id`, `tenant_id`, `email`, `login_id`, `password`, `role`, `status`, `created_at`, `updated_at`, `phone`, `address`, `reset_token`, `reset_token_expires`, `last_login`) VALUES
  (1,	NULL,	'superadmin@kiranamart.com',	'superadmin',	'$2a$10$QOxUFlvtV/EBNYxfsd145exUE0GeigP0RQNWf5VLgrDVsagVUY1Yi',	'Super Admin',	'Active',	'2026-07-10 06:52:21',	'2026-09-15 17:44:12',	NULL,	NULL,	NULL,	NULL,	'2026-09-12 21:20:28'),
  (2,	1,	'aman@kirana.com',	'AMAN001',	'$2a$10$W1/w1EvgZUUg4zf3R6AIIOi3z7emhKcE0zfob/iYRfP7tZCgyxx7y',	'Admin',	'Active',	'2026-09-12 21:19:29',	'2026-09-12 21:23:07',	NULL,	NULL,	NULL,	NULL,	'2026-09-12 21:23:07'),
  (3,	1,	'dheeraj@gmail.com',	'AMAN001-EM0001',	'$2a$10$JHez78jZ335tWvjklHsI9eraMqJVJ4V87Kxjuo76wELJ6IOME3kxS',	'Employee',	'Active',	'2026-09-15 23:42:16',	'2026-09-15 23:42:16',	NULL,	NULL,	NULL,	NULL,	NULL),
  (4,	1,	'pawan@gmail.com',	'AMAN001-PM0001',	'$2a$10$m4twYrLU7eSXouyL0Iz85./6v.WMUbloEvhCjHubVCAYwf1i8/8Um',	'Employee',	'Active',	'2026-09-15 23:45:35',	'2026-09-15 23:45:35',	NULL,	NULL,	NULL,	NULL,	NULL),
  (5,	2,	'hariom@gmail.com',	'HARIOM001',	'$2a$10$GGEnIfg27MjXEzvQ3i69rutVkgOv4ruagbgVsUH9US0G0WqxKhPKG',	'Admin',	'Active',	'2026-09-16 06:00:54',	'2026-09-16 06:00:54',	NULL,	NULL,	NULL,	NULL,	NULL),
  (6,	3,	'abhishek@gmail.com',	'ABHISHEK001',	'$2a$10$Ob6kUYUqrxatjvW1Jv5GVue8w/vLL56jMbJ6QGoXIHUj.nl4LwdHy',	'Admin',	'Active',	'2026-09-16 07:25:04',	'2026-09-17 10:16:51',	NULL,	NULL,	NULL,	NULL,	'2026-09-17 10:16:51');


-- Table `subscription_logs` ======================================
CREATE TABLE `subscription_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `subscription_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
INSERT INTO `subscription_logs` (`id`, `tenant_id`, `action`, `description`, `created_at`) VALUES
  (1,	1,	'Trial Started',	'7-Day Free Trial automatically activated on first successful login.',	'2026-09-12 21:20:12'),
  (2,	1,	'EXTEND',	'Manual SuperAdmin Override Action: EXTEND on plan Trial.',	'2026-09-12 21:21:06'),
  (3,	1,	'EXTEND',	'Manual SuperAdmin Override Action: EXTEND on plan Trial.',	'2026-09-12 21:21:23'),
  (4,	3,	'Trial Started',	'7-Day Free Trial automatically activated on first successful login.',	'2026-09-17 09:54:55');


-- Table `activity_logs` ==========================================
CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(50) NOT NULL,
  `details` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `user_name` varchar(150) DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `department` varchar(50) DEFAULT NULL,
  `record_id` varchar(100) DEFAULT NULL,
  `previous_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `device_info` varchar(255) DEFAULT NULL,
  `session_id` varchar(100) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Success',
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `user_id` (`user_id`),
  KEY `idx_master_logs_created` (`created_at`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
INSERT INTO `activity_logs` (`id`, `tenant_id`, `user_id`, `action`, `module`, `details`, `ip_address`, `created_at`, `user_name`, `role`, `department`, `record_id`, `previous_value`, `new_value`, `device_info`, `session_id`, `status`) VALUES
  (1,	NULL,	1,	'User Login Success',	'Auth',	'Super Admin logged in.',	'::1',	'2026-09-12 20:44:54',	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	'Success'),
  (2,	NULL,	1,	'User Login Success',	'Auth',	'Super Admin logged in.',	'::1',	'2026-09-12 20:54:49',	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	'Success'),
  (3,	NULL,	1,	'User Login Success',	'Auth',	'Super Admin logged in.',	'::1',	'2026-09-12 21:20:28',	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	'Success'),
  (4,	NULL,	1,	'Adjust Stock',	'Stock',	'Created Stock Adjustment ADJ-85130370 for \"Dairy Milk\": Increase 10 Pcs @ ₹35.5 (Valuation: ₹355, Impact: Gain)',	NULL,	'2026-09-15 19:17:31',	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	NULL,	'Success');



/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;

-- Dump completed on: Mon, 21 Sep 2026 07:55:32 +0100
